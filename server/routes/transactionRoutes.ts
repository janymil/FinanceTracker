import type { Express } from "express";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";
import { getUserLanguage, translateCategoryName } from "../categoryTranslations";
import { insertTransactionSchema } from "@shared/schema";
import { categorizeExpense } from "../openai";
import { batchProcessor } from "../batch-processor";

const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe',
  '#00c49f', '#ffbb28', '#ff8042', '#8dd1e1', '#d084d0'
];

export function registerTransactionRoutes(app: Express) {
  // Transaction routes
  app.post('/api/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(userId);

      // Check transaction limits for free plan users
      if (user?.plan === 'free') {
        const existingTransactions = await storage.getUserTransactions(userId);
        if (existingTransactions.length >= 100) {
          return res.status(403).json({ 
            message: "Free plan limited to 100 transaction entries. Upgrade to Standard or Premium for unlimited transaction storage." 
          });
        }
      }

      // Check if recurring transactions are being used and require appropriate plan
      if (req.body.isRecurring && user?.plan === 'free') {
        return res.status(403).json({ 
          message: "Recurring transactions require Standard or Premium subscription" 
        });
      }

      // Prepare OCR data - limit OCR text for free users
      let ocrText = req.body.rawText;
      if (user?.plan === 'free' && ocrText && ocrText.length > 500) {
        ocrText = ocrText.substring(0, 500) + '...'; // Truncate for free users
      }

      const validatedData = insertTransactionSchema.parse({
        ...req.body,
        userId,
        categoryId: req.body.categoryId ? parseInt(req.body.categoryId) : null,
        amount: req.body.amount.toString(),
        date: new Date(req.body.date),
        recurringEndDate: req.body.recurringEndDate ? new Date(req.body.recurringEndDate) : null,
        // OCR fields (optional)
        imageUrl: req.body.imageUrl || null,
        ocrText: user?.plan === 'free' ? null : ocrText || null, // Only store for Standard/Premium
        ocrVendor: req.body.extracted?.vendor || null,
        ocrDetectedAmount: req.body.extracted?.amount ? req.body.extracted.amount.toString() : null,
        ocrDetectedDate: req.body.extracted?.date ? new Date(req.body.extracted.date) : null,
      });

      // Save transaction to database immediately
      const transaction = await storage.createTransaction(validatedData);

      // Return response immediately to user
      res.json(transaction);

      // Handle background processing asynchronously (no await)
      setImmediate(async () => {
        try {
          const user = await storage.getUser(userId);

          // Auto-categorization for premium users (immediate processing)
          if (user?.plan === 'premium' && !transaction.categoryId && transaction.type === 'expense') {
            try {
              const categorization = await categorizeExpense(transaction.description, parseFloat(transaction.amount));
              if (categorization.confidence > 0.7) { // Only auto-apply if confidence is high
                // Update transaction with suggested category
                const categories = await storage.getCategories(userId);
                const matchingCategory = categories.find(cat => cat.name === categorization.category);
                if (matchingCategory) {
                  await storage.updateTransaction(transaction.id, { categoryId: matchingCategory.id });
                  console.log(`Auto-categorized transaction ${transaction.id} as ${categorization.category}`);
                }
              }
            } catch (error) {
              console.error('Auto-categorization error:', error);
            }
          }

          // Schedule this user for batch processing
          batchProcessor.scheduleUser(userId);

          console.log('Background processing completed for transaction:', transaction.id);
        } catch (error) {
          console.error('Background processing error:', error);
          // Don't affect the user experience even if background processing fails
        }
      });

    } catch (error) {
      console.error("Error creating transaction:", error);
      res.status(400).json({ message: "Failed to create transaction" });
    }
  });

  app.get('/api/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(userId);

      // No viewing limits - users can see all their stored transactions
      // Storage limits are enforced at creation time
      let limit = undefined; // Show all transactions user has stored

      const transactions = await storage.getUserTransactions(userId, limit);

      // Get user language and translate predefined category names
      const userLanguage = getUserLanguage(req);
      const translatedTransactions = transactions.map(transaction => {
        if (transaction.categoryName) {
          // We need to check if this category is predefined
          // For now, we'll translate all category names and let translateCategoryName handle the logic
          return {
            ...transaction,
            categoryName: translateCategoryName(transaction.categoryName, userLanguage)
          };
        }
        return transaction;
      });

      res.json(translatedTransactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.put('/api/transactions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(userId);

      const transactionId = parseInt(req.params.id);

      console.log('=== TRANSACTION UPDATE DEBUG ===');
      console.log('Request body received:', JSON.stringify(req.body, null, 2));

      // Only update fields that are actually provided in the request
      const updateData: any = { userId }; // Always include userId for security

      if (req.body.amount !== undefined) {
        updateData.amount = req.body.amount.toString();
      }
      if (req.body.description !== undefined) {
        updateData.description = req.body.description;
      }
      if (req.body.categoryId !== undefined) {
        updateData.categoryId = req.body.categoryId ? parseInt(req.body.categoryId) : null;
      }
      if (req.body.date !== undefined) {
        updateData.date = new Date(req.body.date);
      }
      if (req.body.type !== undefined) {
        updateData.type = req.body.type;
      }
      if (req.body.isRecurring !== undefined) {
        updateData.isRecurring = req.body.isRecurring;
      }
      if (req.body.recurringFrequency !== undefined) {
        updateData.recurringFrequency = req.body.recurringFrequency;
      }
      if (req.body.recurringEndDate !== undefined) {
        updateData.recurringEndDate = req.body.recurringEndDate ? new Date(req.body.recurringEndDate) : null;
      }
      if (req.body.paymentUrl !== undefined) {
        updateData.paymentUrl = req.body.paymentUrl;
      }
      if (req.body.referenceNote !== undefined) {
        updateData.referenceNote = req.body.referenceNote;
      }

      console.log('Final updateData being sent to storage:', JSON.stringify(updateData, null, 2));

      const transaction = await storage.updateTransaction(transactionId, updateData);

      console.log('Transaction returned from storage:', JSON.stringify(transaction, null, 2));
      console.log('=== END TRANSACTION UPDATE DEBUG ===');

      return res.json(transaction);
    } catch (error) {
      console.error("Error updating transaction:", error);
      return res.status(400).json({ message: "Failed to update transaction" });
    }
  });

  app.delete('/api/transactions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(userId);

      const transactionId = parseInt(req.params.id);
      await storage.deleteTransaction(transactionId, userId);
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting transaction:", error);
      return res.status(500).json({ message: "Failed to delete transaction" });
    }
  });

  // Recurring transactions endpoint
  app.get('/api/recurring-transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(userId);

      if (user?.plan === 'free') {
        return res.status(403).json({ message: "Recurring transactions require Standard or Premium subscription" });
      }

      const recurringTransactions = await storage.getUserRecurringTransactions(userId);
      res.json(recurringTransactions);
    } catch (error) {
      console.error("Error fetching recurring transactions:", error);
      res.status(500).json({ message: "Failed to fetch recurring transactions" });
    }
  });

  // Financial summary
  app.get('/api/financial-summary', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start date and end date are required" });
      }

      const summary = await storage.getUserFinancialSummary(
        userId,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      // Get user language and translate predefined category names
      const userLanguage = getUserLanguage(req);
      const translatedSummary = {
        ...summary,
        transactionsByCategory: summary.transactionsByCategory.map((cat: any) => ({
          ...cat,
          categoryName: translateCategoryName(cat.categoryName, userLanguage)
        }))
      };

      res.json(translatedSummary);
    } catch (error) {
      console.error("Error fetching financial summary:", error);
      res.status(500).json({ message: "Failed to fetch financial summary" });
    }
  });

  // Expense breakdown for current month
  app.get('/api/expense-breakdown', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Get current month date range
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const summary = await storage.getUserFinancialSummary(userId, startDate, endDate);

      // Get user language for translation
      const userLanguage = getUserLanguage(req);

      // Filter for expense categories only and format for chart
      const expensesByCategory = summary.transactionsByCategory
        .filter((cat: any) => cat.type === 'expense')
        .map((cat: any, index: number) => ({
          category: translateCategoryName(cat.categoryName, userLanguage),
          amount: Math.abs(cat.amount),
          color: COLORS[index % COLORS.length]
        }));

      res.json({
        expensesByCategory,
        totalExpenses: Math.abs(summary.totalExpenses)
      });
    } catch (error) {
      console.error("Error fetching expense breakdown:", error);
      res.status(500).json({ message: "Failed to fetch expense breakdown" });
    }
  });

  // Automatic transaction reminders (Standard/Premium only)
  app.get('/api/transaction-reminders', async (req: any, res) => {
    try {
      console.log('Transaction reminders endpoint hit - checking authentication...');
      
      // Check authentication first
      let userId: string | null = null;
      try {
        const auth = req.auth();
        userId = auth?.userId || null;
        console.log(`Auth check result: userId=${userId}, auth=${!!auth}`);
      } catch (authError) {
        console.error('Authentication error:', authError);
        return res.status(401).json({ message: "Authentication required" });
      }
      
      if (!userId) {
        console.log('No user ID found, returning 401');
        return res.status(401).json({ message: "Authentication required" });
      }

      console.log(`Transaction reminders API called for user: ${userId}`);
      const user = await storage.getUser(userId);
      console.log(`Transaction reminders check - User: ${userId}, User plan: ${user?.plan}`);

      if (!user || user.plan === 'free') {
        console.log(`Transaction reminders blocked - User plan: ${user?.plan}`);
        return res.status(403).json({ message: "Transaction reminders require Standard or Premium subscription" });
      }

      const daysAhead = req.query.days ? parseInt(req.query.days as string) : 7;
      console.log(`Fetching reminders for ${daysAhead} days ahead`);
      const reminders = await storage.getUpcomingTransactionReminders(userId, daysAhead);
      console.log(`Found ${reminders.length} reminders for user ${userId}:`, JSON.stringify(reminders, null, 2));
      res.json(reminders);
    } catch (error) {
      console.error("Error fetching transaction reminders:", error);
      res.status(500).json({ message: "Failed to fetch transaction reminders" });
    }
  });
}