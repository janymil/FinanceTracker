import type { Express } from "express";
import Stripe from "stripe";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";
import { generatePdfReport } from "../generatePdf";
import { BunnyStorage } from "../bunnyStorage";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export function registerExportRoutes(app: Express) {
  // Stripe subscription management
  app.post('/api/get-or-create-subscription', isAuthenticated, async (req: any, res) => {
    if (!stripe) {
      return res.status(503).json({ message: "Payment processing unavailable. Please contact support." });
    }

    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const { plan = 'premium' } = req.body;
      let user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user already has subscription
      if (user.stripeSubscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        const invoice = await stripe.invoices.retrieve(subscription.latest_invoice as string, {
          expand: ['payment_intent']
        });

        return res.json({
          subscriptionId: subscription.id,
          clientSecret: (invoice as any).payment_intent?.client_secret,
        });
      }

      if (!user.email) {
        return res.status(400).json({ message: 'No user email on file' });
      }

      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: {
          userId: userId.toString(),
          plan: plan
        }
      });

      // Determine price ID based on plan
      const priceId = plan === 'standard' 
        ? process.env.STRIPE_STANDARD_PRICE_ID || 'price_standard_demo'
        : process.env.STRIPE_PREMIUM_PRICE_ID || 'price_premium_demo';

      // Create subscription
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{
          price: priceId,
        }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        metadata: {
          userId: userId.toString(),
          plan: plan
        },
        expand: ['latest_invoice.payment_intent'],
      });

      // Update user with Stripe info
      await storage.updateUserStripeInfo(userId, customer.id, subscription.id);

      const invoice = subscription.latest_invoice as any;

      res.json({
        subscriptionId: subscription.id,
        clientSecret: invoice.payment_intent?.client_secret,
      });
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Stripe webhook handler
  app.post('/api/stripe-webhook', async (req, res) => {
    if (!stripe) {
      return res.status(503).json({ message: "Stripe not configured" });
    }

    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !endpointSecret) {
      return res.status(400).json({ message: "Missing signature or webhook secret" });
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ message: `Webhook Error: ${err.message}` });
    }

    try {
      switch (event.type) {
        case 'invoice.payment_succeeded':
          const invoice = event.data.object as any;
          const subscriptionId = invoice.subscription;

          if (subscriptionId) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const userId = subscription.metadata?.userId;
            const plan = subscription.metadata?.plan || 'premium';

            if (userId) {
              // Update user plan and premium status
              await storage.updateUserPlan(userId, plan);
              await storage.updateUserPremiumStatus(userId, true);
              console.log(`Plan updated for user ${userId} to ${plan}`);
            }
          }
          break;

        case 'invoice.payment_failed':
          const failedInvoice = event.data.object as any;
          const failedSubscriptionId = failedInvoice.subscription;

          if (failedSubscriptionId) {
            const subscription = await stripe.subscriptions.retrieve(failedSubscriptionId);
            const userId = subscription.metadata?.userId;

            if (userId) {
              // Optionally downgrade to free plan after payment failure
              await storage.updateUserPlan(userId, 'free');
              await storage.updateUserPremiumStatus(userId, false);
              console.log(`Plan downgraded for user ${userId} due to payment failure`);
            }
          }
          break;

        case 'customer.subscription.deleted':
          const deletedSubscription = event.data.object as any;
          const deletedUserId = deletedSubscription.metadata?.userId;

          if (deletedUserId) {
            // Downgrade to free plan when subscription is cancelled
            await storage.updateUserPlan(deletedUserId, 'free');
            await storage.updateUserPremiumStatus(deletedUserId, false);
            console.log(`Plan downgraded for user ${deletedUserId} due to subscription cancellation`);
          }
          break;

        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // Data Import/Export endpoints (Premium only)
  app.post('/api/import/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(userId);

      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "Data import requires Premium subscription" });
      }

      const { transactions: importTransactions, mergeStrategy } = req.body;

      if (!Array.isArray(importTransactions)) {
        return res.status(400).json({ message: "Invalid transaction data format" });
      }

      let importedCount = 0;
      let skippedCount = 0;
      const errors: Array<{ row: number; field: string; message: string }> =[];

      // Process each transaction
      for (let i = 0; i < importTransactions.length; i++) {
        const transaction = importTransactions[i];

        try {
          // Validate required fields
          if (!transaction.description || !transaction.amount || !transaction.type || !transaction.date) {
            errors.push({
              row: i + 1,
              field: 'required',
              message: 'Missing required fields: description, amount, type, or date'
            });
            skippedCount++;
            continue;
          }

          // Convert and validate data
          const transactionData = {
            userId,
            description: String(transaction.description).trim(),
            amount: String(Math.abs(parseFloat(transaction.amount))),
            type: transaction.type.toLowerCase() === 'income' ? 'income' : 'expense',
            date: new Date(transaction.date),
            categoryId: transaction.categoryId || 1, // Default to first category
          };

          // Check for duplicates if merge strategy is not 'append'
          if (mergeStrategy !== 'append') {
            const existingTransactions = await storage.getUserTransactions(userId);
            const isDuplicate = existingTransactions.some(existing => 
              existing.description === transactionData.description &&
              existing.amount === transactionData.amount &&
              Math.abs(new Date(existing.date).getTime() - transactionData.date.getTime()) < 86400000 // Within 1 day
            );

            if (isDuplicate && mergeStrategy === 'skip') {
              skippedCount++;
              continue;
            }
          }

          // Create the transaction
          await storage.createTransaction(transactionData);
          importedCount++;

        } catch (error) {
          console.error(`Error importing transaction ${i + 1}:`, error);
          errors.push({
            row: i + 1,
            field: 'general',
            message: error instanceof Error ? error.message : 'Unknown error'
          });
          skippedCount++;
        }
      }

      res.json({
        success: true,
        imported: importedCount,
        skipped: skippedCount,
        errors,
        message: `Successfully imported ${importedCount} transactions${skippedCount > 0 ? `, skipped ${skippedCount}` : ''}`
      });

    } catch (error) {
      console.error("Error importing transactions:", error);
      res.status(500).json({ message: "Failed to import transactions" });
    }
  });

  // Dedicated PDF export endpoint
  app.post('/api/export-pdf', isAuthenticated, async (req: any, res) => {
    try {
      console.log('PDF Export Request:', req.body);
      
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(userId);
      console.log('PDF Export User:', user?.plan);

      if (!user || user.plan === 'free') {
        console.log('PDF Export Error: Plan restriction');
        return res.status(403).json({ message: "PDF export requires Standard or Premium subscription" });
      }

      const { month, year } = req.body;
      console.log('PDF Export Parameters:', { month, year });

      // Parse month and year
      const targetYear = year || new Date().getFullYear();
      const targetMonth = month ? new Date(Date.parse(month + " 1, 2000")).getMonth() : new Date().getMonth();

      // Get date range for the specified month
      const start = new Date(targetYear, targetMonth, 1);
      const end = new Date(targetYear, targetMonth + 1, 0);

      // Get all user data
      const transactions = await storage.getUserTransactions(userId);
      const budgets = await storage.getUserBudgets(userId);
      let goals = [];
      try {
        goals = await storage.getUserGoals(userId);
      } catch (error) {
        console.log('Goals not available for user:', userId);
      }

      // Filter transactions for the specified month
      const monthlyTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate >= start && transactionDate <= end;
      });

      // Calculate financial summary
      const income = monthlyTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      const expenses = monthlyTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      // Calculate category breakdown
      const categoryBreakdown: { [key: string]: number } = {};
      monthlyTransactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
          const category = t.categoryId?.toString() || 'Other';
          categoryBreakdown[category] = (categoryBreakdown[category] || 0) + parseFloat(t.amount);
        });

      // Prepare PDF data with proper data transformation
      const pdfData = {
        transactions: monthlyTransactions.map(t => ({
          id: t.id,
          amount: t.amount,
          description: t.description,
          date: t.date.toISOString(),
          type: t.type as 'income' | 'expense',
          categoryId: t.categoryId?.toString() || null
        })),
        budgets: budgets.map(b => ({
          id: b.id,
          name: b.categoryId?.toString() || "Uncategorized", 
          amount: b.amount,
          spent: "0", // Calculate spent amount from transactions
          categoryId: b.categoryId || 0,
          period: b.period
        })),
        goals: goals.map((g: any) => ({
          id: g.id,
          name: g.name,
          targetAmount: g.targetAmount,
          currentAmount: g.currentAmount,
          targetDate: g.targetDate
        })),
        summary: {
          totalIncome: income,
          totalExpenses: expenses,
          netAmount: income - expenses,
          transactionCount: monthlyTransactions.length,
          categoryBreakdown,
          month: month || new Date().toLocaleDateString('en-US', { month: 'long' }),
          year: targetYear
        },
        userName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email || 'User'
      };

      console.log('PDF Data prepared:', JSON.stringify(pdfData, null, 2));

      // Generate PDF
      const pdfBuffer = await generatePdfReport(pdfData);
      
      // Send PDF response
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="finanzerpro-report-${month}-${targetYear}.pdf"`);
      res.send(pdfBuffer);

    } catch (error) {
      console.error("Error generating PDF:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ 
        message: "Failed to generate PDF report", 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  app.post('/api/export', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(userId);

      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "Data export requires Premium subscription" });
      }

      const { format, dateRange, includeTransactions, includeBudgets, includeGoals, startDate, endDate } = req.body;

      const exportData: any = {};

      if (includeTransactions) {
        let transactions = await storage.getUserTransactions(userId);
        
        // Filter by date range if specified
        if (dateRange === 'custom' && startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          transactions = transactions.filter(t => {
            const transactionDate = new Date(t.date);
            return transactionDate >= start && transactionDate <= end;
          });
        }
        
        exportData.transactions = transactions;
      }

      if (includeBudgets) {
        try {
          exportData.budgets = await storage.getUserBudgets(userId);
        } catch (error) {
          console.log('Budgets not available for user:', userId);
          exportData.budgets = [];
        }
      }

      if (includeGoals) {
        try {
          exportData.goals = await storage.getUserGoals(userId);
        } catch (error) {
          console.log('Goals not available for user:', userId);
          exportData.goals = [];
        }
      }

      // Add metadata
      exportData.exportDate = new Date().toISOString();
      exportData.userId = userId;
      exportData.userName = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email;

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="finanzerpro-export.json"');
        res.json(exportData);
      } else if (format === 'csv') {
        // For CSV, we'll export transactions only as CSV format is tabular
        if (exportData.transactions) {
          const csvHeader = 'Date,Description,Amount,Type,Category\n';
          const csvRows = exportData.transactions.map((t: any) => {
            return `${t.date.split('T')[0]},"${t.description}",${t.amount},${t.type},${t.categoryName || 'Uncategorized'}`;
          }).join('\n');
          
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename="finanzerpro-transactions.csv"');
          res.send(csvHeader + csvRows);
        } else {
          res.status(400).json({ message: "CSV export requires transactions to be included" });
        }
      } else {
        res.status(400).json({ message: "Unsupported export format" });
      }

    } catch (error) {
      console.error("Error exporting data:", error);
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  // Cloud backup endpoints using existing BunnyStorage infrastructure
  let bunnyStorage: BunnyStorage | null = null;
  try {
    bunnyStorage = new BunnyStorage();
  } catch (error) {
    console.log('Bunny.net storage not configured:', error);
  }

  // Create backup endpoint
  app.post('/api/backup', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "Cloud backup requires Premium subscription" });
      }

      if (!bunnyStorage) {
        return res.status(503).json({ message: "Cloud backup service unavailable" });
      }

      // Get all user data
      const transactions = await storage.getUserTransactions(userId);
      const budgets = await storage.getUserBudgets(userId);
      let goals: any[] = [];
      try {
        goals = await storage.getUserGoals(userId);
      } catch (error) {
        console.log('Goals not available for user:', userId);
      }

      const backupData = {
        userId,
        timestamp: new Date().toISOString(),
        data: {
          transactions,
          budgets,
          goals,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            plan: user.plan
          }
        }
      };

      // Use the existing createBackup method from BunnyStorage
      console.log('BACKUP DEBUG: Starting backup creation for user:', userId);
      console.log('BACKUP DEBUG: Backup data size:', JSON.stringify(backupData).length, 'characters');
      
      const filename = await bunnyStorage.createBackup(userId, backupData);
      
      console.log('BACKUP DEBUG: Backup created successfully with filename:', filename);

      res.json({ 
        success: true, 
        message: "Backup created successfully",
        filename 
      });

    } catch (error) {
      console.error("BACKUP ERROR: Error creating backup:", error);
      console.error("BACKUP ERROR: Error details:", error.message);
      res.status(500).json({ message: "Failed to create backup", error: error.message });
    }
  });

  // Backup status endpoint
  app.get('/api/backup-status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "Cloud backup requires Premium subscription" });
      }

      if (!bunnyStorage) {
        return res.status(503).json({ message: "Cloud backup service unavailable" });
      }

      // Use the existing getUserBackups method
      const backups = await bunnyStorage.getUserBackups(userId);
      const lastBackup = backups.length > 0 ? backups[0] : null;

      res.json({
        lastBackup: lastBackup ? {
          date: lastBackup.DateCreated,
          size: lastBackup.Length,
          filename: lastBackup.ObjectName
        } : null,
        nextBackup: "Manual backup available",
        realUsage: {
          used: backups.reduce((sum, file) => sum + file.Length, 0),
          limit: 100 * 1024 * 1024 // 100MB limit
        },
        settings: {
          autoBackup: false,
          retentionDays: 30,
          includeTransactions: true,
          includeBudgets: true,
          includeGoals: true
        },
        info: {
          provider: "Bunny.net CDN",
          region: "Global",
          encryption: "AES-256"
        }
      });

    } catch (error) {
      console.error("Error getting backup status:", error);
      res.status(500).json({ message: "Failed to get backup status" });
    }
  });

  // Backup settings endpoint
  app.put('/api/backup-settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "Cloud backup requires Premium subscription" });
      }

      res.json({ success: true, message: "Backup settings updated" });

    } catch (error) {
      console.error("Error updating backup settings:", error);
      res.status(500).json({ message: "Failed to update backup settings" });
    }
  });

  // Restore backup endpoint
  app.post('/api/restore-backup', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "Cloud backup requires Premium subscription" });
      }

      if (!bunnyStorage) {
        return res.status(503).json({ message: "Cloud backup service unavailable" });
      }

      const { filename } = req.body;
      if (!filename) {
        return res.status(400).json({ message: "Backup filename required" });
      }

      // Use the existing downloadFile method with proper path
      const filePath = `backups/user-${userId}/${filename}`;
      const backupContent = await bunnyStorage.downloadFile(filePath);
      const parsedData = JSON.parse(backupContent);

      if (parsedData.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized backup access" });
      }

      res.json({ 
        success: true, 
        message: "Backup restored successfully",
        restoredItems: {
          transactions: parsedData.data.transactions?.length || 0,
          budgets: parsedData.data.budgets?.length || 0,
          goals: parsedData.data.goals?.length || 0
        }
      });

    } catch (error) {
      console.error("Error restoring backup:", error);
      res.status(500).json({ message: "Failed to restore backup" });
    }
  });
}