import { log } from '../logger';
import { Request, Response } from 'express';
import { isAuthenticated, getUserId } from '../clerkAuth';
import { storage } from '../storage';
import { transactions, categories, users } from '../../shared/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { translateCategoryName, getUserLanguage } from '../categoryTranslations';
import { buildTrendsPayload, requestPdf, PdfProcessorError } from '../pdfProcessorClient';
import { checkPdf } from '@shared/invariants';
import { reportInvariant } from '../errorGuard/report.js';

export function registerPDFRoutes(app: any) {
  // Generate PDF report for trends data - Premium plan required
  app.post('/api/generate-trends-pdf', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Check user plan - PDF export requires premium plan
      const user = await storage.getUser(userId);
      if (!user || user.plan !== 'premium') {
        log.info(`PDF export blocked - User plan: ${user?.plan}`);
        return res.status(403).json({ 
          error: 'PDF export requires Premium subscription',
          plan: user?.plan || 'free'
        });
      }

      const { period, currency: requestedCurrency } = req.body;
      const language = getUserLanguage(req);

      log.info('Generating PDF for premium user:', userId, 'Period:', period, 'Language:', language);

      const userData = {
        name: user.firstName || 'User',
        email: user.email || ''
      };

      // Parse period for date filtering
      const [year, month] = period.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      log.info('Collecting transaction data for period:', startDate, 'to', endDate);

      // Get all transactions for the period
      const periodTransactions = await storage.getTransactionsByDateRange(userId, startDate, endDate);

      // Calculate totals
      const totalIncome = periodTransactions
        .filter((t: any) => t.type === 'income')
        .reduce((sum: number, t: any) => sum + t.amount, 0);

      const totalExpenses = periodTransactions
        .filter((t: any) => t.type === 'expense')
        .reduce((sum: number, t: any) => sum + t.amount, 0);

      const netBalance = totalIncome - totalExpenses;

      log.info('Financial totals:', { totalIncome, totalExpenses, netBalance });

      // Get trends data for the last 6 months
      const trendsData = [];
      for (let i = 5; i >= 0; i--) {
        const trendDate = new Date(year, month - 1 - i, 1);
        const trendEndDate = new Date(year, month - i, 0);
        
        const monthTransactions = await storage.getTransactionsByDateRange(userId, trendDate, trendEndDate);

        const monthIncome = monthTransactions
          .filter((t: any) => t.type === 'income')
          .reduce((sum: number, t: any) => sum + t.amount, 0);

        const monthExpenses = monthTransactions
          .filter((t: any) => t.type === 'expense')
          .reduce((sum: number, t: any) => sum + t.amount, 0);

        trendsData.push({
          period: trendDate.toISOString().slice(0, 7),
          income: monthIncome,
          expenses: monthExpenses,
          netBalance: monthIncome - monthExpenses
        });
      }

      log.info('Trends data collected:', trendsData.length, 'months');

      // Get category breakdown
      const categoryBreakdown = [];
      const categoryNameById = new Map<number, string>();
      const spentByCategory = new Map<number, number>();
      const expenseTransactions = periodTransactions.filter((t: any) => t.type === 'expense');
      
      if (expenseTransactions.length > 0) {
        // Get categories with their transactions
        const categoryData = new Map();
        
        for (const transaction of expenseTransactions) {
          const categoryId = transaction.categoryId;
          if (categoryId == null) continue;
          if (!categoryData.has(categoryId)) {
            // Get category details
            const category = await storage.getCategory(categoryId);
            
            if (category) {
              const localizedName = translateCategoryName(category.name, language);
              categoryNameById.set(categoryId, localizedName);
              categoryData.set(categoryId, {
                id: categoryId,
                name: localizedName,
                color: category.color || '#3b82f6',
                amount: 0
              });
            }
          }
          
          spentByCategory.set(
            categoryId,
            (spentByCategory.get(categoryId) || 0) + (Number(transaction.amount) || 0)
          );
          
          if (categoryData.has(categoryId)) {
            categoryData.get(categoryId).amount += Number(transaction.amount) || 0;
          }
        }

        // Convert to array and calculate percentages
        const sortedCategories = Array.from(categoryData.values())
          .filter(cat => cat.amount > 0)
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10); // Top 10 categories

        for (const category of sortedCategories) {
          categoryBreakdown.push({
            name: category.name,
            amount: category.amount,
            percentage: (category.amount / totalExpenses) * 100,
            color: category.color
          });
        }
      }

      log.info('Category breakdown:', categoryBreakdown.length, 'categories');

      // Budgets and goals add extra sections to the processor report.
      let budgets: any[] = [];
      let goals: any[] = [];
      try {
        budgets = await storage.getUserBudgets(userId);
        goals = await storage.getUserGoals(userId);
      } catch (error) {
        console.warn(
          '[PDF] Could not load budgets/goals for the report:',
          error instanceof Error ? error.message : String(error)
        );
      }

      const reportCurrency = requestedCurrency || user.currency || '$';
      log.info('[PDF] Generating report. Currency:', reportCurrency, '| period:', period);

      // Hand the report to the independent PDF processor. The payload matches
      // the processor's contract (see server/pdfProcessorClient.ts).
      const payload = buildTrendsPayload({
        userName: userData.name,
        email: userData.email,
        language,
        period,
        currency: reportCurrency,
        monthly: trendsData,
        categories: categoryBreakdown,
        transactions: periodTransactions.map((t: any) => ({
          date: t.date,
          description: t.description || 'Transaction',
          amount: t.amount,
          type: t.type,
          categoryName: t.categoryId != null ? categoryNameById.get(t.categoryId) : undefined,
        })),
        budgets: budgets.map((b: any) => ({
          categoryName: b.categoryId != null ? categoryNameById.get(b.categoryId) : undefined,
          amount: b.amount,
          spent: b.categoryId != null ? spentByCategory.get(b.categoryId) || 0 : 0,
        })),
        goals: goals.map((g: any) => ({
          name: g.name,
          targetAmount: g.targetAmount,
          currentAmount: g.currentAmount,
        })),
      });

      const pdfBuffer = await requestPdf(payload);

      log.info('PDF generated successfully:', pdfBuffer.length, 'bytes');

      // Export invariant (blueprint 07 §18): a PDF that is not a PDF, or is suspiciously
      // small, means the user downloads a broken file and nobody notices.
      for (const violation of checkPdf(pdfBuffer)) {
        reportInvariant(violation.code, {
          expected: violation.expected,
          actual: violation.actual,
          where: 'pdfRoutes.export',
        });
      }

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="financial-report-${period}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      // Send PDF
      return res.send(pdfBuffer);

    } catch (error) {
      console.error('PDF generation error:', error);
      if (error instanceof PdfProcessorError) {
        return res.status(error.statusCode).json({
          error: error.message,
          details: error.details
        });
      }
      res.status(500).json({ 
        error: 'PDF generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}