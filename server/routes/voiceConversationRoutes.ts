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

// Fallback predefined questions if OpenAI fails
function getFallbackQuestion(nextField: string, data: any, userCurrency: string, userLanguage: string): string {
  const isSpanish = userLanguage.startsWith('es');
  const isSlovak = userLanguage.startsWith('sk');
  
  switch (nextField) {
    case 'amount':
      if (isSlovak) return 'Koľko to stálo?';
      if (isSpanish) return '¿Cuánto costó?';
      return 'How much was it?';
      
    case 'description':
      if (isSlovak) return `Čo ste si kúpili za ${userCurrency}${data.amount}?`;
      if (isSpanish) return `¿Qué compraste por ${userCurrency}${data.amount}?`;
      return `What was this ${userCurrency}${data.amount} for?`;
      
    case 'type':
      if (isSlovak) return `Bol "${data.description}" výdavok alebo príjem?`;
      if (isSpanish) return `¿Fue "${data.description}" un gasto o ingreso?`;
      return `Was "${data.description}" an expense or income?`;
      
    case 'date':
      if (isSlovak) return 'Kedy sa to stalo?';
      if (isSpanish) return '¿Cuándo pasó esto?';
      return 'When did this happen?';
      
    case 'note':
      if (isSlovak) return 'Nejaké poznámky? Môžete povedať "žiadne poznámky".';
      if (isSpanish) return '¿Alguna nota? Puedes decir "sin notas".';
      return 'Any notes? You can say "no notes".';
      
    default:
      if (isSlovak) return 'Pokračujme s transakciou.';
      if (isSpanish) return 'Continuemos con la transacción.';
      return 'Let\'s continue with your transaction.';
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

      // Smart extraction: try simple patterns first, use AI only if needed
      const newData = await smartExtractData(transcript, userCurrency || user.currency || '$', userLanguage, existing);
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
        nextQuestion = await generateNaturalResponse(updated, missing, userLanguage, userCurrency || user.currency || '$');
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

// Smart extraction: simple patterns first, AI only when needed
async function smartExtractData(transcript: string, userCurrency: string, userLanguage: string = 'en-us', existingData: any = {}) {
  console.log('🧠 [Smart Extraction] Analyzing:', { transcript, existingData });
  
  // First try simple pattern matching (cost-free)
  const simpleResult = basicExtraction(transcript, userCurrency, userLanguage);
  
  // Check if simple extraction found useful data
  const hasUsefulData = simpleResult.amount !== null || 
                       simpleResult.description !== null || 
                       simpleResult.type !== null ||
                       simpleResult.date !== null;
  
  // Use AI only when:
  // 1. Simple extraction failed AND transcript seems complex (multiple words)
  // 2. OR when transcript contains complete sentence patterns
  const needsAI = !hasUsefulData && (
    transcript.split(' ').length >= 3 || // Multiple words
    /\b(bought|paid|spent|kúpil|for|za|today|dnes)\b/i.test(transcript) // Complex patterns
  );
  
  if (needsAI) {
    console.log('🤖 [Smart Extraction] Using AI for complex transcript');
    return await aiExtractData(transcript, userCurrency, userLanguage, existingData);
  }
  
  console.log('⚡ [Smart Extraction] Using simple patterns (cost-free)');
  return simpleResult;
}

// AI-powered conversational data extraction using Mistral
async function aiExtractData(transcript: string, userCurrency: string, userLanguage: string = 'en-us', existingData: any = {}) {
  try {
    // Use Mistral AI for intelligent extraction
    const mistralResponse = await runMistralAnalysis({
      prompt: `Extract transaction data from this natural conversation: "${transcript}"
      
Current partially collected data: ${JSON.stringify(existingData)}

Extract and return ONLY a JSON object with these fields:
{
  "amount": number or null,
  "description": "what was bought/paid for" or null,
  "type": "expense" or "income" or null,
  "date": "YYYY-MM-DD" or null,
  "note": "additional details" or null
}

Examples:
- "Today I bought pivo for 5 euros" → {"amount": 5, "description": "pivo", "type": "expense", "date": "${new Date().toISOString().split('T')[0]}", "note": null}
- "päť" (when asking for amount) → {"amount": 5, "description": null, "type": null, "date": null, "note": null}
- "pivo" (when asking what for) → {"amount": null, "description": "pivo", "type": null, "date": null, "note": null}

Language context: ${userLanguage}
User currency: ${userCurrency}

Return ONLY the JSON object, no explanation.`,
      language: userLanguage
    });

    if (mistralResponse && mistralResponse.result) {
      console.log('🤖 [AI Extraction] Raw response:', mistralResponse.result);
      
      // Parse AI response
      const cleanResult = mistralResponse.result.replace(/```json|```/g, '').trim();
      const extracted = JSON.parse(cleanResult);
      
      console.log('🔍 [AI Extraction] Parsed result:', extracted);
      return { 
        amount: extracted.amount, 
        description: extracted.description, 
        type: extracted.type, 
        date: extracted.date, 
        note: extracted.note,
        categoryId: null,
        categoryName: null
      };
    }
  } catch (error) {
    console.error('❌ [AI Extraction] Error:', error);
  }

  // Fallback to simple pattern matching if AI fails
  return basicExtraction(transcript, userCurrency, userLanguage);
}

// Enhanced basic extraction for common patterns (cost-free)
function basicExtraction(transcript: string, userCurrency: string, userLanguage: string) {
  const original = transcript.trim();
  const lower = transcript.toLowerCase().trim();
  
  let amount = null;
  let description = null;
  let type = null;
  let date = null;
  let note = null;

  // Enhanced amount detection
  // 1. Numbers with currency: "5 euros", "€20", "$15"
  const currencyMatch = lower.match(/(\d+(?:\.\d{1,2})?)\s*(?:euros?|€|\$|dollars?|korun|korún)/);
  if (currencyMatch) {
    amount = parseFloat(currencyMatch[1]);
  }
  
  // 2. Just numbers if no currency found
  if (amount === null) {
    const numberMatch = lower.match(/(\d+(?:\.\d{1,2})?)/);
    if (numberMatch) {
      amount = parseFloat(numberMatch[1]);
    }
  }

  // 3. Word numbers (Slovak: päť=5, etc.)
  if (amount === null) {
    amount = parseWordNumber(lower, userLanguage);
  }

  // Enhanced type detection
  const spendingWords = ['bought', 'paid', 'spent', 'purchase', 'cost', 'kúpil', 'platil', 'výdavok', 'expense'];
  const earningWords = ['earned', 'received', 'salary', 'income', 'dostal', 'príjem'];
  
  if (spendingWords.some(word => lower.includes(word))) {
    type = 'expense';
  } else if (earningWords.some(word => lower.includes(word))) {
    type = 'income';
  }

  // Enhanced date detection
  const today = new Date();
  if (lower.includes('today') || lower.includes('dnes')) {
    date = today.toISOString().split('T')[0];
  } else if (lower.includes('yesterday') || lower.includes('včera')) {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    date = yesterday.toISOString().split('T')[0];
  }

  // Smart description extraction
  if (original.split(' ').length === 1 && !amount && !type) {
    // Single word likely description: "pivo", "coffee", "groceries"
    description = original;
  } else {
    // Clean multi-word descriptions
    let cleanText = original
      .replace(/\d+(?:\.\d{1,2})?\s*(?:euros?|€|\$|dollars?|korun|korún)?/gi, '') // Remove amounts
      .replace(/\b(?:bought|paid|spent|kúpil|platil|today|dnes|for|za|yesterday|včera)\b/gi, '') // Remove action words
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanText && cleanText.length > 1) {
      description = cleanText;
    }
  }

  console.log('⚡ [Basic Extraction] Result:', { amount, description, type, date, note });
  return { amount, description, type, date, note, categoryId: null, categoryName: null };
}

// Parse word numbers to numeric values
function parseWordNumber(text: string, language: string = 'en-us'): number | null {
  // Multilingual word numbers
  const wordNumbers: { [key: string]: { [word: string]: number } } = {
    'en-us': {
      'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
      'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
      'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
      'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
      'eighty': 80, 'ninety': 90, 'hundred': 100, 'thousand': 1000
    },
    'es-pe': {
      'cero': 0, 'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
      'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10,
      'once': 11, 'doce': 12, 'trece': 13, 'catorce': 14, 'quince': 15,
      'dieciséis': 16, 'diecisiete': 17, 'dieciocho': 18, 'diecinueve': 19, 'veinte': 20,
      'treinta': 30, 'cuarenta': 40, 'cincuenta': 50, 'sesenta': 60, 'setenta': 70,
      'ochenta': 80, 'noventa': 90, 'cien': 100, 'mil': 1000
    },
    'sk-sk': {
      'nula': 0, 'jeden': 1, 'dva': 2, 'tri': 3, 'štyri': 4, 'päť': 5,
      'šesť': 6, 'sedem': 7, 'osem': 8, 'deväť': 9, 'desať': 10,
      'jedenásť': 11, 'dvanásť': 12, 'trinásť': 13, 'štrnásť': 14, 'pätnásť': 15,
      'šestnásť': 16, 'sedemnásť': 17, 'osemnásť': 18, 'devätnásť': 19, 'dvadsať': 20,
      'tridsať': 30, 'štyridsať': 40, 'päťdesiat': 50, 'šesťdesiat': 60, 'sedemdesiat': 70,
      'osemdesiat': 80, 'deväťdesiat': 90, 'sto': 100, 'tisíc': 1000
    }
  };

  const currentLang = wordNumbers[language] || wordNumbers['en-us'];

  const words = text.toLowerCase().split(/\s+/);
  let total = 0;
  let current = 0;

  for (const word of words) {
    if (currentLang.hasOwnProperty(word)) {
      const value = currentLang[word];
      
      if (value === 100) {
        current *= 100;
      } else if (value === 1000) {
        total += current * 1000;
        current = 0;
      } else {
        current += value;
      }
    }
  }
  
  total += current;
  return total > 0 ? total : null;
}



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