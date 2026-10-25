import { log } from '../logger';
import { notifyDataChange } from "../realtime";

import type { Express } from "express";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";
import { getUserLanguage, translateCategoryName } from "../categoryTranslations";
import { insertTransactionSchema } from "@shared/schema";
import { parseValue, sendValidationError } from "../validation";
import { autoCategorizeTransaction } from "../autoCategorize";
import { batchProcessor } from "../batch-processor";
import { monthRange, localParts, rangeStartFrom, rangeEndFrom } from "@shared/timezones";
import {
  cleanPositiveAmount as cleanAmount,
  cleanDateValue as cleanDate,
  cleanText,
  cleanId,
  MAX_DESCRIPTION_LENGTH,
  MAX_NOTE_LENGTH,
} from "@shared/trackingInput";

const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe',
  '#00c49f', '#ffbb28', '#ff8042', '#8dd1e1', '#d084d0'
];

const RECURRING_FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];

/** Only web links may be stored; `javascript:` and friends would run when clicked. */
function cleanUrl(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  try {
    const url = new URL(String(value));
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** The category must be the person's own or a shared default (userId null); otherwise its name and colour would leak. */
async function categoryAllowed(categoryId: number | null | undefined, userId: string): Promise<boolean> {
  if (categoryId === null || categoryId === undefined) return true;
  const categories = await storage.getCategories(userId);
  return categories.some((category) => category.id === categoryId);
}

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
        if ((await storage.countUserTransactions(userId)) >= 100) {
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

      const amount = cleanAmount(req.body.amount);
      const date = cleanDate(req.body.date);
      if (!amount || !date) {
        return res.status(400).json({ message: "A positive amount and a valid date are required" });
      }
      if (!['income', 'expense'].includes(req.body.type)) {
        return res.status(400).json({ message: "Type must be 'income' or 'expense'" });
      }
      const description = cleanText(req.body.description, MAX_DESCRIPTION_LENGTH);
      if (!description) {
        return res.status(400).json({ message: `A description of up to ${MAX_DESCRIPTION_LENGTH} characters is required` });
      }
      if (req.body.referenceNote && String(req.body.referenceNote).length > MAX_NOTE_LENGTH) {
        return res.status(400).json({ message: `Note is limited to ${MAX_NOTE_LENGTH} characters` });
      }
      const paymentUrl = cleanUrl(req.body.paymentUrl);
      if (paymentUrl === undefined && req.body.paymentUrl !== undefined) {
        return res.status(400).json({ message: "Payment link must be an http(s) address" });
      }
      if (req.body.recurringFrequency && !RECURRING_FREQUENCIES.includes(req.body.recurringFrequency)) {
        return res.status(400).json({ message: "Invalid recurring frequency" });
      }

      const requestedCategory = req.body.categoryId ? cleanId(req.body.categoryId) : null;
      if (req.body.categoryId && requestedCategory === null) {
        return res.status(400).json({ message: "Unknown category" });
      }
      if (!(await categoryAllowed(requestedCategory, userId))) {
        return res.status(400).json({ message: "Unknown category" });
      }

      const parsed = parseValue({
        ...req.body,
        userId,
        description,
        paymentUrl: paymentUrl ?? null,
        categoryId: requestedCategory,
        amount,
        date,
        recurringEndDate: req.body.recurringEndDate ? new Date(req.body.recurringEndDate) : null,
        // OCR fields (optional)
        imageUrl: req.body.imageUrl || null,
        ocrText: user?.plan === 'free' ? null : ocrText || null, // Only store for Standard/Premium
        ocrVendor: req.body.extracted?.vendor || null,
        ocrDetectedAmount: req.body.extracted?.amount ? req.body.extracted.amount.toString() : null,
        ocrDetectedDate: req.body.extracted?.date ? new Date(req.body.extracted.date) : null,
      }, insertTransactionSchema);
      if (!parsed.ok) {
        // Answers 400 with the offending fields instead of the generic message below.
        return sendValidationError(res, parsed.issues, "Failed to create transaction");
      }
      const validatedData = parsed.data;

      // Save transaction to database immediately
      const transaction = await storage.createTransaction(validatedData);
      notifyDataChange(userId, 'transaction');

      // Return response immediately to user
      res.json(transaction);

      // Handle background processing asynchronously (no await)
      setImmediate(async () => {
        try {
          // Process voice learning data if present
          if (req.body.voiceLearningData) {
            try {
              const { recordMerchantLearning } = await import('../../lib/merchantLearning');
              const { getCountryFromLanguage } = await import('../../lib/merchantLookup');
              
              const learningData = req.body.voiceLearningData;
              const countryCode = getCountryFromLanguage(learningData.language);
              
              // Determine correction type
              let correctionType = 'manual_selection';
              if (learningData.originalCategoryId && learningData.correctedCategoryId !== learningData.originalCategoryId) {
                correctionType = 'category_change';
              }
              
              await recordMerchantLearning({
                userId,
                merchantName: learningData.merchantName,
                transcript: learningData.transcript,
                originalCategoryId: learningData.originalCategoryId,
                correctedCategoryId: parseInt(learningData.correctedCategoryId),
                countryCode,
                language: learningData.language,
                confidence: learningData.confidence,
                correctionType: correctionType as any,
                transactionId: transaction.id
              });
              
              log.info('📚 Voice learning recorded for transaction:', transaction.id);
            } catch (error) {
              console.error('Voice learning error:', error);
            }
          }

          // Auto-categorization for premium users: same AI gate, the person's own categories
          try {
            const outcome = await autoCategorizeTransaction(transaction, userId, getUserLanguage(req));
            if (outcome.applied) {
              log.info(`Auto-categorized transaction ${transaction.id} (confidence ${outcome.confidence.toFixed(2)})`);
            }
          } catch (error) {
            console.error('Auto-categorization error:', error);
          }

          // Schedule this user for batch processing
          batchProcessor.scheduleUser(userId);

          log.info('Background processing completed for transaction:', transaction.id);
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

      const transactionId = cleanId(req.params.id);

      // Only update fields that are actually provided in the request
      const updateData: any = { userId }; // Always include userId for security

      if (transactionId === null) {
        return res.status(400).json({ message: "Invalid transaction id" });
      }

      if (req.body.amount !== undefined) {
        const amount = cleanAmount(req.body.amount);
        if (!amount) return res.status(400).json({ message: "Amount must be a positive number" });
        updateData.amount = amount;
      }
      if (req.body.description !== undefined) {
        const description = cleanText(req.body.description, MAX_DESCRIPTION_LENGTH);
        if (!description) {
          return res.status(400).json({ message: `A description of up to ${MAX_DESCRIPTION_LENGTH} characters is required` });
        }
        updateData.description = description;
      }
      if (req.body.categoryId !== undefined) {
        updateData.categoryId = req.body.categoryId ? cleanId(req.body.categoryId) : null;
        if (req.body.categoryId && updateData.categoryId === null) {
          return res.status(400).json({ message: "Unknown category" });
        }
        if (!(await categoryAllowed(updateData.categoryId, userId))) {
          return res.status(400).json({ message: "Unknown category" });
        }
      }
      if (req.body.date !== undefined) {
        const date = cleanDate(req.body.date);
        if (!date) return res.status(400).json({ message: "Invalid date" });
        updateData.date = date;
      }
      if (req.body.type !== undefined) {
        if (!['income', 'expense'].includes(req.body.type)) {
          return res.status(400).json({ message: "Type must be 'income' or 'expense'" });
        }
        updateData.type = req.body.type;
      }
      if (req.body.isRecurring !== undefined) {
        updateData.isRecurring = Boolean(req.body.isRecurring);
      }
      if (req.body.recurringFrequency !== undefined) {
        if (req.body.recurringFrequency && !RECURRING_FREQUENCIES.includes(req.body.recurringFrequency)) {
          return res.status(400).json({ message: "Invalid recurring frequency" });
        }
        updateData.recurringFrequency = req.body.recurringFrequency;
      }
      if (req.body.recurringEndDate !== undefined) {
        const end = cleanDate(req.body.recurringEndDate);
        if (req.body.recurringEndDate && !end) return res.status(400).json({ message: "Invalid end date" });
        updateData.recurringEndDate = end;
      }
      if (req.body.paymentUrl !== undefined) {
        const paymentUrl = cleanUrl(req.body.paymentUrl);
        if (paymentUrl === undefined) {
          return res.status(400).json({ message: "Payment link must be an http(s) address" });
        }
        updateData.paymentUrl = paymentUrl;
      }
      if (req.body.referenceNote !== undefined) {
        if (req.body.referenceNote && String(req.body.referenceNote).length > MAX_NOTE_LENGTH) {
          return res.status(400).json({ message: `Note is limited to ${MAX_NOTE_LENGTH} characters` });
        }
        updateData.referenceNote = req.body.referenceNote;
      }

      const transaction = await storage.updateTransaction(transactionId, updateData);
      notifyDataChange(userId, 'transaction');

      return res.json(transaction);
    } catch (error) {
      if (error instanceof Error && error.message === 'Transaction not found') {
        return res.status(404).json({ message: "Transaction not found" });
      }
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
      const transactionId = cleanId(req.params.id);
      if (transactionId === null) {
        return res.status(400).json({ message: "Invalid transaction id" });
      }
      if (!(await storage.deleteTransaction(transactionId, userId))) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      notifyDataChange(userId, 'transaction');
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

  // Stop a recurring rule. Transactions it already created stay; no new ones are made.
  app.delete('/api/recurring-transactions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const ruleId = parseInt(req.params.id);
      if (!Number.isInteger(ruleId)) {
        return res.status(400).json({ message: "Invalid id" });
      }

      const stopped = await storage.stopRecurringRule(ruleId, userId);
      if (!stopped) {
        return res.status(404).json({ message: "Recurring rule not found" });
      }
      notifyDataChange(userId, 'transaction');
      return res.json({ success: true });
    } catch (error) {
      console.error("Error stopping recurring rule:", error);
      return res.status(500).json({ message: "Failed to stop the recurring rule" });
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
      const parsedStart = cleanDate(startDate);
      const parsedEnd = cleanDate(endDate);
      if (!parsedStart || !parsedEnd) {
        return res.status(400).json({ message: "Start date and end date must be valid dates" });
      }
      // A plain "2026-10-01" means that calendar day in the person's own time zone.
      const timeZone = await storage.getUserTimeZone(userId);
      const start = rangeStartFrom(startDate, parsedStart, timeZone);
      const end = rangeEndFrom(endDate, parsedEnd, timeZone);
      if (end < start) {
        return res.status(400).json({ message: "End date must not be before the start date" });
      }

      const summary = await storage.getUserFinancialSummary(userId, start, end);

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

      // The current month as the person's own calendar shows it
      const timeZone = await storage.getUserTimeZone(userId);
      const today = localParts(new Date(), timeZone);
      const { start: startDate, end: endDate } = monthRange(today.year, today.month, timeZone);

      const summary = await storage.getUserFinancialSummary(userId, startDate, endDate);

      // Get user language for translation
      const userLanguage = getUserLanguage(req);

      // Filter for expense categories only and format for chart
      // Amounts are stored non-negative (sign lives in `type`), so no Math.abs().
      const expensesByCategory = summary.transactionsByCategory
        .filter((cat: any) => cat.type === 'expense')
        .map((cat: any, index: number) => ({
          category: translateCategoryName(cat.categoryName, userLanguage),
          amount: cat.amount,
          color: COLORS[index % COLORS.length]
        }));

      res.json({
        expensesByCategory,
        totalExpenses: summary.totalExpenses
      });
    } catch (error) {
      console.error("Error fetching expense breakdown:", error);
      res.status(500).json({ message: "Failed to fetch expense breakdown" });
    }
  });

  // Automatic transaction reminders (Standard/Premium only)
  app.get('/api/transaction-reminders', async (req: any, res) => {
    try {
      
      // Check authentication first
      let userId: string | null = null;
      try {
        const auth = req.auth();
        userId = auth?.userId || null;
      } catch (authError) {
        console.error('Authentication error:', authError);
        return res.status(401).json({ message: "Authentication required" });
      }
      
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);

      if (!user || user.plan === 'free') {
        return res.status(403).json({ message: "Transaction reminders require Standard or Premium subscription" });
      }

      const requestedDays = req.query.days ? Number(req.query.days) : 7;
      const daysAhead = Number.isInteger(requestedDays) ? Math.min(Math.max(requestedDays, 1), 365) : 7;
      const reminders = await storage.getUpcomingTransactionReminders(userId, daysAhead);
      
      // Get user language and translate predefined category names
      const userLanguage = getUserLanguage(req);
      const translatedReminders = reminders.map(reminder => ({
        ...reminder,
        categoryName: translateCategoryName(reminder.categoryName, userLanguage)
      }));
      
      res.json(translatedReminders);
    } catch (error) {
      console.error("Error fetching transaction reminders:", error);
      res.status(500).json({ message: "Failed to fetch transaction reminders" });
    }
  });
}