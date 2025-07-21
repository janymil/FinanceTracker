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

  // Look for numeric amounts
  for (const word of words) {
    // Decimal formats: "5.50", "5,50", "5:50"
    const decimalMatch = word.match(/(\d+)[.:,](\d{1,2})/);
    if (decimalMatch) {
      amount = `${decimalMatch[1]}.${decimalMatch[2]}`;
      break;
    }
    
    // Simple integers
    if (/^\d+$/.test(word)) {
      amount = word;
      break;
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

  // Extract description (meaningful words)
  const stopWords = ['som', 'si', 'za', 'v', 'na', 'kúpil', 'bought', 'paid', 'for', 'at', 'in', 'the', 'a', 'an', 'eur', 'euro', 'dollar', '$', '€', 'včera', 'yesterday', 'today', 'dnes'];
  
  const meaningfulWords = words.filter(word => {
    const clean = word.toLowerCase().replace(/[^\w]/g, '');
    return clean.length > 2 && 
           !stopWords.includes(clean) && 
           !textNumbers[clean] &&
           !/^\d/.test(clean);
  });

  const description = meaningfulWords.join(' ').trim();

  // Detect transaction type
  let type = 'expense'; // Default
  const incomeWords = ['dostal', 'received', 'výplata', 'salary', 'recibí', 'earned', 'income', 'príjem'];
  const hasIncome = incomeWords.some(word => text.includes(word));
  
  if (hasIncome) {
    type = 'income';
  }

  // Extract date
  let date = '';
  if (text.includes('včera') || text.includes('yesterday')) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    date = yesterday.toISOString().split('T')[0];
  } else if (text.includes('dnes') || text.includes('today')) {
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
    if (parsed.description) {
      try {
        const merchantResult = lookupMerchant(parsed.description);
        category = merchantResult?.category || 'Uncategorized';
      } catch (error) {
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