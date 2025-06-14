import type { Express } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { insertTransactionSchema, insertBudgetSchema, insertExpenseReminderSchema } from "@shared/schema";
import { z } from "zod";
import { categorizeExpense, generateFinancialTips, generateSpendingInsights, generateTrendPredictions } from "./openai";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  setupAuth(app);

  // Transaction routes
  app.post('/api/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      // Check if recurring transactions are being used and require appropriate plan
      if (req.body.isRecurring && user?.plan === 'free') {
        return res.status(403).json({ 
          message: "Recurring transactions require Standard or Premium subscription" 
        });
      }

      const validatedData = insertTransactionSchema.parse({
        ...req.body,
        userId,
        categoryId: req.body.categoryId ? parseInt(req.body.categoryId) : null,
        amount: req.body.amount.toString(),
        date: new Date(req.body.date),
        recurringEndDate: req.body.recurringEndDate ? new Date(req.body.recurringEndDate) : null,
      });

      const transaction = await storage.createTransaction(validatedData);
      res.json(transaction);
    } catch (error) {
      console.error("Error creating transaction:", error);
      res.status(400).json({ message: "Failed to create transaction" });
    }
  });

  app.get('/api/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      // Plan-based limits: free = 3, standard = 100, premium = unlimited
      let limit;
      if (user?.plan === 'free') {
        limit = 3;
      } else if (user?.plan === 'standard') {
        limit = 100;
      } else {
        limit = undefined; // unlimited for premium
      }
      
      const transactions = await storage.getUserTransactions(userId, limit);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.put('/api/transactions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.plan === 'free') {
        return res.status(403).json({ message: "Standard or Premium subscription required" });
      }

      const transactionId = parseInt(req.params.id);
      const validatedData = insertTransactionSchema.parse({
        ...req.body,
        userId,
        categoryId: req.body.categoryId ? parseInt(req.body.categoryId) : null,
        amount: req.body.amount.toString(),
        date: new Date(req.body.date),
        recurringEndDate: req.body.recurringEndDate ? new Date(req.body.recurringEndDate) : null,
      });

      const transaction = await storage.updateTransaction(transactionId, validatedData);
      res.json(transaction);
    } catch (error) {
      console.error("Error updating transaction:", error);
      res.status(400).json({ message: "Failed to update transaction" });
    }
  });

  app.delete('/api/transactions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.plan === 'free') {
        return res.status(403).json({ message: "Standard or Premium subscription required" });
      }

      const transactionId = parseInt(req.params.id);
      await storage.deleteTransaction(transactionId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting transaction:", error);
      res.status(500).json({ message: "Failed to delete transaction" });
    }
  });

  // Budget routes
  app.post('/api/budgets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.plan === 'free') {
        return res.status(403).json({ message: "Standard or Premium subscription required" });
      }

      const validatedData = insertBudgetSchema.parse({
        ...req.body,
        userId,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
      });

      const budget = await storage.createBudget(validatedData);
      res.json(budget);
    } catch (error) {
      console.error("Error creating budget:", error);
      res.status(400).json({ message: "Failed to create budget" });
    }
  });

  app.get('/api/budgets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.plan === 'free') {
        return res.status(403).json({ message: "Standard or Premium subscription required" });
      }

      const budgets = await storage.getUserBudgets(userId);
      res.json(budgets);
    } catch (error) {
      console.error("Error fetching budgets:", error);
      res.status(500).json({ message: "Failed to fetch budgets" });
    }
  });

  // Categories
  app.get('/api/categories', isAuthenticated, async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post('/api/categories', isAuthenticated, async (req: any, res) => {
    try {
      const { name, icon, color, type } = req.body;
      
      if (!name || !icon || !color || !type) {
        return res.status(400).json({ message: "Name, icon, color, and type are required" });
      }

      if (!['income', 'expense'].includes(type)) {
        return res.status(400).json({ message: "Type must be 'income' or 'expense'" });
      }

      const category = await storage.createCategory({ name, icon, color, type });
      res.json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(400).json({ message: "Failed to create category" });
    }
  });

  // Financial summary
  app.get('/api/financial-summary', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start date and end date are required" });
      }

      const summary = await storage.getUserFinancialSummary(
        userId,
        new Date(startDate as string),
        new Date(endDate as string)
      );
      
      res.json(summary);
    } catch (error) {
      console.error("Error fetching financial summary:", error);
      res.status(500).json({ message: "Failed to fetch financial summary" });
    }
  });

  // Update user plan
  app.post('/api/update-plan', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { plan } = req.body;

      if (!plan || !['free', 'standard', 'premium'].includes(plan)) {
        return res.status(400).json({ message: "Invalid plan. Must be 'free', 'standard', or 'premium'" });
      }

      await storage.updateUserPlan(userId, plan);
      
      res.json({ success: true, message: `Plan updated to ${plan}` });
    } catch (error) {
      console.error("Error updating plan:", error);
      res.status(500).json({ message: "Failed to update plan" });
    }
  });

  // Stripe subscription management
  app.post('/api/get-or-create-subscription', isAuthenticated, async (req: any, res) => {
    if (!stripe) {
      return res.status(503).json({ message: "Payment processing unavailable. Please contact support." });
    }

    try {
      const userId = req.user.id;
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
              await storage.updateUserPlan(parseInt(userId), plan);
              await storage.updateUserPremiumStatus(parseInt(userId), true);
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
              await storage.updateUserPlan(parseInt(userId), 'free');
              await storage.updateUserPremiumStatus(parseInt(userId), false);
              console.log(`Plan downgraded for user ${userId} due to payment failure`);
            }
          }
          break;

        case 'customer.subscription.deleted':
          const deletedSubscription = event.data.object as any;
          const deletedUserId = deletedSubscription.metadata?.userId;
          
          if (deletedUserId) {
            // Downgrade to free plan when subscription is cancelled
            await storage.updateUserPlan(parseInt(deletedUserId), 'free');
            await storage.updateUserPremiumStatus(parseInt(deletedUserId), false);
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

  // Initialize default categories if none exist
  app.post('/api/init-categories', isAuthenticated, async (req, res) => {
    try {
      const existingCategories = await storage.getCategories();
      
      if (existingCategories.length === 0) {
        // Initialize default categories
        const defaultCategories = [
          { name: 'Food', icon: 'utensils', color: '#3B82F6', type: 'expense' },
          { name: 'Entertainment', icon: 'film', color: '#F59E0B', type: 'expense' },
          { name: 'Housing', icon: 'home', color: '#10B981', type: 'expense' },
          { name: 'Transportation', icon: 'car', color: '#EF4444', type: 'expense' },
          { name: 'Healthcare', icon: 'heart', color: '#8B5CF6', type: 'expense' },
          { name: 'Shopping', icon: 'shopping-bag', color: '#F97316', type: 'expense' },
          { name: 'Salary', icon: 'dollar-sign', color: '#10B981', type: 'income' },
          { name: 'Freelance', icon: 'laptop', color: '#3B82F6', type: 'income' },
          { name: 'Investments', icon: 'trending-up', color: '#8B5CF6', type: 'income' },
        ];

        // Insert categories into database (this would need to be implemented in storage)
        // For now, return mock data
        res.json(defaultCategories);
      } else {
        res.json(existingCategories);
      }
    } catch (error) {
      console.error("Error initializing categories:", error);
      res.status(500).json({ message: "Failed to initialize categories" });
    }
  });

  // Auto-categorization endpoint for bulk processing
  app.post('/api/auto-categorize', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      
      // Require premium plan for auto-categorization
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "Auto-categorization requires premium plan" });
      }

      // Get uncategorized transactions
      const transactions = await storage.getUserTransactions(req.user.id);
      const uncategorized = transactions.filter(t => !t.categoryId);

      if (uncategorized.length === 0) {
        return res.json({ suggestions: [] });
      }

      // Process up to 10 transactions at a time to avoid rate limits
      const suggestions = [];
      const limit = Math.min(uncategorized.length, 10);

      for (let i = 0; i < limit; i++) {
        const transaction = uncategorized[i];
        try {
          const result = await categorizeExpense(transaction.description, parseFloat(transaction.amount));
          suggestions.push({
            id: `suggestion-${transaction.id}`,
            transactionDescription: transaction.description,
            suggestedCategory: result.category,
            confidence: result.confidence,
            amount: parseFloat(transaction.amount),
            date: transaction.date.toISOString(),
            transactionId: transaction.id
          });
        } catch (error) {
          console.error(`Failed to categorize transaction ${transaction.id}:`, error);
        }
      }

      res.json({ suggestions });
    } catch (error) {
      console.error("Error in auto-categorization:", error);
      res.status(500).json({ message: "Failed to auto-categorize transactions" });
    }
  });

  // AI Categorization endpoint
  app.post('/api/ai/categorize', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      
      // Require standard+ plan for AI categorization
      if (!user || !['standard', 'premium'].includes(user.plan || '')) {
        return res.status(403).json({ message: "AI categorization requires standard or premium plan" });
      }

      const { description, amount } = req.body;
      
      if (!description) {
        return res.status(400).json({ message: "Description is required" });
      }

      const result = await categorizeExpense(description, amount || 0);
      res.json({ category: result.category });
    } catch (error) {
      console.error("Error categorizing expense:", error);
      res.status(500).json({ message: "Failed to categorize expense" });
    }
  });

  // AI Financial Tips endpoint
  app.post('/api/ai/tip', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      
      // Require premium plan for AI tips
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "AI financial tips require premium plan" });
      }

      const { month, total, categories } = req.body;
      
      if (!month || !total || !categories) {
        return res.status(400).json({ message: "Month, total, and categories are required" });
      }

      // Get user's actual financial data for better tips
      const startDate = new Date();
      startDate.setDate(1); // First day of current month
      const endDate = new Date();
      
      const financialSummary = await storage.getUserFinancialSummary(req.user.id, startDate, endDate);
      const transactions = await storage.getUserTransactions(req.user.id, 50);
      
      const financialData = {
        totalIncome: financialSummary.totalIncome,
        totalExpenses: financialSummary.totalExpenses,
        transactionsByCategory: financialSummary.transactionsByCategory,
        recentTransactions: transactions.map(t => ({
          description: t.description,
          amount: parseFloat(t.amount),
          date: t.date.toISOString(),
          categoryName: t.categoryId?.toString() || 'Uncategorized'
        }))
      };

      const tips = await generateFinancialTips(financialData);
      const tip = tips.length > 0 ? tips[0] : null;
      
      if (tip) {
        res.json({ tip: `${tip.title}: ${tip.description}` });
      } else {
        res.json({ tip: "Continue tracking your expenses to get personalized financial insights." });
      }
    } catch (error) {
      console.error("Error generating financial tip:", error);
      res.status(500).json({ message: "Failed to generate financial tip" });
    }
  });

  // AI Spending Insights endpoint
  app.get('/api/ai/insights', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      
      // Require premium plan for AI insights
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "AI spending insights require premium plan" });
      }

      const transactions = await storage.getUserTransactions(req.user.id, 100);
      
      const insights = await generateSpendingInsights(transactions.map(t => ({
        description: t.description,
        amount: parseFloat(t.amount),
        date: t.date.toISOString(),
        categoryName: t.categoryId?.toString() || 'Uncategorized',
        type: t.type
      })));

      res.json(insights);
    } catch (error) {
      console.error("Error generating spending insights:", error);
      res.status(500).json({ message: "Failed to generate spending insights" });
    }
  });

  // AI Trend Predictions (Premium only)
  app.get('/api/trend-predictions', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "AI trend predictions require Premium subscription" });
      }

      const transactions = await storage.getUserTransactions(req.user.id, 200);
      const categories = await storage.getCategories();
      const budgets = await storage.getUserBudgets(req.user.id);
      
      const categoryMap = new Map();
      categories.forEach(cat => {
        categoryMap.set(cat.id, cat.name);
      });

      const predictions = await generateTrendPredictions(
        transactions.map(t => ({
          id: t.id,
          amount: t.amount,
          description: t.description,
          date: t.date.toISOString(),
          type: t.type,
          categoryId: t.categoryId || 1 // Default to first category if null
        })),
        categoryMap,
        budgets.map(b => ({
          categoryId: b.categoryId,
          amount: b.amount
        }))
      );

      res.json(predictions);
    } catch (error) {
      console.error("Error generating trend predictions:", error);
      res.status(500).json({ message: "Failed to generate trend predictions" });
    }
  });

  // Automatic transaction reminders (Standard/Premium only)
  app.get('/api/transaction-reminders', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      
      if (!user || user.plan === 'free') {
        return res.status(403).json({ message: "Transaction reminders require Standard or Premium subscription" });
      }

      const daysAhead = req.query.days ? parseInt(req.query.days as string) : 7;
      const reminders = await storage.getUpcomingTransactionReminders(req.user.id, daysAhead);
      res.json(reminders);
    } catch (error) {
      console.error("Error fetching transaction reminders:", error);
      res.status(500).json({ message: "Failed to fetch transaction reminders" });
    }
  });

  // Expense Reminders API (Standard/Premium only) - Smart Bill Assistant feature
  app.post('/api/expense-reminders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user || user.plan === 'free') {
        return res.status(403).json({ message: "Expense reminders require Standard or Premium subscription" });
      }

      const validatedData = insertExpenseReminderSchema.parse({
        ...req.body,
        userId,
        categoryId: req.body.categoryId ? parseInt(req.body.categoryId) : null,
        amount: req.body.amount ? req.body.amount.toString() : null,
        dueDate: new Date(req.body.dueDate),
        recurringEndDate: req.body.recurringEndDate ? new Date(req.body.recurringEndDate) : null,
      });

      const reminder = await storage.createExpenseReminder(validatedData);
      res.json(reminder);
    } catch (error) {
      console.error("Error creating expense reminder:", error);
      res.status(400).json({ message: "Failed to create expense reminder" });
    }
  });

  app.get('/api/expense-reminders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user || user.plan === 'free') {
        return res.status(403).json({ message: "Expense reminders require Standard or Premium subscription" });
      }

      const reminders = await storage.getUserExpenseReminders(userId);
      res.json(reminders);
    } catch (error) {
      console.error("Error fetching expense reminders:", error);
      res.status(500).json({ message: "Failed to fetch expense reminders" });
    }
  });

  app.get('/api/expense-reminders/upcoming', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user || user.plan === 'free') {
        return res.status(403).json({ message: "Expense reminders require Standard or Premium subscription" });
      }

      const daysBefore = req.query.days ? parseInt(req.query.days as string) : 7;
      const reminders = await storage.getUpcomingExpenseReminders(userId, daysBefore);
      res.json(reminders);
    } catch (error) {
      console.error("Error fetching upcoming expense reminders:", error);
      res.status(500).json({ message: "Failed to fetch upcoming expense reminders" });
    }
  });

  app.put('/api/expense-reminders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user || user.plan === 'free') {
        return res.status(403).json({ message: "Expense reminders require Standard or Premium subscription" });
      }

      const id = parseInt(req.params.id);
      const updateData = {
        ...req.body,
        categoryId: req.body.categoryId ? parseInt(req.body.categoryId) : null,
        amount: req.body.amount ? req.body.amount.toString() : null,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
        recurringEndDate: req.body.recurringEndDate ? new Date(req.body.recurringEndDate) : undefined,
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => 
        updateData[key] === undefined && delete updateData[key]
      );

      const reminder = await storage.updateExpenseReminder(id, updateData);
      res.json(reminder);
    } catch (error) {
      console.error("Error updating expense reminder:", error);
      res.status(400).json({ message: "Failed to update expense reminder" });
    }
  });

  app.delete('/api/expense-reminders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user || user.plan === 'free') {
        return res.status(403).json({ message: "Expense reminders require Standard or Premium subscription" });
      }

      const id = parseInt(req.params.id);
      await storage.deleteExpenseReminder(id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting expense reminder:", error);
      res.status(500).json({ message: "Failed to delete expense reminder" });
    }
  });

  app.post('/api/expense-reminders/:id/complete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user || user.plan === 'free') {
        return res.status(403).json({ message: "Expense reminders require Standard or Premium subscription" });
      }

      const id = parseInt(req.params.id);
      await storage.markExpenseReminderCompleted(id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error completing expense reminder:", error);
      res.status(500).json({ message: "Failed to complete expense reminder" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
