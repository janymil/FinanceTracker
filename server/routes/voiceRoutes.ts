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

  // Conversation endpoint - minimal implementation for data persistence
  router.post('/conversation', requireAuth(), async (req: Request, res: Response) => {
    try {
      const { transcript, currentData } = req.body;
      const userId = req.auth?.userId;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Echo back the current data unchanged for now - frontend handles logic
      res.json({
        success: true,
        data: currentData,
        isComplete: false,
        nextQuestion: null
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Processing failed"
      });
    }
  });

  // Complete endpoint - save transaction
  router.post('/complete', requireAuth(), async (req: Request, res: Response) => {
    try {
      const { transactionData } = req.body;
      const userId = req.auth?.userId;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Save transaction
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

      res.json({
        success: true,
        transaction: insertResult[0]
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Save failed"
      });
    }
  });

  app.use('/api/voice', router);
}
