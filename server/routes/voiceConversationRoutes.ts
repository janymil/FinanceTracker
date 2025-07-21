import { Router, Request, Response } from "express";
import { requireAuth } from "@clerk/express";
import { z } from "zod";
import { storage } from "../storage";

const completeTransactionSchema = z.object({
  transactionData: z.object({
    amount: z.number(),
    description: z.string(),
    type: z.enum(['income', 'expense']),
    categoryId: z.number().nullable(),
    categoryName: z.string().nullable(),
    date: z.string().optional(),
    note: z.string().optional()
  }),
  userLanguage: z.string().optional()
});

export function registerVoiceConversationRoutes(app: Router) {
  const router = Router();

  // Complete and save transaction - simplified without AI or hardcoded categories
  router.post('/complete', requireAuth(), async (req: Request, res: Response) => {
    try {
      const { transactionData, userLanguage } = completeTransactionSchema.parse(req.body);
      const userId = (req as any).auth?.userId;

      if (!userId) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      console.log('✅ [VoiceConversation] Saving transaction:', {
        userId: userId.substring(0, 8) + '...',
        data: transactionData
      });

      // Create transaction record without any categorization
      // The existing transaction creation flow will handle categorization
      const transaction = await storage.createTransaction({
        userId: userId,
        amount: transactionData.amount.toString(),
        description: transactionData.description,
        type: transactionData.type,
        date: new Date(transactionData.date || new Date().toISOString().split('T')[0]),
        referenceNote: transactionData.note || '',
        categoryId: null, // Let the existing system handle categorization
        isRecurring: false
      });

      return res.json({
        success: true,
        transaction,
        message: "Transaction saved successfully"
      });

    } catch (error: any) {
      console.error('💥 [VoiceConversation] Failed to save transaction:', error);
      
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