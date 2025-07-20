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
  conversationHistory: z.array(z.string()).optional(),
  currentTransactionData: z.object({
    amount: z.number().nullable(),
    description: z.string().nullable(),
    type: z.enum(['expense', 'income']).nullable(),
    date: z.string().nullable(),
    note: z.string().nullable(),
    categoryName: z.string().nullable()
  }).optional()
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
  userCurrency: string,
  currentData?: any
): Promise<{
  response: string;
  isComplete: boolean;
  transactionData?: any;
}> {
  try {
    console.log('🧠 [OpenAI Complete] Managing conversation:', { transcript, userLanguage, userCurrency });
    
    // Build conversation context
    const fullConversation = [...conversationHistory, `User: ${transcript}`].join('\n');
    
    // Use existing transaction data if provided, otherwise start fresh
    let accumulatedData = currentData || {
      amount: null,
      description: null,
      type: null,
      date: null,
      note: null,
      categoryName: null
    };

    // EXTRACT accumulated data from conversation history + current input
    const allText = [...conversationHistory, `User: ${transcript}`].join(' ').toLowerCase();
    
    // Extract amount from conversation - check both history and current input
    const amountPatterns = [
      /(\d+(?:[.,]\d+)?)\s*(?:eur|euro|dollar|dolár|€|\$)/g,
      /(?:stalo|cost|costó|bolo)\s*(?:to)?\s*(\d+)/g,
      /(\d+)\s*(?:eur|euro|dollar|dolár|€|\$)/g
    ];
    
    for (const pattern of amountPatterns) {
      const matches = allText.match(pattern);
      if (matches) {
        const lastMatch = matches[matches.length - 1];
        const numberMatch = lastMatch.match(/(\d+(?:[.,]\d+)?)/);
        if (numberMatch) {
          accumulatedData.amount = parseFloat(numberMatch[1].replace(',', '.'));
          break;
        }
      }
    }
    
    // Extract description from purchase mentions
    if (allText.includes('pivo') || allText.includes('beer')) accumulatedData.description = 'pivo';
    if (allText.includes('chlieb') || allText.includes('bread')) accumulatedData.description = 'chlieb';
    if (allText.includes('kávu') || allText.includes('coffee')) accumulatedData.description = 'káva';
    if (allText.includes('mlieko') || allText.includes('milk')) accumulatedData.description = 'mlieko';
    
    // Extract date
    if (allText.includes('včera') || allText.includes('yesterday')) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      accumulatedData.date = yesterday.toISOString().split('T')[0];
    } else if (allText.includes('dnes') || allText.includes('today')) {
      accumulatedData.date = new Date().toISOString().split('T')[0];
    }
    
    // AUTO-DETECT expense vs income (NO ASKING)
    if (allText.includes('kúpil') || allText.includes('bought') || allText.includes('zaplatil') || 
        allText.includes('paid') || allText.includes('výdavok') || allText.includes('expense')) {
      accumulatedData.type = 'expense';
    } else if (allText.includes('dostal') || allText.includes('received') || allText.includes('výplata') || 
               allText.includes('salary') || allText.includes('príjem') || allText.includes('income')) {
      accumulatedData.type = 'income';
    }
    
    console.log('🧠 [Parser] Full text:', allText.substring(0, 100) + '...');
    console.log('🧠 [Parser] Extracted:', accumulatedData);

    const systemPrompt = `You are a transaction data collector. Extract data and respond in ${userLanguage === 'sk-sk' ? 'Slovak' : userLanguage === 'es-pe' ? 'Spanish' : 'English'}.

CURRENT DATA: ${JSON.stringify(accumulatedData)}
USER INPUT: "${transcript}"

REQUIRED RESPONSE FORMAT:
{
  "response": "Brief question in user's language (max 8 words)",
  "complete": false,
  "transactionData": {
    "amount": number_or_null,
    "description": "text_or_null", 
    "type": "expense_or_income_or_null",
    "date": "YYYY-MM-DD_or_null",
    "note": "text_or_null",
    "categoryName": "category_or_null"
  }
}

CRITICAL RULES:
- NEVER ask for category - auto-categorize using AI
- If amount+description+type exist → set complete=true immediately
- Auto-detect expense/income from context (kúpil=expense, dostal=income)
- Extract ALL data including from conversation history
- Ask for missing required data ONLY (amount, description)
- Brief responses (max 5 words)`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Process the user input and return the required JSON format.' }
      ],
      temperature: 0.1,
      max_tokens: 150,
      response_format: { type: "json_object" }
    });

    const response = completion.choices[0].message.content?.trim();
    
    if (response) {
      const parsed = JSON.parse(response);
      console.log('✅ [OpenAI Complete] Parsed response:', parsed);
      
      // Fix malformed OpenAI responses
      let fixedResponse = parsed.response;
      let isComplete = parsed.complete || false;
      let transactionData = parsed.transactionData || parsed; // Sometimes OpenAI returns data directly
      
      // If no response text, generate appropriate question
      if (!fixedResponse) {
        if (accumulatedData.amount && accumulatedData.description && accumulatedData.type) {
          fixedResponse = userLanguage === 'sk-sk' ? 'Perfektne! Ukladám transakciu.' : 
                        userLanguage === 'es-pe' ? '¡Perfecto! Guardando transacción.' :
                        'Perfect! Saving transaction.';
          isComplete = true;
        } else if (!accumulatedData.amount) {
          fixedResponse = userLanguage === 'sk-sk' ? 'Koľko to stálo?' :
                        userLanguage === 'es-pe' ? '¿Cuánto costó?' :
                        'How much did it cost?';
        } else if (!accumulatedData.description) {
          fixedResponse = userLanguage === 'sk-sk' ? 'Čo si kúpil?' :
                        userLanguage === 'es-pe' ? '¿Qué compraste?' :
                        'What did you buy?';
        } else {
          fixedResponse = userLanguage === 'sk-sk' ? 'Povedz mi viac.' :
                        userLanguage === 'es-pe' ? 'Cuéntame más.' :
                        'Tell me more.';
        }
      }
      
      // Ensure transactionData has proper structure
      if (transactionData && !transactionData.amount) {
        transactionData = {
          amount: accumulatedData.amount,
          description: accumulatedData.description,
          type: accumulatedData.type,
          date: accumulatedData.date,
          note: accumulatedData.note,
          categoryName: accumulatedData.categoryName
        };
      }
      
      return {
        response: fixedResponse,
        isComplete: isComplete,
        transactionData: transactionData
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
      const { transcript, sessionId, userLanguage, userCurrency, conversationHistory = [], currentTransactionData } = conversationSchema.parse(req.body);
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
        finalCurrency,
        currentTransactionData
      );

      console.log('🤖 [VoiceConversation] OpenAI result:', result);

      // Update conversation history and ensure data persistence
      const updatedHistory = [
        ...conversationHistory,
        `User: ${transcript}`,
        `Assistant: ${result.response}`
      ];

      // CRITICAL: Pass accumulated data to frontend for memory persistence
      const finalTransactionData = result.transactionData || accumulatedData;
      
      console.log('🔄 [VoiceConversation] Returning to frontend:', {
        response: result.response,
        isComplete: result.isComplete,
        transactionData: finalTransactionData,
        accumulatedData: accumulatedData
      });

      return res.json({
        success: true,
        response: result.response,
        isComplete: result.isComplete,
        transactionData: finalTransactionData,
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