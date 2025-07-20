import OpenAI from "openai";
import { getLanguageLabel, normalizeLanguageCode } from "../lib/languageUtils";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface TTSRequest {
  text: string;
  language?: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  speed?: number; // 0.25 to 4.0
}

export class TTSService {
  private static readonly VOICE_MAPPING = {
    'en-us': 'alloy',    // Clear, neutral American English
    'es-pe': 'nova',     // Warm, good for Spanish
    'sk-sk': 'echo'      // Clear, works well for Slovak
  } as const;

  /**
   * Generate speech audio from text using OpenAI TTS
   */
  static async generateSpeech(request: TTSRequest): Promise<Buffer> {
    const normalizedLanguage = normalizeLanguageCode(request.language || 'en-us');
    
    try {
      console.log('🔊 [TTS] Generating speech:', {
        text: request.text.substring(0, 50) + '...',
        language: normalizedLanguage,
        voice: request.voice || this.VOICE_MAPPING[normalizedLanguage] || 'alloy'
      });

      const response = await openai.audio.speech.create({
        model: "tts-1", // FAST model - not tts-1-hd for speed
        voice: request.voice || this.VOICE_MAPPING[normalizedLanguage] || 'alloy',
        input: request.text,
        speed: request.speed || 1.0, // NORMAL speed - 1.0x for natural conversation
        response_format: 'mp3' // MP3 is smaller than wav for speed
      });

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      
      console.log('✅ [TTS] Speech generated successfully:', {
        audioSize: audioBuffer.length,
        textLength: request.text.length
      });

      return audioBuffer;
    } catch (error) {
      console.error('❌ [TTS] Failed to generate speech:', error);
      throw new Error('Failed to generate speech audio');
    }
  }

  /**
   * Validate if the input is transaction-related
   */
  static isTransactionRelated(input: string): boolean {
    const transactionKeywords = [
      // English
      'spend', 'spent', 'buy', 'bought', 'paid', 'pay', 'cost', 'price', 'amount', 'money', 'dollar', 'euro',
      'store', 'shop', 'restaurant', 'gas', 'fuel', 'grocery', 'food', 'coffee', 'lunch', 'dinner',
      'uber', 'taxi', 'bus', 'train', 'transport', 'salary', 'income', 'wage', 'bill', 'rent',
      // Spanish
      'gasto', 'compré', 'comprar', 'pagué', 'pagar', 'costo', 'precio', 'dinero', 'dólares', 'euros',
      'tienda', 'restaurante', 'gasolina', 'comida', 'café', 'almuerzo', 'cena', 'salario', 'ingreso',
      // Slovak
      'minul', 'kúpil', 'platil', 'cena', 'peniaze', 'obchod', 'reštaurácia', 'jedlo', 'káva', 'plat',
      'papiernictvo', 'kancelárske', 'nákup', 'zaplatil', 'som', 'eur', 'euro', 'koruna', 'zaplatil som'
    ];

    const lowerInput = input.toLowerCase();
    
    // Check for transaction keywords
    const hasKeywords = transactionKeywords.some(keyword => lowerInput.includes(keyword));
    
    // Check for currency patterns 
    const hasCurrency = /\$\d+|\d+\s*(dollar|euro|crown|koruna|sol|eur)/i.test(input);
    
    // Check for money amounts
    const hasAmount = /\d+[\.,]\d{2}/.test(input);
    
    // Check for common transaction phrases
    const hasTransactionPhrases = /extracted|at|purchase|transaction|spent|paid/i.test(input);
    
    console.log('🔍 [TTS] Transaction validation:', {
      input: input.substring(0, 50),
      hasKeywords,
      hasCurrency,
      hasAmount,
      hasTransactionPhrases,
      isValid: hasKeywords || hasCurrency || hasAmount || hasTransactionPhrases
    });
    
    return hasKeywords || hasCurrency || hasAmount || hasTransactionPhrases;
  }

  /**
   * Validate transaction session context
   */
  static isValidTransactionSession(sessionId: string, extractedData: any): boolean {
    // Must have session ID
    if (!sessionId || !sessionId.startsWith('session_')) {
      return false;
    }

    // Must have some transaction-related data or be starting fresh
    const hasTransactionData = extractedData && (
      extractedData.amount !== undefined ||
      extractedData.vendor !== undefined ||
      extractedData.category !== undefined ||
      extractedData.type !== undefined
    );

    return hasTransactionData || Object.keys(extractedData || {}).length === 0;
  }

