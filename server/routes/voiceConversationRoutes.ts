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
      const userId = req.auth?.userId;

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
        categoryId: null,
        categoryName: null
      };

      // Extract information from current transcript
      const newData = extractDataFromTranscript(transcript, user.currency || '$');
      console.log('📝 [VoiceConversation] Extracted:', newData);

      // Merge new data with existing (prioritize new data)
      const updated = {
        amount: newData.amount || existing.amount,
        description: newData.description || existing.description,
        type: newData.type || existing.type,
        categoryId: newData.categoryId || existing.categoryId,
        categoryName: newData.categoryName || existing.categoryName
      };

      // AI Categorization - if we have description but no category
      if (updated.description && !updated.categoryId) {
        console.log('🤖 [VoiceConversation] Running AI categorization...');
        
        try {
          const categoryResult = await runAICategorizationForVoice(
            updated.description,
            userId,
            updated.type || 'expense'
          );
          
          if (categoryResult) {
            updated.categoryId = categoryResult.categoryId;
            updated.categoryName = categoryResult.categoryName;
            console.log('✅ [VoiceConversation] AI categorized:', categoryResult);
          }
        } catch (error) {
          console.log('⚠️ [VoiceConversation] AI categorization failed, continuing without category');
        }
      }

      console.log('🔄 [VoiceConversation] Final updated data:', updated);

      // Check what's still missing (only required fields)
      const missing = [];
      if (!updated.amount) missing.push('amount');
      if (!updated.description) missing.push('description');
      if (!updated.type) missing.push('type');

      const isComplete = missing.length === 0;
      const nextField = missing[0] || null;

      // Generate next question if not complete
      let nextQuestion = null;
      if (!isComplete) {
        nextQuestion = generateQuestion(nextField, updated, user.currency || '$');
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

  app.use('/api/voice', router);
}

// Extract data from transcript with currency support
function extractDataFromTranscript(transcript: string, userCurrency: string) {
  const lower = transcript.toLowerCase().trim();
  
  let amount = null;
  let description = null;
  let type = null;

  // Extract amount with user's currency
  const currencySymbol = userCurrency === '€' ? '€' : '$';
  const amountPattern = new RegExp(`\\${currencySymbol}?(\\d+(?:\\.\\d{1,2})?)\\s?(?:dollars?|euros?|€|\\$)?`, 'i');
  const amountMatch = lower.match(amountPattern);
  
  if (amountMatch) {
    amount = parseFloat(amountMatch[1]);
  }

  // Extract type keywords
  if (lower.includes('income') || lower.includes('salary') || lower.includes('wage') || 
      lower.includes('earned') || lower.includes('received') || lower.includes('paid me')) {
    type = 'income';
  } else if (lower.includes('expense') || lower.includes('spent') || lower.includes('bought') || 
            lower.includes('paid for') || lower.includes('purchase') || lower.includes('cost')) {
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

  return { amount, description, type, categoryId: null, categoryName: null };
}

// Check if text is just a number
function isJustNumber(text: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(text.trim());
}

// Run AI categorization for voice input using existing AI processor  
async function runAICategorizationForVoice(description: string, userId: string, type: string) {
  try {
    console.log('🤖 [VoiceConversation] Starting AI categorization:', { description, type });

    // Import the AI processor function from the correct path
    const aiProcessor = await import('../../lib/aiProcessor.js');
    const user = await storage.getUser(userId);
    
    if (!user) {
      console.log('⚠️ [VoiceConversation] User not found for AI categorization');
      return null;
    }

    // Use the existing AI categorization system
    const result = await aiProcessor.runAI('categorizeExpense', userId, user.plan || 'free', {
      description,
      type: type as 'expense' | 'income', 
      language: 'en-us'
    });

    console.log('✅ [VoiceConversation] AI categorization result:', result);

    if (result && result.categoryId) {
      return {
        categoryId: result.categoryId,
        categoryName: result.categoryName
      };
    }
    
    return null;
  } catch (error) {
    console.error('💥 [VoiceConversation] AI categorization failed, continuing without category:', error.message);
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
      
    default:
      return 'Please provide more details.';
  }
}