import fs from 'fs/promises';
import path from 'path';
import { getLearnedMerchantPattern, getUserMerchantHistory } from './merchantLearning';

interface MerchantData {
  business_type: string;
  category_keywords: string[];
  merchants: string[];
}

interface BusinessTypeMapping {
  category_keywords: string[];
  typical_categories: string[];
  confidence: number;
}

interface MerchantLookupResult {
  business_type: string;
  category_keywords: string[];
  typical_categories?: string[];
  confidence: number;
  matched_merchant?: string;
  source: 'country_specific' | 'global' | 'ai_analysis' | 'context_analysis' | 'english_context_analysis';
}

// Cache for loaded merchant data
const merchantCache = new Map<string, any>();

/**
 * Load merchant data for a specific country with global fallback
 */
async function loadMerchantData(countryCode: string = 'global'): Promise<Record<string, MerchantData>> {
  const cacheKey = `merchants_${countryCode}`;
  
  if (merchantCache.has(cacheKey)) {
    return merchantCache.get(cacheKey);
  }

  try {
    // Direct path from workspace root
    const countryPath = path.resolve(process.cwd(), 'lib', 'merchants', 'countries', `${countryCode.toLowerCase()}.json`);
    console.log(`[MerchantData] Loading from: ${countryPath}`);
    console.log(`[MerchantData] Current working directory: ${process.cwd()}`);
    
    const countryData = JSON.parse(await fs.readFile(countryPath, 'utf-8'));
    
    console.log(`[MerchantData] Loaded ${countryCode} data with keys:`, Object.keys(countryData));
    
    // Load global merchants as fallback
    const globalPath = path.resolve(process.cwd(), 'lib', 'merchants', 'global.json');
    const globalData = JSON.parse(await fs.readFile(globalPath, 'utf-8'));
    
    // Merge country-specific over global (country takes priority)
    const mergedData = { ...globalData, ...countryData };
    
    merchantCache.set(cacheKey, mergedData);
    return mergedData;
  } catch (error) {
    console.error(`Error loading merchant data for ${countryCode}:`, error);
    
    // Fallback to global only
    try {
      const globalPath = path.join(process.cwd(), 'lib', 'merchants', 'global.json');
      const globalData = JSON.parse(await fs.readFile(globalPath, 'utf-8'));
      merchantCache.set(cacheKey, globalData);
      return globalData;
    } catch (globalError) {
      console.error('Error loading global merchant data:', globalError);
      return {};
    }
  }
}

/**
 * Load business type mappings
 */
async function loadBusinessTypes(): Promise<any> {
  const cacheKey = 'business_types';
  
  if (merchantCache.has(cacheKey)) {
    return merchantCache.get(cacheKey);
  }

  try {
    const businessTypesPath = path.join(process.cwd(), 'lib', 'merchants', 'business-types.json');
    const businessTypes = JSON.parse(await fs.readFile(businessTypesPath, 'utf-8'));
    merchantCache.set(cacheKey, businessTypes);
    return businessTypes;
  } catch (error) {
    console.error('Error loading business types:', error);
    return { business_type_mappings: {}, fallback_analysis: {} };
  }
}

/**
 * Find merchant match by name
 */
async function findMerchantMatch(merchantName: string | null, merchantData: Record<string, MerchantData>): Promise<MerchantLookupResult | null> {
  if (!merchantName || merchantName.trim() === '') {
    return null;
  }
  
  const normalizedName = merchantName.toLowerCase().trim();
  
  for (const [businessType, data] of Object.entries(merchantData)) {
    for (const merchant of data.merchants) {
      if (normalizedName.includes(merchant.toLowerCase()) || merchant.toLowerCase().includes(normalizedName)) {
        // Load business types to get typical_categories
        const businessTypes = await loadBusinessTypes();
        const mapping = businessTypes.business_type_mappings[data.business_type];
        
        return {
          business_type: data.business_type,
          category_keywords: data.category_keywords,
          typical_categories: mapping?.typical_categories,
          confidence: 0.9,
          matched_merchant: merchant,
          source: 'country_specific'
        };
      }
    }
  }
  
  return null;
}

