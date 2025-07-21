import { Router, Request, Response } from "express";
import { requireAuth } from "@clerk/express";
import { z } from "zod";
import { storage } from "../storage";
import { lookupMerchant } from "../../lib/merchantLookup";

const completeTransactionSchema = z.object({
  transactionData: z.object({
    amount: z.number(),
    description: z.string(),
    type: z.enum(['income', 'expense']),
    date: z.string(),
    note: z.string().optional()
  }),
  userLanguage: z.string().optional()
});

export function registerSimpleVoiceRoutes(app: Router) {
  const router = Router();

  // Simple transaction save endpoint - no AI, no complex processing
  router.post('/complete', requireAuth(), async (req: Request, res: Response) => {
    try {
      const { transactionData } = completeTransactionSchema.parse(req.body);
      const userId = (req as any).auth?.userId;

      if (!userId) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      console.log('💰 [SimpleVoice] Saving transaction:', {
        userId: userId.substring(0, 8) + '...',
        amount: transactionData.amount,
        description: transactionData.description,
        type: transactionData.type
      });

      // Use local merchant categorization system
      let categoryId = null;
      try {
        const user = await storage.getUser(parseInt(userId.replace('user_', '')));
        const userCountry = user?.country || 'us';
        
        const merchantResult = await lookupMerchant(transactionData.description, userCountry);
        console.log('🏪 [SimpleVoice] Merchant lookup result:', merchantResult);
        
        if (merchantResult && merchantResult.category_keywords.length > 0) {
          // Try to match with existing user categories
          const categories = await storage.getCategories(userId);
          const matchedCategory = categories.find(cat => 
            merchantResult.category_keywords.some(keyword => 
              cat.name.toLowerCase().includes(keyword.toLowerCase())
            )
          );
          
          if (matchedCategory) {
            categoryId = matchedCategory.id;
            console.log('✅ [SimpleVoice] Found matching category:', matchedCategory.name);
          }
        }
      } catch (error) {
        console.error('⚠️ [SimpleVoice] Local categorization failed:', error);
      }

      // Create transaction record with local categorization
      const transaction = await storage.createTransaction({
        userId: userId,
        amount: transactionData.amount.toString(),
        description: transactionData.description,
        type: transactionData.type,
        date: new Date(transactionData.date),
        referenceNote: transactionData.note || '',
        categoryId: categoryId,
        isRecurring: false
      });

      return res.json({
        success: true,
        transaction,
        message: "Transaction saved successfully"
      });

    } catch (error: any) {
      console.error('💥 [SimpleVoice] Failed to save transaction:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false,
          error: "Invalid request parameters",
          details: error.errors
        });
      }
      
      return res.status(500).json({ 
        success: false,
        error: "Failed to save transaction"
      });
    }
  });

  app.use('/api/voice', router);
}