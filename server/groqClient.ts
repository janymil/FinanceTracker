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
    
    const systemPrompt = `You are a financial transaction parser. Analyze the user's speech transcript and extract transaction data.

CRITICAL REQUIREMENTS:
- Respond ONLY with valid JSON in exactly this format
- Use the user's language (${language}) for category names
- Always set a date (use today if not specified)
- Amount must be numeric string or empty string
- Type must be "income" or "expense"

JSON FORMAT:
{
  "amount": "25.50",
  "description": "Merchant Name",
  "type": "expense",
  "date": "2025-07-21",
  "category": "Food",
  "note": "Original transcript"
}

LANGUAGE-SPECIFIC CATEGORIES:
English: Food, Transport, Shopping, Entertainment, Bills, Healthcare, Income, Other
Spanish: Supermercado, Transporte, Compras, Entretenimiento, Servicios, Salud, Ingresos, Otros  
Slovak: Potraviny, Doprava, Nakupovanie, Zábava, Účty, Zdravie, Príjmy, Ostatné

DATE PARSING:
- "today/dnes/hoy" → today's date
- "yesterday/včera/ayer" → yesterday's date
- Otherwise use today's date

AMOUNT PARSING:
- Extract numeric amounts: "25", "25.50", "twenty-five"
- Slovak: "tridsatpet" = "35", "päťdesiat" = "50"
- Spanish: "treinta y cinco" = "35"
- If no clear amount, leave empty string`;

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

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    
    // Validate and sanitize result
    const parsedTransaction = {
      amount: String(result.amount || ''),
      description: String(result.description || 'Transaction'),
      type: (result.type === 'income' ? 'income' : 'expense') as 'income' | 'expense',
      date: result.date || new Date().toISOString().split('T')[0],
      category: String(result.category || 'Other'),
      note: transcript
    };
    
    console.log('🧠 Groq LLaMA parsed transaction:', parsedTransaction);
    return parsedTransaction;
    
  } catch (error) {
    console.error('❌ Groq LLaMA parsing failed:', error);
    throw new Error(`Transaction parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}