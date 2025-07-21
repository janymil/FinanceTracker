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

export async function parseTransactionWithMistral(
  transcript: string,
  userLanguage: string = 'en-us',
  userCurrency: string = '$',
  userCategories: Array<{id: number, name: string, type: string}> = []
): Promise<ParsedTransaction> {
  const normalizedLanguage = normalizeLanguageCode(userLanguage);
  const language = getLanguageLabel(normalizedLanguage);

  const systemPrompt = `You are a financial expert specializing in transaction categorization. Parse the user's speech into structured transaction data.

USER PREFERENCES:
- Language: ${language}
- Currency: ${userCurrency}

RESPOND ONLY WITH VALID JSON:
{
  "amount": "5.80",
  "description": "Merchant or expense description", 
  "type": "expense",
  "date": "2025-07-21",
  "category": "Category name",
  "note": "original transcript"
}

MERCHANT INTELLIGENCE:
- Migros = Swiss grocery store = ${language === 'Spanish' ? 'Comida' : language === 'Slovak' ? 'Potraviny' : 'Food'}
- McDonald's = fast food restaurant = ${language === 'Spanish' ? 'Comida' : language === 'Slovak' ? 'Potraviny' : 'Food'}
- Shell, BP = gas stations = ${language === 'Spanish' ? 'Transporte' : language === 'Slovak' ? 'Doprava' : 'Transport'}
- Amazon, Walmart = retail shopping = ${language === 'Spanish' ? 'Compras' : language === 'Slovak' ? 'Nakupovanie' : 'Shopping'}

USER'S EXISTING CATEGORIES:
${userCategories.length > 0 ? userCategories.map(cat => `- ${cat.name} (${cat.type})`).join('\n') : 'No existing categories'}

CATEGORY MATCHING PRIORITY (CRITICAL):
1. MANDATORY: Choose from user's existing categories ONLY
2. Look for semantic matches: salary/trabajo/work → "Trabajo", food/comida → "Comida"  
3. ONLY use exact category names from user's list above
4. If NO user category matches AT ALL, use first available category from user's list

EXAMPLES WITH USER CATEGORIES:
- Salary/trabajo/work + user has "Trabajo" → use "Trabajo"
- Food/comida + user has "Comida" → use "Comida"
- Shopping + user has "Compras" → use "Compras"
- ANY transaction + no good match → use most appropriate category from user's list

CRITICAL AMOUNT PARSING:
- "cinco ochenta" = 5.80 (NOT 580!)
- "135 soles 80" = 135.80 (NOT 215!)
- "dos euros cincuenta" = 2.50
- "twenty dollars" = 20.00

MATHEMATICAL RULE:
For "[NUMBER] [CURRENCY] [NUMBER]" format:
- First number = main units
- Second number = cents/centavos  
- Result = First.Second (e.g., "15 euros 75" = 15.75)

CATEGORIZATION PRIORITY:
1. Analyze merchant/business TYPE first
2. Grocery stores/supermarkets → ${language === 'Spanish' ? 'Comida' : language === 'Slovak' ? 'Potraviny' : 'Food'}
3. Restaurants/cafes/food → ${language === 'Spanish' ? 'Comida' : language === 'Slovak' ? 'Potraviny' : 'Food'}
4. Gas/fuel/transport → ${language === 'Spanish' ? 'Transporte' : language === 'Slovak' ? 'Doprava' : 'Transport'}
5. Default retail → ${language === 'Spanish' ? 'Compras' : language === 'Slovak' ? 'Nakupovanie' : 'Shopping'}`;

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