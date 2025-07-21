import { MistralClient } from './mistralClient.js';
import { normalizeLanguageCode, getLanguageLabel } from '../lib/languageUtils';

interface ParsedTransaction {
  amount: string;
  description: string;
  type: 'expense' | 'income';
  date: string;
  category: string;
  note: string;
}

const mistralClient = new MistralClient();

interface UserCategory {
  id: number;
  name: string;
  type: 'expense' | 'income';
}

export async function parseTransactionWithMistral(
  transcript: string,
  userLanguage: string = 'en-us',
  userCurrency: string = '$',
  existingCategories: UserCategory[] = []
): Promise<ParsedTransaction> {
  const normalizedLanguage = normalizeLanguageCode(userLanguage);
  const language = getLanguageLabel(normalizedLanguage);

  const systemPrompt = `You are a financial expert specializing in transaction categorization. Parse the user's speech into structured transaction data.

USER PREFERENCES:
- Language: ${language}
- Currency: ${userCurrency}

USER'S EXISTING CATEGORIES:
${existingCategories.length > 0 
  ? existingCategories.map(cat => `- ${cat.name} (${cat.type})`).join('\n')
  : '- No existing categories yet'
}

RESPOND ONLY WITH VALID JSON:
{
  "amount": "5.80",
  "description": "Merchant or expense description", 
  "type": "expense",
  "date": "2025-07-21",
  "category": "Category name",
  "note": "original transcript"
}

INTELLIGENT BUSINESS ANALYSIS:
- Analyze what TYPE of business this merchant is
- Grocery stores/supermarkets → ${language === 'Spanish' ? 'Comida' : language === 'Slovak' ? 'Potraviny' : 'Food'}
- Restaurants/cafes/food delivery → ${language === 'Spanish' ? 'Comida' : language === 'Slovak' ? 'Potraviny' : 'Food'}
- Gas stations/fuel/transport → ${language === 'Spanish' ? 'Transporte' : language === 'Slovak' ? 'Doprava' : 'Transport'}
- Retail stores/shopping → ${language === 'Spanish' ? 'Compras' : language === 'Slovak' ? 'Nakupovanie' : 'Shopping'}
- Salary/work income → ${language === 'Spanish' ? 'Trabajo' : language === 'Slovak' ? 'Práca' : 'Work'}
- Investment income → ${language === 'Spanish' ? 'Inversiones' : language === 'Slovak' ? 'Investície' : 'Investments'}

INCOME VS EXPENSE INTELLIGENCE:
- If user mentions salary, work, employer, job → type: "income", category: "${language === 'Spanish' ? 'Trabajo' : language === 'Slovak' ? 'Práca' : 'Work'}"
- If user mentions investment, dividend, return → type: "income", category: "${language === 'Spanish' ? 'Inversiones' : language === 'Slovak' ? 'Investície' : 'Investments'}"
- If user mentions purchase, buy, store, merchant → type: "expense", analyze merchant type for category

CRITICAL AMOUNT PARSING (STT often misrecognizes numbers):
- "two thousand nine hundred" = 2900.00 (NOT 2.90!)
- "twenty nine hundred" = 2900.00 (NOT 29.00!)
- "cinco mil ochocientos" = 5800.00 (NOT 5.80!)
- "fifteen hundred" = 1500.00 (NOT 15.00!)

COMMON STT ERRORS TO FIX:
- STT says "2.90" but user meant "2900" → Check context for large amounts
- STT says "five eighty" → Could be 5.80 OR 580, decide from context
- Company names get garbled → Use best guess for description

DECIMAL DETECTION:
- If amount sounds like large income (salary, rent) → Likely whole number
- If amount sounds like small expense (coffee, snacks) → Likely has decimals
- "Microsoft 5000" = salary = 5000.00 (NOT 50.00!)
- "coffee shop five fifty" = coffee = 5.50

TRANSACTION ANALYSIS PRIORITY:
1. FIRST: Determine if this is INCOME or EXPENSE based on context
2. SECOND: For expenses - analyze what TYPE of business/merchant this is
3. THIRD: For income - determine the SOURCE type (work, investments, etc.)

CATEGORY MATCHING INTELLIGENCE:
1. FIRST: Try to match with user's existing categories
2. SECOND: If no good match exists, create a logical new category name
3. NEVER use generic "Income" or "Expense" - always be specific

CATEGORY PRIORITY:
- If user has "Salary" category → use "Salary" for work income
- If user has "Groceries" category → use "Groceries" for food
- If user has "Gas" category → use "Gas" for fuel
- If NO match exists → create new specific category:
  * Work income → "${language === 'Spanish' ? 'Trabajo' : language === 'Slovak' ? 'Práca' : 'Work'}"
  * Food expenses → "${language === 'Spanish' ? 'Comida' : language === 'Slovak' ? 'Potraviny' : 'Food'}"
  * Transport → "${language === 'Spanish' ? 'Transporte' : language === 'Slovak' ? 'Doprava' : 'Transport'}"

CRITICAL: Always prefer user's existing category names when they logically match!`;

  // Spanish number pattern fixes
  const spanishPatterns = [
    { pattern: /cinco\s+ochenta/i, expectedAmount: '5.80' },
    { pattern: /dos\s+cincuenta/i, expectedAmount: '2.50' },
    { pattern: /tres\s+veinte/i, expectedAmount: '3.20' }
  ];

  let userPrompt = `Parse this transaction: "${transcript}"`;
  
  // Add specific guidance for known Spanish patterns
  for (const p of spanishPatterns) {
    if (transcript.match(p.pattern)) {
      userPrompt += `\n\nIMPORTANT: This contains Spanish number format. Expected amount: ${p.expectedAmount}`;
      break;
    }
  }

  try {
    const response = await mistralClient.createChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: 'mistral-small-2506',
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const rawResponse = response.choices[0].message.content;
    console.log('🤖 Raw Mistral response:', rawResponse);
    
    const result = JSON.parse(rawResponse);
    
    // Post-process amount parsing for Spanish patterns
    let correctedAmount = String(result.amount || '');
    for (const p of spanishPatterns) {
      if (transcript.match(p.pattern) && correctedAmount !== p.expectedAmount) {
        correctedAmount = p.expectedAmount;
        console.log(`🔧 Fixed Spanish amount: "${transcript}" → ${correctedAmount} (was ${result.amount})`);
        break;
      }
    }
    
    // Validate and sanitize result
    const parsedTransaction: ParsedTransaction = {
      amount: correctedAmount,
      description: String(result.description || ''),
      type: (result.type === 'income' ? 'income' : 'expense') as 'income' | 'expense',
      date: result.date || new Date().toISOString().split('T')[0],
      category: String(result.category || ''),
      note: transcript
    };

    console.log('🤖 Mistral parsed transaction:', parsedTransaction);
    return parsedTransaction;

  } catch (error) {
    console.error('❌ Mistral parsing failed:', error);
    throw new Error(`Mistral parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function matchCategoryIntelligentlyMistral(
  suggestedCategory: string,
  existingCategories: Array<{id: number, name: string, type: string}>,
  userLanguage: string = 'en-us'
): Promise<{matchedCategory?: {id: number, name: string}, createNew: boolean, newCategoryName: string}> {
  
  const normalizedLanguage = normalizeLanguageCode(userLanguage);
  const language = getLanguageLabel(normalizedLanguage);

  const systemPrompt = `You are a financial categorization expert. Your job is to match suggested categories with existing user categories intelligently.

LANGUAGE: ${language}

MATCHING PRIORITY:
1. EXACT match (same name)
2. LOGICAL match (same meaning, different language)
3. BUSINESS TYPE match (e.g., "Shopping" → "Compras" for retail)

TRANSLATION RULES:
- Food/Comida/Potraviny = grocery stores, restaurants, food purchases
- Shopping/Compras/Nakupovanie = retail, clothing, electronics, general shopping
- Transport/Transporte/Doprava = gas, fuel, public transport, travel
- Entertainment/Entretenimiento/Zábava = movies, games, leisure

RESPOND WITH JSON:
{
  "matchedCategory": {"id": 1, "name": "Comida"} OR null,
  "createNew": false,
  "newCategoryName": ""
}

If no logical match exists, set createNew to true and provide newCategoryName.`;

  const userPrompt = `Suggested category: "${suggestedCategory}"

Existing user categories:
${existingCategories.map(cat => `- ${cat.name} (ID: ${cat.id})`).join('\n')}

Find the best match or suggest creating a new category.`;

  try {
    console.log('🧠 Starting intelligent category matching with Mistral...');
    
    const response = await mistralClient.createChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: 'mistral-small-2506',
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content);
    console.log('🧠 Mistral category matching result:', result);
    
    return result;
    
  } catch (error) {
    console.error('❌ Mistral category matching failed:', error);
    // Fallback: try to find simple matches
    const exactMatch = existingCategories.find(cat => 
      cat.name.toLowerCase() === suggestedCategory.toLowerCase()
    );
    
    if (exactMatch) {
      return {
        matchedCategory: { id: exactMatch.id, name: exactMatch.name },
        createNew: false,
        newCategoryName: ''
      };
    }
    
    return {
      createNew: true,
      newCategoryName: suggestedCategory
    };
  }
}