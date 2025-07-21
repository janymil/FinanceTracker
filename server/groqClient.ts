import Groq from 'groq-sdk';

if (!process.env.GROQ_API_KEY) {
  throw new Error('GROQ_API_KEY must be set in environment variables');
}

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Groq STT using Distil-Whisper
export async function transcribeAudioWithGroq(audioBuffer: Buffer): Promise<string> {
  try {
    console.log('🎙️ Starting Groq STT with Distil-Whisper...');
    
    const transcription = await groq.audio.transcriptions.create({
      file: new File([audioBuffer], 'audio.wav', { type: 'audio/wav' }),
      model: 'distil-whisper-large-v3-en',
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
  "amount": "25.50",
  "description": "Merchant or expense description", 
  "type": "expense",
  "date": "2025-07-21",
  "category": "Category name",
  "note": "original transcript"
}

PARSING INSTRUCTIONS:
- AMOUNT: Extract numeric value (including written numbers like "twenty", "veinte", "päťdesiat", "dos soles", "fifty euros")
- DESCRIPTION: Extract merchant name, store name, or what the money was spent on
- TYPE: "expense" for spending money, "income" for receiving money
- CATEGORY: Choose appropriate category in ${language}
- DATE: Use today's date (2025-07-21) unless another date is clearly mentioned

CATEGORIES FOR ${language}:
${language === 'Spanish' ? 'Comida, Transporte, Compras, Entretenimiento, Servicios, Salud, Ingresos, Otros' : 
  language === 'Slovak' ? 'Potraviny, Doprava, Nakupovanie, Zábava, Účty, Zdravie, Príjmy, Ostatné' :
  'Food, Transport, Shopping, Entertainment, Bills, Healthcare, Income, Other'}

CURRENCY CONTEXT:
- User's currency is ${userCurrency}
- Parse amounts mentioned in any currency but extract the numeric value
- Example: "spent twenty dollars" → "20", "gasté dos soles" → "2", "päťdesiat eur" → "50"

IMPORTANT: 
- Always extract the amount as a number, even if spoken as words
- Use your knowledge to categorize any merchant or expense type
- Consider user's currency context but extract pure numeric amounts`;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `Parse this transaction: "${transcript}"`
        }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const rawResponse = completion.choices[0].message.content || '{}';
    console.log('🧠 Raw LLaMA response:', rawResponse);
    
    const result = JSON.parse(rawResponse);
    
    // Validate and sanitize result - let LLaMA do all the work
    const parsedTransaction = {
      amount: String(result.amount || ''),
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

    const response = await groq.chat.completions.create({
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