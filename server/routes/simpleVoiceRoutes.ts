import { Router, Request, Response } from "express";
import { requireAuth } from "@clerk/express";
import { z } from "zod";
import { storage } from "../storage";
import { lookupMerchant } from "../../lib/merchantLookup";

// Dynamic pattern-based transcript parsing (no AI required)
function parseTranscriptWithPatterns(transcript: string, userLanguage: string): any {
  const lowerText = transcript.toLowerCase();
  const words = transcript.split(/\s+/);
  
  console.log('🔍 Parsing transcript words:', words);
  
  // Dynamic amount extraction
  let amount = '';
  
  // Text to number mapping for multiple languages
  const numberWords: { [key: string]: string } = {
    // Slovak
    'jeden': '1', 'dva': '2', 'tri': '3', 'štyri': '4', 'päť': '5',
    'šesť': '6', 'sedem': '7', 'osem': '8', 'deväť': '9', 'desať': '10',
    'dvadsať': '20', 'tridsať': '30', 'štyridsať': '40', 'päťdesiat': '50',
    // Spanish  
    'uno': '1', 'dos': '2', 'tres': '3', 'cuatro': '4', 'cinco': '5',
    'seis': '6', 'siete': '7', 'ocho': '8', 'nueve': '9', 'diez': '10',
    'veinte': '20', 'treinta': '30', 'cuarenta': '40', 'cincuenta': '50',
    // English
    'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
    'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
    'twenty': '20', 'thirty': '30', 'forty': '40', 'fifty': '50'
  };

  // First look for numeric amounts
  for (const word of words) {
    const cleanWord = word.replace(/[^\d.,]/g, '');
    if (/^\d+([.,]\d{1,2})?$/.test(cleanWord)) {
      amount = cleanWord.replace(',', '.');
      break;
    }
  }

  // If no numeric amount, look for text numbers
  if (!amount) {
    for (const word of words) {
      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
      if (numberWords[cleanWord]) {
        amount = numberWords[cleanWord];
        break;
      }
    }
  }

  // Dynamic description extraction - find meaningful business/item words
  let description = '';
  const stopWords = ['som', 'si', 'za', 'v', 'na', 'kúpil', 'bought', 'paid', 'for', 'at', 'in', 'the', 'a', 'an', 'eur', 'euro', 'dollar', 'dolár', '$', '€'];
  
  const meaningfulWords = words.filter(word => {
    const clean = word.toLowerCase().replace(/[^\w]/g, '');
    return clean.length > 2 && 
           !stopWords.includes(clean) && 
           !Object.keys(numberWords).includes(clean) &&
           !/^\d/.test(clean);
  });

  if (meaningfulWords.length > 0) {
    description = meaningfulWords.slice(0, 2).join(' ').trim();
  }

  // Dynamic type detection
  let type = ''; // Start empty, let user decide if not obvious
  const expenseIndicators = ['kúpil', 'bought', 'zaplatil', 'paid', 'compré', 'pagué', 'spend', 'cost', 'stalo'];
  const incomeIndicators = ['dostal', 'received', 'výplata', 'salary', 'recibí', 'earned', 'income', 'príjem'];
  
  const hasExpense = expenseIndicators.some(indicator => lowerText.includes(indicator));
  const hasIncome = incomeIndicators.some(indicator => lowerText.includes(indicator));
  
  if (hasExpense && !hasIncome) {
    type = 'expense';
  } else if (hasIncome && !hasExpense) {
    type = 'income';
  }
  // If neither or both detected, leave empty for user to decide

  // Dynamic date calculation - only set if mentioned
  let date = '';
  
  if (lowerText.includes('včera') || lowerText.includes('yesterday') || lowerText.includes('ayer')) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    date = yesterday.toISOString().split('T')[0];
  } else if (lowerText.includes('predvčerom') || lowerText.includes('day before yesterday') || lowerText.includes('anteayer')) {
    const dayBefore = new Date();
    dayBefore.setDate(dayBefore.getDate() - 2);
    date = dayBefore.toISOString().split('T')[0];
  } else if (lowerText.includes('dnes') || lowerText.includes('today') || lowerText.includes('hoy')) {
    const today = new Date();
    date = today.toISOString().split('T')[0];
  }
  // If no date mentioned, leave empty

  return {
    amount,
    description,
    type,
    date,
    note: transcript,
    category: '' // Will be filled by merchant lookup
  };
}

