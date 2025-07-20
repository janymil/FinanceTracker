import { Router, Request, Response } from "express";
import { requireAuth } from "@clerk/express";
import { z } from "zod";
import { runAI } from "../../lib/aiProcessor";
import { getMerchantContextForAI, getCountryFromLanguage } from "../../lib/merchantLookup";
import { getLanguageLabel } from "../../lib/languageUtils";
import { db } from "../db";
import { categories, aiUsage, users } from "../../shared/schema";
import { eq, and, sql, gte } from "drizzle-orm";
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
        totalCategories: allCategories.length,
        allCategoriesList: allCategories.map(cat => `${cat.name} (ID: ${cat.id})`)
      });

      // Build the extraction prompt with smart merchant lookup and learning
      const currentDate = new Date().toISOString();
      const countryCode = getCountryFromLanguage(language);
      const merchantContext = await getMerchantContextForAI(transcript, countryCode, 15);
      
      // Get learned patterns for this user/merchant
      const { lookupMerchant } = await import('../../lib/merchantLookup');
      const learnedMatch = await lookupMerchant(transcript, countryCode, userId);
      
      const prompt = `CRITICAL: You must respond with ONLY valid JSON. No explanations, no markdown, no additional text.
CRITICAL: You MUST respond exclusively in ${getLanguageLabel(language)} for all text fields (vendor, description, categoryName, ambiguities, followUpQuestions).

Extract financial transaction details from this voice transcript:
"${transcript}"

Context:
- User Language: ${language}
- Current Date: ${currentDate}
- User Timezone: ${timezone || 'UTC'}
- Country: ${countryCode.toUpperCase()}

Available Categories:
${allCategories.map(cat => `- ${cat.name} (ID: ${cat.id})`).join('\n')}

${merchantContext}

${learnedMatch ? `
LEARNED PATTERN FOR THIS USER:
- This merchant "${learnedMatch.matched_merchant}" was previously categorized by this user
- Business Type: ${learnedMatch.business_type}
- Confidence: ${learnedMatch.confidence}
- Source: ${learnedMatch.source}
- PRIORITIZE this learned pattern if merchant matches
` : ''}

SMART CATEGORIZATION RULES - TWO-LAYER SYSTEM:

LAYER 1: MERCHANT LOOKUP (JSON-based)
1. Extract merchant name from transcript
2. Check if merchant matches known businesses from examples above
3. If found in examples, use that business type with high confidence

LAYER 2: AI MERCHANT INTELLIGENCE (for unknown merchants)
1. If merchant NOT found in examples above, use AI intelligence:
   - Analyze: "What type of business is this merchant?"
   - Research the merchant name to understand their business type
   - Examples: "papiernictvo" = stationery shop → office supplies
   - Examples: "slovnaft" = Slovak gas company → transportation
   - Examples: "tesco" = supermarket chain → groceries
2. Match the discovered business type to user's available categories
3. Use business intelligence, not hardcoded patterns
4. If uncertain about category match (confidence < 0.7), set categoryId: null
5. NEVER force into wrong category - better null for manual selection

STRICT INSTRUCTIONS:
1. Return ONLY valid JSON - no markdown code blocks, no explanations
2. Extract: amount, vendor, category, date, type from transcript
3. Use merchant recognition examples to identify business type
4. Match business type to most relevant user category
5. If uncertain about category (confidence < 0.7), set categoryId: null
6. Parse natural dates like "yesterday", "last week" 
7. Determine income vs expense from context

JSON RESPONSE FORMAT:
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

EXAMPLES FOR ${countryCode.toUpperCase()}:
- "I bought coffee at Starbucks" + available "Jedlo (ID: 5)" → categoryId: 5, categoryName: "Jedlo"
- "Filled gas at Slovnaft" + available "Doprava (ID: 8)" → categoryId: 8, categoryName: "Doprava"
- "Shopping at unknown store" → categoryId: null, categoryName: null (let user choose)

CRITICAL: Better to return categoryId: null than wrong category. User can select manually.`;

      // Call external AI processor (which uses Mistral first, then OpenAI fallback)
      let completion;
      let aiProcessingTime = 0;
      const aiStartTime = Date.now();
      
      try {
        const AI_PROCESSOR_URL = process.env.AI_PROCESSOR_URL || 'http://31.97.103.28:8080';
        
        console.log('🤖 [VoiceAPI] Calling external AI processor:', {
          url: AI_PROCESSOR_URL,
          model: 'mistral-small-2506',
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
            model: 'mistral-small-2506',
            language
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
        completion = await runAI("voice-extraction", userId, { prompt, language }, user?.plan || "free");
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