import { Router, Request, Response } from "express";
import { requireAuth } from "@clerk/express";
import { z } from "zod";
import { storage } from "../storage";
import { db } from "../db";
import { categories } from "../../shared/schema";
import { eq, and } from "drizzle-orm";

const conversationSchema = z.object({
  transcript: z.string().min(1),
  sessionId: z.string().min(1),
  currentData: z.object({
    amount: z.number().nullable(),
    description: z.string().nullable(),
    type: z.enum(['income', 'expense']).nullable(),
    categoryId: z.number().nullable(),
    categoryName: z.string().nullable()
  }).optional()
});

export function registerVoiceConversationRoutes(app: Router) {
  const router = Router();

  // Process voice conversation with AI categorization
  router.post('/conversation', requireAuth(), async (req: Request, res: Response) => {
    try {
      const { transcript, sessionId, currentData } = conversationSchema.parse(req.body);
      const userId = (req as any).auth?.userId;

      if (!userId) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      console.log('🎯 [VoiceConversation] Processing:', {
        userId: userId.substring(0, 8) + '...',
        transcript,
        sessionId
      });

      // Get user for currency info
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      // Start with existing data
      const existing = currentData || { 
        amount: null, 
        description: null, 
        type: null,
        date: null,
        note: null,
        categoryId: null,
        categoryName: null
      };

      // Process input using Mistral AI for comprehensive analysis
      const updated = await processTranscriptWithMistral(
        transcript, 
        existing, 
        userId, 
        user.currency || '$',
        sessionId
      );

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

      // Generate next question if not complete
      let nextQuestion = null;
      if (!isComplete) {
        if (nextField) {
          nextQuestion = generateQuestion(nextField, updated, user.currency || '$');
        }
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
      const { transactionData, sessionId } = req.body;
      const userId = (req as any).auth?.userId;

      if (!userId) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      console.log('✅ [VoiceConversation] Saving complete transaction:', {
        userId: userId.substring(0, 8) + '...',
        sessionId,
        data: transactionData
      });

      // Create transaction record
      const transaction = await storage.addTransaction(userId, {
        amount: transactionData.amount,
        description: transactionData.description,
        type: transactionData.type,
        date: transactionData.date || new Date().toISOString().split('T')[0],
        reference: transactionData.note || '',
        categoryId: transactionData.categoryId || null,
        source: 'voice_conversation'
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

// Process transcript with Mistral AI for comprehensive analysis
async function processTranscriptWithMistral(
  transcript: string,
  existingData: any,
  userId: string,
  currency: string,
  sessionId: string
) {
  console.log('🤖 [VoiceConversation] Processing with Mistral AI...');

  try {
    // Get user's categories for Mistral processing
    const userCategories = await storage.getCategories(userId);
    
    // Use Mistral client for processing
    const mistralClient = await import('../mistralClient.ts');
    const client = new mistralClient.MistralClient();

    // Call processVoiceInput with existing data as session context
    const result = await client.processVoiceInput(
      transcript,
      userCategories.map(cat => ({
        id: cat.id,
        name: cat.name,
        type: cat.type
      })),
      'en-us', // TODO: Get from user settings
      'UTC', // TODO: Get from user settings
      {
        sessionId,
        existingData,
        currency
      }
    );

    console.log('✅ [VoiceConversation] Mistral result:', result);

    // Merge result with existing data (prioritize AI results)
    const updated = {
      amount: result.amount || existingData.amount,
      description: result.description || result.vendor || existingData.description,
      type: result.type || existingData.type,
      date: result.date || existingData.date,
      note: result.note || existingData.note,
      categoryId: result.categoryId || existingData.categoryId,
      categoryName: result.categoryName || existingData.categoryName
    };

    return updated;

  } catch (error: any) {
    console.warn('⚠️ [VoiceConversation] Mistral processing failed, using fallback:', error.message);
    
    // Fallback to basic extraction
    return extractDataFromTranscriptFallback(transcript, existingData, currency);
  }
}

// Fallback extraction function for when Mistral fails
function extractDataFromTranscriptFallback(transcript: string, existingData: any, userCurrency: string) {
  const lower = transcript.toLowerCase().trim();
  
  let amount = null;
  let description = null;
  let type = null;
  let date = null;
  let note = null;

  // Extract amount with user's currency
  const currencySymbol = userCurrency === '€' ? '€' : '$';
  const amountPattern = new RegExp(`\\${currencySymbol}?(\\d+(?:\\.\\d{1,2})?)\\s?(?:dollars?|euros?|€|\\$)?`, 'i');
  const amountMatch = lower.match(amountPattern);
  
  if (amountMatch) {
    amount = parseFloat(amountMatch[1]);
  }

  // Extract date patterns
  const today = new Date();
  if (lower.includes('today') || lower.includes('now')) {
    date = today.toISOString().split('T')[0];
  } else if (lower.includes('yesterday')) {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    date = yesterday.toISOString().split('T')[0];
  } else if (lower.includes('last week')) {
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);
    date = lastWeek.toISOString().split('T')[0];
  }

  // Extract note indicators
  if (lower.includes('note:') || lower.includes('notes:')) {
    const noteMatch = transcript.match(/(?:note:?|notes:?)\s*(.+)/i);
    if (noteMatch) {
      note = noteMatch[1].trim();
    }
  } else if (lower.includes('no note') || lower.includes('no notes') || lower.includes('none')) {
    note = '';
  }

  // Basic type detection
  if (lower.includes('income') || lower.includes('salary') || lower.includes('wage') || 
      lower.includes('earned') || lower.includes('received') || lower.includes('paid me') ||
      lower.includes('bonus') || lower.includes('refund') || lower.includes('dividend')) {
    type = 'income';
  } else if (lower.includes('expense') || lower.includes('spent') || lower.includes('bought') || 
            lower.includes('paid for') || lower.includes('purchase') || lower.includes('cost') ||
            lower.includes('bill') || lower.includes('fee') || lower.includes('subscription') ||
            lower.includes('coffee') || lower.includes('food') || lower.includes('gas') ||
            lower.includes('store') || lower.includes('restaurant') || lower.includes('shop')) {
    type = 'expense';
  }

  // Extract description - clean transcript
  let cleanText = transcript
    .replace(/\$?\d+(?:\.\d{1,2})?\s?(?:dollars?|€|euros?)?/gi, '') // Remove amounts
    .replace(/\b(?:for|at|from|to|on|income|expense|spent|bought|paid|purchase|received|earned|cost|dollars?|euros?)\b/gi, '') // Remove keywords
    .replace(/\s+/g, ' ') // Clean multiple spaces
    .trim();

  if (cleanText && cleanText.length > 1 && !isJustNumber(cleanText)) {
    description = cleanText;
  }

  // Merge with existing data
  return {
    amount: amount || existingData.amount,
    description: description || existingData.description,
    type: type || existingData.type,
    date: date || existingData.date,
    note: note !== null ? note : existingData.note,
    categoryId: existingData.categoryId,
    categoryName: existingData.categoryName
  };
}

// Check if text is just a number
function isJustNumber(text: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(text.trim());
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