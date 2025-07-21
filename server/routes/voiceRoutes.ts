import { Router, type Express } from "express";
import { z } from "zod";
import { lookupMerchant, getCountryFromLanguage } from "../../lib/merchantLookup";

const router = Router();

// Enhanced voice input parsing function
function parseVoiceInput(transcript: string, userLanguage: string) {
  const text = transcript.toLowerCase().trim();
  const words = transcript.split(/\s+/).filter(w => w.length > 0);
  
  console.log('🎤 Parsing voice:', transcript);
  
  // Extract amount with enhanced patterns
  let amount = '';
  
  // Number mappings for multilingual support
  const textNumbers: { [key: string]: string } = {
    // Slovak
    'jeden': '1', 'dva': '2', 'tri': '3', 'štyri': '4', 'päť': '5',
    'šesť': '6', 'sedem': '7', 'osem': '8', 'deväť': '9', 'desať': '10',
    'jedenásť': '11', 'dvanásť': '12', 'trinásť': '13', 'štrnásť': '14', 'pätnásť': '15',
    'dvadsať': '20', 'tridsať': '30', 'štyridsať': '40', 'päťdesiat': '50',
    // Spanish  
    'uno': '1', 'dos': '2', 'tres': '3', 'cuatro': '4', 'cinco': '5',
    'seis': '6', 'siete': '7', 'ocho': '8', 'nueve': '9', 'diez': '10',
    'once': '11', 'doce': '12', 'trece': '13', 'catorce': '14', 'quince': '15',
    'veinte': '20', 'treinta': '30', 'cuarenta': '40', 'cincuenta': '50',
    // English
    'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
    'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
    'eleven': '11', 'twelve': '12', 'thirteen': '13', 'fourteen': '14', 'fifteen': '15',
    'twenty': '20', 'thirty': '30', 'forty': '40', 'fifty': '50'
  };

  // Enhanced amount detection patterns
  const amountPatterns = [
    // Currency with amount: "5 euros", "3 dollars", "10 eur"
    /(\d+(?:[.,]\d+)?)\s*(?:euro|eur|€|dollar|dolar|\$|peso|pesos)/gi,
    // Amount with currency symbols: "$5", "€3.50" 
    /[€$]\s*(\d+(?:[.,]\d+)?)/gi,
    // Contextual amounts: "cost 5", "stalo 10", "costó 3"
    /(?:cost|stalo|costó|costed|stálo)\s*(?:to|me)?\s*(\d+(?:[.,]\d+)?)/gi,
    // "za 5 eur", "for 3 dollars"
    /(?:za|for|por)\s*(\d+(?:[.,]\d+)?)/gi,
    // Decimal formats with various separators
    /(\d+)[.:,](\d{1,2})(?!\d)/g,
    // Split decimals: "5 50" meaning "5.50"
    /\b(\d+)\s+(\d{1,2})\b/g,
    // Simple integers last
    /\b(\d+)\b/g
  ];

  for (const pattern of amountPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      const match = matches[0];
      console.log('💰 Found amount match:', match);
      
      if (pattern === amountPatterns[4]) { // Decimal format
        const decimalMatch = match.match(/(\d+)[.:,](\d{1,2})/);
        if (decimalMatch) {
          amount = `${decimalMatch[1]}.${decimalMatch[2].padEnd(2, '0')}`;
        }
      } else if (pattern === amountPatterns[5]) { // Split decimals
        const splitMatch = match.match(/(\d+)\s+(\d{1,2})/);
        if (splitMatch && parseInt(splitMatch[2]) < 100) {
          amount = `${splitMatch[1]}.${splitMatch[2].padStart(2, '0')}`;
        }
      } else {
        // Extract numeric part
        const numberMatch = match.match(/(\d+(?:[.,]\d+)?)/);
        if (numberMatch) {
          amount = numberMatch[1].replace(',', '.');
        }
      }
      
      if (amount) break;
    }
  }

  // Try text numbers if no numeric amount found
  if (!amount) {
    for (const word of words) {
      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
      if (textNumbers[cleanWord]) {
        amount = textNumbers[cleanWord];
        console.log('💰 Found text number:', cleanWord, '=', amount);
        break;
      }
    }
  }

  // Enhanced description extraction
  const stopWords = [
    // Slovak
    'som', 'si', 'za', 'v', 'na', 'kúpil', 'kúpila', 'zaplatil', 'zaplatila',
    'iba', 'len', 'to', 'je', 'bolo', 'stalo', 'stála',
    // Spanish
    'compré', 'compre', 'pagué', 'pague', 'por', 'para', 'en', 'el', 'la', 'un', 'una',
    'esto', 'eso', 'fue', 'costó', 'costo',
    // English
    'bought', 'paid', 'for', 'at', 'in', 'the', 'a', 'an', 'this', 'that', 'and', 'or', 'but',
    'cost', 'costed', 'was', 'were', 'is', 'it',
    // Common
    'eur', 'euro', 'dollar', '$', '€', 'včera', 'yesterday', 'today', 'dnes', 'ayer', 'hoy'
  ];
  
  // Filter meaningful words and remove amounts
  const meaningfulWords = words.filter(word => {
    const clean = word.toLowerCase().replace(/[^\w]/g, '');
    return clean.length > 1 && 
           !stopWords.includes(clean) && 
           !textNumbers[clean] &&
           !/^\d/.test(clean) &&
           !/^[.:,€$]/.test(clean) &&
           !clean.match(/^(euro|eur|dollar|dolar|peso|pesos)$/);
  });

  // Enhanced description extraction with context
  let description = '';
  if (meaningfulWords.length > 0) {
    description = meaningfulWords.join(' ').trim();
  } else {
    // Fallback: extract from context patterns
    const contextPatterns = [
      // "bought coffee at starbucks"
      /(?:kúpil|bought|compré)\s+(?:som\s+)?(?:si\s+)?(.+?)(?:\s+(?:za|for|por|v|at|en)\s+|$)/gi,
      // "paid for lunch"  
      /(?:zaplatil|paid|pagué)\s+(?:som\s+)?(?:za\s+|for\s+|por\s+)?(.+?)(?:\s+\d+|$)/gi,
      // "at restaurant name"
      /(?:v|at|en)\s+(.+?)(?:\s+za\s+\d+|\s+for\s+\d+|$)/gi
    ];
    
    for (const pattern of contextPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        description = match[1].trim();
        break;
      }
    }
  }

  // Enhanced transaction type detection
  let type = 'expense'; // Default
  const expenseWords = [
    'kúpil', 'kúpila', 'zaplatil', 'zaplatila', 'výdavok', 'minul', 'minula',
    'bought', 'paid', 'spent', 'purchase', 'expense', 'cost',
    'compré', 'compre', 'pagué', 'pague', 'gasto', 'gasté'
  ];
  const incomeWords = [
    'dostal', 'dostala', 'výplata', 'príjem', 'zarobil', 'zarobila', 'predal', 'predala',
    'received', 'earned', 'income', 'salary', 'sold', 'gain',
    'recibí', 'recibe', 'ingreso', 'salario', 'gané', 'vendí'
  ];
  
  const hasIncome = incomeWords.some(word => text.includes(word));
  const hasExpense = expenseWords.some(word => text.includes(word));
  
  if (hasIncome && !hasExpense) {
    type = 'income';
  }

  // Enhanced date extraction
  let date = '';
  const today = new Date();
  
  if (text.includes('včera') || text.includes('yesterday') || text.includes('ayer')) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    date = yesterday.toISOString().split('T')[0];
  } else if (text.includes('predvčerom') || text.includes('day before yesterday') || text.includes('anteayer')) {
    const dayBefore = new Date(today);
    dayBefore.setDate(dayBefore.getDate() - 2);
    date = dayBefore.toISOString().split('T')[0];
  } else if (text.includes('dnes') || text.includes('today') || text.includes('hoy')) {
    date = today.toISOString().split('T')[0];
  } else if (text.includes('minulý týždeň') || text.includes('last week') || text.includes('semana pasada')) {
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    date = lastWeek.toISOString().split('T')[0];
  }

  return {
    amount: amount || '',
    description: description || '',
    type,
    date: date || today.toISOString().split('T')[0], // Default to today
    note: transcript
  };
}