/**
 * Analyze transaction context for business type
 */
function analyzeTransactionContext(transcript: string, businessTypes: any, merchantData?: any): MerchantLookupResult | null {
  const normalizedTranscript = transcript.toLowerCase();
  const { fallback_analysis } = businessTypes;
  
  // First check localized keywords from country-specific merchant data
  console.log(`[Context] Analyzing transcript: "${transcript}"`);
  if (merchantData) {
    console.log(`[Context] Checking merchant data with types:`, Object.keys(merchantData));
    for (const [merchantType, data] of Object.entries(merchantData)) {
      if (typeof data === 'object' && data !== null && 'category_keywords' in data) {
        const categoryKeywords = (data as any).category_keywords as string[];
        console.log(`[Context] Checking ${merchantType} keywords:`, categoryKeywords);
        const matchingKeywords = categoryKeywords.filter(keyword => 
          normalizedTranscript.includes(keyword.toLowerCase())
        );
        const matchCount = matchingKeywords.length;
        console.log(`[Context] Found ${matchCount} matching keywords:`, matchingKeywords);
        
        if (matchCount > 0) {
          console.log(`[Context] Found localized keyword match in ${merchantType}:`, categoryKeywords.filter(k => normalizedTranscript.includes(k.toLowerCase())));
          
          // Map merchant type to business type from business-types.json
          const merchantTypeToBusinessType: Record<string, string> = {
            'coffee_shops': 'coffee_shop',
            'restaurants': 'restaurant', 
            'fast_food': 'fast_food',
            'bakeries': 'restaurant',
            'grocery_stores': 'grocery_store',
            'supermarkets': 'supermarket',
            'gas_stations': 'gas_station',
            'pharmacies': 'pharmacy',
            'banks': 'financial_institution'
          };
          
          const businessType = merchantTypeToBusinessType[merchantType];
          if (businessType && businessTypes.business_type_mappings[businessType]) {
            const mapping = businessTypes.business_type_mappings[businessType];
            return {
              business_type: businessType,
              category_keywords: mapping.category_keywords,
              typical_categories: mapping.typical_categories,
              confidence: Math.max(0.7, matchCount * 0.3), // Higher confidence for localized matches
              source: 'context_analysis'
            };
          }
        }
      }
    }
  }
  
  // Fallback to English keywords if no localized match
  if (!fallback_analysis?.context_keywords) return null;
  
  for (const [category, keywords] of Object.entries(fallback_analysis.context_keywords)) {
    const keywordArray = keywords as string[];
    const matchCount = keywordArray.filter(keyword => 
      normalizedTranscript.includes(keyword.toLowerCase())
    ).length;
    
    if (matchCount > 0) {
      // Map category to business type
      const businessTypeMap: Record<string, string> = {
        'food_related': 'restaurant',
        'transport_related': 'transportation_service',
        'shopping_related': 'retail',
        'health_related': 'pharmacy',
        'entertainment_related': 'entertainment_streaming'
      };
      
      const businessType = businessTypeMap[category];
      if (businessType && businessTypes.business_type_mappings[businessType]) {
        const mapping = businessTypes.business_type_mappings[businessType];
        return {
          business_type: businessType,
          category_keywords: mapping.category_keywords,
          typical_categories: mapping.typical_categories,
          confidence: Math.max(0.6, matchCount * 0.2),
          source: 'english_context_analysis'
        };
      }
    }
  }
  
  return null;
}

/**
 * Main merchant lookup function with learning integration
 */
function getUserLanguage(): string | undefined {
  // This will be passed from the voice routes
  return undefined;
}

