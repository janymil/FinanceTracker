import { Router, Request, Response } from "express";
import { requireAuth } from "@clerk/express";
import { z } from "zod";
import { runAI } from "../../lib/aiProcessor";
import { getMerchantContextForAI, getCountryFromLanguage } from "../../lib/merchantLookup";
import { getLanguageLabel } from "../../lib/languageUtils";
import { db } from "../db";
import { categories, aiUsage, users, transactions } from "../../shared/schema";
import { eq, and, sql, gte, or, desc } from "drizzle-orm";
import { storage } from "../storage";
import { 
  extractAmountFromText, 
  extractVendorFromText, 
  extractDescriptionFromText, 
  extractTransactionType,
  parseDateReference,
  calculateConfidence 
} from "./voiceRoutes_helpers";

const voiceProcessSchema = z.object({
  transcript: z.string().min(1),
  language: z.string().default("en-us"),
  timezone: z.string().optional(),
  sessionId: z.string().optional(),
  context: z.object({}).optional(), // Conversation context
});

// Removed conversation and seamless schemas - keeping only simple voice input

export function registerVoiceRoutes(app: Router) {
  const router = Router();

  // Process voice transcript to extract transaction data
  router.post('/process', requireAuth(), async (req: Request, res: Response) => {
    const startTime = Date.now();
    let userId: string | undefined;
    
    try {
      const { transcript, language, timezone } = voiceProcessSchema.parse(req.body);
      userId = req.auth?.userId;
      
      console.log('🎯 [VoiceAPI] Processing voice input:', {
        userId: (userId || 'unknown').substring(0, 8) + '...',
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

      // Get user for plan info
      const user = await storage.getUser(userId);
      
      if (!user) {
        console.error('❌ [VoiceAPI] User not found in database');
        return res.status(404).json({ error: "User not found" });
      }

      // FAST category lookup - parallel queries
      const [userCategories, systemCategories] = await Promise.all([
        db.select().from(categories).where(
          and(eq(categories.type, 'expense'), eq(categories.userId, userId))
        ).limit(10), // Limit for speed
        db.select().from(categories).where(
          and(eq(categories.type, 'expense'), eq(categories.userId, null as any))
        ).limit(20) // Limit system categories for speed
      ]);

      const allCategories = [...systemCategories, ...userCategories];
      
      console.log('📂 [VoiceAPI] Categories loaded:', {
        systemCategories: systemCategories.length,
        userCategories: userCategories.length,
        totalCategories: allCategories.length,
        allCategoriesList: allCategories.map(cat => `${cat.name} (ID: ${cat.id})`)
      });

      // FAST extraction - parse transcript directly first
      let extractedData;
      const currentDate = new Date().toISOString().split('T')[0];
      
      try {
        // Step 1: FAST direct parsing with user's currency - NO TYPE DEFAULT!
        extractedData = {
          amount: extractAmountFromText(transcript, user.currency || '$'),
          vendor: extractVendorFromText(transcript),
          description: extractDescriptionFromText(transcript), // Better description extraction
          type: extractTransactionType(transcript), // Only set if explicitly mentioned (income/expense/salary/etc)
          dateReference: 'today',
          parsedDate: currentDate,
          categoryId: null,
          categoryName: null,
          confidence: 0.8,
          currency: user.currency || '$'
        };

        // Step 2: ONLY use AI for categorization if vendor is found but no category
        if (extractedData.vendor && !extractedData.categoryId) {
          console.log('🤖 [VoiceAPI] Using AI for categorization only:', extractedData.vendor);
          
          const categorizationPrompt = `ONLY categorize this merchant: "${extractedData.vendor}"
Available categories: ${allCategories.map(cat => `${cat.name} (ID: ${cat.id})`).join(', ')}
Respond ONLY with JSON: {"categoryId": number|null, "categoryName": "string"|null}`;
          
          try {
            const AI_PROCESSOR_URL = process.env.AI_PROCESSOR_URL || 'http://31.97.103.28:8080';
            const response = await fetch(`${AI_PROCESSOR_URL}/api/ai/voice-extract`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.AI_PROCESSOR_TOKEN || 'default'}`,
              },
              body: JSON.stringify({
                prompt: categorizationPrompt,
                userId,
                model: 'gpt-4o-mini', // Fast model for simple categorization
                language
              }),
              signal: AbortSignal.timeout(5000) // FAST 5-second timeout
            });

            if (response.ok) {
              const aiResult = await response.json();
              const categoryData = JSON.parse(aiResult.result || aiResult.completion);
              extractedData.categoryId = categoryData.categoryId;
              extractedData.categoryName = categoryData.categoryName;
            }
          } catch (aiError) {
            console.log('⚡ [VoiceAPI] AI categorization skipped, user will choose manually');
            // Continue without AI categorization - user can select manually
          }
        }
        
        console.log('⚡ [VoiceAPI] FAST processing completed:', extractedData);
        
      } catch (parseError) {
        console.error('❌ [VoiceAPI] Fast parsing failed, using fallback');
        // Fallback - NO TYPE DEFAULT! Must be explicitly detected
        extractedData = {
          amount: null,
          vendor: null,
          description: transcript,
          type: null, // No default - must be explicitly mentioned by user
          categoryId: null,
          categoryName: null,
          confidence: 0.3
        };
      }

      // Validate and enhance the extracted data
      if (extractedData.amount && typeof extractedData.amount === 'string') {
        extractedData.amount = parseFloat(extractedData.amount);
      }

      // Parse date references
      if (extractedData.dateReference && !extractedData.parsedDate) {
        extractedData.parsedDate = parseDateReference(extractedData.dateReference, timezone);
      }

      // Do NOT set default type - user must specify expense or income

      if (!extractedData.confidence) {
        extractedData.confidence = calculateConfidence(extractedData);
      }

      // Category validation - if confidence is low, clear category to let user choose
      if (extractedData.categoryId && extractedData.confidence < 0.7) {
        console.log('⚠️ [VoiceAPI] Low confidence category match, clearing category for user selection:', {
          originalCategory: extractedData.categoryName,
          confidence: extractedData.confidence
        });
        extractedData.categoryId = null;
        extractedData.categoryName = null;
        extractedData.ambiguities = extractedData.ambiguities || [];
        extractedData.ambiguities.push('Category match uncertain - please select manually');
      }

      const totalTime = Date.now() - startTime;
      
      console.log('🚀 [VoiceAPI] Voice processing completed successfully:', {
        totalProcessingTime: `${totalTime}ms`,
        finalConfidence: extractedData.confidence,
        extractedFields: Object.keys(extractedData).filter(key => extractedData[key] !== null && extractedData[key] !== undefined),
        userId: (userId || 'unknown').substring(0, 8) + '...',
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
        userId: (userId || 'unknown').substring(0, 8) + '...',
        timestamp: new Date().toISOString()
      });
      
      res.status(500).json({ 
        error: "Failed to process voice input",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Conversation endpoint for voice conversation component  
  router.post('/conversation', requireAuth(), async (req: Request, res: Response) => {
    try {
      const { transcript, sessionId, currentData, userLanguage, userCurrency } = req.body;
      const userId = req.auth?.userId;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      console.log('🗣️ [VoiceConversation] Processing transcript:', transcript);
      console.log('🗣️ [VoiceConversation] Current data:', currentData);

      // Process transcript using AI to extract/update transaction data
      const prompt = `
VOICE CONVERSATION PROCESSOR
============================

CURRENT TRANSACTION DATA: ${JSON.stringify(currentData)}
NEW USER INPUT: "${transcript}"

TASK: Update transaction data with new information from user input.

RULES:
1. PRESERVE existing data unless user is correcting/updating it
2. Extract new information from transcript
3. NEVER automatically set date to today unless user specifically mentions "today"
4. If user says amount, extract it to amount field
5. If user describes what the transaction was for, extract it to description field

RESPONSE FORMAT (JSON only):
{
  "amount": number | null,
  "description": "string" | null,
  "type": "income" | "expense" | null,
  "categoryId": number | null,
  "categoryName": "string" | null,
  "date": "YYYY-MM-DD" | null,
  "note": "string" | null
}

IMPORTANT: Only update fields that the user provided new information for. Keep existing values for all other fields.
`;

      // Use AI to process the conversation
      const aiResult = await runAI("voice-conversation", userId, {
        prompt,
        language: userLanguage
      }, "free");

      let updatedData;
      try {
        updatedData = typeof aiResult === 'string' ? JSON.parse(aiResult) : aiResult;
      } catch {
        // Fallback: return current data unchanged if AI fails
        updatedData = currentData;
      }

      // Ensure we preserve existing data
      const finalData = {
        amount: updatedData.amount !== undefined ? updatedData.amount : currentData.amount,
        description: updatedData.description !== undefined ? updatedData.description : currentData.description,
        type: updatedData.type !== undefined ? updatedData.type : currentData.type,
        categoryId: updatedData.categoryId !== undefined ? updatedData.categoryId : currentData.categoryId,
        categoryName: updatedData.categoryName !== undefined ? updatedData.categoryName : currentData.categoryName,
        date: updatedData.date !== undefined ? updatedData.date : currentData.date,
        note: updatedData.note !== undefined ? updatedData.note : currentData.note
      };

      // Check completion
      const isComplete = finalData.amount !== null && finalData.description !== null && finalData.date !== null;

      // Generate next question
      let nextQuestion = null;
      if (!isComplete) {
        if (finalData.amount === null) {
          nextQuestion = "How much was it?";
        } else if (finalData.description === null) {
          nextQuestion = `What was this ${userCurrency}${finalData.amount} for?`;
        } else if (finalData.date === null) {
          nextQuestion = "When did this happen? Today or another day?";
        }
      }

      console.log('✅ [VoiceConversation] Final data:', finalData);

      res.json({
        success: true,
        data: finalData,
        isComplete,
        nextQuestion
      });

    } catch (error) {
      console.error('💥 [VoiceConversation] Error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Processing failed"
      });
    }
  });

  // Complete endpoint to save transaction
  router.post('/complete', requireAuth(), async (req: Request, res: Response) => {
    try {
      const { transactionData, sessionId, userLanguage } = req.body;
      const userId = req.auth?.userId;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      console.log('💾 [VoiceComplete] Saving:', transactionData);

      // Save transaction to database
      const insertResult = await db.insert(transactions).values({
        userId,
        amount: transactionData.amount,
        description: transactionData.description,
        type: transactionData.type || 'expense',
        categoryId: transactionData.categoryId || null,
        date: transactionData.date || new Date().toISOString().split('T')[0],
        notes: transactionData.note || null,
        isRecurring: false,
        paymentUrl: null
      }).returning();

      console.log('✅ [VoiceComplete] Saved transaction:', insertResult[0].id);

      res.json({
        success: true,
        transaction: insertResult[0]
      });

    } catch (error) {
      console.error('💥 [VoiceComplete] Error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Save failed"
      });
    }
  });

  app.use('/api/voice', router);
}
