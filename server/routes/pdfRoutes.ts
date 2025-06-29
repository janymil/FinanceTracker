import { Request, Response } from 'express';
import { isAuthenticated, getUserId } from '../clerkAuth';
import { storage } from '../storage';
import { transactions, categories, users } from '../../shared/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { translateCategoryName, getUserLanguage } from '../categoryTranslations';
import fetch from 'node-fetch';

const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL || 'https://finanzerpro-pdf.fly.dev';

export function registerPDFRoutes(app: any) {
  // Generate PDF report for trends data
  app.post('/api/generate-trends-pdf', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { period, currency = '$' } = req.body;
      const language = getUserLanguage(req);

      console.log('Generating PDF for user:', userId, 'Period:', period, 'Language:', language);

      // Get user information
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userData = {
        name: user.name || 'User',
        email: user.email || ''
      };

      // Parse period for date filtering
      const [year, month] = period.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      console.log('Collecting transaction data for period:', startDate, 'to', endDate);

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

      console.log('Financial totals:', { totalIncome, totalExpenses, netBalance });

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

      console.log('Trends data collected:', trendsData.length, 'months');

      // Get category breakdown
      const categoryBreakdown = [];
      const expenseTransactions = periodTransactions.filter((t: any) => t.type === 'expense');
      
      if (expenseTransactions.length > 0) {
        // Get categories with their transactions
        const categoryData = new Map();
        
        for (const transaction of expenseTransactions) {
          const categoryId = transaction.categoryId;
          if (!categoryData.has(categoryId)) {
            // Get category details
            const category = await storage.getCategory(categoryId);
            
            if (category) {
              categoryData.set(categoryId, {
                id: categoryId,
                name: translateCategoryName(category.name, language),
                color: category.color || '#3b82f6',
                amount: 0
              });
            }
          }
          
          if (categoryData.has(categoryId)) {
            categoryData.get(categoryId).amount += transaction.amount;
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

      console.log('Category breakdown:', categoryBreakdown.length, 'categories');

      // Prepare PDF data
      const webUrl = `${req.protocol}://${req.get('host')}/${language}/trends?period=${period}`;
      
      const pdfData = {
        user: userData,
        period: period,
        language: language,
        totalIncome: totalIncome,
        totalExpenses: totalExpenses,
        netBalance: netBalance,
        currency: currency,
        trends: trendsData,
        categories: categoryBreakdown,
        webUrl: webUrl
      };

      console.log('Calling PDF service at:', PDF_SERVICE_URL);

      // Call PDF service
      const pdfResponse = await fetch(`${PDF_SERVICE_URL}/generate-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data: pdfData }),
        timeout: 60000 // 60 second timeout
      });

      if (!pdfResponse.ok) {
        const errorText = await pdfResponse.text();
        console.error('PDF service error:', pdfResponse.status, errorText);
        return res.status(500).json({ 
          error: 'PDF generation failed',
          details: errorText
        });
      }

      console.log('PDF generated successfully');

      // Get PDF buffer
      const pdfBuffer = await pdfResponse.buffer();

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="financial-report-${period}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      // Send PDF
      res.send(pdfBuffer);

    } catch (error) {
      console.error('PDF generation error:', error);
      res.status(500).json({ 
        error: 'PDF generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}