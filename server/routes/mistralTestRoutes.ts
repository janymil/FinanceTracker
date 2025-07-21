import { Router, Request, Response } from 'express';
import { parseTransactionWithMistral } from '../mistralTransactionParser.js';

const router = Router();

// Complete end-to-end test with category matching
router.post('/full-pipeline-test', async (req: Request, res: Response) => {
  try {
    const { transcript } = req.body;
    
    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }
    
    console.log('🧪 FULL PIPELINE TEST:', transcript);
    
    // Mock user categories for testing (Trabajo = work/salary)
    const mockCategories = [
      { id: 5, name: 'Trabajo', type: 'income' },
      { id: 1, name: 'Comida', type: 'expense' }
    ];
    
    // Step 1: Parse with Mistral
    console.log('🧠 Step 1: Mistral parsing...');
    const mistralResult = await parseTransactionWithMistral(
      transcript, 
      'es-pe', 
      'S/', 
      mockCategories
    );
    console.log('🧠 Mistral result:', mistralResult);
    
    // Step 2: Local category matching  
    console.log('🎯 Step 2: Local matching...');
    const { matchCategoryLocally } = await import('../categoryMatcher.js');
    const matchResult = matchCategoryLocally(
      mistralResult.category,
      mockCategories,
      'es-pe'
    );
    console.log('🎯 Match result:', matchResult);
    
    // Step 3: Final result
    const finalCategory = matchResult.matchedCategory ? 
      matchResult.matchedCategory.name : 
      matchResult.newCategoryName;
    
    const finalResult = {
      ...mistralResult,
      category: finalCategory,
      matchingDetails: matchResult
    };
    
    console.log('✅ FINAL PIPELINE RESULT:', finalResult);
    
    res.json({ 
      success: true, 
      data: finalResult,
      message: 'Full pipeline test completed!'
    });
    
  } catch (error) {
    console.error('❌ Full pipeline test failed:', error);
    res.status(500).json({ 
      error: 'Pipeline test failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Simple Mistral API test
router.post('/test-mistral-no-auth', async (req: Request, res: Response) => {
  try {
    const { transcript } = req.body;
    
    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }
    
    console.log('🧪 Testing Mistral parsing WITHOUT auth:', transcript);
    
    // Mock empty categories for testing
    const mockCategories: any[] = [];
    
    const result = await parseTransactionWithMistral(
      transcript, 
      'es-pe', 
      'S/', 
      mockCategories
    );
    
    console.log('🧪 Mistral test result:', result);
    
    res.json({ 
      success: true, 
      data: result,
      message: 'Mistral API is working!'
    });
    
  } catch (error) {
    console.error('❌ Mistral test failed:', error);
    res.status(500).json({ 
      error: 'Mistral test failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;