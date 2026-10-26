import { log } from '../logger';
import { Router, type Request, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import { transcribeAudioWithGroq, parseTransactionWithGroq, matchCategoryIntelligently } from "../groqClient";
import { lookupMerchant } from "../../lib/merchantLookup";
import { runMeteredAI } from "../../lib/aiProcessor";

const router = Router();

// Configure multer for audio uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp3', 'audio/mpeg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio format. Supported: WAV, WEBM, OGG, MP3'));
    }
  }
});

// Groq voice transcription and parsing endpoint
router.post('/transcribe-and-parse', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    log.info('🎤 Groq voice transcription and parsing request');
    
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }
    
    const userLanguage = req.headers['x-user-language'] as string || 'en-us';
    const userCurrency = req.headers['x-user-currency'] as string || '$';
    
    log.info('🌍 User preferences:', { userLanguage, userCurrency });
    
    // Step 1: Groq STT with Distil-Whisper
    log.info('🎙️ Step 1: Transcribing audio with Groq Distil-Whisper...');
    const transcript = await transcribeAudioWithGroq(req.file.buffer);
    
    if (!transcript.trim()) {
      return res.status(400).json({ error: 'No speech detected in audio' });
    }
    
    log.debug('Groq transcription finished', { characters: transcript.length });
    
    // Step 2: Groq LLaMA intelligent parsing with user preferences. Metered: the row belongs
    // to the person who spoke, so a voice entry uses up allowance like any other AI call.
    log.info('🧠 Step 2: Parsing transaction with Groq LLaMA...');
    const owner = (req as any).aiUser;
    const parsedTransaction = await runMeteredAI(
      'voice-entry',
      owner?.id || '',
      owner?.plan || 'free',
      () => parseTransactionWithGroq(transcript, userLanguage, userCurrency),
    );
    
    // Step 3: Enhanced category matching with merchant lookup (optional enhancement)
    let enhancedCategory = parsedTransaction.category;
    
    if (parsedTransaction.description && parsedTransaction.description !== 'Transaction') {
      try {
        const countryCode = userLanguage === 'sk-sk' ? 'sk' : 
                          userLanguage === 'es-pe' ? 'pe' : 'us';
        
        log.info('🏪 Step 3: Enhancing category with merchant lookup...');
        const merchantResult = await lookupMerchant(transcript, countryCode);
        
        if (merchantResult && merchantResult.typical_categories) {
          const languageIndex = userLanguage === 'sk-sk' ? 1 : 
                               userLanguage === 'es-pe' ? 2 : 0;
          enhancedCategory = merchantResult.typical_categories[languageIndex] || parsedTransaction.category;
          log.info('🏪 Enhanced category from merchant lookup:', enhancedCategory);
        }
      } catch (merchantError) {
        log.info('🏪 Merchant lookup failed, using LLaMA category:', merchantError instanceof Error ? merchantError.message : 'Unknown error');
      }
    }
    
    const finalResult = {
      ...parsedTransaction,
      category: enhancedCategory,
      transcript: transcript // Include original transcript
    };
    
    // Never the transcript itself: its shape is enough to debug the flow.
    log.info('✅ Final Groq analysis result', {
      hasAmount: Boolean(finalResult.amount),
      type: finalResult.type,
      category: finalResult.category,
      transcriptCharacters: transcript.length,
    });
    
    res.json({ 
      success: true, 
      data: finalResult 
    });
    
  } catch (error) {
    log.error('❌ Groq voice processing failed:', error);
    res.status(500).json({ 
      error: 'Voice processing failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test endpoint for text-only parsing (for debugging)
router.post('/parse-text', async (req: Request, res: Response) => {
  try {
    const { transcript, userLanguage = 'en-us', userCurrency = '$' } = req.body;
    
    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }
    
    log.debug('Groq text parsing request', { characters: transcript.length, userLanguage });
    
    const result = await parseTransactionWithGroq(transcript, userLanguage, userCurrency);
    
    res.json({ success: true, data: result });
    
  } catch (error) {
    log.error('❌ Groq text parsing failed:', error);
    res.status(500).json({ 
      error: 'Text parsing failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Intelligent category matching endpoint
router.post('/match-category', async (req: Request, res: Response) => {
  try {
    const { suggestedCategory, existingCategories } = req.body;
    const userLanguage = req.headers['x-user-language'] as string || 'en-us';
    
    if (!suggestedCategory || !existingCategories) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    log.info('🎯 Intelligent category matching request:', {
      suggestedCategory,
      existingCount: existingCategories.length,
      language: userLanguage
    });

    const result = await matchCategoryIntelligently(suggestedCategory, existingCategories, userLanguage);
    
    log.info('✅ Category matching result:', result);
    res.json(result);
    
  } catch (error) {
    log.error('❌ Category matching failed:', error);
    res.status(500).json({ 
      error: 'Category matching failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;