const completeTransactionSchema = z.object({
  transactionData: z.object({
    amount: z.number(),
    description: z.string(),
    type: z.enum(['income', 'expense']),
    date: z.string(),
    note: z.string().optional()
  }),
  userLanguage: z.string().optional()
});

const parseTranscriptSchema = z.object({
  transcript: z.string(),
  userLanguage: z.string().optional()
});

export function registerSimpleVoiceRoutes(app: Router) {
  const router = Router();

  // Dynamic transcript parsing endpoint
  router.post('/parse', requireAuth(), async (req: Request, res: Response) => {
    try {
      const { transcript, userLanguage } = parseTranscriptSchema.parse(req.body);
      const userId = (req as any).auth?.userId;

      if (!userId) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      console.log('🎯 [VoiceParse] Processing transcript:', {
        userId: userId.substring(0, 8) + '...',
        transcript: transcript.substring(0, 50) + '...',
        language: userLanguage
      });

      // Use pattern-based parsing (no AI required)
      const parsedData = parseTranscriptWithPatterns(transcript, userLanguage || 'en-us');
      
      // Try to get category from merchant lookup if description exists
      if (parsedData.description) {
        try {
          const merchantResult = await lookupMerchant(parsedData.description, 'us');
          if (merchantResult && merchantResult.category_keywords.length > 0) {
            parsedData.category = merchantResult.category_keywords[0]; // Use first suggested category
          }
        } catch (error) {
          console.error('⚠️ [VoiceParse] Merchant lookup failed:', error);
        }
      }
      
      console.log('✅ [VoiceParse] Extracted data:', parsedData);

      return res.json({
        success: true,
        data: parsedData
      });

    } catch (error: any) {
      console.error('💥 [VoiceParse] Failed to parse transcript:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false,
          error: "Invalid request parameters",
          details: error.errors
        });
      }
      
      return res.status(500).json({ 
        success: false,
        error: "Failed to parse transcript"
      });
    }
  });

  // Simple transaction save endpoint - no AI, no complex processing
  router.post('/complete', requireAuth(), async (req: Request, res: Response) => {
    try {
      const { transactionData } = completeTransactionSchema.parse(req.body);
      const userId = (req as any).auth?.userId;

      if (!userId) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      console.log('💰 [SimpleVoice] Saving transaction:', {
        userId: userId.substring(0, 8) + '...',
        amount: transactionData.amount,
        description: transactionData.description,
        type: transactionData.type
      });

      // Use local merchant categorization system
      let categoryId = null;
      try {
        const userIdNum = userId.replace('user_', '');
        const user = await storage.getUser(userIdNum);
        const userCountry = 'us'; // Default country
        
        const merchantResult = await lookupMerchant(transactionData.description, userCountry);
        console.log('🏪 [SimpleVoice] Merchant lookup result:', merchantResult);
        
        if (merchantResult && merchantResult.category_keywords.length > 0) {
          // Try to match with existing user categories
          const categories = await storage.getCategories(userId);
          const matchedCategory = categories.find(cat => 
            merchantResult.category_keywords.some(keyword => 
              cat.name.toLowerCase().includes(keyword.toLowerCase())
            )
          );
          
          if (matchedCategory) {
            categoryId = matchedCategory.id;
            console.log('✅ [SimpleVoice] Found matching category:', matchedCategory.name);
          }
        }
      } catch (error) {
        console.error('⚠️ [SimpleVoice] Local categorization failed:', error);
      }

      // Create transaction record with local categorization
      const transaction = await storage.createTransaction({
        userId: userId,
        amount: transactionData.amount.toString(),
        description: transactionData.description,
        type: transactionData.type,
        date: new Date(transactionData.date),
        referenceNote: transactionData.note || '',
        categoryId: categoryId,
        isRecurring: false
      });

      return res.json({
        success: true,
        transaction,
        message: "Transaction saved successfully"
      });

    } catch (error: any) {
      console.error('💥 [SimpleVoice] Failed to save transaction:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false,
          error: "Invalid request parameters",
          details: error.errors
        });
      }
      
      return res.status(500).json({ 
        success: false,
        error: "Failed to save transaction"
      });
    }
  });

  app.use('/api/voice', router);
}