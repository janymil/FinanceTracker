import { Router, Request, Response } from 'express';
import multer from 'multer';
import { MistralClient } from '../mistralClient.js';
import { parseTransactionWithMistral } from '../mistralTransactionParser.js';
import { storage } from '../storage.js';
import { matchCategoryLocally } from '../categoryMatcher.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const mistralClient = new MistralClient();

// Mistral text parsing endpoint (using browser STT instead of Mistral STT)
router.post('/parse-text', async (req: Request, res: Response) => {
  try {
    const { transcript } = req.body;
    
    if (!transcript || transcript.trim().length < 2) {
      return res.status(400).json({ error: 'No valid transcript provided' });
    }

    const userLanguage = req.headers['x-user-language'] as string || 'en-us';
    const userCurrency = req.headers['x-user-currency'] as string || '$';
    
    console.log('🎤 Mistral text parsing request');
    console.log('🌍 User preferences:', { userLanguage, userCurrency });
    console.log('📝 Transcript to parse:', transcript);

    // Get user ID from authentication
    const userId = (req as any).auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Step 1: Get user's existing categories from database
    console.log('📂 Step 1: Fetching user categories...');
    const userCategories = await storage.getCategories(userId);
    console.log('📂 User has', userCategories.length, 'categories');

    // Step 2: Parse with Mistral Small 2506 (with user categories)
    console.log('🧠 Step 2: Parsing transaction with Mistral (with user categories)...');
    const parsedTransaction = await parseTransactionWithMistral(transcript, userLanguage, userCurrency, userCategories);
    console.log('🧠 Mistral parsed transaction:', parsedTransaction);

    // Step 3: Local category matching (100% accurate)
    console.log('🎯 Step 3: Local intelligent category matching...');
    const categoryMatchResult = matchCategoryLocally(
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
    const userId = (req as any).auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log('🧠 Testing Mistral text parsing:', transcript);
    
    // Get user's existing categories
    const userCategories = await storage.getCategories(userId);
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

// Local category matching endpoint (100% accurate)
router.post('/match-category', async (req: Request, res: Response) => {
  try {
    const { suggestedCategory, existingCategories } = req.body;
    const userLanguage = req.headers['x-user-language'] as string || 'en-us';
    
    if (!suggestedCategory || !existingCategories) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log('🎯 Local category matching request:', {
      suggestedCategory,
      existingCount: existingCategories.length,
      language: userLanguage
    });

    const result = matchCategoryLocally(suggestedCategory, existingCategories, userLanguage);
    
    console.log('✅ Local category matching result:', result);
    res.json(result);
    
  } catch (error) {
    console.error('❌ Local category matching failed:', error);
    res.status(500).json({ 
      error: 'Category matching failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;