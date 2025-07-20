import { Router, Request, Response } from "express";
import { requireAuth } from "@clerk/express";
import { z } from "zod";
import { storage } from "../storage";
import { db } from "../db";
import { categories } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { runMistralAnalysis } from "../mistralClient";
import { generateContextualFinancialTips } from "../openai";

const conversationSchema = z.object({
  transcript: z.string().min(1),
  sessionId: z.string().min(1),
  userLanguage: z.string().optional(),
  userCurrency: z.string().optional(),
  currentData: z.object({
    amount: z.number().nullable(),
    description: z.string().nullable(),
    type: z.enum(['income', 'expense']).nullable(),
    categoryId: z.number().nullable(),
    categoryName: z.string().nullable(),
    date: z.string().nullable().optional(),
    note: z.string().nullable().optional()
  }).optional()
});

// Generate natural conversation response using OpenAI (transaction-limited)
async function generateNaturalResponse(currentData: any, missing: string[], userLanguage: string, userCurrency: string): Promise<string> {
  try {
    console.log('🗣️ [Natural Response] Generating with OpenAI:', { currentData, missing, userLanguage });
    
    // Create context-aware prompt for OpenAI
    const dataContext = Object.entries(currentData)
      .filter(([_, value]) => value !== null && value !== undefined)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    
    const missingFields = missing.join(', ');
    
    const prompt = `You are a transaction data collection assistant. Generate a natural, conversational response to collect missing transaction information.

STRICT RULES:
1. ONLY discuss financial transactions (expenses, income, purchases)
2. DO NOT answer questions about other topics
3. Keep responses SHORT (max 15 words)
4. Be conversational and friendly
5. Use the user's currency: ${userCurrency}

Current transaction data: ${dataContext || 'none collected yet'}
Missing information: ${missingFields}
User language: ${userLanguage}

Generate a natural question to collect the next piece of missing information. If user language is Slovak (sk-sk), respond in Slovak. If Spanish (es-pe), respond in Spanish.

Examples:
- Missing amount: "How much did you spend?" or "Koľko to stálo?" (Slovak)
- Missing description: "What did you buy?" or "Čo ste si kúpili?" (Slovak)
- Missing type: "Was this an expense or income?" or "Bol to výdavok alebo príjem?" (Slovak)
- Missing date: "When did this happen?" or "Kedy sa to stalo?" (Slovak)

Response:`;

    // Use basic OpenAI completion (not the full financial tips system)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system', 
            content: 'You are a transaction data collection assistant. Generate SHORT, natural conversation responses ONLY about financial transactions. Respond in the user\'s language.'
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 50,
        temperature: 0.7
      })
    });

    if (response.ok) {
      const result = await response.json();
      const naturalResponse = result.choices[0]?.message?.content?.trim();
      console.log('✅ [Natural Response] Generated:', naturalResponse);
      return naturalResponse || getFallbackQuestion(missing[0], currentData, userCurrency, userLanguage);
    }
  } catch (error) {
    console.error('❌ [Natural Response] OpenAI error:', error);
  }

  // Fallback to predefined questions
  return getFallbackQuestion(missing[0], currentData, userCurrency, userLanguage);
}

// Fallback: Simple English-only questions if OpenAI fails
function getFallbackQuestion(nextField: string, data: any, userCurrency: string, userLanguage: string): string {
  // Simple fallback - OpenAI should handle multilingual questions
  switch (nextField) {
    case 'amount':
      return 'How much was it?';
    case 'description':
      return 'What was this for?';
    case 'type':
      return 'Was this an expense or income?';
    case 'date':
      return 'When did this happen?';
    case 'note':
      return 'Any notes?';
    default:
      return 'Tell me more about your transaction.';
  }
}

