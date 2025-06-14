import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import { storage } from "./storage";
import { users, transactions, budgets, categories, goals, type Transaction, type Budget, type Goal } from "@shared/schema";
import { setupAuth, isAuthenticated } from "./auth";
import { setCookieConsent } from "./cookieMiddleware";
import { insertTransactionSchema, insertBudgetSchema, insertGoalSchema, insertExpenseReminderSchema } from "@shared/schema";
import { z } from "zod";
import { 
  generateFinancialTips, 
  categorizeExpense, 
  generateSpendingInsights, 
  generateTrendPredictions,
  type ExpenseCategorizationResult 
} from "./openai";
import { aiCache } from "./cache";
import { batchProcessor } from "./batch-processor";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe',
  '#00c49f', '#ffbb28', '#ff8042', '#8dd1e1', '#d084d0'
];

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
                const categories = await storage.getCategories();
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

      // Transform and validate the data
      const { categoryId, amount, startDate, endDate, period } = req.body;

      const budgetData = {
        userId,
        categoryId: parseInt(categoryId), // Convert string to number
        amount: String(amount), // Convert number to string for decimal storage
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        period: String(period || 'monthly') // Ensure period is provided
      };

      const budget = await storage.createBudget(budgetData);
      res.json(budget);
    } catch (error) {
      console.error("Error creating budget:", error);
      res.status(400).json({ message: "Failed to create budget" });
    }
  });

  app.put('/api/budgets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (user?.plan === 'free') {
        return res.status(403).json({ message: "Standard or Premium subscription required" });
      }

      const id = parseInt(req.params.id);
      const { categoryId, amount, startDate, endDate, period } = req.body;

      const updateData: any = {};
      if (categoryId !== undefined) updateData.categoryId = parseInt(categoryId);
      if (amount !== undefined) updateData.amount = String(amount);
      if (startDate !== undefined) updateData.startDate = new Date(startDate);
      if (endDate !== undefined) updateData.endDate = new Date(endDate);
      if (period !== undefined) updateData.period = String(period);

      const budget = await storage.updateBudget(id, updateData);
      res.json(budget);
    } catch (error) {
      console.error("Error updating budget:", error);
      res.status(400).json({ message: "Failed to update budget" });
    }
  });

  app.delete('/api/budgets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (user?.plan === 'free') {
        return res.status(403).json({ message: "Standard or Premium subscription required" });
      }

      const id = parseInt(req.params.id);
      await storage.deleteBudget(id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting budget:", error);
      res.status(500).json({ message: "Failed to delete budget" });
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

  // Goals routes
  app.get('/api/goals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (user?.plan === 'free') {
        return res.status(403).json({ message: "Standard or Premium subscription required" });
      }

      const goals = await storage.getUserGoals(userId);
      res.json(goals);
    } catch (error) {
      console.error("Error fetching goals:", error);
      res.status(500).json({ message: "Failed to fetch goals" });
    }
  });

  app.post('/api/goals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (user?.plan === 'free') {
        return res.status(403).json({ message: "Standard or Premium subscription required" });
      }

      // Transform and validate the data
      const { name, targetAmount, targetDate, category, description } = req.body;

      const goalData = {
        userId,
        name: String(name),
        targetAmount: String(targetAmount), // Convert number to string for decimal storage
        targetDate: new Date(targetDate), // Convert string to Date
        category: String(category),
        description: description ? String(description) : null,
        currentAmount: "0.00",
        status: "active"
      };

      const goal = await storage.createGoal(goalData);
      res.json(goal);
    } catch (error) {
      console.error("Error creating goal:", error);
      res.status(400).json({ message: "Failed to create goal" });
    }
  });

  app.put('/api/goals/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (user?.plan === 'free') {
        return res.status(403).json({ message: "Standard or Premium subscription required" });
      }

      const id = parseInt(req.params.id);
      const { name, targetAmount, targetDate, category, description, currentAmount } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = String(name);
      if (targetAmount !== undefined) updateData.targetAmount = String(targetAmount);
      if (targetDate !== undefined) updateData.targetDate = new Date(targetDate);
      if (category !== undefined) updateData.category = String(category);
      if (description !== undefined) updateData.description = description ? String(description) : null;
      if (currentAmount !== undefined) updateData.currentAmount = String(currentAmount);

      const goal = await storage.updateGoal(id, updateData);
      res.json(goal);
    } catch (error) {
      console.error("Error updating goal:", error);
      res.status(400).json({ message: "Failed to update goal" });
    }
  });

  app.delete('/api/goals/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (user?.plan === 'free') {
        return res.status(403).json({ message: "Standard or Premium subscription required" });
      }

      const id = parseInt(req.params.id);
      await storage.deleteGoal(id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting goal:", error);
      res.status(500).json({ message: "Failed to delete goal" });
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

  // Expense breakdown for current month
  app.get('/api/expense-breakdown', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Get current month date range
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const summary = await storage.getUserFinancialSummary(userId, startDate, endDate);
      
      // Filter for expense categories only and format for chart
      const expensesByCategory = summary.transactionsByCategory
        .filter((cat: any) => cat.type === 'expense')
        .map((cat: any, index: number) => ({
          category: cat.categoryName,
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

  // AI Financial Tips endpoint - bypasses cache for fresh responses
  app.post('/api/ai/tip', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);

      // Require premium plan for AI tips
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "AI financial tips require premium plan" });
      }

      // Get user's complete financial data for analysis
      const currentDate = new Date();
      const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
      
      const financialSummary = await storage.getUserFinancialSummary(req.user.id, startOfYear, currentDate);
      const transactions = await storage.getUserTransactions(req.user.id, 100);
      const categories = await storage.getCategories();

      // Create category name mapping
      const categoryMap = new Map();
      categories.forEach(cat => categoryMap.set(cat.id, cat.name));

      // Prepare comprehensive financial data
      const financialData = {
        totalIncome: financialSummary.totalIncome,
        totalExpenses: financialSummary.totalExpenses,
        transactionsByCategory: financialSummary.transactionsByCategory,
        recentTransactions: transactions.map(t => ({
          description: t.description,
          amount: parseFloat(t.amount),
          date: t.date.toISOString(),
          categoryName: categoryMap.get(t.categoryId) || 'Uncategorized',
          type: t.type
        })),
        // Add timestamp to force fresh AI response
        timestamp: Date.now()
      };

      console.log(`Generating fresh AI tip for user ${req.user.id} with ${transactions.length} transactions`);
      
      const tips = await generateFinancialTips(financialData);
      const tip = tips.length > 0 ? tips[0] : null;

      if (tip) {
        res.json({ tip: `${tip.title}: ${tip.description}` });
      } else {
        // Provide specific fallback based on actual data
        if (transactions.length === 0) {
          res.json({ tip: "Start by adding some transactions to get personalized financial insights." });
        } else {
          const expenseCount = transactions.filter(t => t.type === 'expense').length;
          const incomeCount = transactions.filter(t => t.type === 'income').length;
          res.json({ 
            tip: `Based on your ${expenseCount} expense transactions ($${financialSummary.totalExpenses.toFixed(2)}) and ${incomeCount} income transactions ($${financialSummary.totalIncome.toFixed(2)}), consider setting up budgets for your top spending categories to better manage your finances.` 
          });
        }
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

  // AI Financial Health Score
  app.post('/api/ai/financial-health-score', isAuthenticated, async (req: any, res) => {
    try {
      const { summary, budgets, useAdvancedFactors } = req.body;

      const transactions = await storage.getUserTransactions(req.user.id, 100);

      const aiScore = await generateAIFinancialHealthScore({
        summary,
        budgets,
        transactions: transactions.map(t => ({
          description: t.description,
          amount: parseFloat(t.amount),
          date: t.date.toISOString(),
          categoryName: t.categoryId?.toString() || 'Uncategorized',
          type: t.type
        })),
        useAdvancedFactors
      });

      res.json(aiScore);
    } catch (error) {
      console.error("Error generating AI financial health score:", error);
      res.status(500).json({ message: "Failed to generate AI financial health score" });
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

  // Data Import/Export endpoints (Premium only)
  app.post('/api/import/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
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

  app.post('/api/export', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "Data export requires Premium subscription" });
      }

      const { format, dateRange, includeTransactions, includeBudgets, includeGoals, startDate, endDate } = req.body;

      const exportData: any = {};

      // Get date range
      let start: Date, end: Date;
      const now = new Date();

      switch (dateRange) {
        case 'month':
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'quarter':
          const quarter = Math.floor(now.getMonth() / 3);
          start = new Date(now.getFullYear(), quarter * 3, 1);
          end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
          break;
        case 'year':
          start = new Date(now.getFullYear(), 0, 1);
          end = new Date(now.getFullYear(), 11, 31);
          break;
        case 'custom':
          start = startDate ? new Date(startDate) : new Date(now.getFullYear(), 0, 1);
          end = endDate ? new Date(endDate) : now;
          break;
        default:
          start = new Date(2020, 0, 1); // All time
          end = now;
      }

      // Fetch data based on what's included
      if (includeTransactions) {
        const transactions = await storage.getUserTransactions(userId);
        exportData.transactions = transactions.filter(t => {
          const transactionDate = new Date(t.date);
          return transactionDate >= start && transactionDate <= end;
        });
      }

      if (includeBudgets) {
        exportData.budgets = await storage.getUserBudgets(userId);
      }

      if (includeGoals) {
        // Note: Goals endpoint doesn't exist in storage, would need to implement
        exportData.goals = [];
      }

      // Add metadata
      exportData.exportInfo = {
        exportDate: new Date().toISOString(),
        userId: userId,
        dateRange: { start: start.toISOString(), end: end.toISOString() },
        format
      };

      // Format the response based on requested format
      let responseData: any;
      let filename: string;
      let contentType: string;

      switch (format) {
        case 'json':
          responseData = exportData;
          filename = `financial-data-${new Date().toISOString().split('T')[0]}.json`;
          contentType = 'application/json';
          break;
        case 'csv':
          if (exportData.transactions) {
            const csvHeader = 'Date,Description,Amount,Type,Category\n';
            const csvRows = exportData.transactions.map((t: any) => 
              `${t.date},${t.description},${t.amount},${t.type},${t.categoryId}`
            ).join('\n');
            responseData = csvHeader + csvRows;
          } else {
            responseData = 'No transaction data to export';
          }
          filename = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
          contentType = 'text/csv';
          break;
        default:
          responseData = exportData;
          filename = `financial-data-${new Date().toISOString().split('T')[0]}.json`;
          contentType = 'application/json';
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(responseData);

    } catch (error) {
      console.error("Error exporting data:", error);
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  app.post('/api/backup', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "Cloud backup requires Premium subscription" });
      }

      // Ensure backup settings exist before backup
      let settings = await storage.getUserBackupSettings(userId);
      if (!settings) {
        settings = await storage.createBackupSettings({
          userId,
          autoBackup: true,
          frequency: 'daily',
          retentionDays: 7,
          includeAttachments: true,
          encryptBackups: true,
          status: 'active',
          totalBackups: 0,
          totalSize: '0 B',
          lastBackupDate: null,
          nextBackupDate: null
        });
      }

      const { backupScheduler } = await import('./backupScheduler');

      // Trigger manual backup
      await backupScheduler.triggerManualBackup(userId);

      // Get updated backup info
      const { bunnyStorage } = await import('./bunnyStorage');
      const backupInfo = await bunnyStorage.getBackupInfo(userId);

      res.json({
        success: true,
        message: "Data backed up successfully to Bunny.net cloud storage",
        totalBackups: backupInfo.totalBackups,
        totalSize: backupInfo.totalSize,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error("Error creating backup:", error);
      res.status(500).json({ message: "Failed to create backup: " + (error instanceof Error ? error.message : 'Unknown error') });
    }
  });

  // Backup settings endpoints
  app.get('/api/backup-settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "Backup settings require Premium subscription" });
      }

      let settings = await storage.getUserBackupSettings(userId);

      // Create default settings if none exist
      if (!settings) {
        settings = await storage.createBackupSettings({
          userId,
          autoBackup: true,
          frequency: 'daily',
          retentionDays: 7,
          includeAttachments: true,
          encryptBackups: true,
          status: 'active',
          totalBackups: 0,
          totalSize: '0 B',
          lastBackupDate: null,
          nextBackupDate: null
        });
      }

      // Get backup info from Bunny.net
      const { bunnyStorage } = await import('./bunnyStorage');
      const backupInfo = await bunnyStorage.getBackupInfo(userId);

      res.json({
        ...settings,
        ...backupInfo
      });

    } catch (error) {
      console.error("Error getting backup settings:", error);
      res.status(500).json({ message: "Failed to get backup settings" });
    }
  });

  app.put('/api/backup-settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "Backup settings require Premium subscription" });
      }

      const { autoBackup, frequency, retentionDays, includeAttachments, encryptBackups } = req.body;

      // Validate frequency
      if (frequency && !['daily', 'weekly', 'monthly'].includes(frequency)) {
        return res.status(400).json({ message: "Invalid frequency. Must be daily, weekly, or monthly" });
      }

      // Validate retention days
      if (retentionDays && ![7, 14, 30].includes(retentionDays)) {
        return res.status(400).json({ message: "Invalid retention period. Must be 7, 14, or 30 days" });
      }

      let settings = await storage.getUserBackupSettings(userId);

      if (!settings) {
        // Create new settings
        settings = await storage.createBackupSettings({
          userId,
          autoBackup: autoBackup ?? true,
          frequency: frequency ?? 'daily',
          retentionDays: retentionDays ?? 7,
          includeAttachments: includeAttachments ?? true,
          encryptBackups: encryptBackups ?? true,
          status: 'active',
          totalBackups: 0,
          totalSize: '0 B',
          lastBackupDate: null,
          nextBackupDate: null
        });
      } else {
        // Update existing settings
        settings = await storage.updateBackupSettings(userId, {
          autoBackup,
          frequency,
          retentionDays,
          includeAttachments,
          encryptBackups
        });
      }

      // Update backup schedule
      const { backupScheduler } = await import('./backupScheduler');
      await backupScheduler.updateUserSchedule(userId);

      res.json(settings);

    } catch (error) {
      console.error("Error updating backup settings:", error);
      res.status(500).json({ message: "Failed to update backup settings" });
    }
  });

  app.get('/api/backup-status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "Backup status requires Premium subscription" });
      }

      let settings = await storage.getUserBackupSettings(userId);

      // Create default settings if none exist
      if (!settings) {
        settings = await storage.createBackupSettings({
          userId,
          autoBackup: true,
          frequency: 'daily',
          retentionDays: 7,
          includeAttachments: true,
          encryptBackups: true,
          status: 'active',
          totalBackups: 0,
          totalSize: '0 B',
          lastBackupDate: null,
          nextBackupDate: null
        });
      }

      // Get backup info from Bunny.net
      const { bunnyStorage } = await import('./bunnyStorage');
      let backups = [];
      let backupInfo = { totalBackups: 0, totalSize: 0, oldestBackup: null, newestBackup: null };

      try {
        backups = await bunnyStorage.getUserBackups(userId);
        backupInfo = await bunnyStorage.getBackupInfo(userId);
      } catch (error) {
        // If no backups exist yet, that's ok - user hasn't backed up yet
        console.log(`No backups found for user ${userId}, this is normal for new users`);
      }

      // Helper function to format file sizes
      function formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      }

      res.json({
        settings,
        backups: backups.slice(0, 10), // Latest 10 backups
        info: backupInfo,
        lastBackup: backups.length > 0 ? backups[0].DateCreated : null,
        nextBackup: settings?.nextBackupDate || null,
        realUsage: {
          size: backupInfo.totalSize,
          formattedSize: formatFileSize(backupInfo.totalSize)
        }
      });

    } catch (error) {
      console.error("Error getting backup status:", error);
      res.status(500).json({ message: "Failed to get backup status" });
    }
  });

  // Cache management endpoints (admin/debugging)
  app.get('/api/admin/cache/stats', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);

      // Only allow premium users to view cache stats for now
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "Cache stats require premium plan" });
      }

      const stats = aiCache.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting cache stats:", error);
      res.status(500).json({ message: "Failed to get cache stats" });
    }
  });

  app.post('/api/admin/cache/clear', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);

      // Only allow premium users to clear cache for now
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "Cache clearing requires premium plan" });
      }

      aiCache.clear();
      res.json({ message: "Cache cleared successfully" });
    } catch (error) {
      console.error("Error clearing cache:", error);
      res.status(500).json({ message: "Failed to clear cache" });
    }
  });

  // Cookie consent endpoint
  app.post('/api/cookie-consent', setCookieConsent, (req, res) => {
    res.json({ success: true, message: "Cookie preferences updated successfully" });
  });

  // Test endpoint to demonstrate cookie functionality
  app.get('/api/test-cookies', (req: any, res) => {
    const consent = req.cookieConsent;

    // Show what cookies will be set based on consent
    const cookieResults = {
      essential: "always set (required for site function)",
      functional: consent.functional ? "will be set (user preferences enabled)" : "blocked (user disabled functional cookies)",
      analytics: consent.analytics ? "will be set (analytics enabled)" : "blocked (user disabled analytics cookies)"
    };

    // Demonstrate real functionality by setting theme cookie (functional)
    if (consent.functional) {
      res.cookie('user-theme', 'dark-mode', { maxAge: 86400000 }); // 24 hours
      res.cookie('dashboard-layout', 'compact', { maxAge: 86400000 });
    }

    // Demonstrate analytics cookies
    if (consent.analytics) {
      res.cookie('analytics-session', 'track_123', { maxAge: 1800000 }); // 30 minutes  
      res.cookie('user-behavior', 'navigation_pattern', { maxAge: 3600000 }); // 1 hour
    }

    // Always set essential cookies (for login, security, etc)
    res.cookie('site-essential', 'csrf_token_abc', { maxAge: 86400000, httpOnly: true });

    res.json({
      consent,
      message: "Cookie behavior demonstration",
      cookieResults,
      demonstration: {
        functionalCookiesSet: consent.functional ? ["user-theme", "dashboard-layout"] : [],
        analyticsCookiesSet: consent.analytics ? ["analytics-session", "user-behavior"] : [],
        essentialCookiesSet: ["site-essential"],
        note: "Check your browser's developer tools to see which cookies were actually set"
      }
    });
  });

  // AI Help Chat endpoint
  // Stripe payment endpoints
  app.post("/api/create-checkout-session", async (req: Request, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { plan } = req.body;
      
      // Simple plan mapping for Stripe
      const planPrices = {
        'standard': { priceId: 'price_standard_monthly', amount: 499 },
        'standard-yearly': { priceId: 'price_standard_yearly', amount: 4990 },
        'premium': { priceId: 'price_premium_monthly', amount: 999 },
        'premium-yearly': { priceId: 'price_premium_yearly', amount: 9990 }
      };

      const selectedPlan = planPrices[plan as keyof typeof planPrices];
      if (!selectedPlan) {
        return res.status(400).json({ error: "Invalid plan selected" });
      }

      // For demo purposes, return a success URL that updates the user's plan
      const successUrl = `${req.headers.origin}/api/subscription-success?plan=${plan}&userId=${req.session.userId}`;
      const cancelUrl = `${req.headers.origin}/pricing`;

      // In a real implementation, you would create a Stripe checkout session here
      // For now, we'll redirect directly to success to simulate payment
      res.json({ url: successUrl });

    } catch (error) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  app.get("/api/subscription-success", async (req: Request, res: Response) => {
    try {
      const { plan, userId } = req.query;
      
      if (!userId || !plan) {
        return res.redirect('/pricing?error=invalid_params');
      }

      // Map plan names to database values
      const planMapping = {
        'standard': 'standard',
        'standard-yearly': 'standard',
        'premium': 'premium',
        'premium-yearly': 'premium'
      };

      const dbPlan = planMapping[plan as keyof typeof planMapping];
      if (!dbPlan) {
        return res.redirect('/pricing?error=invalid_plan');
      }

      // Update user's plan in database
      await storage.updateUserPlan(Number(userId), dbPlan);

      // Redirect to dashboard with success message
      res.redirect('/dashboard?subscription=success');

    } catch (error) {
      console.error('Error processing subscription success:', error);
      res.redirect('/pricing?error=processing_failed');
    }
  });

  app.post("/api/cancel-subscription", async (req: Request, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Reset user to free plan
      await storage.updateUserPlan(req.session.userId, 'free');

      res.json({ success: true, message: "Subscription cancelled successfully" });

    } catch (error) {
      console.error('Error cancelling subscription:', error);
      res.status(500).json({ error: "Failed to cancel subscription" });
    }
  });

  app.post("/api/help-chat", async (req: Request, res: Response) => {
    try {
      const { message } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message is required" });
      }

      // Get current app configuration dynamically
      const { getCurrentAppConfig, formatConfigForAI } = await import('./helpConfig');
      const currentConfig = getCurrentAppConfig();
      const formattedConfig = formatConfigForAI(currentConfig);

      const systemPrompt = `You are a helpful assistant for FinanzerPro, a personal finance management application. You should answer questions about the app's features, pricing, and how to use it.

${formattedConfig}

Keep responses helpful, concise, and focused on FinanzerPro features. If asked about technical issues, suggest contacting support. Always use the most current information provided above.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          max_tokens: 300,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content || "I'm sorry, I couldn't process your question. Please try again or contact support.";

      res.json({ response: aiResponse });
    } catch (error) {
      console.error('Help chat error:', error);
      res.status(500).json({ 
        response: "I'm experiencing technical difficulties. Please try again later or contact support for assistance." 
      });
    }
  });

  // Serve attached assets for demo screenshots
  app.use('/attached_assets', Express.static('attached_assets'));

  // Error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ message: "Something went wrong!" });
  });

  const httpServer = createServer(app);
  return httpServer;
}