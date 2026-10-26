import { log } from './logger';
import Groq from 'groq-sdk';
import { createRoutedClient } from '../lib/aiProvider';
import { getLanguageLabel, normalizeLanguageCode } from '../lib/languageUtils';
import { validCategoryId } from '../shared/aiResults';
import { matchCategoryLocally } from './categoryMatcher';
import { parseTransactionWithMistral } from './mistralTransactionParser';

/**
 * A local name match at least this close needs no second, paid opinion:
 * 1.0 is the same name, 0.95 is the same concept in another language.
 */
const LOCAL_MATCH_THRESHOLD = 0.9;

if (!process.env.GROQ_API_KEY) {
  log.warn('GROQ_API_KEY not set in environment variables - Groq voice features will be unavailable until configured.');
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
    log.info('🎙️ Starting Groq STT with Distil-Whisper...');
    
    const transcription = await groq.audio.transcriptions.create({
      file: new File([audioBuffer], 'audio.wav', { type: 'audio/wav' }),
      model: 'whisper-large-v3-turbo',
      response_format: 'text'
    });

    // The transcription is what the person said: log its shape, never its text.
    log.debug('Groq STT finished', { characters: String(transcription || '').length });
    return String(transcription || '');
  } catch (error) {
    log.error('❌ Groq STT failed:', error);
    throw new Error(`Speech-to-text failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Speech to text stays on Groq; the parsing prompt is shared with the other voice route.
/**
 * Voice parsing, second entry point (the Groq voice route).
 *
 * This used to be a thinner copy of the prompt in `mistralTransactionParser.ts`: fewer rules, a
 * language table keyed to exactly "sk-sk" / "es-pe" / "en-us" (any other code silently produced
 * English instructions), and a model name that the router replaced anyway. Two copies of the same
 * prompt mean a fix lands in one and the other stays broken, so this one now delegates to the
 * single prompt. What is genuinely Groq-specific - speech to text - stays above.
 */
export async function parseTransactionWithGroq(
  transcript: string,
  userLanguage: string,
  userCurrency: string = '$',
): Promise<{
  amount: string;
  description: string;
  type: 'income' | 'expense';
  date: string;
  category: string;
  note: string;
}> {
  const parsed = await parseTransactionWithMistral(transcript, userLanguage, userCurrency);

  return {
    amount: parsed.amount,
    description: parsed.description,
    type: parsed.type,
    date: parsed.date,
    category: parsed.category,
    note: parsed.note,
  };
}

/**
 * Category matching for the Groq route.
 *
 * Local first: an exact name, a containment or a small edit distance is free, instant and gives
 * the same answer on every run. The model is only worth paying for when the local answer is weak,
 * and if the model fails (or returns an id that is not the person's), the local answer is used.
 */
export async function matchCategoryIntelligently(
  suggestedCategory: string,
  existingCategories: Array<{id: number, name: string, type: string}>,
  userLanguage: string = 'en-us'
): Promise<{
  matchedCategory?: {id: number, name: string},
  createNew?: boolean,
  newCategoryName?: string
}> {
  const local = matchCategoryLocally(suggestedCategory, existingCategories, userLanguage);

  const localAnswer = local.matchedCategory
    ? {
        matchedCategory: { id: local.matchedCategory.id, name: local.matchedCategory.name },
        createNew: false,
        newCategoryName: '',
      }
    : {
        createNew: true,
        newCategoryName: local.newCategoryName || suggestedCategory,
      };

  // A near-certain local match does not need a paid second opinion.
  if (local.matchedCategory && local.confidence >= LOCAL_MATCH_THRESHOLD) {
    return localAnswer;
  }

  try {
    log.info('🧠 Starting intelligent category matching with the model...');

    const language = getLanguageLabel(normalizeLanguageCode(userLanguage));

    const systemPrompt = `You match one suggested category to a person's existing categories.

APP LANGUAGE: ${language}

RESPOND ONLY WITH VALID JSON:
{
  "matchedCategory": {"id": 123, "name": "Matched category name"},
  "createNew": false,
  "newCategoryName": ""
}

MATCHING RULES, in order:
1. EXACT: the same name, ignoring case and surrounding spaces.
2. LOGICAL: the same meaning in another language or a synonym:
   - Food matches Jedlo, Comida, Alimentación, Groceries
   - Transport matches Doprava, Transporte, Car, Fuel
   - Shopping matches Nákupy, Compras, Retail, Clothes
   - Entertainment matches Zábava, Entretenimiento, Movies
   - Bills matches Účty, Servicios, Utilities, Internet
   - Health matches Zdravie, Salud, Medical, Pharmacy
3. NEW: only when nothing above fits, in which case give one short name in ${language}.

RULES:
- "id" must be copied from the list in the next message. Never invent one.
- When you match, "createNew" is false and "newCategoryName" is empty.`;

    const userPrompt = `SUGGESTED CATEGORY: "${suggestedCategory}"

EXISTING CATEGORIES:
${existingCategories.map(cat => `- ${cat.name} (ID: ${cat.id}, Type: ${cat.type})`).join('\n')}

Find the best match, or decide that a new category is needed.`;

    const response = await createChat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from the matching model');
    }

    const result = JSON.parse(content.trim());

    // An id the model made up is not a match. The local answer knows the real ids, so it wins.
    if (result?.matchedCategory && validCategoryId(result.matchedCategory.id, existingCategories) === undefined) {
      log.warn('Category matching returned an id that is not the person\'s; using the local answer');
      return localAnswer;
    }

    return result;

  } catch (error) {
    log.error('Category matching failed, using the local answer:', error);
    return localAnswer;
  }
}