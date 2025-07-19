import { Router, Request, Response } from "express";
import { requireAuth } from "@clerk/express";
import { z } from "zod";
import { openaiRequest } from "../openai";
import { db } from "../db";
import { categories } from "../../shared/schema";
import { eq, and } from "drizzle-orm";

const voiceProcessSchema = z.object({
  transcript: z.string().min(1),
  language: z.string().default("en-us"),
  timezone: z.string().optional(),
  sessionId: z.string().optional(),
});

export function registerVoiceRoutes(app: Router) {
  const router = Router();

  // Process voice transcript to extract transaction data
  router.post('/process', requireAuth(), async (req: Request, res: Response) => {
    try {
      const { transcript, language, timezone } = voiceProcessSchema.parse(req.body);
      const userId = req.auth?.userId;
      
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get user's categories for better categorization
      const userCategories = await db
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.type, 'expense'),
            // Include both predefined and user categories
            eq(categories.userId, userId)
          )
        );

      const systemCategories = await db
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.type, 'expense'),
            eq(categories.userId, null as any) // Predefined categories
          )
        );

      const allCategories = [...systemCategories, ...userCategories];

      // Build the extraction prompt
      const currentDate = new Date().toISOString();
      const prompt = `Extract financial transaction details from the following voice transcript.

Voice Transcript: "${transcript}"
User Language: ${language}
Current Date: ${currentDate}
User Timezone: ${timezone || 'UTC'}

Available expense categories:
${allCategories.map(cat => `- ${cat.name} (ID: ${cat.id})`).join('\n')}

Instructions:
1. Extract the transaction amount, vendor/description, category, and date
2. Determine if this is income or expense
3. Parse natural date references (e.g., "yesterday", "last week", "on Monday")
4. Match to the most appropriate category from the list above
5. If recurring is mentioned, extract frequency

Return ONLY a valid JSON object with this exact structure:
{
  "amount": number | null,
  "currency": "USD" | "EUR" | "PEN" | null,
  "vendor": string | null,
  "description": string | null,
  "categoryId": number | null,
  "categoryName": string | null,
  "dateReference": string | null,
  "parsedDate": "YYYY-MM-DD" | null,
  "type": "income" | "expense" | null,
  "isRecurring": boolean,
  "recurringFrequency": "weekly" | "monthly" | "yearly" | null,
  "confidence": number (0.0-1.0),
  "ambiguities": string[],
  "followUpQuestions": string[]
}

Examples:
- "I spent fifty two dollars at Walmart for groceries" → {amount: 52, vendor: "Walmart", type: "expense", description: "groceries"}
- "Got my salary of three thousand yesterday" → {amount: 3000, type: "income", dateReference: "yesterday", description: "salary"}
- "Coffee this morning at Starbucks" → {vendor: "Starbucks", dateReference: "this morning", type: "expense", ambiguities: ["amount"]}`;

      // Use external AI processor service with fallback to local OpenAI
      let completion;
      try {
        const AI_PROCESSOR_URL = process.env.AI_PROCESSOR_URL || 'http://31.97.103.28:8080';
        const response = await fetch(`${AI_PROCESSOR_URL}/api/ai/voice-extract`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.AI_PROCESSOR_TOKEN || 'default'}`,
          },
          body: JSON.stringify({
            prompt,
            userId,
            model: 'gpt-4o-mini'
          }),
          signal: AbortSignal.timeout(30000) // 30 second timeout
        });

        if (!response.ok) {
          throw new Error(`AI processor responded with ${response.status}`);
        }

        const data = await response.json();
        completion = data.result || data.completion;
      } catch (aiProcessorError) {
        console.warn('AI processor service unavailable, falling back to direct OpenAI:', aiProcessorError);
        completion = await openaiRequest(prompt, userId, "voice-extraction");
      }
      
      let extractedData;
      try {
        // Parse the AI response
        extractedData = JSON.parse(completion);
      } catch (error) {
        console.error("Failed to parse AI response:", completion);
        return res.status(500).json({ 
          error: "Failed to parse transaction data",
          rawResponse: completion 
        });
      }

      // Validate and enhance the extracted data
      if (extractedData.amount && typeof extractedData.amount === 'string') {
        extractedData.amount = parseFloat(extractedData.amount);
      }

      // Parse date references
      if (extractedData.dateReference && !extractedData.parsedDate) {
        extractedData.parsedDate = parseDateReference(extractedData.dateReference, timezone);
      }

      // Set default values
      if (!extractedData.type && extractedData.amount) {
        // Default to expense if not specified
        extractedData.type = 'expense';
      }

      if (!extractedData.confidence) {
        extractedData.confidence = calculateConfidence(extractedData);
      }

      res.json({
        success: true,
        data: extractedData,
        transcript: transcript
      });

    } catch (error) {
      console.error("Voice processing error:", error);
      res.status(500).json({ 
        error: "Failed to process voice input",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.use('/api/voice', router);
}

// Helper function to parse natural date references
function parseDateReference(reference: string, timezone?: string): string {
  const today = new Date();
  const lowerRef = reference.toLowerCase();
  
  // Handle relative dates
  if (lowerRef === 'today') {
    return today.toISOString().split('T')[0];
  } else if (lowerRef === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  } else if (lowerRef.includes('last week')) {
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    return lastWeek.toISOString().split('T')[0];
  } else if (lowerRef === 'this morning' || lowerRef === 'this afternoon') {
    return today.toISOString().split('T')[0];
  }
  
  // Default to today if can't parse
  return today.toISOString().split('T')[0];
}

// Calculate confidence based on extracted fields
function calculateConfidence(data: any): number {
  let confidence = 1.0;
  const requiredFields = ['amount', 'type', 'description'];
  
  for (const field of requiredFields) {
    if (!data[field]) {
      confidence -= 0.25;
    }
  }
  
  if (data.ambiguities && data.ambiguities.length > 0) {
    confidence -= 0.1 * data.ambiguities.length;
  }
  
  return Math.max(0, Math.min(1, confidence));
}