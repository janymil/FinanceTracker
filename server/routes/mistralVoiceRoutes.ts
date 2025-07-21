import { Router, Request, Response } from 'express';
import multer from 'multer';
import { transcribeAudioWithGroq } from '../groqClient.js';
import { parseTransactionWithMistral, matchCategoryIntelligentlyMistral } from '../mistralTransactionParser.js';
import { lookupMerchant } from '../../lib/merchantLookup.js';
import { storage } from '../storage.js';

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
    const userId = (req as any).auth?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    console.log('🎤 Mistral voice transcription and parsing request');
    console.log('🌍 User preferences:', { userLanguage, userCurrency, userId });

    // Step 0: Get user's existing categories for intelligent matching
    console.log('📋 Step 0: Getting user\'s existing categories...');
    const existingCategories = await storage.getCategories(userId);
    console.log('📋 User has', existingCategories.length, 'existing categories:', existingCategories.map(c => c.name));

    // Step 1: Transcribe with Groq Distil-Whisper (STT) 
    console.log('🎙️ Step 1: Transcribing audio with Groq Distil-Whisper...');
    const transcription = await transcribeAudioWithGroq(req.file.buffer);
    console.log('🎙️ Raw STT transcription:', transcription);
    
    if (!transcription || transcription.trim().length < 2) {
      return res.status(400).json({ error: 'No valid transcription received from STT' });
    }

    // Step 1.5: Apply STT corrections for known issues
    let correctedTranscription = transcription;
    
    // Fix common STT number errors
    correctedTranscription = correctedTranscription
      .replace(/\b2\.90?\b/gi, '2900') // "2.90" likely means "2900"
      .replace(/\b5\.80?\b/gi, '580')   // "5.80" could be "580"
      .replace(/\bfive eighty\b/gi, '580')
      .replace(/\btwo ninety\b/gi, '290')
      .replace(/\btwenty nine hundred\b/gi, '2900')
      .replace(/\bfifteen hundred\b/gi, '1500');
    
    if (correctedTranscription !== transcription) {
      console.log('🔧 STT corrections applied:', transcription, '→', correctedTranscription);
    }

    // Step 2: Parse with Mistral (with user's categories for intelligence)
    console.log('🧠 Step 2: Parsing transaction with Mistral (with user categories)...');
    const parsedTransaction = await parseTransactionWithMistral(
      correctedTranscription, 
      userLanguage, 
      userCurrency,
      existingCategories.map(cat => ({ id: cat.id, name: cat.name, type: cat.type as 'expense' | 'income' }))
    );
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
      transcript: correctedTranscription, // Include corrected transcript
      originalTranscript: transcription // Also include original for debugging
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
    const { transcript } = req.body;
    const userLanguage = req.headers['x-user-language'] as string || 'en-us';
    const userCurrency = req.headers['x-user-currency'] as string || '$';
    const userId = (req as any).auth?.userId;
    
    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }
    
    console.log('🧠 Testing Mistral text parsing:', transcript);
    
    // Get user categories if authenticated (for testing with user context)
    let existingCategories: any[] = [];
    if (userId) {
      existingCategories = await storage.getCategories(userId);
      console.log('📋 User has', existingCategories.length, 'existing categories for testing');
    } else {
      console.log('📋 No user authentication - using general AI categories');
    }
    
    const result = await parseTransactionWithMistral(
      transcript, 
      userLanguage, 
      userCurrency,
      existingCategories.map(cat => ({ id: cat.id, name: cat.name, type: cat.type as 'expense' | 'income' }))
    );
    
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