export async function lookupMerchant(
  transcript: string, 
  countryCode: string = 'global',
  userId?: string,
  userLanguage?: string
): Promise<MerchantLookupResult | null> {
  try {
    console.log(`[MerchantLookup] Starting lookup for transcript: "${transcript}" with country: ${countryCode}`);
    
    // Extract potential merchant name from transcript
    const merchantName = extractMerchantName(transcript, userLanguage);
    console.log(`[MerchantLookup] Extracted merchant name: "${merchantName}"`);
    
    if (!merchantName) {
      console.log('[MerchantLookup] No merchant name extracted, but continuing with context analysis');
      // Don't return null - we can still do context analysis without extracted merchant name
    }
    
    console.log(`[MerchantLookup] Looking up merchant: "${merchantName}" for country: ${countryCode}`);
    
    // Step 1: Check user's personal history (highest priority)
    if (userId) {
      const userHistory = await getUserMerchantHistory(userId, merchantName);
      if (userHistory) {
        console.log(`[MerchantLookup] User history match found:`, userHistory);
        return {
          business_type: 'learned_from_user',
          category_keywords: [],
          confidence: userHistory.confidence,
          matched_merchant: merchantName,
          source: 'user_history'
        };
      }
    }
    
    // Step 2: Check learned global patterns
    const learnedPattern = await getLearnedMerchantPattern(merchantName, countryCode);
    if (learnedPattern && learnedPattern.confidence > 0.6) {
      console.log(`[MerchantLookup] Learned pattern match found:`, learnedPattern);
      return {
        business_type: learnedPattern.businessType,
        category_keywords: [],
        confidence: learnedPattern.confidence,
        matched_merchant: merchantName,
        source: 'learned_pattern'
      };
    }
    
    // Step 3: Load merchant data for country (file-based)
    const merchantData = await loadMerchantData(countryCode);
    console.log(`[MerchantLookup] Loaded merchant data for ${countryCode}:`, Object.keys(merchantData || {}));
    
    // Step 4: Try direct merchant match
    const directMatch = await findMerchantMatch(merchantName, merchantData);
    if (directMatch) {
      console.log(`[MerchantLookup] Direct match found:`, directMatch);
      return directMatch;
    }
    
    // Step 5: Try global merchant data if country-specific didn't work
    if (countryCode !== 'global') {
      const globalData = await loadMerchantData('global');
      const globalMatch = await findMerchantMatch(merchantName, globalData);
      if (globalMatch) {
        globalMatch.source = 'global';
        console.log(`[MerchantLookup] Global match found:`, globalMatch);
        return globalMatch;
      }
    }
    
    // Step 6: Dynamic intelligent context analysis
    console.log(`[MerchantLookup] No direct merchant match found, trying intelligent context analysis...`);
    const contextResult = await analyzeBusinessContext(transcript, userLanguage, countryCode);
    if (contextResult) {
      console.log(`[MerchantLookup] Intelligent context match found:`, contextResult);
      return contextResult;
    }
    
    console.log('[MerchantLookup] No match found');
    return null;
    
  } catch (error) {
    console.error('[MerchantLookup] Error during lookup:', error);
    return null;
  }
}

/**
 * Extract merchant name from transcript
 */
