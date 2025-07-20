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
        speed: request.speed || 1.2, // FASTER speed - 1.2x for quicker conversation
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
    language: string = 'en-us'
  ): string {
    const normalizedLanguage = normalizeLanguageCode(language);

    // SECURITY: Only allow specific transaction fields
    const allowedFields = ['amount', 'vendor', 'category', 'date', 'type', 'description'];
    if (!allowedFields.includes(field)) {
      throw new Error(`Invalid field: ${field}. Only transaction fields allowed.`);
    }

    const promptTemplates = {
      amount: {
        'en-us': (data: any) => {
          if (data.vendor) return `How much did you spend at ${data.vendor}?`;
          if (data.category) return `How much did you spend on ${data.category}?`;
          return 'How much was this transaction?';
        },
        'es-pe': (data: any) => {
          if (data.vendor) return `¿Cuánto gastaste en ${data.vendor}?`;
          if (data.category) return `¿Cuánto gastaste en ${data.category}?`;
          return '¿Cuánto fue esta transacción?';
        },
        'sk-sk': (data: any) => {
          if (data.vendor) return `Koľko si minul v ${data.vendor}?`;
          if (data.category) return `Koľko si minul na ${data.category}?`;
          return 'Koľko bola táto transakcia?';
        }
      },
      vendor: {
        'en-us': (data: any) => {
          if (data.category === 'Food & Dining') return 'Where did you buy this food?';
          if (data.category === 'Transportation') return 'Was this Uber, taxi, or something else?';
          return 'Where did you make this purchase?';
        },
        'es-pe': (data: any) => {
          if (data.category === 'Food & Dining') return '¿Dónde compraste esta comida?';
          if (data.category === 'Transportation') return '¿Fue Uber, taxi, o algo más?';
          return '¿Dónde hiciste esta compra?';
        },
        'sk-sk': (data: any) => {
          if (data.category === 'Food & Dining') return 'Kde si kúpil toto jedlo?';
          if (data.category === 'Transportation') return 'Bol to Uber, taxi, alebo niečo iné?';
          return 'Kde si urobil tento nákup?';
        }
      },
      date: {
        'en-us': () => 'When did this transaction happen?',
        'es-pe': () => '¿Cuándo ocurrió esta transacción?',
        'sk-sk': () => 'Kedy sa táto transakcia stala?'
      },
      category: {
        'en-us': (data: any) => {
          if (data.vendor) return `What category should I use for ${data.vendor}?`;
          return 'What type of expense is this?';
        },
        'es-pe': (data: any) => {
          if (data.vendor) return `¿Qué categoría debo usar para ${data.vendor}?`;
          return '¿Qué tipo de gasto es este?';
        },
        'sk-sk': (data: any) => {
          if (data.vendor) return `Akú kategóriu mám použiť pre ${data.vendor}?`;
          return 'Aký typ výdavku je toto?';
        }
      },
      description: {
        'en-us': (data: any) => {
          if (data.amount) return `What was this ${data.amount} dollar purchase for?`;
          return 'What was this purchase for?';
        },
        'es-pe': (data: any) => {
          if (data.amount) return `¿Para qué fue esta compra de ${data.amount} dólares?`;
          return '¿Para qué fue esta compra?';
        },
        'sk-sk': (data: any) => {
          if (data.amount) return `Na čo bol tento nákup za ${data.amount} dolárov?`;
          return 'Na čo bol tento nákup?';
        }
      }
    };

    const template = promptTemplates[field]?.[normalizedLanguage];
    if (template) {
      return template(extractedData);
    }

    // NO AI FALLBACK - Only predefined questions allowed
    // Return a basic fallback question in the user's language
    const fallbackQuestions = {
      'en-us': `Please provide the ${field}.`,
      'es-pe': `Por favor proporciona ${field}.`,
      'sk-sk': `Prosím poskytni ${field}.`
    };

    return fallbackQuestions[normalizedLanguage] || fallbackQuestions['en-us'];
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