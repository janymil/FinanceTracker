import fetch from 'node-fetch';

interface VoiceOptions {
  voice_id?: string;
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
}

interface GenerateAudioRequest {
  text: string;
  language: 'en-us' | 'es-pe' | 'sk-sk';
  voice_options?: VoiceOptions;
}

class ElevenLabsService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';
  
  // Pre-selected voices for each language (professional, clear, marketing-friendly)
  private voices = {
    'en-us': 'EXAVITQu4vr4xnSDxMaL', // Bella - professional female voice
    'es-pe': 'VR6AewLTigWG4xSOukaG', // Adam - clear male voice (works well for Spanish)
    'sk-sk': 'pNInz6obpgDQGcFmaJgB' // Antoni - versatile voice (good for Eastern European pronunciation)
  };

  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('ElevenLabs API key not found');
    }
  }

  async generateAudio({ text, language, voice_options = {} }: GenerateAudioRequest): Promise<Buffer> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    const voiceId = this.voices[language];
    if (!voiceId) {
      throw new Error(`Voice not available for language: ${language}`);
    }

    const requestBody = {
      text,
      model_id: 'eleven_multilingual_v2', // Best model for multilingual content
      voice_settings: {
        stability: voice_options.stability || 0.5,
        similarity_boost: voice_options.similarity_boost || 0.8,
        style: voice_options.style || 0.2,
        use_speaker_boost: voice_options.use_speaker_boost || true
      }
    };

    try {
      const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const audioBuffer = await response.buffer();
      return audioBuffer;
    } catch (error) {
      console.error('ElevenLabs API error:', error);
      throw error;
    }
  }

  async getAvailableVoices() {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching voices:', error);
      throw error;
    }
  }

  // Pre-generate common demo narrations for better performance
  async preGenerateDemoNarrations() {
    const scripts = this.getDemoScripts();
    const results: { [key: string]: Buffer } = {};

    for (const [key, content] of Object.entries(scripts)) {
      for (const language of ['en-us', 'es-pe', 'sk-sk'] as const) {
        try {
          const audio = await this.generateAudio({
            text: content[language],
            language
          });
          results[`${key}_${language}`] = audio;
          console.log(`Generated narration: ${key}_${language}`);
        } catch (error) {
          console.error(`Failed to generate ${key}_${language}:`, error);
        }
      }
    }

    return results;
  }

  private getDemoScripts() {
    return {
      categorization_intro: {
        'en-us': 'Welcome to FinanzerPro\'s AI Transaction Categorization. Watch how our intelligent system automatically categorizes your expenses with 95% accuracy.',
        'es-pe': 'Bienvenido a la Categorización IA de Transacciones de FinanzerPro. Observa cómo nuestro sistema inteligente categoriza automáticamente tus gastos con 95% de precisión.',
        'sk-sk': 'Vitajte v AI Kategorizácii Transakcií FinanzerPro. Sledujte ako náš inteligentný systém automaticky kategorizuje vaše výdavky s 95% presnosťou.'
      },
      categorization_upload: {
        'en-us': 'First, upload any receipt or enter transaction details manually. Our OCR technology instantly reads the receipt.',
        'es-pe': 'Primero, sube cualquier recibo o ingresa los detalles de transacción manualmente. Nuestra tecnología OCR lee instantáneamente el recibo.',
        'sk-sk': 'Najprv nahrajte akýkoľvek účet alebo zadajte detaily transakcie manuálne. Naša OCR technológia okamžite prečíta účet.'
      },
      categorization_analysis: {
        'en-us': 'Our AI analyzes the merchant name, amount, and your spending patterns to suggest the perfect category with confidence scoring.',
        'es-pe': 'Nuestra IA analiza el nombre del comerciante, cantidad y tus patrones de gasto para sugerir la categoría perfecta con puntuación de confianza.',
        'sk-sk': 'Naša AI analyzuje názov obchodníka, sumu a vaše vzorce výdavkov na navrhnutie perfektnej kategórie s hodnotením spoľahlivosti.'
      },
      tips_intro: {
        'en-us': 'Experience AI Financial Analysis - your personal financial advisor powered by advanced artificial intelligence.',
        'es-pe': 'Experimenta el Análisis Financiero IA - tu asesor financiero personal potenciado por inteligencia artificial avanzada.',
        'sk-sk': 'Zažite AI Finančnú Analýzu - vášho osobného finančného poradcu poháňaného pokročilou umelou inteligenciou.'
      },
      health_intro: {
        'en-us': 'Discover your Financial Health Score - a comprehensive analysis that evaluates multiple factors to give you a complete picture of your financial wellness.',
        'es-pe': 'Descubre tu Puntuación de Salud Financiera - un análisis integral que evalúa múltiples factores para darte una imagen completa de tu bienestar financiero.',
        'sk-sk': 'Objavte vaše Skóre Finančného Zdravia - komplexnú analýzu, ktorá hodnotí viaceré faktory a poskytuje kompletný obraz vášho finančného zdravia.'
      }
    };
  }
}

export const elevenLabsService = new ElevenLabsService();