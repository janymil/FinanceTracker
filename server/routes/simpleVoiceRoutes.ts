import { Router, Request, Response } from "express";
import { requireAuth } from "@clerk/express";
import { z } from "zod";
import { storage } from "../storage";
import { lookupMerchant } from "../../lib/merchantLookup";

// Intelligent parsing function for complete sentences
function parseTranscriptWithPatterns(transcript: string, userLanguage: string): any {
  const lowerText = transcript.toLowerCase().trim();
  const words = transcript.split(/\s+/).filter(w => w.length > 0);
  
  console.log('🔍 Parsing COMPLETE transcript:', transcript);
  console.log('🔍 Words found:', words);
  
  // Amount extraction - look for numbers with currency indicators
  let amount = '';
  
  // Text to number mapping
  const numberWords: { [key: string]: string } = {
    'jeden': '1', 'dva': '2', 'tri': '3', 'štyri': '4', 'päť': '5', 'šesť': '6', 'sedem': '7', 'osem': '8', 'deväť': '9', 'desať': '10',
    'uno': '1', 'dos': '2', 'tres': '3', 'cuatro': '4', 'cinco': '5', 'seis': '6', 'siete': '7', 'ocho': '8', 'nueve': '9', 'diez': '10',
    'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10'
  };

  // Look for amounts in various formats
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    // Numeric amounts like "5.50", "5:50", "5,50"
    const numericMatch = word.match(/(\d+)[.:,](\d{1,2})/);
    if (numericMatch) {
      amount = numericMatch[1] + '.' + numericMatch[2];
      console.log('💰 Found decimal amount:', amount);
      break;
    }
    
    // Simple numbers followed by currency
    const simpleNumMatch = word.match(/^(\d+)$/);
    if (simpleNumMatch && i < words.length - 1) {
      const nextWord = words[i + 1].toLowerCase();
      if (nextWord.includes('eur') || nextWord.includes('dol') || nextWord.includes('€') || nextWord.includes('$')) {
        amount = simpleNumMatch[1];
        console.log('💰 Found simple amount:', amount);
        break;
      }
    }
    
    // Text numbers
    const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
    if (numberWords[cleanWord]) {
      amount = numberWords[cleanWord];
      console.log('💰 Found text amount:', amount);
      break;
    }
  }

  // Description extraction - find business/item names
  let description = '';
  const stopWords = ['som', 'si', 'za', 'v', 'na', 'kúpil', 'bought', 'paid', 'for', 'at', 'in', 'the', 'a', 'an', 'eur', 'euro', 'dollar', 'dolár', '$', '€', 'včera', 'yesterday', 'ayer', 'predvčerom', 'today', 'dnes', 'hoy'];
  
  const meaningfulWords = words.filter(word => {
    const clean = word.toLowerCase().replace(/[^\w]/g, '');
    return clean.length > 2 && 
           !stopWords.includes(clean) && 
           !Object.keys(numberWords).includes(clean) &&
           !/^\d+[.:,]?\d*$/.test(clean); // Skip pure numbers
  });

  if (meaningfulWords.length > 0) {
    description = meaningfulWords.join(' ').trim();
    console.log('📝 Found description:', description);
  }

  // Type detection based on action words
  let type = '';
  const expenseWords = ['kúpil', 'bought', 'zaplatil', 'paid', 'compré', 'pagué', 'spend', 'cost', 'stalo', 'purchase'];
  const incomeWords = ['dostal', 'received', 'výplata', 'salary', 'recibí', 'earned', 'income', 'príjem', 'got', 'earn'];
  
  const hasExpenseWord = expenseWords.some(word => lowerText.includes(word));
  const hasIncomeWord = incomeWords.some(word => lowerText.includes(word));
  
  if (hasExpenseWord && !hasIncomeWord) {
    type = 'expense';
    console.log('💸 Detected expense type');
  } else if (hasIncomeWord && !hasExpenseWord) {
    type = 'income';
    console.log('💰 Detected income type');
  }

  // Date extraction
  let date = '';
  if (lowerText.includes('včera') || lowerText.includes('yesterday') || lowerText.includes('ayer')) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    date = yesterday.toISOString().split('T')[0];
    console.log('📅 Found date: yesterday =', date);
  } else if (lowerText.includes('predvčerom') || lowerText.includes('day before yesterday') || lowerText.includes('anteayer')) {
    const dayBefore = new Date();
    dayBefore.setDate(dayBefore.getDate() - 2);
    date = dayBefore.toISOString().split('T')[0];
    console.log('📅 Found date: day before yesterday =', date);
  } else if (lowerText.includes('dnes') || lowerText.includes('today') || lowerText.includes('hoy')) {
    date = new Date().toISOString().split('T')[0];
    console.log('📅 Found date: today =', date);
  }

  const result = {
    amount,
    description, 
    type,
    date,
    note: transcript,
    category: ''
  };
  
  console.log('✅ Final parsed result:', result);
  return result;
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