function extractMerchantName(transcript: string, userLanguage?: string): string | null {
  const text = transcript.toLowerCase().trim();
  
  // Common patterns for merchant extraction
  const patterns = [
    /at\s+([a-zA-Z0-9\s&'.,-]+?)(?:\s+for|\s+to|\s*$)/,
    /from\s+([a-zA-Z0-9\s&'.,-]+?)(?:\s+for|\s+to|\s*$)/,
    /([a-zA-Z0-9\s&'.,-]+?)\s+store/,
    /([a-zA-Z0-9\s&'.,-]+?)\s+shop/,
    /([a-zA-Z0-9\s&'.,-]+?)\s+restaurant/,
    /([a-zA-Z0-9\s&'.,-]+?)\s+cafe/,
    /([a-zA-Z0-9\s&'.,-]+?)\s+station/,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  // Try to find proper nouns (capitalized words in original text)
  const words = transcript.split(' ');
  const properNouns = words.filter(word => 
    word.length > 2 && 
    /^[A-Z]/.test(word) && 
    !/^(I|At|From|For|To|The|And|Or|But)$/i.test(word)
  );
  
  if (properNouns.length > 0) {
    return properNouns.join(' ');
  }
  
  // For simple words like "starbucks", return the first meaningful word from lowercase
  // Multilingual exclusion words
  const getExclusionPattern = (userLanguage?: string) => {
    const baseWords = ['at', 'from', 'for', 'to', 'the', 'and', 'or', 'but', 'in', 'on', 'with', 'by'];
    
    if (userLanguage?.startsWith('sk')) {
      return [...baseWords, 'za', 'v', 'som', 'si', 'na', 'pre', 'do', 'od', 'eur', 'euro'];
    } else if (userLanguage?.startsWith('es')) {
      return [...baseWords, 'para', 'en', 'de', 'por', 'con', 'desde', 'hasta', 'eur', 'euro', 'euros'];
    } else {
      return [...baseWords, 'eur', 'usd', 'czk', 'euro', 'euros', 'dollar', 'dollars'];
    }
  };
  
  const exclusionWords = getExclusionPattern(userLanguage);
  const meaningfulWords = text.split(' ').filter(word => 
    word.length >= 3 && 
    !exclusionWords.includes(word.toLowerCase()) &&
    !/^\d+/.test(word) && // not starting with number
    !/^\d+[\.,]\d+$/.test(word) // not a decimal number like 5.50 or 5,50
  );
  
  if (meaningfulWords.length > 0) {
    return meaningfulWords[0];
  }
  
  return null;
}

/**
 * Dynamic intelligent business context analysis
 * This function analyzes transaction context to determine business type
 * without relying on hardcoded merchant lists
 */
async function analyzeBusinessContext(
  transcript: string, 
  userLanguage?: string, 
  countryCode: string = 'global'
): Promise<MerchantLookupResult | null> {
  try {
    console.log('[Context] Starting intelligent business analysis...');
    
    const normalizedText = transcript.toLowerCase();
    const businessTypes = await loadBusinessTypes();
    
    // Dynamic context clues - these expand over time
    const contextClues = getContextClues(userLanguage);
    
    let bestMatch: { businessType: string; confidence: number; matchedClues: string[] } | null = null;
    
    // Analyze each business type for contextual clues
    for (const [businessType, mapping] of Object.entries(businessTypes.business_type_mappings)) {
      const cluesForType = contextClues[businessType] || [];
      const matchedClues: string[] = [];
      let confidence = 0;
      
      // Check for context clues in transcript
      for (const clue of cluesForType) {
        if (normalizedText.includes(clue.toLowerCase())) {
          matchedClues.push(clue);
          confidence += 0.2; // Each clue adds confidence
        }
      }
      
      // Additional pattern-based detection
      if (businessType === 'coffee_shop' && /\b(caf[eé]|coffee|káva|espresso|cappuccino|latte)\b/i.test(transcript)) {
        matchedClues.push('coffee_indicator');
        confidence += 0.3;
      }
      
      if (businessType === 'restaurant' && /\b(restaur|jedl[eo]|comida|meal|dinner|lunch)\b/i.test(transcript)) {
        matchedClues.push('restaurant_indicator');
        confidence += 0.3;
      }
      
      if (businessType === 'grocery_store' && /\b(grocery|obchod|tienda|market|supermarket|potraviny)\b/i.test(transcript)) {
        matchedClues.push('grocery_indicator');
        confidence += 0.3;
      }
      
      if (businessType === 'gas_station' && /\b(gas|benzín|gasolina|fuel|tankov)\b/i.test(transcript)) {
        matchedClues.push('gas_indicator');
        confidence += 0.4;
      }
      
      if (businessType === 'pharmacy' && /\b(pharmacy|lekáreň|farmacia|medicine|zdravie)\b/i.test(transcript)) {
        matchedClues.push('pharmacy_indicator');
        confidence += 0.4;
      }
      
      if (matchedClues.length > 0 && (!bestMatch || confidence > bestMatch.confidence)) {
        bestMatch = { businessType, confidence, matchedClues };
      }
    }
    
    if (bestMatch && bestMatch.confidence >= 0.3) {
      console.log(`[Context] Detected business type: ${bestMatch.businessType} (confidence: ${bestMatch.confidence.toFixed(2)}, clues: ${bestMatch.matchedClues.join(', ')})`);
      
      const mapping = businessTypes.business_type_mappings[bestMatch.businessType];
      return {
        business_type: bestMatch.businessType,
        category_keywords: mapping.category_keywords || [],
        typical_categories: mapping.typical_categories,
        confidence: Math.min(0.8, bestMatch.confidence), // Cap at 0.8 for context analysis
        source: 'intelligent_context_analysis'
      };
    }
    
    console.log('[Context] No confident business type detected');
    return null;
    
  } catch (error) {
    console.error('[Context] Error in business context analysis:', error);
    return null;
  }
}

/**
 * Get dynamic context clues based on user language
 * This function can be expanded over time with more business types and languages
 */
function getContextClues(userLanguage?: string): Record<string, string[]> {
  const baseClues = {
    coffee_shop: ['starbucks', 'costa', 'dunkin', 'mccafe'],
    restaurant: ['mcdonald', 'kfc', 'pizza', 'burger'],
    grocery_store: ['tesco', 'lidl', 'kaufland', 'billa'],
    gas_station: ['shell', 'bp', 'esso', 'mol'],
    pharmacy: ['walgreens', 'cvs', 'boots'],
    bank: ['bank', 'atm', 'credit'],
    retail_store: ['amazon', 'walmart', 'target']
  };
  
  // Add language-specific clues
  if (userLanguage?.startsWith('sk')) {
    return {
      ...baseClues,
      coffee_shop: [...baseClues.coffee_shop, 'kaviareň', 'káva'],
      restaurant: [...baseClues.restaurant, 'reštaurácia', 'jedlo'],
      grocery_store: [...baseClues.grocery_store, 'potraviny', 'obchod'],
      gas_station: [...baseClues.gas_station, 'benzínka', 'čerpačka'],
      pharmacy: [...baseClues.pharmacy, 'lekáreň', 'lieky']
    };
  } else if (userLanguage?.startsWith('es')) {
    return {
      ...baseClues,
      coffee_shop: [...baseClues.coffee_shop, 'cafetería', 'café'],
      restaurant: [...baseClues.restaurant, 'restaurante', 'comida'],
      grocery_store: [...baseClues.grocery_store, 'supermercado', 'tienda'],
      gas_station: [...baseClues.gas_station, 'gasolinera', 'combustible'],
      pharmacy: [...baseClues.pharmacy, 'farmacia', 'medicina']
    };
  }
  
  return baseClues;
}

/**
 * Get merchant context for AI prompt
 */
export async function getMerchantContextForAI(
  transcript: string, 
  countryCode: string = 'global',
  limit: number = 20
): Promise<string> {
  try {
    const merchantData = await loadMerchantData(countryCode);
    const businessTypes = await loadBusinessTypes();
    
    // Get relevant merchant examples based on transcript content
    const relevantMerchants: string[] = [];
    
    // Add merchants from all business types, but prioritize based on context
    for (const [businessType, data] of Object.entries(merchantData)) {
      const merchants = (data as MerchantData).merchants.slice(0, 3); // Top 3 per category
      merchants.forEach(merchant => {
        relevantMerchants.push(`${merchant} → ${businessType}`);
      });
    }
    
    // Limit to prevent token bloat
    const limitedMerchants = relevantMerchants.slice(0, limit);
    
    return `
MERCHANT RECOGNITION EXAMPLES (${countryCode.toUpperCase()}):
${limitedMerchants.join('\n')}

BUSINESS TYPE ANALYSIS:
- If merchant not in list above, analyze business type from context
- Match business type to user's available categories
- Set categoryId: null if uncertain about match
`;
  } catch (error) {
    console.error('[MerchantLookup] Error generating AI context:', error);
    return '';
  }
}

/**
 * Get user's country from language/locale
 */
export function getCountryFromLanguage(language: string): string {
  const langToCountry: Record<string, string> = {
    'en-us': 'us',
    'es-pe': 'pe', 
    'sk-sk': 'sk',
    'en': 'us',
    'es': 'pe',
    'sk': 'sk'
  };
  
  return langToCountry[language.toLowerCase()] || 'global';
}