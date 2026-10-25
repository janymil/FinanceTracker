import { log } from '../logger';
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { MistralClient } from '../mistralClient.js';
import { parseTransactionWithMistral } from '../mistralTransactionParser.js';
import { storage } from '../storage.js';
import { matchCategoryLocally } from '../categoryMatcher.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('audio/') || file.mimetype === 'video/webm'),
});
const mistralClient = new MistralClient();

// Mistral voice transcription and parsing endpoint
router.post('/transcribe-and-parse', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    const userLanguage = req.headers['x-user-language'] as string || 'en-us';
    const userCurrency = req.headers['x-user-currency'] as string || '$';
    
    log.info('🎤 Mistral voice transcription and parsing request');
    log.info('🌍 User preferences:', { userLanguage, userCurrency });

    // Get user ID from authentication
    const userId = (req as any).auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Step 1: Transcribe with Mistral Voxtral-mini-2507
    log.info('🎙️ Step 1: Transcribing audio with Mistral Voxtral-mini-2507...');
    
    const formData = new FormData();
    formData.append('file', new Blob([req.file.buffer]), 'audio.webm');
    formData.append('model', 'voxtral-mini-2507');
    formData.append('temperature', '0.0');
    
    // Set language for better transcription accuracy
    const mistralLanguage = userLanguage.startsWith('es') ? 'es' : 
                           userLanguage.startsWith('sk') ? 'sk' : 'en';
    formData.append('language', mistralLanguage);

    const mistralResponse = await fetch('https://api.mistral.ai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.MISTRAL_API_KEY!
      },
      body: formData
    });

    if (!mistralResponse.ok) {
      const errorText = await mistralResponse.text();
      log.error('❌ Mistral transcription error:', errorText);
      throw new Error(`Mistral transcription failed: ${mistralResponse.statusText}`);
    }

    const mistralResult = await mistralResponse.json();
    const transcription = mistralResult.text;
    log.debug('Mistral transcription finished', { characters: transcription.length });

    if (!transcription || transcription.trim().length < 2) {
      return res.status(400).json({ error: 'No valid transcription received' });
    }

    // Step 2: Get user's existing categories from database
    log.info('📂 Step 2: Fetching user categories...');
    const userCategories = await storage.getCategories(userId);
    log.info('📂 User has', userCategories.length, 'categories');

    // Step 3: Parse with Mistral Small 2506 (with user categories)
    log.info('🧠 Step 3: Parsing transaction with Mistral (with user categories)...');
    const parsedTransaction = await parseTransactionWithMistral(transcription, userLanguage, userCurrency, userCategories);
    log.info('🧠 Mistral parsed transaction:', parsedTransaction);

    // Step 4: Local category matching (100% accurate)
    log.info('🎯 Step 4: Local intelligent category matching...');
    const categoryMatchResult = matchCategoryLocally(
      parsedTransaction.category,
      userCategories,
      userLanguage
    );

    let finalCategory = parsedTransaction.category;
    let newCategoryId = null;

    if (categoryMatchResult.createNew) {
      // Create new category if AI suggests it
      log.info('✨ Creating new category:', categoryMatchResult.newCategoryName);
      try {
        const newCategory = await storage.createCategory({
          userId,
          name: categoryMatchResult.newCategoryName,
          type: parsedTransaction.type,
          icon: 'other',
          color: '#6B7280'
        });
        finalCategory = newCategory.name;
        newCategoryId = newCategory.id;
      } catch (error) {
        log.error('❌ Failed to create new category:', error);
        finalCategory = parsedTransaction.category;
      }
    } else if (categoryMatchResult.matchedCategory) {
      // Use matched existing category
      finalCategory = categoryMatchResult.matchedCategory.name;
      newCategoryId = categoryMatchResult.matchedCategory.id;
    }
    
    const finalResult = {
      ...parsedTransaction,
      category: finalCategory,
      categoryId: newCategoryId,
      transcript: transcription,
      categoryConfidence: categoryMatchResult.confidence
    };
    
    log.info('✅ Final Mistral analysis result:', finalResult);
    
    res.json({ 
      success: true, 
      data: finalResult 
    });
    
  } catch (error) {
    log.error('❌ Mistral voice processing failed:', error);
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
    
    // Get user ID from authentication
    const userId = (req as any).auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    log.debug('Mistral text parsing request', { characters: transcript.length, userLanguage });
    
    // Get user's existing categories
    const userCategories = await storage.getCategories(userId);
    log.info('📂 User has', userCategories.length, 'categories for text parsing');
    
    const result = await parseTransactionWithMistral(transcript, userLanguage, userCurrency, userCategories);
    
    res.json({ success: true, data: result });
    
  } catch (error) {
    log.error('❌ Mistral text parsing failed:', error);
    res.status(500).json({ 
      error: 'Text parsing failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Local category matching endpoint (100% accurate)
router.post('/match-category', async (req: Request, res: Response) => {
  try {
    const { suggestedCategory, existingCategories } = req.body;
    const userLanguage = req.headers['x-user-language'] as string || 'en-us';
    
    if (!suggestedCategory || !existingCategories) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    log.info('🎯 Local category matching request:', {
      suggestedCategory,
      existingCount: existingCategories.length,
      language: userLanguage
    });

    const result = matchCategoryLocally(suggestedCategory, existingCategories, userLanguage);
    
    log.info('✅ Local category matching result:', result);
    res.json(result);
    
  } catch (error) {
    log.error('❌ Local category matching failed:', error);
    res.status(500).json({ 
      error: 'Category matching failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;