// Enhanced category mapping
function getEnhancedCategoryMapping(businessType: string, userLanguage: string): string {
  const categoryMappings: { [key: string]: { [lang: string]: string } } = {
    'restaurant': {
      'sk-sk': 'Jedlo a pitie',
      'es-pe': 'Comida',
      'en-us': 'Food & Dining'
    },
    'grocery': {
      'sk-sk': 'Potraviny',
      'es-pe': 'Supermercado', 
      'en-us': 'Groceries'
    },
    'supermarket': {
      'sk-sk': 'Potraviny',
      'es-pe': 'Supermercado',
      'en-us': 'Groceries'
    },
    'food': {
      'sk-sk': 'Jedlo a pitie',
      'es-pe': 'Comida',
      'en-us': 'Food & Dining'
    },
    'cafe': {
      'sk-sk': 'Jedlo a pitie',
      'es-pe': 'Café',
      'en-us': 'Food & Dining'
    },
    'shopping': {
      'sk-sk': 'Nákupy',
      'es-pe': 'Compras',
      'en-us': 'Shopping'
    },
    'retail': {
      'sk-sk': 'Nákupy', 
      'es-pe': 'Compras',
      'en-us': 'Shopping'
    },
    'clothing': {
      'sk-sk': 'Oblečenie',
      'es-pe': 'Ropa',
      'en-us': 'Clothing'
    },
    'electronics': {
      'sk-sk': 'Elektronika',
      'es-pe': 'Electrónicos',
      'en-us': 'Electronics'
    },
    'transport': {
      'sk-sk': 'Doprava',
      'es-pe': 'Transporte', 
      'en-us': 'Transportation'
    },
    'transportation_service': {
      'sk-sk': 'Doprava',
      'es-pe': 'Transporte',
      'en-us': 'Transportation'
    },
    'fuel': {
      'sk-sk': 'Benzín',
      'es-pe': 'Gasolina',
      'en-us': 'Fuel'
    },
    'gas_station': {
      'sk-sk': 'Benzín',
      'es-pe': 'Gasolina', 
      'en-us': 'Fuel'
    },
    'entertainment': {
      'sk-sk': 'Zábava',
      'es-pe': 'Entretenimiento',
      'en-us': 'Entertainment'
    },
    'entertainment_streaming': {
      'sk-sk': 'Zábava',
      'es-pe': 'Entretenimiento',
      'en-us': 'Entertainment'
    },
    'healthcare': {
      'sk-sk': 'Zdravie',
      'es-pe': 'Salud',
      'en-us': 'Healthcare'
    },
    'pharmacy': {
      'sk-sk': 'Lekáreň',
      'es-pe': 'Farmacia',
      'en-us': 'Healthcare'
    },
    'education': {
      'sk-sk': 'Vzdelávanie',
      'es-pe': 'Educación',
      'en-us': 'Education'
    },
    'utilities': {
      'sk-sk': 'Služby',
      'es-pe': 'Servicios',
      'en-us': 'Utilities'
    },
    'bank': {
      'sk-sk': 'Finančné služby',
      'es-pe': 'Servicios Financieros',
      'en-us': 'Financial Services'
    },
    'atm': {
      'sk-sk': 'Finančné služby',
      'es-pe': 'Servicios Financieros', 
      'en-us': 'Financial Services'
    }
  };
  
  const mapping = categoryMappings[businessType.toLowerCase()];
  if (mapping) {
    return mapping[userLanguage] || mapping['en-us'] || 'Uncategorized';
  }
  
  return 'Uncategorized';
}

