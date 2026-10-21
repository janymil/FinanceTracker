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
  source: 'country_specific' | 'global' | 'ai_analysis' | 'context_analysis' | 'english_context_analysis' | 'user_history' | 'learned_pattern';
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
      const normalizedMerchant = merchant.toLowerCase().trim();
      
      // Direct match
      if (normalizedName === normalizedMerchant) {
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
      
      // Handle common spelling variations (like Bille -> billa)
      if ((normalizedName === 'bille' && normalizedMerchant === 'billa') ||
          (normalizedName === 'billa' && normalizedMerchant === 'bille') ||
          normalizedName.includes(normalizedMerchant) || 
          normalizedMerchant.includes(normalizedName)) {
        const businessTypes = await loadBusinessTypes();
        const mapping = businessTypes.business_type_mappings[data.business_type];
        
        return {
          business_type: data.business_type,
          category_keywords: data.category_keywords,
          typical_categories: mapping?.typical_categories,
          confidence: 0.8,
          matched_merchant: merchant,
          source: 'country_specific'
        };
      }
    }
  }
  
  return null;
}

/**
 * Simple context analysis using country-specific merchant data
 */
function analyzeTransactionContext(transcript: string, businessTypes: any, merchantData?: any): MerchantLookupResult | null {
  const normalizedTranscript = transcript.toLowerCase();
  
  // Check keywords from country-specific merchant data
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
          console.log(`[Context] Found keyword match in ${merchantType}:`, matchingKeywords);
          
          // Map merchant type to business type
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
              confidence: 0.7,
              source: 'context_analysis'
            };
          }
        }
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
    if (userId && merchantName) {
      const userHistory = await getUserMerchantHistory(userId, merchantName);
      if (userHistory) {
        console.log(`[MerchantLookup] User history match found:`, userHistory);
        return {
          business_type: 'learned_from_user',
          category_keywords: [],
          confidence: userHistory.confidence,
          matched_merchant: merchantName || undefined,
          source: 'user_history'
        };
      }
    }
    
    // Step 2: Check learned global patterns
    if (merchantName) {
      const learnedPattern = await getLearnedMerchantPattern(merchantName, countryCode);
      if (learnedPattern && learnedPattern.confidence > 0.6) {
        console.log(`[MerchantLookup] Learned pattern match found:`, learnedPattern);
        return {
          business_type: learnedPattern.businessType,
          category_keywords: [],
          confidence: learnedPattern.confidence,
          matched_merchant: merchantName || undefined,
          source: 'learned_pattern'
        };
      }
    }
    
    // Step 3: Load merchant data for country (file-based)
    const merchantData = await loadMerchantData(countryCode);
    console.log(`[MerchantLookup] Loaded merchant data for ${countryCode}:`, Object.keys(merchantData || {}));
    
    // Step 4: Try direct merchant match
    const directMatch = merchantName ? await findMerchantMatch(merchantName, merchantData) : null;
    if (directMatch) {
      console.log(`[MerchantLookup] Direct match found:`, directMatch);
      return directMatch;
    }
    
    // Step 5: Try direct global merchant lookup using global.json
    console.log(`[MerchantLookup] Trying global merchants from global.json...`);
    try {
      const globalPath = path.resolve(process.cwd(), 'lib', 'merchants', 'global.json');
      const globalData = JSON.parse(await fs.readFile(globalPath, 'utf-8'));
      const globalMatch = merchantName ? await findMerchantMatch(merchantName, globalData) : null;
      if (globalMatch) {
        globalMatch.source = 'global';
        console.log(`[MerchantLookup] Global match found:`, globalMatch);
        return globalMatch;
      }
    } catch (globalError: any) {
      console.log(`[MerchantLookup] Could not load global merchants:`, globalError?.message);
    }
    
    // Step 6: Simple context analysis using country-specific merchant data
    console.log(`[MerchantLookup] No direct merchant match found, trying context analysis...`);
    const businessTypes = await loadBusinessTypes();
    const contextMatch = analyzeTransactionContext(transcript, businessTypes, merchantData);
    if (contextMatch) {
      console.log(`[MerchantLookup] Context match found:`, contextMatch);
      return contextMatch;
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
  
  // Common patterns for merchant extraction - Slovak-specific patterns first
  const patterns = [
    // Slovak patterns
    /v\s+([A-Za-z][a-zA-Z0-9\s&'.,-]*?)(?:\s+za|\s+$)/,  // "v Bille za" -> "Bille"
    /na\s+([A-Za-z][a-zA-Z0-9\s&'.,-]*?)(?:\s+za|\s+$)/, // "na Tesco za" -> "Tesco"
    // English patterns
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
  
  // Simple extraction - try to find proper nouns (capitalized words)
  const words = transcript.split(' ');
  const properNouns = words.filter(word => 
    word.length > 2 && 
    /^[A-Z]/.test(word)
  );
  
  if (properNouns.length > 0) {
    return properNouns[0]; // Return first proper noun
  }
  
  // Fallback to meaningful words from lowercase
  const meaningfulWords = text.split(' ').filter(word => 
    word.length >= 3 && 
    !/^\d+/.test(word) && // not starting with number
    !/^\d+[\.,]\d+$/.test(word) // not a decimal number like 5.50 or 5,50
  );
  
  if (meaningfulWords.length > 0) {
    return meaningfulWords[0];
  }
  
  return null;
}

// Removed overcomplicated intelligent analysis - using simple country JSON lookup instead

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