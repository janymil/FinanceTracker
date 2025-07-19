import { Router, Request, Response } from "express";
import { requireAuth } from "@clerk/express";
import { z } from "zod";
import { runAI } from "../../lib/aiProcessor";
import { db } from "../db";
import { categories, aiUsage, users } from "../../shared/schema";
import { eq, and, sql, gte } from "drizzle-orm";

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
    const startTime = Date.now();
    
    try {
      const { transcript, language, timezone } = voiceProcessSchema.parse(req.body);
      const userId = req.auth?.userId;
      
      console.log('🎯 [VoiceAPI] Processing voice input:', {
        userId: userId?.substring(0, 8) + '...',
        transcript: transcript,
        language,
        timezone,
        transcriptLength: transcript.length,
        timestamp: new Date().toISOString()
      });
      
      if (!userId) {
        console.error('❌ [VoiceAPI] Unauthorized request');
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
      
      console.log('📂 [VoiceAPI] Categories loaded:', {
        systemCategories: systemCategories.length,
        userCategories: userCategories.length,
        totalCategories: allCategories.length
      });

      // Build the extraction prompt with stricter JSON formatting
      const currentDate = new Date().toISOString();
      const prompt = `CRITICAL: You must respond with ONLY valid JSON. No explanations, no markdown, no additional text.

Extract financial transaction details from this voice transcript:
"${transcript}"

Context:
- User Language: ${language}
- Current Date: ${currentDate}
- User Timezone: ${timezone || 'UTC'}

Available Categories:
${allCategories.map(cat => `- ${cat.name} (ID: ${cat.id})`).join('\n')}

STRICT INSTRUCTIONS:
1. Return ONLY valid JSON - no markdown code blocks, no explanations
2. Extract amount, vendor, category, date, and type from the transcript
3. Match to existing categories by ID when possible
4. Parse natural dates like "yesterday", "last week"
5. Determine if income or expense based on context

JSON RESPONSE FORMAT (respond with exactly this structure):
{
  "amount": 52.00,
  "currency": "USD",
  "vendor": "Walmart",
  "description": "groceries",
  "categoryId": 15,
  "categoryName": "Food & Groceries",
  "dateReference": "today",
  "parsedDate": "2025-07-19",
  "type": "expense",
  "isRecurring": false,
  "recurringFrequency": null,
  "confidence": 0.9,
  "ambiguities": [],
  "followUpQuestions": []
}

CRITICAL: Respond with valid JSON only. No \`\`\`json blocks, no explanations, just the JSON object.`;

      // Use external AI processor service with fallback to local OpenAI
      let completion;
      let aiProcessingTime = 0;
      const aiStartTime = Date.now();
      
      try {
        const AI_PROCESSOR_URL = process.env.AI_PROCESSOR_URL || 'http://31.97.103.28:8080';
        
        console.log('🤖 [VoiceAPI] Calling external AI processor:', {
          url: AI_PROCESSOR_URL,
          model: 'gpt-4o-mini',
          promptLength: prompt.length,
          timeout: '30s'
        });
        
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
          throw new Error(`AI processor responded with ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        completion = data.result || data.completion;
        aiProcessingTime = Date.now() - aiStartTime;
        
        console.log('🎉 [VoiceAPI] External AI processing successful:', {
          processingTime: `${aiProcessingTime}ms`,
          responseSize: JSON.stringify(data).length,
          hasResult: !!completion
        });
        
      } catch (aiProcessorError) {
        aiProcessingTime = Date.now() - aiStartTime;
        console.warn('⚠️ [VoiceAPI] External AI processor failed, using fallback:', {
          error: aiProcessorError.message,
          processingTime: `${aiProcessingTime}ms`,
          fallbackMethod: 'local OpenAI'
        });
        
        const fallbackStartTime = Date.now();
        completion = await runAI("voice-extraction", userId, { prompt }, "free");
        const fallbackTime = Date.now() - fallbackStartTime;
        
        console.log('🔄 [VoiceAPI] Fallback processing completed:', {
          fallbackTime: `${fallbackTime}ms`,
          totalTime: `${Date.now() - aiStartTime}ms`
        });
      }
      
      let extractedData;
      try {
        // Parse the AI response with cleanup
        console.log('🔍 [VoiceAPI] Parsing AI response:', {
          rawResponse: completion,
          responseLength: completion?.length
        });
        
        // Clean up AI response - remove markdown code blocks if present
        let cleanedResponse = completion;
        if (typeof completion === 'string') {
          cleanedResponse = completion
            .replace(/```json\s*/g, '') // Remove ```json
            .replace(/```\s*/g, '')     // Remove ```
            .trim();
        }
        
        extractedData = JSON.parse(cleanedResponse);
        
        console.log('✅ [VoiceAPI] AI response parsed successfully:', {
          hasAmount: !!extractedData.amount,
          hasVendor: !!extractedData.vendor,
          hasType: !!extractedData.type,
          confidence: extractedData.confidence,
          ambiguities: extractedData.ambiguities?.length || 0
        });
        
      } catch (error) {
        console.error('💥 [VoiceAPI] Failed to parse AI response:', {
          error: error.message,
          rawResponse: completion,
          responseType: typeof completion
        });
        
        // Return a fallback response instead of failing completely
        extractedData = {
          amount: null,
          currency: "USD",
          vendor: null,
          description: transcript,
          categoryId: null,
          categoryName: null,
          dateReference: "today",
          parsedDate: new Date().toISOString().split('T')[0],
          type: "expense",
          isRecurring: false,
          recurringFrequency: null,
          confidence: 0.3,
          ambiguities: ["Failed to parse AI response - manual review needed"],
          followUpQuestions: ["Please verify the transaction details"]
        };
        
        console.log('🔄 [VoiceAPI] Using fallback extracted data');
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

      const totalTime = Date.now() - startTime;
      
      console.log('🚀 [VoiceAPI] Voice processing completed successfully:', {
        totalProcessingTime: `${totalTime}ms`,
        aiProcessingTime: `${aiProcessingTime}ms`,
        finalConfidence: extractedData.confidence,
        extractedFields: Object.keys(extractedData).filter(key => extractedData[key] !== null && extractedData[key] !== undefined),
        userId: userId?.substring(0, 8) + '...',
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        data: extractedData,
        transcript: transcript,
        processingTime: totalTime
      });

    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error('💥 [VoiceAPI] Voice processing failed:', {
        error: error.message,
        stack: error.stack,
        totalTime: `${totalTime}ms`,
        userId: userId?.substring(0, 8) + '...',
        timestamp: new Date().toISOString()
      });
      
      res.status(500).json({ 
        error: "Failed to process voice input",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get current month voice usage for free users
  router.get('/usage', requireAuth(), async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;
      
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get user's plan
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (!user[0]) {
        return res.status(404).json({ error: "User not found" });
      }

      // Only track usage for free users
      if (user[0].plan !== 'free') {
        return res.json({
          currentMonthUsage: 0,
          maxUsage: -1, // Unlimited
          remainingUsage: -1 // Unlimited
        });
      }

      // Get current month usage
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const usage = await db
        .select({ count: sql<number>`count(*)` })
        .from(aiUsage)
        .where(
          and(
            eq(aiUsage.userId, userId),
            eq(aiUsage.functionName, 'voice-input'),
            gte(aiUsage.createdAt, startOfMonth)
          )
        );

      const currentMonthUsage = usage[0]?.count || 0;
      const maxUsage = 5; // Free users get 5 voice inputs per month
      const remainingUsage = Math.max(0, maxUsage - currentMonthUsage);

      res.json({
        currentMonthUsage,
        maxUsage,
        remainingUsage
      });

    } catch (error) {
      console.error("Voice usage check error:", error);
      res.status(500).json({ error: "Failed to check voice usage" });
    }
  });

  // Track voice input usage
  router.post('/track-usage', requireAuth(), async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;
      const { transcript, plan } = req.body;
      
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Only track usage for free users
      if (plan === 'free') {
        await db.insert(aiUsage).values({
          userId,
          functionName: 'voice-input',
          tokensUsed: Math.ceil(transcript / 4), // Approximate tokens
          cost: "0.000000", // Free tier
          model: 'voice-recognition',
          requestSize: transcript,
          responseSize: 0,
          plan: plan,
          status: 'success'
        });
      }

      res.json({ success: true });

    } catch (error) {
      console.error("Voice usage tracking error:", error);
      res.status(500).json({ error: "Failed to track voice usage" });
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