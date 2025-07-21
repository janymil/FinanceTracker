import { Router, Request, Response } from 'express';
import multer from 'multer';
import { MistralClient } from '../mistralClient.js';
import { parseTransactionWithMistral, matchCategoryIntelligentlyMistral } from '../mistralTransactionParser.js';
import { storage } from '../storage.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const mistralClient = new MistralClient();

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

    // Get user ID from authentication
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Step 1: Transcribe with Mistral Voxtral-mini (STT)
    console.log('🎙️ Step 1: Transcribing audio with Mistral Voxtral-mini...');
    const transcription = await mistralClient.transcribeAudio(req.file.buffer);
    console.log('🎙️ Transcription result:', transcription);
    
    if (!transcription || transcription.trim().length < 2) {
      return res.status(400).json({ error: 'No valid transcription received' });
    }

    // Step 2: Get user's existing categories from database
    console.log('📂 Step 2: Fetching user categories...');
    const userCategories = await storage.getCategoriesByUserId(userId);
    console.log('📂 User has', userCategories.length, 'categories');

    // Step 3: Parse with Mistral Small 2506 (with user categories)
    console.log('🧠 Step 3: Parsing transaction with Mistral (with user categories)...');
    const parsedTransaction = await parseTransactionWithMistral(transcription, userLanguage, userCurrency, userCategories);
    console.log('🧠 Mistral parsed transaction:', parsedTransaction);

    // Step 4: Match category intelligently with user's existing categories
    console.log('🎯 Step 4: Intelligent category matching...');
    const categoryMatchResult = await matchCategoryIntelligentlyMistral(
      parsedTransaction.category,
      userCategories,
      userLanguage
    );

    let finalCategory = parsedTransaction.category;
    let newCategoryId = null;

    if (categoryMatchResult.createNew) {
      // Create new category if AI suggests it
      console.log('✨ Creating new category:', categoryMatchResult.newCategoryName);
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
        console.error('❌ Failed to create new category:', error);
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
      transcript: transcription
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
    
    // Get user ID from authentication
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log('🧠 Testing Mistral text parsing:', transcript);
    
    // Get user's existing categories
    const userCategories = await storage.getCategoriesByUserId(userId);
    console.log('📂 User has', userCategories.length, 'categories for text parsing');
    
    const result = await parseTransactionWithMistral(transcript, userLanguage, userCurrency, userCategories);
    
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