// Enhanced voice parsing endpoint
router.post('/parse', async (req, res) => {
  try {
    const { transcript, userLanguage } = z.object({
      transcript: z.string().min(1),
      userLanguage: z.string().default('en-us')
    }).parse(req.body);

    console.log('🎤 Voice parse request:', { transcript, userLanguage });

    // Parse voice input with enhanced logic
    const parsed = parseVoiceInput(transcript, userLanguage);
    
    // Get category using enhanced merchant lookup
    let category = '';
    if (parsed.description) {
      try {
        console.log('🏪 Looking up merchant for transcript:', transcript);
        
        // Get country from language for better merchant lookup
        const countryCode = getCountryFromLanguage(userLanguage);
        const merchantResult = await lookupMerchant(transcript, countryCode);
        
        console.log('🏪 Merchant lookup result:', merchantResult);
        
        // Use enhanced category mapping
        if (merchantResult?.business_type) {
          category = getEnhancedCategoryMapping(merchantResult.business_type, userLanguage);
        } else {
          // Fallback: try to categorize based on description context
          const desc = parsed.description.toLowerCase();
          if (desc.includes('coffee') || desc.includes('káva') || desc.includes('café') ||
              desc.includes('restaurant') || desc.includes('reštaurácia') || desc.includes('restaurante')) {
            category = getEnhancedCategoryMapping('restaurant', userLanguage);
          } else if (desc.includes('gas') || desc.includes('benzín') || desc.includes('gasolina') ||
                     desc.includes('fuel') || desc.includes('nafta') || desc.includes('combustible')) {
            category = getEnhancedCategoryMapping('fuel', userLanguage);
          } else if (desc.includes('grocery') || desc.includes('potraviny') || desc.includes('supermercado') ||
                     desc.includes('tesco') || desc.includes('lidl') || desc.includes('kaufland')) {
            category = getEnhancedCategoryMapping('grocery', userLanguage);
          } else {
            category = userLanguage === 'sk-sk' ? 'Ostatné' : 
                      userLanguage === 'es-pe' ? 'Otros' : 'Other';
          }
        }
        
        console.log('🏪 Final category:', category);
      } catch (error) {
        console.log('🏪 Merchant lookup error:', error);
        category = userLanguage === 'sk-sk' ? 'Ostatné' : 
                  userLanguage === 'es-pe' ? 'Otros' : 'Other';
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