  /**
   * Generate contextual questions for missing transaction data - RESTRICTED TO TRANSACTION FIELDS ONLY
   */
  static generateQuestionForMissingField(
    field: string, 
    extractedData: any, 
    language: string = 'en-us',
    userCurrency: string = '$'
  ): string {
    const normalizedLanguage = normalizeLanguageCode(language);

    // SECURITY: Only allow REQUIRED transaction fields based on schema
    const allowedFields = ['amount', 'description', 'type'];
    if (!allowedFields.includes(field)) {
      throw new Error(`Invalid field: ${field}. Only required transaction fields allowed: ${allowedFields.join(', ')}`);
    }

    const promptTemplates = {
      amount: {
        'en-us': (data: any, currency: string) => {
          return `How much was it?`;
        },
        'es-pe': (data: any, currency: string) => {
          return `¿Cuánto fue?`;
        },
        'sk-sk': (data: any, currency: string) => {
          return `Koľko to bolo?`;
        }
      },
      description: {
        'en-us': (data: any) => {
          if (data.amount) return `What was this $${data.amount} for?`;
          return 'What was this transaction for?';
        },
        'es-pe': (data: any) => {
          if (data.amount) return `¿Para qué fueron estos $${data.amount}?`;
          return '¿Para qué fue esta transacción?';
        },
        'sk-sk': (data: any) => {
          if (data.amount) return `Na čo bolo týchto $${data.amount}?`;
          return 'Na čo bola táto transakcia?';
        }
      },
      type: {
        'en-us': (data: any) => {
          if (data.description) return `Was "${data.description}" an expense or income?`;
          return 'Was this an expense or income?';
        },
        'es-pe': (data: any) => {
          if (data.description) return `¿Fue "${data.description}" un gasto o ingreso?`;
          return '¿Fue esto un gasto o ingreso?';
        },
        'sk-sk': (data: any) => {
          if (data.description) return `Bol "${data.description}" výdavok alebo príjem?`;
          return 'Bol to výdavok alebo príjem?';
        }
      }
    };

    const template = promptTemplates[field as keyof typeof promptTemplates]?.[normalizedLanguage];
    if (template) {
      // For amount field, pass the user currency; for others, use the original signature
      if (field === 'amount') {
        return template(extractedData, userCurrency);
      } else {
        return template(extractedData);
      }
    }

    // NO AI FALLBACK - Only predefined questions allowed for required fields
    // Return a basic fallback question in the user's language
    const fallbackQuestions = {
      'en-us': {
        amount: 'How much was it?',
        description: 'What was this transaction for?',
        type: 'Was this an expense or income?'
      },
      'es-pe': {
        amount: '¿Cuánto fue?',
        description: '¿Para qué fue esta transacción?',
        type: '¿Fue esto un gasto o ingreso?'
      },
      'sk-sk': {
        amount: 'Koľko to bolo?',
        description: 'Na čo bola táto transakcia?',
        type: 'Bol to výdavok alebo príjem?'
      }
    };

    const languageQuestions = fallbackQuestions[normalizedLanguage] || fallbackQuestions['en-us'];
    return languageQuestions[field as keyof typeof languageQuestions] || `Please provide the ${field}.`;
  }

  /**
   * Generate confirmation message for completed transaction
   */
  static generateConfirmationMessage(
    transactionData: any, 
    language: string = 'en-us'
  ): string {
    const normalizedLanguage = normalizeLanguageCode(language);
    
    const confirmationTemplates = {
      'en-us': (data: any) => {
        const amount = data.amount ? `$${data.amount}` : 'this amount';
        const vendor = data.vendor || 'this place';
        const category = data.category || 'this category';
        return `Perfect! I'll save ${amount} at ${vendor} under ${category}.`;
      },
      'es-pe': (data: any) => {
        const amount = data.amount ? `$${data.amount}` : 'esta cantidad';
        const vendor = data.vendor || 'este lugar';
        const category = data.category || 'esta categoría';
        return `¡Perfecto! Guardaré ${amount} en ${vendor} bajo ${category}.`;
      },
      'sk-sk': (data: any) => {
        const amount = data.amount ? `$${data.amount}` : 'túto sumu';
        const vendor = data.vendor || 'toto miesto';
        const category = data.category || 'túto kategóriu';
        return `Perfektne! Uložím ${amount} v ${vendor} pod ${category}.`;
      }
    };

    const template = confirmationTemplates[normalizedLanguage];
    return template ? template(transactionData) : 
      'Perfect! I\'ll save this transaction for you.';
  }

  /**
   * Calculate estimated cost for TTS usage
   */
  static estimateCost(textLength: number): number {
    // OpenAI TTS pricing: $0.015 per 1K characters
    return (textLength / 1000) * 0.015;
  }
}