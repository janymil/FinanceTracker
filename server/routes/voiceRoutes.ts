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

const voiceProcessSchema = z.object({
  transcript: z.string().min(1),
  language: z.string().default("en-us"),
  timezone: z.string().optional(),
  sessionId: z.string().optional(),
  context: z.object({}).optional(), // Conversation context
});

const conversationProcessSchema = z.object({
  transcript: z.string().min(1),
  sessionId: z.string(),
  context: z.object({
    extractedData: z.object({}).optional(),
    missingFields: z.array(z.string()).optional(),
  }).optional(),
});

const seamlessProcessSchema = z.object({
  transcript: z.string().min(1),
  sessionId: z.string(),
  extractedData: z.object({}).optional(),
  messages: z.array(z.object({
    role: z.string(),
    content: z.string()
  })).optional()
});

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
        // Step 1: FAST direct parsing without AI
        extractedData = {
          amount: parseAmountFromText(transcript),
          vendor: parseVendorFromText(transcript),
          description: transcript.trim(),
          type: 'expense', // Default
          dateReference: 'today',
          parsedDate: currentDate,
          categoryId: null,
          categoryName: null,
          confidence: 0.8
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
        // Fallback to original AI processing only if fast parsing completely fails
        extractedData = {
          amount: null,
          vendor: null,
          description: transcript,
          type: 'expense',
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

      // Set default values
      if (!extractedData.type && extractedData.amount) {
        // Default to expense if not specified
        extractedData.type = 'expense';
      }

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
        aiProcessingTime: `${aiProcessingTime}ms`,
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

  // Conversational voice processing endpoint
  router.post('/conversation', requireAuth(), async (req: Request, res: Response) => {
    try {
      const { transcript, sessionId, context } = conversationProcessSchema.parse(req.body);
      const userId = req.auth?.userId;
      
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      console.log('💬 [VoiceAPI] Processing conversational input:', {
        sessionId,
        transcript: transcript.substring(0, 50) + '...',
        hasContext: !!context
      });

      // SECURITY: Validate transaction-related input only
      const TTSService = await import('../ttsService');
      if (!TTSService.TTSService.isTransactionRelated(transcript)) {
        return res.status(400).json({ 
          error: "Voice input is restricted to transaction-related content only.",
          message: "Please provide transaction information like amount, vendor, or category."
        });
      }

      // SECURITY: Validate session context
      if (!TTSService.TTSService.isValidTransactionSession(sessionId, context?.extractedData)) {
        return res.status(400).json({ 
          error: "Invalid transaction session. Please start a new transaction session.",
          sessionId: null
        });
      }

      // SECURITY: Session timeout (30 minutes)
      const sessionTimestamp = parseInt(sessionId.split('_')[1]);
      const currentTime = Date.now();
      const sessionAge = currentTime - sessionTimestamp;
      const maxSessionAge = 30 * 60 * 1000; // 30 minutes

      if (sessionAge > maxSessionAge) {
        return res.status(400).json({ 
          error: "Session expired. Please start a new transaction session.",
          sessionId: null
        });
      }

      // SECURITY: Limit conversation turns (max 10 exchanges)
      const maxTurns = 10;
      const currentTurn = context?.turn || 1;
      
      if (currentTurn > maxTurns) {
        return res.status(400).json({ 
          error: "Conversation limit reached. Please complete the transaction manually.",
          sessionId: null
        });
      }

      // Merge new transcript with existing context
      const existingData = context?.extractedData || {};
      const language = req.headers['x-user-language'] as string || 'en-us';

      // Call the main voice processing but with conversation context
      const prompt = `
CONVERSATIONAL VOICE INPUT PROCESSING
===========================================

Previous Context: ${JSON.stringify(existingData, null, 2)}
New User Input: "${transcript}"
Session ID: ${sessionId}

TASK: Update the transaction data with new information from user input.

CONVERSATION RULES:
1. If user provides missing information, update corresponding fields
2. If user corrects existing information, replace old values
3. Keep existing data that wasn't mentioned
4. Return complete updated transaction object

EXPECTED RESPONSE FORMAT:
{
  "amount": number | null,
  "vendor": string | null,
  "description": string | null, 
  "category": string | null,
  "categoryId": number | null,
  "date": "YYYY-MM-DD" | null,
  "type": "income" | "expense" | null,
  "confidence": 0.0-1.0,
  "missingFields": ["field1", "field2"],
  "sessionId": "${sessionId}"
}

MISSING FIELDS: Include any fields that are still null/missing after this update.
MERGE STRATEGY: Previous context + new input = complete transaction data.
`;

      // Use local OpenAI for conversational processing (simpler than external processor)
      let extractedData;
      try {
        console.log('💬 [VoiceAPI] Processing conversational input with local AI...');
        
        const completion = await runAI("voice-extraction", userId, { prompt, language }, "free");
        
        if (!completion) {
          throw new Error('Failed to process conversational input');
        }

        try {
          extractedData = typeof completion === 'string' ? JSON.parse(completion) : completion;
        } catch (parseError) {
          console.error('Failed to parse conversation response:', completion);
          throw new Error('Invalid AI response format');
        }
      } catch (error) {
        console.error('💥 [VoiceAPI] Conversation AI processing failed:', error);
        throw new Error('Failed to process conversational input');
      }

      // Determine missing fields
      const requiredFields = ['amount', 'vendor', 'category'];
      const missingFields = requiredFields.filter(field => 
        !extractedData[field] && !existingData[field]
      );

      const response = {
        ...extractedData,
        missingFields,
        isComplete: missingFields.length === 0,
        sessionId: sessionId,
        turn: currentTurn + 1, // Increment turn for next request
        maxTurns: maxTurns
      };

      console.log('💬 [VoiceAPI] Conversation processing completed:', {
        missingFields,
        isComplete: response.isComplete,
        sessionId
      });

      res.json(response);

    } catch (error) {
      console.error('💥 [VoiceAPI] Conversation processing failed:', error);
      res.status(500).json({ 
        error: "Failed to process conversational input",
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

  // Seamless voice processing endpoint with enhanced categorization
  router.post('/seamless-process', requireAuth(), async (req: Request, res: Response) => {
    const startTime = Date.now();
    let userId: string | undefined;
    
    try {
      const { transcript, sessionId, extractedData, messages } = seamlessProcessSchema.parse(req.body);
      userId = req.auth?.userId;
      const userLanguage = req.headers['x-user-language'] as string || 'en-us';
      
      console.log('🎤 [SeamlessVoice] Processing seamless voice input:', {
        userId: (userId || 'unknown').substring(0, 8) + '...',
        sessionId,
        transcript,
        hasExtractedData: !!extractedData,
        messagesCount: messages?.length || 0
      });
      
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get user for plan info
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get user's transaction history for better categorization
      const userTransactions = await db
        .select({
          description: transactions.description,
          vendor: transactions.vendor,
          category: categories.name,
          amount: transactions.amount
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(eq(transactions.userId, userId))
        .orderBy(desc(transactions.date))
        .limit(100);

      // Get all categories (user + system)
      const allCategories = await db
        .select()
        .from(categories)
        .where(
          or(
            eq(categories.userId, userId),
            eq(categories.userId, null as any)
          )
        );

      // Build conversation context
      const conversationHistory = messages?.map(m => `${m.role}: ${m.content}`).join('\n') || '';
      const currentExtracted = extractedData || {};
      
      // Determine what's missing
      const requiredFields = ['amount', 'vendor', 'category'];
      const missingFields = requiredFields.filter(field => !currentExtracted[field]);
      
      // FAST seamless processing - direct parsing + minimal AI
      let aiResponse;
      
      // Step 1: Fast direct parsing of new input
      const newData = {
        amount: parseAmountFromText(transcript) || currentExtracted.amount,
        vendor: parseVendorFromText(transcript) || currentExtracted.vendor,
        description: transcript.trim(),
        type: currentExtracted.type || 'expense',
        date: new Date().toISOString().split('T')[0]
      };
      
      // Step 2: Only use AI for categorization if needed
      if (newData.vendor && !currentExtracted.categoryId && !currentExtracted.category) {
        console.log('🤖 [SeamlessVoice] Quick categorization for:', newData.vendor);
        
        try {
          const categorizationPrompt = `Categorize "${newData.vendor}":
Categories: ${allCategories.map(cat => `${cat.name}(${cat.id})`).join(', ')}
JSON: {"categoryId": number|null, "categoryName": "string"|null}`;
          
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
              model: 'gpt-4o-mini',
              language: userLanguage
            }),
            signal: AbortSignal.timeout(3000) // VERY FAST 3-second timeout
          });

          if (response.ok) {
            const aiResult = await response.json();
            const categoryData = JSON.parse(aiResult.result || aiResult.completion);
            newData.categoryId = categoryData.categoryId;
            newData.category = categoryData.categoryName;
          }
        } catch (aiError) {
          console.log('⚡ [SeamlessVoice] Quick categorization skipped');
        }
      }
      
      // Prepare AI response structure
      aiResponse = {
        extractedData: newData,
        isComplete: false,
        needsMoreInfo: true
      };

      // Merge extracted data
      const mergedData = {
        ...currentExtracted,
        ...aiResponse.extractedData
      };

      // Determine what's still missing after merging
      const stillMissingFields = requiredFields.filter(field => !mergedData[field]);
      const isComplete = stillMissingFields.length === 0;
      
      let responseText = '';
      let audioData = null;
      let transaction = null;

      if (isComplete) {
        // Generate confirmation using TTSService
        const { TTSService } = await import('../ttsService');
        responseText = TTSService.generateConfirmationMessage(mergedData, userLanguage);
        
        // Prepare transaction for saving
        transaction = {
          amount: mergedData.amount,
          vendor: mergedData.vendor,
          description: mergedData.description || `${mergedData.vendor} - ${mergedData.category}`,
          category: mergedData.category,
          categoryId: mergedData.categoryId,
          date: mergedData.date || new Date().toISOString().split('T')[0],
          type: mergedData.type || 'expense',
          confidence: mergedData.confidence || 0.9
        };
      } else {
        // Generate predefined question for next missing field using TTSService
        const { TTSService } = await import('../ttsService');
        const nextMissingField = stillMissingFields[0];
        responseText = TTSService.generateQuestionForMissingField(nextMissingField, mergedData, userLanguage);
      }

      // Generate TTS audio for predefined response
      if (user.plan !== 'free' && responseText) {
        try {
          const { TTSService } = await import('../ttsService');
          const audioBuffer = await TTSService.generateSpeech({
            text: responseText,
            language: userLanguage
          });
          audioData = audioBuffer.toString('base64');
        } catch (ttsError) {
          console.error('TTS generation failed:', ttsError);
        }
      }

      const processingTime = Date.now() - startTime;
      console.log('✅ [SeamlessVoice] Processing complete:', {
        processingTime: `${processingTime}ms`,
        isComplete,
        stillMissingFields,
        hasAudio: !!audioData,
        response: responseText.substring(0, 50) + '...'
      });

      res.json({
        sessionId,
        extractedData: mergedData,
        response: responseText,
        audioData,
        isComplete,
        needsMoreInfo: !isComplete,
        transaction
      });

    } catch (error) {
      console.error('❌ [SeamlessVoice] Processing error:', error);
      res.status(500).json({ error: 'Failed to process voice input' });
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

// FAST parsing functions for immediate extraction
function parseAmountFromText(text: string): number | null {
  // Look for currency patterns: $50, 50 dollars, 50.99, 50,99
  const patterns = [
    /\$(\d+(?:[.,]\d{2})?)/,           // $50.99
    /(\d+(?:[.,]\d{2})?) *(?:dollar|euro|eur|usd)/i, // 50.99 dollars
    /(\d+(?:[.,]\d{2})?) *(?:koruna|crown)/i,         // 50 koruna
    /(\d+(?:[.,]\d{2})?)/             // Plain numbers
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(',', '.'));
      if (!isNaN(amount) && amount > 0) {
        return amount;
      }
    }
  }
  return null;
}

function parseVendorFromText(text: string): string | null {
  // Look for common vendor patterns
  const patterns = [
    /(?:at|from|in) ([A-Za-z][A-Za-z0-9\s&'-]+?)(?:\s|$|,|\.)/i,  // "at Starbucks"
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,  // Proper nouns
    /([a-zA-Z]+(?:\s+[a-zA-Z]+)*?)(?:\s+for|\s+was|\s+cost)/i  // "Starbucks for coffee"
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const vendor = match[1].trim();
      // Filter out common words that aren't vendors
      const stopWords = ['the', 'and', 'for', 'was', 'cost', 'bought', 'paid', 'spend', 'at'];
      if (!stopWords.includes(vendor.toLowerCase()) && vendor.length > 2) {
        return vendor;
      }
    }
  }
  return null;
}