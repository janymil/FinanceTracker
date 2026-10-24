import Groq from 'groq-sdk';
import { createRoutedClient } from '../lib/aiProvider';

if (!process.env.GROQ_API_KEY) {
  console.warn('GROQ_API_KEY not set in environment variables - Groq voice features will be unavailable until configured.');
}

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || 'missing-groq-api-key',
});

const routed = createRoutedClient();

/**
 * Chat goes through lib/aiProvider like every other prompt: the ai-processor gateway first,
 * then the shared fallback chain, with the anonymiser applied at that one choke point (no
 * e-mails, IBANs, cards, phones or names leave). Speech-to-text below still calls Groq directly:
 * the gateway only carries chat requests.
 */
async function createChat(params: any): Promise<any> {
  return routed.chat.completions.create({ ...params, model: 'openai/gpt-oss-120b', task: 'voice-groq' } as any);
}

// Groq STT using Distil-Whisper
export async function transcribeAudioWithGroq(audioBuffer: Buffer): Promise<string> {
  try {
    console.log('🎙️ Starting Groq STT with Distil-Whisper...');
    
    const transcription = await groq.audio.transcriptions.create({
      file: new File([audioBuffer], 'audio.wav', { type: 'audio/wav' }),
      model: 'whisper-large-v3-turbo',
      response_format: 'text'
    });

    console.log('🎙️ Groq STT result:', transcription);
    return String(transcription || '');
  } catch (error) {
    console.error('❌ Groq STT failed:', error);
    throw new Error(`Speech-to-text failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Groq LLaMA for intelligent transaction parsing
export async function parseTransactionWithGroq(transcript: string, userLanguage: string, userCurrency: string = '$'): Promise<{
  amount: string;
  description: string;
  type: 'income' | 'expense';
  date: string;
  category: string;
  note: string;
}> {
  try {
    console.log('🧠 Starting Groq LLaMA analysis...');
    
    const languageMap: { [key: string]: string } = {
      'sk-sk': 'Slovak',
      'es-pe': 'Spanish',
      'en-us': 'English'
    };
    
    const language = languageMap[userLanguage] || 'English';
    
    const systemPrompt = `You are an expert at parsing financial transactions from natural speech. Parse the user's speech into structured transaction data.

USER PREFERENCES:
- Language: ${language}
- Currency: ${userCurrency}

RESPOND ONLY WITH VALID JSON:
{
  "amount": "135.80",
  "description": "Merchant or expense description", 
  "type": "expense",
  "date": "2025-07-21",
  "category": "Category name",
  "note": "original transcript"
}

EXACT PARSING EXAMPLE:
Input: "coolbox audífonos ayer 135 soles 80"
Output: {
  "amount": "135.80",
  "description": "coolbox audífonos",
  "type": "expense",
  "date": "2025-07-20",
  "category": "Compras",
  "note": "coolbox audífonos ayer 135 soles 80"
}

PARSING INSTRUCTIONS:
- AMOUNT: Extract numeric value PRECISELY. For currency with decimals like "135 soles 80" → "135.80", "twenty dollars fifty" → "20.50"
- DESCRIPTION: Extract merchant name, store name, or what the money was spent on
- TYPE: "expense" for spending money, "income" for receiving money  
- CATEGORY: Choose appropriate category in ${language}
- DATE: Use today's date (2025-07-21) unless another date is clearly mentioned

CATEGORIES FOR ${language}:
${language === 'Spanish' ? 'Comida, Transporte, Compras, Entretenimiento, Servicios, Salud, Ingresos, Otros' : 
  language === 'Slovak' ? 'Potraviny, Doprava, Nakupovanie, Zábava, Účty, Zdravie, Príjmy, Ostatné' :
  'Food, Transport, Shopping, Entertainment, Bills, Healthcare, Income, Other'}

CRITICAL AMOUNT PARSING EXAMPLES:
- "135 soles 80" → "135.80" (135 soles and 80 cents = 135.80, NOT 215.80!)
- "dos soles treinta" → "2.30" (2 soles and 30 cents = 2.30)
- "twenty dollars fifty cents" → "20.50" (20 dollars and 50 cents = 20.50)
- "päťdesiat eur dvadsať" → "50.20" (50 euros and 20 cents = 50.20)

MATHEMATICAL RULE FOR CURRENCY:
When you see "[NUMBER] [CURRENCY] [NUMBER]", it means:
- First number = main units (soles, dollars, euros)  
- Second number = cents/centavos (always after decimal point)
- Formula: FIRST.SECOND (e.g., 135 soles 80 = 135.80)

CRITICAL: DO NOT ADD NUMBERS TOGETHER! 135 + 80 ≠ 215. Use 135.80!

IMPORTANT: 
- Use decimal point format for currency amounts
- Major currency unit + minor currency unit = decimal format
- Use your knowledge of GLOBAL merchants and businesses to categorize correctly
- Examples: Migros = grocery store = ${language === 'Spanish' ? 'Comida' : language === 'Slovak' ? 'Potraviny' : 'Food'}, McDonald's = restaurant = ${language === 'Spanish' ? 'Comida' : language === 'Slovak' ? 'Potraviny' : 'Food'}
- CRITICAL: Grocery stores, supermarkets, food stores → ${language === 'Spanish' ? 'Comida' : language === 'Slovak' ? 'Potraviny' : 'Food'} (NOT Shopping/Compras)
- Be intelligent about merchant types regardless of country
- Extract amounts with mathematical precision`;

    // Create specific user prompt with currency parsing guidance
    const userPrompt = transcript.includes('soles') && /\d+\s+soles\s+\d+/.test(transcript) 
      ? `Parse this transaction: "${transcript}"

IMPORTANT: This transcript contains "X soles Y" format. This means X.Y, not X+Y.
For example: "135 soles 80" = 135.80 (one hundred thirty-five point eighty)`
      : `Parse this transaction: "${transcript}"`;

    const completion = await createChat({
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const rawResponse = completion.choices[0].message.content || '{}';
    console.log('🧠 Raw LLaMA response:', rawResponse);
    
    const result = JSON.parse(rawResponse);
    
    // Fix amount parsing errors - LLaMA has issues with currency formats
    let correctedAmount = String(result.amount || '');
    
    // Fix Spanish number parsing patterns
    const spanishNumberPatterns: Array<
      | { pattern: RegExp; fix: string; handler?: undefined }
      | { pattern: RegExp; handler: (match: RegExpMatchArray) => string; fix?: undefined }
    > = [
      // "cinco ochenta" pattern - LLaMA thinks it's 580 instead of 5.80
      { pattern: /cinco\s+ochenta/i, fix: '5.80' },
      // "X soles Y" pattern
      { pattern: /(\d+)\s+soles?\s+(\d+)/i, handler: (match: RegExpMatchArray) => `${match[1]}.${match[2].padStart(2, '0')}` }
    ];
    
    for (const p of spanishNumberPatterns) {
      const match = transcript.match(p.pattern);
      if (match) {
        if (p.fix !== undefined) {
          // Direct fix
          if (correctedAmount === '580.00' || correctedAmount === '580') {
            correctedAmount = p.fix;
            console.log(`🔧 Fixed Spanish number parsing: "${transcript}" → ${correctedAmount} (was ${result.amount})`);
          }
        } else if (p.handler) {
          // Dynamic fix
          const expectedAmount = p.handler(match);
          if (correctedAmount !== expectedAmount) {
            correctedAmount = expectedAmount;
            console.log(`🔧 Fixed currency parsing: "${transcript}" → ${correctedAmount} (was ${result.amount})`);
          }
        }
        break;
      }
    }
    
    // Validate and sanitize result
    const parsedTransaction = {
      amount: correctedAmount,
      description: String(result.description || ''),
      type: (result.type === 'income' ? 'income' : 'expense') as 'income' | 'expense',
      date: result.date || new Date().toISOString().split('T')[0],
      category: String(result.category || ''),
      note: transcript
    };
    
    console.log('🧠 Groq LLaMA parsed transaction:', parsedTransaction);
    return parsedTransaction;
    
  } catch (error) {
    console.error('❌ Groq LLaMA parsing failed:', error);
    throw new Error(`Transaction parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Intelligent category matching using Groq LLaMA
export async function matchCategoryIntelligently(
  suggestedCategory: string,
  existingCategories: Array<{id: number, name: string, type: string}>,
  userLanguage: string = 'en-us'
): Promise<{
  matchedCategory?: {id: number, name: string},
  createNew?: boolean,
  newCategoryName?: string
}> {
  try {
    console.log('🧠 Starting intelligent category matching with Groq LLaMA...');
    
    const languageMap: { [key: string]: string } = {
      'en-us': 'English',
      'es-pe': 'Spanish', 
      'sk-sk': 'Slovak'
    };
    
    const language = languageMap[userLanguage] || 'English';
    
    const systemPrompt = `You are an expert at matching financial categories intelligently. Your task is to find the best logical match between a suggested category and existing user categories.

USER PREFERENCES:
- Language: ${language}

RESPOND ONLY WITH VALID JSON:
{
  "matchedCategory": {"id": 123, "name": "Matched Category Name"},
  "createNew": false,
  "newCategoryName": ""
}

MATCHING RULES:
1. EXACT MATCH: If suggested category matches exactly (case-insensitive), return that category
2. LOGICAL MATCH: Find the closest logical meaning match:
   - "Food" matches "Jedlo", "Comida", "Alimentación", "Groceries", "Restaurant" 
   - "Transport" matches "Doprava", "Transporte", "Car", "Gas", "Uber"
   - "Shopping" matches "Nákupy", "Compras", "Retail", "Clothes", "Electronics"
   - "Entertainment" matches "Zábava", "Entretenimiento", "Movies", "Games"
   - "Bills" matches "Účty", "Servicios", "Utilities", "Internet", "Phone"
   - "Healthcare" matches "Zdravie", "Salud", "Medical", "Pharmacy", "Doctor"
3. SEMANTIC SIMILARITY: Consider synonyms and related concepts
4. CREATE NEW: Only if no logical match exists at all

IMPORTANT:
- Prioritize logical meaning over exact words
- Consider multilingual equivalents
- Return the existing category that makes most sense
- Only create new category if truly no match exists`;

    const userPrompt = `SUGGESTED CATEGORY: "${suggestedCategory}"

EXISTING CATEGORIES:
${existingCategories.map(cat => `- ${cat.name} (ID: ${cat.id}, Type: ${cat.type})`).join('\n')}

Find the best match or decide if new category should be created.`;

    const response = await createChat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from Groq LLaMA');
    }

    const result = JSON.parse(content.trim());
    console.log('🧠 Groq category matching result:', result);

    return result;

  } catch (error) {
    console.error('❌ Groq category matching failed:', error);
    throw new Error(`Category matching failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}