export function registerVoiceConversationRoutes(app: Router) {
  const router = Router();

  // Process voice conversation with AI categorization
  router.post('/conversation', requireAuth(), async (req: Request, res: Response) => {
    try {
      const { transcript, sessionId, currentData, userLanguage, userCurrency } = conversationSchema.parse(req.body);
      const userId = (req as any).auth?.userId;

      if (!userId) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      // CRITICAL: Don't process empty transcripts
      if (!transcript || transcript.trim() === '') {
        console.log('❌ [VoiceConversation] Rejecting empty transcript:', {
          transcript,
          sessionId,
          hasCurrentData: !!currentData
        });
        return res.status(400).json({ 
          success: false, 
          error: "Empty transcript not allowed" 
        });
      }

      console.log('🎯 [VoiceConversation] Processing:', {
        userId: userId.substring(0, 8) + '...',
        transcript,
        sessionId,
        receivedCurrentData: currentData
      });

      // Get user for currency info
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      // Start with existing data from frontend
      const existing = {
        amount: null,
        description: null,
        type: null,
        date: null,
        note: undefined,
        categoryId: null,
        categoryName: null,
        ...(currentData || {})
      };
      
      console.log('📤 [VoiceConversation] Existing data from frontend:', existing);

      // Get proper user language and currency
      const finalUserLanguage = userLanguage || user.language || 'en-us';
      const finalUserCurrency = userCurrency || user.currency || '$';
      
      // Always use Mistral AI for data extraction from conversation
      const newData = await aiExtractData(transcript, finalUserCurrency, finalUserLanguage, existing);
      console.log('📝 [VoiceConversation] Extracted:', newData);

      // Merge new data with existing (preserve existing data, only add new non-null values)
      const updated = {
        amount: newData.amount !== null ? newData.amount : existing.amount,
        description: newData.description !== null ? newData.description : existing.description,
        type: newData.type !== null ? newData.type : existing.type,
        date: (newData as any).date !== null && (newData as any).date !== undefined ? (newData as any).date : (existing as any).date,
        note: (newData as any).note !== undefined ? (newData as any).note : (existing as any).note,
        categoryId: newData.categoryId !== null ? newData.categoryId : existing.categoryId,
        categoryName: newData.categoryName !== null ? newData.categoryName : existing.categoryName
      };
      
      console.log('🔄 [VoiceConversation] Data merge:', {
        existing,
        newData,
        updated
      });

      // Remove Mistral from conversation flow - only use for final categorization

      console.log('🔄 [VoiceConversation] Final updated data:', updated);

      // Check what's still missing (including date and note)
      const missing = [];
      if (!updated.amount) missing.push('amount');
      if (!updated.description) missing.push('description'); 
      if (!updated.type) missing.push('type');
      if (!updated.date) missing.push('date');
      if (updated.note === undefined) missing.push('note');

      const isComplete = missing.length === 0;
      const nextField = missing[0] || null;

      // Generate natural conversation response using OpenAI TTS (transaction-limited)
      let nextQuestion = null;
      if (!isComplete) {
        nextQuestion = await generateNaturalResponse(updated, missing, finalUserLanguage, finalUserCurrency);
      }

      return res.json({
        success: true,
        data: updated,
        nextField,
        missing,
        isComplete,
        nextQuestion,
        sessionId
      });

    } catch (error) {
      console.error('💥 [VoiceConversation] Error:', error);
      return res.status(500).json({ 
        success: false,
        error: "Failed to process voice input"
      });
    }
  });

  // Complete and save transaction
  router.post('/complete', requireAuth(), async (req: Request, res: Response) => {
    try {
      const { transactionData, sessionId, userLanguage } = req.body;
      const userId = (req as any).auth?.userId;

      if (!userId) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      console.log('✅ [VoiceConversation] Saving complete transaction:', {
        userId: userId.substring(0, 8) + '...',
        sessionId,
        data: transactionData
      });

      // Use Mistral AI ONLY for categorization if missing
      let finalType = transactionData.type;
      let finalCategoryId = transactionData.categoryId;
      let finalCategoryName = transactionData.categoryName;

      if (transactionData.description && !finalCategoryId) {
        console.log('🤖 [VoiceConversation] Using Mistral for AI categorization...');
        try {
          const analysis = await runMistralAnalysis(
            transactionData.description,
            userId,
            userLanguage
          );
          
          if (analysis) {
            finalCategoryId = analysis.categoryId || finalCategoryId;
            finalCategoryName = analysis.categoryName || finalCategoryName;
            console.log('✅ [VoiceConversation] Mistral categorization applied:', analysis);
          }
        } catch (error) {
          console.log('⚠️ [VoiceConversation] Mistral categorization failed, using defaults');
        }
      }

      // Default to expense if still no type determined
      if (!finalType) {
        finalType = 'expense';
        console.log('📝 [VoiceConversation] Defaulting to expense type');
      }

      // Create transaction record
      const transaction = await storage.createTransaction({
        userId: userId,
        amount: transactionData.amount,
        description: transactionData.description,
        type: finalType,
        date: transactionData.date || new Date().toISOString().split('T')[0],
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

// REMOVED: smartExtractData function - not needed anymore
// All extraction is done by aiExtractData using Mistral

// AI-powered conversational data extraction using external AI processor
async function aiExtractData(transcript: string, userCurrency: string, userLanguage: string = 'en-us', existingData: any = {}) {
  try {
    console.log('🤖 [AI Extraction] Calling external AI processor for intelligent extraction');
    
    // Call external AI processor with the new extractConversationalTransactionData function
    const response = await fetch('https://finanzerpro-ai-processor.fly.dev/execute-gpt-task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task: 'voice-extraction',
        userId: 'voice-system',
        payload: {
          transcript,
          existingData,
          userCurrency,
          language: userLanguage
        }
      })
    });

    if (response.ok) {
      const aiResult = await response.json();
      console.log('✅ [AI Extraction] External processor result:', aiResult);
      
      return {
        amount: aiResult.amount || null,
        description: aiResult.description || null,
        type: aiResult.type || null,
        date: aiResult.date || null,
        note: aiResult.note || null,
        categoryId: null,
        categoryName: null
      };
    } else {
      console.warn('⚠️ [AI Extraction] External processor failed, using fallback');
    }
  } catch (error) {
    console.error('❌ [AI Extraction] External processor error:', error);
  }

  // Fallback: return minimal data if external AI fails
  return {
    amount: null,
    description: transcript.trim(),
    type: null,
    date: null,
    note: null,
    categoryId: null,
    categoryName: null
  };
}

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