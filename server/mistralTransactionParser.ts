import { MistralClient } from './mistralClient.js';
import { normalizeLanguageCode, getLanguageLabel } from '../lib/languageUtils';
import { applyAmountCorrections, findAmountCorrection } from '../shared/voiceCorrections';

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

CRITICAL: You MUST respond exclusively in ${language} language. All categories, descriptions, and text MUST be in ${language}.

USER PREFERENCES:
- Language: ${language}
- Currency: ${userCurrency}

RESPOND ONLY WITH VALID JSON (all text fields in ${language}):
{
  "amount": "5.80",
  "description": "Store/Merchant + Product/Service in ${language}", 
  "type": "expense",
  "date": "2025-07-21",
  "category": "Category name in ${language}",
  "note": "original transcript"
}

DESCRIPTION FORMAT RULES:
- ALWAYS include store/merchant name + product/service
- Examples: "Metro - detergente", "McDonald's - almuerzo", "Shell - gasolina"
- Format: "[STORE] - [PRODUCT]" or "[STORE] [PRODUCT]"

USER'S ACTUAL CATEGORIES (REAL DATA FROM DATABASE):
${userCategories.length > 0 ? userCategories.map(cat => `- "${cat.name}" (${cat.type})`).join('\n') : 'No existing categories - will suggest new category'}

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

CURRENCY FORMAT:
User's preferred currency: ${userCurrency}
Format amounts as: ${userCurrency}XX.XX (e.g., ${userCurrency}35.80)

INTELLIGENT CATEGORIZATION LOGIC:

STEP 1: ANALYZE WHAT WAS PURCHASED (PRODUCT INTELLIGENCE)
- DETERGENTE/CLEANING = Household/Home products → Look for: Housing, Casa, Hogar, Home, Limpieza, Household
- MEDICINA/FARMACIA = Healthcare products → Look for: Healthcare, Salud, Zdravie, Medical
- COMIDA/FOOD = Food products → Look for: Food, Comida, Potraviny, Groceries, Alimentación
- GASOLINA/FUEL = Transport → Look for: Transport, Transporte, Doprava, Gas, Combustible
- ROPA/CLOTHES = General shopping → Look for: Shopping, Compras, Nakupovanie, Clothes

STEP 2: INTELLIGENT CATEGORY MATCHING
Scan user's categories for SEMANTIC matches based on product type:
- If user has "Housing" and product is "detergente" → USE "Housing" (perfect match)
- If user has "Casa" and product is "detergente" → USE "Casa" (perfect match)
- If user has "Shopping" and product is "detergente" → DON'T use "Shopping" (wrong match)

STEP 3: IF NO LOGICAL MATCH EXISTS
Suggest NEW category name appropriate for product type in user's language:
- For cleaning products → suggest "Hogar" (Spanish), "Dom" (Slovak), "Household" (English)
- For healthcare → suggest "Salud" (Spanish), "Zdravie" (Slovak), "Healthcare" (English)

CRITICAL INTELLIGENCE RULES:
- DETERGENTE is NOT Shopping - it's household/cleaning
- MEDICINA is NOT Shopping - it's healthcare  
- GASOLINA is NOT Shopping - it's transport
- Use LOGIC, not just keyword matching`;

  // Spanish spoken-number patterns live in shared/voiceCorrections.ts (pure, tested).
  const amountHint = findAmountCorrection(transcript);

  let userPrompt = `Parse this transaction: "${transcript}"

PRODUCT INTELLIGENCE ANALYSIS:
1. What specific PRODUCT/SERVICE is mentioned in the transcript?
2. What TYPE of product is it? (cleaning/healthcare/food/transport/entertainment)
3. Which of user's categories logically fits this product type?

CRITICAL EXAMPLES FOR PROPER CATEGORIZATION:
- "detergente" = cleaning product → Housing/Casa/Hogar (NOT Shopping!)
- "medicina" = healthcare product → Healthcare/Salud (NOT Shopping!)  
- "gasolina" = fuel → Transport/Transporte (NOT Shopping!)
- "comida" = food product → Food/Comida (correct)

ANALYZE THE PRODUCT TYPE FIRST, then choose the most logical category from user's list.`;
  
  // Add specific guidance for known Spanish patterns
  if (amountHint) {
    userPrompt += `\n\nIMPORTANT: This contains Spanish number format. Expected amount: ${amountHint.expectedAmount}`;
  }

  try {
    const response = await mistralClient.createChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: 'mistral-small-latest',
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const rawResponse = response.choices[0].message.content;
    console.log('🤖 Raw Mistral response:', rawResponse);
    
    const result = JSON.parse(rawResponse);
    
    // Post-process amount parsing for Spanish patterns
    const correction = applyAmountCorrections(transcript, result.amount);
    const correctedAmount = correction.amount;
    if (correction.corrected) {
      console.log(`🔧 Fixed Spanish amount: "${transcript}" → ${correctedAmount} (was ${result.amount})`);
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
      model: 'mistral-small-latest',
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