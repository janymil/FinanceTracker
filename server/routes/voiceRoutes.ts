import { Router, type Express } from "express";
import { z } from "zod";
import { lookupMerchant } from "../../lib/merchantLookup";

const router = Router();

// Voice input parsing function
function parseVoiceInput(transcript: string, userLanguage: string) {
  const text = transcript.toLowerCase().trim();
  const words = transcript.split(/\s+/).filter(w => w.length > 0);
  
  console.log('🎤 Parsing voice:', transcript);
  
  // Extract amount
  let amount = '';
  
  // Number mappings for multilingual support
  const textNumbers: { [key: string]: string } = {
    // Slovak
    'jeden': '1', 'dva': '2', 'tri': '3', 'štyri': '4', 'päť': '5',
    'šesť': '6', 'sedem': '7', 'osem': '8', 'deväť': '9', 'desať': '10',
    // Spanish  
    'uno': '1', 'dos': '2', 'tres': '3', 'cuatro': '4', 'cinco': '5',
    'seis': '6', 'siete': '7', 'ocho': '8', 'nueve': '9', 'diez': '10',
    // English
    'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
    'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10'
  };

  // Look for numeric amounts - improved decimal recognition
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    // Decimal formats: "5.50", "5,50", "5:50" - more flexible pattern
    const decimalMatch = word.match(/(\d+)[.:,](\d{1,2})/);
    if (decimalMatch) {
      amount = `${decimalMatch[1]}.${decimalMatch[2]}`;
      console.log('💰 Found decimal amount:', amount);
      break;
    }
    
    // Handle speech recognition patterns like "5 50" meaning "5.50" 
    // Also handles "za 5 50" (Slovak: "for 5.50")
    if (/^\d+$/.test(word) && i < words.length - 1) {
      const nextWord = words[i + 1];
      if (/^\d{1,2}$/.test(nextWord) && parseInt(nextWord) < 100) {
        amount = `${word}.${nextWord.padStart(2, '0')}`;
        console.log('💰 Found split decimal amount:', amount);
        break;
      }
    }
    
    // Look for decimal after "za" (Slovak "for")
    if ((word === 'za' || word === 'for' || word === 'por') && i < words.length - 2) {
      const nextWord = words[i + 1];
      const afterNext = words[i + 2];
      if (/^\d+$/.test(nextWord) && /^\d{1,2}$/.test(afterNext) && parseInt(afterNext) < 100) {
        amount = `${nextWord}.${afterNext.padStart(2, '0')}`;
        console.log('💰 Found decimal after preposition:', amount);
        break;
      }
    }
    
    // Simple integers as last resort
    if (/^\d+$/.test(word) && !amount) {
      amount = word;
      console.log('💰 Found integer amount:', amount);
    }
  }

  // Try text numbers if no numeric amount found
  if (!amount) {
    for (const word of words) {
      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
      if (textNumbers[cleanWord]) {
        amount = textNumbers[cleanWord];
        break;
      }
    }
  }

  // Simple description extraction - merchant lookup will enhance this later
  let description = '';
  
  // Look for capitalized words (likely merchant names)
  const properNouns = words.filter(word => 
    /^[A-Z]/.test(word) && 
    word.length > 2
  );
  
  if (properNouns.length > 0) {
    description = properNouns[0];
  } else {
    // Fallback to first meaningful word
    const meaningfulWords = words.filter(word => {
      const clean = word.toLowerCase().replace(/[^\w]/g, '');
      return clean.length > 2 && 
             !textNumbers[clean] &&
             !/^\d/.test(clean);
    });
    
    description = meaningfulWords.length > 0 ? 
      meaningfulWords[0].charAt(0).toUpperCase() + meaningfulWords[0].slice(1) :
      'Transaction';
  }

  // Simple transaction type detection
  let type = 'expense'; // Default
  // Basic income detection - can be enhanced later
  if (text.includes('received') || text.includes('salary') || text.includes('income') || 
      text.includes('príjem') || text.includes('mzda') || text.includes('plat') ||
      text.includes('ingreso') || text.includes('salario') || text.includes('sueldo')) {
    type = 'income';
  }

  // Simple date extraction
  let date = '';
  if (text.includes('yesterday')) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    date = yesterday.toISOString().split('T')[0];
  } else if (text.includes('today')) {
    date = new Date().toISOString().split('T')[0];
  }

  return {
    amount,
    description,
    type,
    date,
    note: transcript
  };
}

// Voice parsing endpoint
router.post('/parse', async (req, res) => {
  try {
    const { transcript, userLanguage } = z.object({
      transcript: z.string().min(1),
      userLanguage: z.string().default('en-us')
    }).parse(req.body);

    console.log('🎤 Voice parse request:', { transcript, userLanguage });

    // Parse voice input
    const parsed = parseVoiceInput(transcript, userLanguage);
    
    // Get category using merchant lookup
    let category = '';
    // Always try merchant lookup - use transcript if no description
    const textToAnalyze = parsed.description || transcript;
    if (textToAnalyze) {
      try {
        console.log('🏪 Looking up merchant for transcript:', transcript);
        
        // Get country code from user language
        const getCountryCode = (lang: string) => {
          if (lang.startsWith('es')) return 'pe'; // Spanish -> Peru
          if (lang.startsWith('sk')) return 'sk'; // Slovak -> Slovakia  
          return 'us'; // English -> US (default)
        };
        
        const countryCode = getCountryCode(userLanguage);
        console.log('🏪 Using country code:', countryCode);
        

        
        const merchantResult = await lookupMerchant(transcript, countryCode, undefined, userLanguage);
        console.log('🏪 Merchant lookup result:', JSON.stringify(merchantResult, null, 2));
        
        // Use the category from merchant lookup with proper language mapping
        if (merchantResult?.business_type) {
          console.log('🏪 Found business_type:', merchantResult.business_type);
          console.log('🏪 typical_categories:', merchantResult.typical_categories);
          console.log('🏪 matched_merchant:', merchantResult.matched_merchant);
          
          // Update description with proper merchant name if found
          if (merchantResult.matched_merchant) {
            parsed.description = merchantResult.matched_merchant.charAt(0).toUpperCase() + merchantResult.matched_merchant.slice(1);
            console.log('🏪 Updated description to:', parsed.description);
          }
          
          // If it has typical_categories, use the appropriate language one
          if (merchantResult.typical_categories && merchantResult.typical_categories.length > 0) {
            // Get the category based on user language: [English, Slovak, Spanish]
            const langIndex = userLanguage.startsWith('es') ? 2 : userLanguage.startsWith('sk') ? 1 : 0;
            category = merchantResult.typical_categories[langIndex] || merchantResult.typical_categories[0];
            console.log('🏪 Selected category by language index', langIndex, ':', category);
          } else {
            // Fallback - use business_type as category (shouldn't happen with proper merchant data)
            category = merchantResult.business_type;
          }
        } else {
          category = 'Uncategorized';
        }
        
        console.log('🏪 Final category:', category);
      } catch (error) {
        console.log('🏪 Merchant lookup error:', error);
        category = 'Uncategorized';
      }
    }

    const result = { ...parsed, category };
    
    console.log('📤 Voice parsing result:', result);
    res.json({ success: true, data: result });

  } catch (error) {
    console.error('❌ Voice parsing error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Voice parsing failed'
    });
  }
});

export function registerVoiceRoutes(app: Express) {
  app.use('/api/voice', router);
}