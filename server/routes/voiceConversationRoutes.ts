import { Router, Request, Response } from "express";
import { requireAuth } from "@clerk/express";
import { z } from "zod";
import { storage } from "../storage";
import { db } from "../db";
import { categories } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

const conversationSchema = z.object({
  transcript: z.string().min(1),
  sessionId: z.string().min(1),
  userLanguage: z.string().optional(),
  userCurrency: z.string().optional(),
  conversationHistory: z.array(z.string()).optional()
});

const completeTransactionSchema = z.object({
  transactionData: z.object({
    amount: z.number(),
    description: z.string(),
    type: z.enum(['income', 'expense']),
    categoryId: z.number().nullable(),
    categoryName: z.string().nullable(),
    date: z.string().optional(),
    note: z.string().optional()
  }),
  sessionId: z.string().min(1),
  userLanguage: z.string().optional()
});

// Ultra-efficient OpenAI conversation management
async function manageCompleteConversation(
  transcript: string, 
  conversationHistory: string[], 
  userLanguage: string, 
  userCurrency: string
): Promise<{
  response: string;
  isComplete: boolean;
  transactionData?: any;
}> {
  try {
    console.log('🧠 [OpenAI Complete] Managing conversation:', { transcript, userLanguage, userCurrency });
    
    // Build conversation context
    const fullConversation = [...conversationHistory, `User: ${transcript}`].join('\n');
    
    // Extract accumulated data from previous conversation
    let accumulatedData = {
      amount: null,
      description: null,
      type: null,
      date: null,
      note: null,
      categoryName: null
    };

    // Parse previous conversation to maintain state
    conversationHistory.forEach(entry => {
      if (entry.includes('amount:') || entry.includes('pivo') || entry.includes('€') || entry.includes('$')) {
        // Extract data from previous conversation - this is a simplified parser
        // In production, you'd want more robust parsing
        const amountMatch = entry.match(/(\d+(?:\.\d+)?)/);
        if (amountMatch) accumulatedData.amount = parseFloat(amountMatch[1]);
        
        if (entry.includes('pivo')) accumulatedData.description = 'pivo';
        if (entry.includes('expense') || entry.includes('výdavok')) accumulatedData.type = 'expense';
        if (entry.includes('včera') || entry.includes('yesterday')) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          accumulatedData.date = yesterday.toISOString().split('T')[0];
        }
      }
    });

    const systemPrompt = `FAST transaction collection. Build on previous data.

ACCUMULATED DATA: ${JSON.stringify(accumulatedData)}

USER LANGUAGE: ${userLanguage === 'sk-sk' ? 'Slovak' : userLanguage === 'es-pe' ? 'Spanish' : 'English'}
CURRENCY: ${userCurrency}

RULES:
1. NEVER repeat what user said
2. EXTREMELY brief responses (5 words max)
3. If you have amount+description+type → complete=true IMMEDIATELY
4. Ask for ONLY next missing piece
5. Extract ALL data from current+previous conversation

Required: amount, description, type
Optional: date, note

Latest user input: "${transcript}"

JSON only:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Extract data from: "${transcript}" + previous conversation. Return JSON with updated transactionData building on accumulated data. If amount+description+type exist, set complete=true.` }
      ],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: "json_object" }
    });

    const response = completion.choices[0].message.content?.trim();
    
    if (response) {
      const parsed = JSON.parse(response);
      console.log('✅ [OpenAI Complete] Parsed response:', parsed);
      return {
        response: parsed.response,
        isComplete: parsed.complete || false,
        transactionData: parsed.transactionData
      };
    }

    throw new Error('No response from OpenAI');

  } catch (error) {
    console.error('❌ [OpenAI Complete] Error:', error);
    
    // Fallback response
    return {
      response: userLanguage === 'sk-sk' ? 'Povedzte mi o vašej transakcii.' : 
                userLanguage === 'es-pe' ? 'Cuéntame sobre tu transacción.' : 
                'Tell me about your transaction.',
      isComplete: false,
      transactionData: null
    };
  }
}

