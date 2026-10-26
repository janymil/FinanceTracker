import { log } from './logger';
import { AI_MODELS, createRoutedClient } from '../lib/aiProvider';
import { normalizeLanguageCode, getLanguageLabel } from '../lib/languageUtils';
import { parseModelJson, validCategoryId } from '../shared/aiResults';
import { applyAmountCorrections, findAmountCorrection } from '../shared/voiceCorrections';
import { matchCategoryLocally } from './categoryMatcher';

interface ParsedTransaction {
  amount: string;
  description: string;
  type: 'expense' | 'income';
  date: string;
  category: string;
  note: string;
}

/**
 * Voice parsing used to call Mistral directly. It now goes through lib/aiProvider like every
 * other prompt: the ai-processor gateway first (Mistral model), then the shared fallback chain,
 * with the anonymiser applied at that one choke point.
 */
const routed = createRoutedClient();
const mistralClient = {
  createChatCompletion: (request: any) =>
    routed.chat.completions.create({
      ...request,
      model: AI_MODELS.voice,
      max_tokens: request.max_tokens ?? 1000,
      task: 'voice-parse',
    } as any),
};

export async function parseTransactionWithMistral(
  transcript: string,
  userLanguage: string = 'en-us',
  userCurrency: string = '$',
  userCategories: Array<{id: number, name: string, type: string}> = []
): Promise<ParsedTransaction> {
  const normalizedLanguage = normalizeLanguageCode(userLanguage);
  const language = getLanguageLabel(normalizedLanguage);

  // The date comes from the clock, never from the prompt text: a fixed date in the example
  // was copied by the model and saved entries months in the past.
  const today = new Date().toISOString().slice(0, 10);

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
  "date": "${today}",
  "category": "Category name in ${language}",
  "note": "original transcript"
}

DATE RULE:
- Use today's date (${today}) unless the person clearly said another date ("ayer", "včera", "yesterday", "on Monday").

DESCRIPTION FORMAT RULES:
- ALWAYS include store/merchant name + product/service
- Examples: "Metro - detergente", "McDonald's - almuerzo", "Shell - gasolina"
- Format: "[STORE] - [PRODUCT]" or "[STORE] [PRODUCT]"

USER'S ACTUAL CATEGORIES (these are the only categories that exist):
${userCategories.length > 0 ? userCategories.map(cat => `- ${cat.name} (ID: ${cat.id}, ${cat.type})`).join('\n') : 'No categories yet - suggest one short new name'}

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
Write the amount as a plain number with a dot and two decimals: 35.80.
Never put a currency symbol or code inside the amount - the app adds it from the user's settings.

HOW TO CHOOSE THE CATEGORY:

STEP 1: WHAT WAS BOUGHT?
Decide the product type from the words in the sentence, in any language:
- cleaning or household supplies (detergente, čistiaci prostriedok, cleaner) = household
- medicine or pharmacy (medicina, lieky, farmacia) = health
- food, groceries, a restaurant (comida, potraviny, lunch) = food
- fuel or transport (gasolina, benzín, taxi, parking) = transport
- clothes, electronics, general retail (ropa, oblečenie) = shopping
- a subscription, a phone or internet bill = bills

STEP 2: WHICH OF THE PERSON'S CATEGORIES COVERS IT?
- Use the category's EXACT name as written in the list above. The app matches the name
  character for character, so a translated or reworded name is a miss and the tip is lost.
- One product type can only land in one category; choose the most specific one.

STEP 3: ONLY WHEN NOTHING FITS
- Suggest ONE short new name (1-2 words) in the person's language, and keep it generic
  ("Household", "Health"), not the product itself ("Detergent").

A cleaning product is not "shopping", medicine is not "shopping" and fuel is not "shopping":
those three are the mistakes this rule exists to stop. Decide from the product, not from the
shop's name.`

  // Spanish spoken-number patterns live in shared/voiceCorrections.ts (pure, tested).
  const amountHint = findAmountCorrection(transcript);

  let userPrompt = `Parse this transaction: "${transcript}"

Decide the product type first, then the category:
1. What product or service is actually mentioned?
2. What type is it - household, health, food, transport, shopping, entertainment, bills?
3. Which of the person's categories (names exactly as listed) covers that type?

The words can come in any language; the logic is the same:
- a cleaning product (detergente, čistiaci prostriedok) is household, not shopping
- medicine (medicina, lieky) is health, not shopping
- fuel (gasolina, benzín) is transport, not shopping
- food (comida, potraviny) is food

If one of the categories matches, return its exact name. Only if none matches, propose one short
new name that describes the type, not the product.`;
  
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
      // The model is pinned by lib/aiProvider (AI_MODELS.voice); naming one here would only
      // look like it decides something.
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    // Not logged: it is derived from what the person said.
    const result = parseModelJson(response.choices[0].message.content);
    
    // Post-process amount parsing for Spanish patterns
    const correction = applyAmountCorrections(transcript, result.amount);
    const correctedAmount = correction.amount;
    if (correction.corrected) {
      log.debug('Spanish amount correction applied');
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

    log.info('🤖 Mistral parsed transaction:', parsedTransaction);
    return parsedTransaction;

  } catch (error) {
    log.error('❌ Mistral parsing failed:', error);
    throw new Error(`Mistral parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function matchCategoryIntelligentlyMistral(
  suggestedCategory: string,
  existingCategories: Array<{id: number, name: string, type: string}>,
  userLanguage: string = 'en-us'
): Promise<{matchedCategory?: {id: number, name: string}, createNew: boolean, newCategoryName: string}> {
  /*
   * Local first, model second. Nothing calls this today (the voice route uses the local matcher
   * directly), but it is exported, so it must not be a second, weaker implementation of
   * server/categoryMatcher.ts: an exact or near-exact name never needs a paid call.
   */
  const local = matchCategoryLocally(suggestedCategory, existingCategories, userLanguage);
  const localAnswer = local.matchedCategory
    ? {
        matchedCategory: { id: local.matchedCategory.id, name: local.matchedCategory.name },
        createNew: false,
        newCategoryName: '',
      }
    : { createNew: true, newCategoryName: local.newCategoryName || suggestedCategory };

  if (local.matchedCategory && local.confidence >= 0.9) return localAnswer;

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
    log.info('🧠 Starting intelligent category matching with Mistral...');
    
    const response = await mistralClient.createChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const result = parseModelJson(response.choices[0].message.content);

    // The model may only match one of the person's own categories; an id it made up is no match.
    if (result.matchedCategory && validCategoryId(result.matchedCategory.id, existingCategories) === undefined) {
      return {
        createNew: true,
        newCategoryName: String(result.newCategoryName || suggestedCategory),
      };
    }

    return result as any;
    
  } catch (error) {
    log.error('Category matching failed, using the local answer:', error);
    // The local answer cannot fail and needs no network, so it is the fallback.
    return localAnswer;
  }
}