import { Router, type Express } from "express";
import { z } from "zod";
import { lookupMerchant } from "../../lib/merchantLookup";
import { parseVoiceInput } from "../../shared/voiceParser";
import { isAuthenticated } from "../clerkAuth.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = Router();

// Voice parsing endpoint
router.post('/parse', async (req, res) => {
  try {
    const { transcript, userLanguage } = z.object({
      transcript: z.string().min(1),
      userLanguage: z.string().default('en-us')
    }).parse(req.body);

    console.log('🎤 Voice parse request:', { transcript, userLanguage });

    // Parse voice input
    const parsed = parseVoiceInput(transcript, userLanguage, new Date());
    
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
  // Parsing a spoken phrase is free (pure regex), but it reveals the merchant lookup and
  // is only used by signed-in screens. Keeping it behind the same door as the other voice
  // routes makes the rule "no login, no voice" uniform.
  app.use(
    '/api/voice',
    isAuthenticated,
    rateLimit({ windowMs: 10 * 60 * 1000, max: 60, keyPrefix: 'voice-parse', perUser: true }),
    router
  );
}