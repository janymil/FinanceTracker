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
export async function parseTransactionWithGroq(transcript: string, userLanguage: string): Promise<{
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
    
    const systemPrompt = `You are a financial transaction parser. Extract transaction data from speech transcripts.

RESPOND ONLY WITH VALID JSON IN THIS EXACT FORMAT:
{
  "amount": "25.50",
  "description": "Coffee at Starbucks",
  "type": "expense",
  "date": "2025-07-21",
  "category": "Comida",
  "note": "original transcript"
}

CRITICAL PARSING RULES:
1. AMOUNT EXTRACTION - Look for:
   - Numbers: "25", "25.50", "dos soles", "thirty-five", "päťdesiat eur"
   - Words: "veinte soles" = "20", "twenty dollars" = "20", "päťdesiat" = "50"
   - Currency mentions: "soles", "dollars", "euros", "pesos"
   
2. DESCRIPTION - Extract merchant/purpose:
   - "compré en Totus" → "Totus"
   - "gasté en KFC" → "KFC" 
   - "pago de Netflix" → "Netflix"

3. CATEGORIES in ${language}:
   ${language === 'Spanish' ? 'Comida, Transporte, Compras, Entretenimiento, Servicios, Salud, Ingresos, Otros' : 
     language === 'Slovak' ? 'Potraviny, Doprava, Nakupovanie, Zábava, Účty, Zdravie, Príjmy, Ostatné' :
     'Food, Transport, Shopping, Entertainment, Bills, Healthcare, Income, Other'}

4. TYPE: Usually "expense" unless clearly income ("salary", "sueldo", "plat")

5. DATE: Today unless specified ("ayer"→yesterday, "yesterday"→yesterday)

EXAMPLES:
"gasté veinte soles en Totus" → {"amount":"20","description":"Totus","type":"expense","category":"Comida"}
"paid 35 dollars at KFC yesterday" → {"amount":"35","description":"KFC","type":"expense","category":"Food","date":"2025-07-20"}
"dostal som päťdesiat eur plat" → {"amount":"50","description":"Salary","type":"income","category":"Príjmy"}`;

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
    
    // Validate and sanitize result with fallback parsing
    let amount = String(result.amount || '');
    let description = String(result.description || '');
    let category = String(result.category || '');
    
    // Fallback parsing if LLaMA failed
    if (!amount || !description) {
      console.log('⚠️ LLaMA parsing incomplete, applying fallback logic...');
      
      // Try to extract amount with regex
      const amountMatches = transcript.match(/(\d+(?:\.\d{2})?)|(\b(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\b)|(\b(?:un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|veinte|treinta|cuarenta|cincuenta)\b)/gi);
      if (amountMatches && !amount) {
        const match = amountMatches[0];
        if (/^\d+/.test(match)) {
          amount = match;
        } else {
          // Basic word-to-number conversion
          const wordToNum: {[key: string]: string} = {
            'dos': '2', 'tres': '3', 'cuatro': '4', 'cinco': '5',
            'two': '2', 'three': '3', 'four': '4', 'five': '5',
            'veinte': '20', 'twenty': '20', 'treinta': '30', 'thirty': '30'
          };
          amount = wordToNum[match.toLowerCase()] || '';
        }
      }
      
      // Extract merchant/description
      if (!description) {
        // Look for common patterns
        const merchantPattern = /(?:en|at|from|de)\s+([A-Za-z]+)/i;
        const merchantMatch = transcript.match(merchantPattern);
        description = merchantMatch ? merchantMatch[1] : transcript.trim();
      }
      
      // Default category based on language
      if (!category) {
        const defaultCategories = {
          'Spanish': 'Otros',
          'Slovak': 'Ostatné', 
          'English': 'Other'
        };
        category = defaultCategories[language] || 'Other';
      }
    }

    const parsedTransaction = {
      amount: amount,
      description: description || 'Transaction',
      type: (result.type === 'income' ? 'income' : 'expense') as 'income' | 'expense',
      date: result.date || new Date().toISOString().split('T')[0],
      category: category,
      note: transcript
    };
    
    console.log('🧠 Groq LLaMA parsed transaction:', parsedTransaction);
    return parsedTransaction;
    
  } catch (error) {
    console.error('❌ Groq LLaMA parsing failed:', error);
    throw new Error(`Transaction parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}