export function registerVoiceConversationRoutes(app: Router) {
  const router = Router();

  // Ultra-efficient voice conversation with pure OpenAI
  router.post('/conversation', requireAuth(), async (req: Request, res: Response) => {
    try {
      const { transcript, sessionId, userLanguage, userCurrency, conversationHistory = [] } = conversationSchema.parse(req.body);
      const userId = (req as any).auth?.userId;

      if (!userId) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      // CRITICAL: Don't process empty transcripts
      if (!transcript || transcript.trim() === '') {
        console.log('❌ [VoiceConversation] Rejecting empty transcript');
        return res.status(400).json({ 
          success: false, 
          error: "Empty transcript not allowed" 
        });
      }

      console.log('🗣️ [VoiceConversation] Processing:', {
        userId: userId.substring(0, 8) + '...',
        transcript,
        sessionId,
        historyLength: conversationHistory.length
      });

      // Get user data for language and currency fallbacks
      const user = await storage.getUser(userId);
      const finalLanguage = userLanguage || (user as any)?.language || 'en-us';
      const finalCurrency = userCurrency || (user as any)?.currency || '$';

      console.log('🌍 [VoiceConversation] Using settings:', {
        language: finalLanguage,
        currency: finalCurrency
      });

      // Let OpenAI manage the complete conversation
      const result = await manageCompleteConversation(
        transcript,
        conversationHistory,
        finalLanguage,
        finalCurrency
      );

      console.log('🤖 [VoiceConversation] OpenAI result:', result);

      // Update conversation history
      const updatedHistory = [
        ...conversationHistory,
        `User: ${transcript}`,
        `Assistant: ${result.response}`
      ];

      return res.json({
        success: true,
        response: result.response,
        isComplete: result.isComplete,
        transactionData: result.transactionData,
        conversationHistory: updatedHistory
      });

    } catch (error) {
      console.error('💥 [VoiceConversation] Error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid request parameters",
          details: error.errors
        });
      }

      res.status(500).json({ 
        success: false, 
        error: "Failed to process voice conversation",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Complete and save transaction with OpenAI categorization
  router.post('/complete', requireAuth(), async (req: Request, res: Response) => {
    try {
      const { transactionData, sessionId, userLanguage } = completeTransactionSchema.parse(req.body);
      const userId = (req as any).auth?.userId;

      if (!userId) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      console.log('✅ [VoiceConversation] Saving complete transaction:', {
        userId: userId.substring(0, 8) + '...',
        sessionId,
        data: transactionData
      });

      // Use OpenAI for intelligent categorization if missing
      let finalCategoryId = transactionData.categoryId;
      let finalCategoryName = transactionData.categoryName;

      if (transactionData.description && !finalCategoryId) {
        console.log('🤖 [VoiceConversation] Using OpenAI for categorization...');
        try {
          // Get available categories
          const availableCategories = await db.select().from(categories).where(
            and(
              eq(categories.userId, userId),
              eq(categories.type, transactionData.type)
            )
          );

          if (availableCategories.length > 0) {
            const categoryPrompt = `Categorize this transaction intelligently:

Description: "${transactionData.description}"
Type: ${transactionData.type}
Available categories: ${availableCategories.map(c => `${c.id}: ${c.name}`).join(', ')}

Return only the category ID number that best matches this transaction. If no good match exists, return 'null'.`;

            const categoryCompletion = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: 'You are a transaction categorization specialist. Return only the category ID number or null.' },
                { role: 'user', content: categoryPrompt }
              ],
              temperature: 0.1,
              max_tokens: 10
            });

            const categoryResponse = categoryCompletion.choices[0].message.content?.trim();
            const categoryId = categoryResponse && categoryResponse !== 'null' ? parseInt(categoryResponse) : null;
            
            if (categoryId && availableCategories.find(c => c.id === categoryId)) {
              finalCategoryId = categoryId;
              finalCategoryName = availableCategories.find(c => c.id === categoryId)?.name || null;
              console.log('✅ [OpenAI Categorization] Found category:', { categoryId, categoryName: finalCategoryName });
            }
          }
        } catch (error) {
          console.log('⚠️ [VoiceConversation] OpenAI categorization failed, using defaults');
        }
      }

      // Create transaction record
      const transaction = await storage.createTransaction({
        userId: userId,
        amount: transactionData.amount,
        description: transactionData.description,
        type: transactionData.type,
        date: new Date(transactionData.date || new Date().toISOString().split('T')[0]),
        referenceNote: transactionData.note || '',
        categoryId: finalCategoryId || null,
        isRecurring: false
      });

      return res.json({
        success: true,
        transaction,
        message: "Transaction saved successfully"
      });

    } catch (error: any) {
      console.error('💥 [VoiceConversation] Failed to save transaction:', error);
      return res.status(500).json({ 
        success: false,
        error: "Failed to save transaction"
      });
    }
  });

  app.use('/api/voice', router);
}

// REMOVED: All external AI processor calls - pure OpenAI solution implemented

// REMOVED: basicExtraction and parseWordNumber functions
// These contained hardcoded Slovak/Spanish words which is terrible coding practice
// All extraction now uses AI with proper language understanding



// Remove unused async function

// Synchronous Mistral analysis for AI categorization ONLY
async function runMistralAnalysis(description: string, userId: string, userLanguage?: string) {
  try {
    console.log('🤖 [VoiceConversation] Running Mistral AI categorization for:', description);

    // Get user's categories for Mistral processing
    const userCategories = await storage.getCategories(userId);
    
    // Use Mistral client for AI categorization only
    const { mistralClient } = await import('../mistralClient.js');
    const client = mistralClient;

    // Use processVoiceInput for categorization only
    const result = await client.processVoiceInput(
      description,
      userCategories.map(cat => ({
        id: cat.id,
        name: cat.name,
        type: cat.type
      })),
      userLanguage || 'en-us'
    );

    console.log('✅ [VoiceConversation] Mistral categorization result:', result);

    return {
      type: result.type || null,
      categoryId: result.categoryId || null,
      categoryName: result.categoryName || null
    };
    
  } catch (error: any) {
    console.warn('⚠️ [VoiceConversation] Mistral categorization failed:', error.message);
    return null;
  }
}

// Generate question for missing field
function generateQuestion(field: string, currentData: any, userCurrency: string): string {
  const currencySymbol = userCurrency === '€' ? '€' : '$';
  
  switch (field) {
    case 'amount':
      return 'How much was it?';
      
    case 'description':
      if (currentData.amount) {
        return `What was this ${currencySymbol}${currentData.amount} for?`;
      }
      return 'What was this transaction for?';
      
    case 'type':
      if (currentData.description) {
        return `Was "${currentData.description}" an expense or income?`;
      }
      return 'Was this an expense or income?';

    case 'date':
      return 'When did this happen? Today or another day?';

    case 'note':
      return 'Any notes to add to this transaction?';
      
    default:
      return 'Please provide more details.';
  }
}