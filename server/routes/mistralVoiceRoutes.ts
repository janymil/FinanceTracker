import { Router, Request, Response } from 'express';
import multer from 'multer';
import { transcribeAudioWithGroq } from '../groqClient.js';
import { parseTransactionWithMistral, matchCategoryIntelligentlyMistral } from '../mistralTransactionParser.js';
import { lookupMerchant } from '../../lib/merchantLookup.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Mistral voice transcription and parsing endpoint
router.post('/transcribe-and-parse', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    const userLanguage = req.headers['x-user-language'] as string || 'en-us';
    const userCurrency = req.headers['x-user-currency'] as string || '$';
    
    console.log('🎤 Mistral voice transcription and parsing request');
    console.log('🌍 User preferences:', { userLanguage, userCurrency });

    // Step 1: Transcribe with Groq Distil-Whisper (STT)
    console.log('🎙️ Step 1: Transcribing audio with Groq Distil-Whisper...');
    const transcription = await transcribeAudioWithGroq(req.file.buffer);
    console.log('🎙️ Transcription result:', transcription);
    
    if (!transcription || transcription.trim().length < 2) {
      return res.status(400).json({ error: 'No valid transcription received' });
    }

    // Step 2: Parse with Mistral (better than LLaMA)
    console.log('🧠 Step 2: Parsing transaction with Mistral...');
    const parsedTransaction = await parseTransactionWithMistral(transcription, userLanguage, userCurrency);
    console.log('🧠 Mistral parsed transaction:', parsedTransaction);

    // Step 3: Enhance category with merchant lookup (optional)
    let enhancedCategory = parsedTransaction.category;
    
    if (parsedTransaction.description && parsedTransaction.description.length > 2) {
      try {
        const countryCode = userLanguage === 'sk-sk' ? 'sk' : 
                          userLanguage === 'es-pe' ? 'pe' : 'us';
        
        console.log('🏪 Step 3: Enhancing category with merchant lookup...');
        const merchantResult = await lookupMerchant(transcription, countryCode);
        
        if (merchantResult && merchantResult.typical_categories) {
          const languageIndex = userLanguage === 'sk-sk' ? 1 : 
                               userLanguage === 'es-pe' ? 2 : 0;
          enhancedCategory = merchantResult.typical_categories[languageIndex] || parsedTransaction.category;
          console.log('🏪 Enhanced category from merchant lookup:', enhancedCategory);
        }
      } catch (merchantError) {
        console.log('🏪 Merchant lookup failed, using Mistral category:', merchantError instanceof Error ? merchantError.message : 'Unknown error');
      }
    }
    
    const finalResult = {
      ...parsedTransaction,
      category: enhancedCategory,
      transcript: transcription // Include original transcript
    };
    
    console.log('✅ Final Mistral analysis result:', finalResult);
    
    res.json({ 
      success: true, 
      data: finalResult 
    });
    
  } catch (error) {
    console.error('❌ Mistral voice processing failed:', error);
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
    
    console.log('🧠 Testing Mistral text parsing:', transcript);
    
    const result = await parseTransactionWithMistral(transcript, userLanguage, userCurrency);
    
    res.json({ success: true, data: result });
    
  } catch (error) {
    console.error('❌ Mistral text parsing failed:', error);
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

    console.log('🎯 Intelligent category matching request (Mistral):', {
      suggestedCategory,
      existingCount: existingCategories.length,
      language: userLanguage
    });

    const result = await matchCategoryIntelligentlyMistral(suggestedCategory, existingCategories, userLanguage);
    
    console.log('✅ Category matching result (Mistral):', result);
    res.json(result);
    
  } catch (error) {
    console.error('❌ Mistral category matching failed:', error);
    res.status(500).json({ 
      error: 'Category matching failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;