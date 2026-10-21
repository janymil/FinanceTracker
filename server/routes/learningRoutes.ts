import { Router, Request, Response } from "express";
import { requireAuth } from "@clerk/express";
import { getUserId } from "../clerkAuth";
import { z } from "zod";
import { 
  recordMerchantLearning, 
  getLearnedMerchantPattern, 
  getTopLearnedMerchants,
  getLearningAnalytics 
} from "../../lib/merchantLearning";
import { getCountryFromLanguage } from "../../lib/merchantLookup";

const learningSchema = z.object({
  merchantName: z.string().min(1),
  transcript: z.string().min(1),
  originalCategoryId: z.number().optional(),
  correctedCategoryId: z.number(),
  businessType: z.string().optional(),
  language: z.string().default("en-us"),
  confidence: z.number().min(0).max(1).optional(),
  correctionType: z.enum(['manual_selection', 'category_change', 'merchant_correction']),
  transactionId: z.number().optional()
});

export function registerLearningRoutes(app: Router) {
  const router = Router();

  // Record merchant learning from user correction
  router.post('/record', requireAuth(), async (req: Request, res: Response) => {
    try {
      const data = learningSchema.parse(req.body);
      const userId = getUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      console.log('📚 [LearningAPI] Recording user correction:', {
        merchant: data.merchantName,
        correctionType: data.correctionType,
        userId: userId.substring(0, 8) + '...'
      });

      const countryCode = getCountryFromLanguage(data.language);
      
      await recordMerchantLearning({
        userId,
        merchantName: data.merchantName,
        transcript: data.transcript,
        originalCategoryId: data.originalCategoryId,
        correctedCategoryId: data.correctedCategoryId,
        businessType: data.businessType,
        countryCode,
        language: data.language,
        confidence: data.confidence,
        correctionType: data.correctionType,
        transactionId: data.transactionId
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Learning record error:", error);
      res.status(500).json({ error: "Failed to record learning" });
    }
  });

  // Get learned pattern for a merchant
  router.get('/merchant/:name', requireAuth(), async (req: Request, res: Response) => {
    try {
      const merchantName = req.params.name;
      const language = req.query.language as string || 'en-us';
      const countryCode = getCountryFromLanguage(language);
      
      const pattern = await getLearnedMerchantPattern(merchantName, countryCode);
      
      res.json({ pattern });
    } catch (error) {
      console.error("Get merchant pattern error:", error);
      res.status(500).json({ error: "Failed to get merchant pattern" });
    }
  });

  // Get top learned merchants for a country
  router.get('/merchants/:country', requireAuth(), async (req: Request, res: Response) => {
    try {
      const countryCode = req.params.country;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const merchants = await getTopLearnedMerchants(countryCode, limit);
      
      res.json({ merchants });
    } catch (error) {
      console.error("Get top merchants error:", error);
      res.status(500).json({ error: "Failed to get top merchants" });
    }
  });

  // Get learning analytics (admin only)
  router.get('/analytics', requireAuth(), async (req: Request, res: Response) => {
    try {
      // TODO: Add admin role check
      const analytics = await getLearningAnalytics();
      
      res.json(analytics);
    } catch (error) {
      console.error("Get learning analytics error:", error);
      res.status(500).json({ error: "Failed to get learning analytics" });
    }
  });

  app.use('/api/learning', router);
}