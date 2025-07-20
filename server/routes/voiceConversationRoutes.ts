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
  userLanguage: z.string().optional(),
  userCurrency: z.string().optional(),
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
      const { transcript, sessionId, currentData, userLanguage, userCurrency } = conversationSchema.parse(req.body);
      const userId = (req as any).auth?.userId;

      if (!userId) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
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
      const existing = currentData || { 
        amount: null, 
        description: null, 
        type: null,
        date: null,
        note: null,
        categoryId: null,
        categoryName: null
      };
      
      console.log('📤 [VoiceConversation] Existing data from frontend:', existing);

      // Extract information from current transcript using user's currency
      const newData = extractDataFromTranscript(transcript, userCurrency || user.currency || '$');
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

      // ONLY use Mistral AI for expense/income detection and categorization
      // This happens asynchronously AFTER we have description
      if (updated.description && (!updated.type || !updated.categoryId)) {
        processWithMistralAsync(updated, userId, sessionId);
      }

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
          nextQuestion = generateQuestion(nextField, updated, userCurrency || user.currency || '$');
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

      // Use Mistral AI for final type detection and categorization if missing
      let finalType = transactionData.type;
      let finalCategoryId = transactionData.categoryId;
      let finalCategoryName = transactionData.categoryName;

      if (transactionData.description && (!finalType || !finalCategoryId)) {
        console.log('🤖 [VoiceConversation] Using Mistral for final analysis...');
        try {
          const analysis = await runMistralAnalysis(
            transactionData.description,
            userId
          );
          
          if (analysis) {
            finalType = analysis.type || finalType;
            finalCategoryId = analysis.categoryId || finalCategoryId;
            finalCategoryName = analysis.categoryName || finalCategoryName;
            console.log('✅ [VoiceConversation] Mistral analysis applied:', analysis);
          }
        } catch (error) {
          console.log('⚠️ [VoiceConversation] Mistral analysis failed, using defaults');
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

// Extract data from transcript with currency support, date, and note
function extractDataFromTranscript(transcript: string, userCurrency: string) {
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

  // Basic type detection (Mistral will do the intelligent analysis)
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

  // Extract description - clean transcript, but preserve meaningful words
  let cleanText = transcript
    .replace(/\$?\d+(?:\.\d{1,2})?\s?(?:dollars?|€|euros?)?/gi, '') // Remove amounts
    .replace(/\b(?:for|at|from|to|on|dollars?|euros?)\b/gi, '') // Remove only prepositions and currency words
    .replace(/\s+/g, ' ') // Clean multiple spaces
    .trim();

  // If it's a simple word like "drugstore", "coffee", "groceries" - use it as description
  if (cleanText && cleanText.length > 1 && !isJustNumber(cleanText)) {
    description = cleanText;
  }

  console.log('🔍 [VoiceConversation] Extraction result:', { amount, description, type, date, note });
  return { amount, description, type, date, note, categoryId: null, categoryName: null };
}



// Asynchronous Mistral processing for expense/income detection and categorization ONLY
async function processWithMistralAsync(transactionData: any, userId: string, sessionId: string) {
  if (!transactionData.description) return;
  
  console.log('🤖 [VoiceConversation] Running async Mistral analysis for:', transactionData.description);
  // This is non-blocking - just for future optimization
}

// Synchronous Mistral analysis for final transaction saving
async function runMistralAnalysis(description: string, userId: string) {
  try {
    console.log('🤖 [VoiceConversation] Running Mistral analysis for:', description);

    // Get user's categories for Mistral processing
    const userCategories = await storage.getCategories(userId);
    
    // Use Mistral client for processing
    const { mistralClient } = await import('../mistralClient.js');
    const client = mistralClient;

    // Call processVoiceInput ONLY for type detection and categorization
    const result = await client.processVoiceInput(
      `Analyze this transaction: "${description}" - determine if expense or income and appropriate category`,
      userCategories.map(cat => ({
        id: cat.id,
        name: cat.name,
        type: cat.type
      })),
      'en-us', // Note: Mistral analysis uses English for technical processing
      'UTC', // TODO: Get from user settings
      {
        analysisOnly: true // Flag to indicate we only need type and category
      }
    );

    console.log('✅ [VoiceConversation] Mistral analysis result:', result);

    return {
      type: result.type,
      categoryId: result.categoryId,
      categoryName: result.categoryName
    };
    
  } catch (error: any) {
    console.warn('⚠️ [VoiceConversation] Mistral analysis failed:', error.message);
    return null;
  }
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