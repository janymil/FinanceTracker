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
    
    const systemPrompt = `You are an expert at parsing financial transactions from natural speech. Parse the user's speech into structured transaction data.

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
- AMOUNT: Extract any numeric value mentioned (including written numbers like "twenty", "veinte", "päťdesiat")
- DESCRIPTION: Extract merchant name, store name, or what the money was spent on
- TYPE: "expense" for spending money, "income" for receiving money
- CATEGORY: Choose appropriate category in ${language}
- DATE: Use today's date (2025-07-21) unless another date is clearly mentioned

CATEGORIES FOR ${language}:
${language === 'Spanish' ? 'Comida, Transporte, Compras, Entretenimiento, Servicios, Salud, Ingresos, Otros' : 
  language === 'Slovak' ? 'Potraviny, Doprava, Nakupovanie, Zábava, Účty, Zdravie, Príjmy, Ostatné' :
  'Food, Transport, Shopping, Entertainment, Bills, Healthcare, Income, Other'}

IMPORTANT: 
- Always extract the amount as a number, even if spoken as words
- Use your knowledge to categorize any merchant or expense type
- If unclear, make your best intelligent guess based on context`;

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