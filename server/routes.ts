import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import { storage } from "./storage";
import { users, transactions, budgets, categories, goals, type Transaction, type Budget, type Goal } from "@shared/schema";
import { setupClerkAuth, isAuthenticated, getUserId, requireUserId } from "./clerkAuth";
import { setCookieConsent } from "./cookieMiddleware";
import { insertTransactionSchema, insertBudgetSchema, insertGoalSchema, insertExpenseReminderSchema } from "@shared/schema";
import { z } from "zod";
import { 
  generateFinancialTips, 
  categorizeExpense, 
  generateSpendingInsights, 
  generateTrendPredictions,
  generateAIFinancialHealthScore,
  type ExpenseCategorizationResult 
} from "./openai";
import { aiCache } from "./cache";
import { batchProcessor } from "./batch-processor";
import { adminAuth, adminLogin, adminLogout } from "./adminAuth";
import { generatePdfReport } from "./generatePdf";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe',
  '#00c49f', '#ffbb28', '#ff8042', '#8dd1e1', '#d084d0'
];

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  setupClerkAuth(app);

  // Explicitly block old auth endpoints that no longer exist
  app.get('/api/login', (req, res) => {
    res.status(404).json({ error: 'Login endpoint no longer exists. Please use /sign-in-clerk' });
  });
  
  app.get('/api/logout', (req, res) => {
    res.status(404).json({ error: 'Logout endpoint no longer exists. Please use Clerk sign out' });
  });
  
  app.get('/api/callback', (req, res) => {
    res.status(404).json({ error: 'Callback endpoint no longer exists. Authentication handled by Clerk' });
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      if (!userId) {
        return res.status(401).json({ message: "No user ID found" });
      }

      let user = await storage.getUser(userId);
      
      // Get full user data from Clerk
      const { clerkClient } = await import('@clerk/express');
      let clerkUser;
      try {
        clerkUser = await clerkClient.users.getUser(userId);
      } catch (error) {
        console.error('Error fetching Clerk user:', error);
        clerkUser = null;
      }
      
      // Always sync latest Clerk data (for existing users) or create new user
      const userData = {
        id: userId,
        email: clerkUser?.emailAddresses?.[0]?.emailAddress || user?.email || `${userId}@clerk.user`,
        firstName: clerkUser?.firstName || null,
        lastName: clerkUser?.lastName || null,
        profileImageUrl: clerkUser?.imageUrl || null,
        plan: user?.plan || 'free',
        stripeCustomerId: user?.stripeCustomerId || null,
        stripeSubscriptionId: user?.stripeSubscriptionId || null,
        settings: user?.settings || null
      };
      user = await storage.upsertUser(userData);

      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

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
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(userId);

      // No viewing limits - users can see all their stored transactions
      // Storage limits are enforced at creation time
      let limit = undefined; // Show all transactions user has stored

      const transactions = await storage.getUserTransactions(userId, limit);
      res.json(transactions);
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

      if (user?.plan === 'free') {
        return res.status(403).json({ message: "Standard or Premium subscription required" });
      }

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
      
      res.json(transaction);
    } catch (error) {
      console.error("Error updating transaction:", error);
      res.status(400).json({ message: "Failed to update transaction" });
    }
  });

  app.delete('/api/transactions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
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
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
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
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
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
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
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
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
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
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
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
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
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
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
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
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
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

  app.put('/api/categories/:id', isAuthenticated, async (req: any, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      const { name, icon, color, type } = req.body;

      if (!name || !icon || !color || !type) {
        return res.status(400).json({ message: "Name, icon, color, and type are required" });
      }

      if (!['income', 'expense'].includes(type)) {
        return res.status(400).json({ message: "Type must be 'income' or 'expense'" });
      }

      const category = await storage.updateCategory(categoryId, { name, icon, color, type });
      res.json(category);
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(400).json({ message: "Failed to update category" });
    }
  });

  app.delete('/api/categories/:id', isAuthenticated, async (req: any, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      await storage.deleteCategory(categoryId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Failed to delete category" });
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

      let summary;
      if (!startDate || !endDate) {
        // No date range provided - get all transactions
        summary = await storage.getUserFinancialSummary(userId);
      } else {
        // Date range provided - filter by dates
        summary = await storage.getUserFinancialSummary(
          userId,
          new Date(startDate as string),
          new Date(endDate as string)
        );
      }

      res.json(summary);
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
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
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
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(userId);

      // Require standard+ plan for auto-categorization
      if (!user || !['standard', 'premium'].includes(user.plan || '')) {
        return res.status(403).json({ message: "Auto-categorization requires standard or premium plan" });
      }

      // Get uncategorized transactions
      const transactions = await storage.getUserTransactions(userId);
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
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(userId);

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
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(userId);

      // Require premium plan for AI tips
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "AI financial tips require premium plan" });
      }

      // Get user's complete financial data for analysis
      const currentDate = new Date();
      const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
      
      const financialSummary = await storage.getUserFinancialSummary(userId, startOfYear, currentDate);
      const transactions = await storage.getUserTransactions(userId, 100);
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

      console.log(`Generating fresh AI tip for user ${getUserId(req)} with ${transactions.length} transactions`);
      
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
      const user = await storage.getUser(getUserId(req));

      // Require premium plan for AI insights
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "AI spending insights require premium plan" });
      }

      const transactions = await storage.getUserTransactions(getUserId(req), 100);

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

      const transactions = await storage.getUserTransactions(getUserId(req), 100);

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
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);

      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "AI trend predictions require Premium subscription" });
      }

      const transactions = await storage.getUserTransactions(userId, 200);
      const categories = await storage.getCategories();
      const budgets = await storage.getUserBudgets(userId);

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
        budgets
          .filter(b => b.categoryId !== null)
          .map(b => ({
            categoryId: b.categoryId as number,
            amount: b.amount
          }))
      );

      res.json(predictions);
    } catch (error) {
      console.error("Error generating trend predictions:", error);
      res.status(500).json({ message: "Failed to generate trend predictions" });
    }
  });

  // Financial Health Score (Free for all users)
  app.get('/api/financial-health', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Get user's financial data
      const transactions = await storage.getUserTransactions(userId, 100);
      const budgets = await storage.getUserBudgets(userId);
      const categories = await storage.getCategories();
      
      // Calculate summary from transactions
      const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const totalExpenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      const summary = {
        totalIncome,
        totalExpenses,
        netBalance: totalIncome - totalExpenses
      };

      // Create a stable data hash that only changes with significant financial changes
      // This prevents cache misses from minor data changes like transaction IDs or exact timestamps
      const stableFinancialData = {
        transactionCount: transactions.length,
        totalIncome: Math.round(totalIncome),
        totalExpenses: Math.round(totalExpenses),
        budgetCount: budgets.length,
        recentTransactionTypes: transactions
          .slice(0, 10)
          .map(t => ({ type: t.type, amount: Math.round(parseFloat(t.amount)) })),
        budgetAllocations: budgets.map(b => ({ 
          categoryId: b.categoryId, 
          amount: Math.round(parseFloat(b.amount)) 
        }))
      };

      const dataHash = aiCache.createDataHash(stableFinancialData);
      
      // Check cache first - 24 hour expiration
      const cachedHealth = aiCache.getFinancialHealth(userId, dataHash);
      if (cachedHealth) {
        console.log('Financial health: Using cached data - avoiding OpenAI API call');
        return res.json(cachedHealth);
      }

      // Create category map
      const categoryMap = new Map();
      categories.forEach(cat => {
        categoryMap.set(cat.id, cat.name);
      });

      // Process transactions with category names
      const processedTransactions = transactions.map(t => ({
        id: t.id,
        amount: t.amount,
        description: t.description,
        date: t.date.toISOString(),
        type: t.type,
        categoryName: categoryMap.get(t.categoryId) || 'Other'
      }));

      // Calculate budget spending
      const budgetSpending = new Map();
      transactions.forEach(t => {
        if (t.type === 'expense' && t.categoryId) {
          const current = budgetSpending.get(t.categoryId) || 0;
          budgetSpending.set(t.categoryId, current + parseFloat(t.amount));
        }
      });

      const processedBudgets = budgets
        .filter(b => b.categoryId !== null)
        .map(b => ({
          categoryId: b.categoryId as number,
          amount: b.amount,
          spent: budgetSpending.get(b.categoryId) || 0
        }));

      // Generate financial health score with OpenAI
      console.log('Financial health: Making new OpenAI API call - no cached data available');
      const { generateFinancialHealthScore } = await import('./openai');
      const healthData = await generateFinancialHealthScore({
        transactions: processedTransactions,
        budgets: processedBudgets,
        summary: {
          totalIncome: summary.totalIncome,
          totalExpenses: summary.totalExpenses,
          netBalance: summary.totalIncome - summary.totalExpenses
        }
      });

      // Cache the result for 24 hours
      aiCache.setFinancialHealth(userId, dataHash, healthData);
      console.log('Financial health: Cached new result for 24 hours');

      res.json(healthData);
    } catch (error) {
      console.error("Error generating financial health score:", error);
      res.status(500).json({ message: "Failed to generate financial health score" });
    }
  });

  // Automatic transaction reminders (Standard/Premium only)
  app.get('/api/transaction-reminders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      if (!userId) {
        return res.status(401).json({ message: "No user ID found" });
      }

      const user = await storage.getUser(userId);
      console.log(`Transaction reminders check - User: ${userId}, User object:`, JSON.stringify(user, null, 2));

      if (!user || user.plan === 'free') {
        console.log(`Transaction reminders blocked - User plan: ${user?.plan}`);
        return res.status(403).json({ message: "Transaction reminders require Standard or Premium subscription" });
      }

      const daysAhead = req.query.days ? parseInt(req.query.days as string) : 7;
      const reminders = await storage.getUpcomingTransactionReminders(userId, daysAhead);
      console.log(`Found ${reminders.length} reminders for user ${userId}`);
      res.json(reminders);
    } catch (error) {
      console.error("Error fetching transaction reminders:", error);
      res.status(500).json({ message: "Failed to fetch transaction reminders" });
    }
  });

  // Expense Reminders API (Standard/Premium only) - Smart Bill Assistant feature
  app.post('/api/expense-reminders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
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
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
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
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
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
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
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
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
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
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
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
      if (!userId) {
        console.log('PDF Export Error: No user ID');
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
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
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
        try {
          exportData.goals = await storage.getUserGoals(userId);
        } catch (error) {
          exportData.goals = [];
        }
      }

      // Add financial summary
      if (exportData.transactions && exportData.transactions.length > 0) {
        const income = exportData.transactions
          .filter((t: any) => t.type === 'income')
          .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
        
        const expenses = exportData.transactions
          .filter((t: any) => t.type === 'expense')
          .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
        
        exportData.summary = {
          totalIncome: income,
          totalExpenses: expenses,
          netAmount: income - expenses,
          transactionCount: exportData.transactions.length,
          dateRange: { start: start.toISOString(), end: end.toISOString() }
        };
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
          let csvContent = '';
          
          // Add transactions section
          if (exportData.transactions && exportData.transactions.length > 0) {
            csvContent += 'TRANSACTIONS\n';
            csvContent += 'Date,Description,Amount,Type,Category\n';
            exportData.transactions.forEach((t: any) => {
              csvContent += `${t.date},"${t.description}",${t.amount},${t.type},${t.categoryId}\n`;
            });
            csvContent += '\n';
          }
          
          // Add budgets section
          if (exportData.budgets && exportData.budgets.length > 0) {
            csvContent += 'BUDGETS\n';
            csvContent += 'Category,Amount,Period,Start Date,End Date\n';
            exportData.budgets.forEach((b: any) => {
              csvContent += `${b.categoryId},${b.amount},${b.period},${b.startDate},${b.endDate}\n`;
            });
            csvContent += '\n';
          }
          
          // Add goals section
          if (exportData.goals && exportData.goals.length > 0) {
            csvContent += 'GOALS\n';
            csvContent += 'Title,Target Amount,Current Amount,Target Date,Description\n';
            exportData.goals.forEach((g: any) => {
              csvContent += `"${g.title}",${g.targetAmount},${g.currentAmount},${g.targetDate},"${g.description || ''}"\n`;
            });
            csvContent += '\n';
          }
          
          // Add financial summary
          if (exportData.summary) {
            csvContent += 'FINANCIAL SUMMARY\n';
            csvContent += 'Metric,Value\n';
            csvContent += `Total Income,${exportData.summary.totalIncome || 0}\n`;
            csvContent += `Total Expenses,${exportData.summary.totalExpenses || 0}\n`;
            csvContent += `Net Amount,${(exportData.summary.totalIncome || 0) - (exportData.summary.totalExpenses || 0)}\n`;
            csvContent += `Transaction Count,${exportData.transactions?.length || 0}\n`;
            csvContent += `Budget Count,${exportData.budgets?.length || 0}\n`;
            csvContent += `Goal Count,${exportData.goals?.length || 0}\n`;
          }
          
          responseData = csvContent || 'No data to export';
          filename = `financial-data-${new Date().toISOString().split('T')[0]}.csv`;
          contentType = 'text/csv';
          break;
        case 'excel':
          const XLSX = await import('xlsx');
          const workbook = XLSX.utils.book_new();
          
          // Add transactions sheet
          if (exportData.transactions && exportData.transactions.length > 0) {
            const transactionsSheet = XLSX.utils.json_to_sheet(exportData.transactions.map((t: any) => ({
              Date: t.date,
              Description: t.description,
              Amount: t.amount,
              Type: t.type,
              Category: t.categoryId
            })));
            XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'Transactions');
          }
          
          // Add budgets sheet
          if (exportData.budgets && exportData.budgets.length > 0) {
            const budgetsSheet = XLSX.utils.json_to_sheet(exportData.budgets);
            XLSX.utils.book_append_sheet(workbook, budgetsSheet, 'Budgets');
          }
          
          // Add goals sheet  
          if (exportData.goals && exportData.goals.length > 0) {
            const goalsSheet = XLSX.utils.json_to_sheet(exportData.goals);
            XLSX.utils.book_append_sheet(workbook, goalsSheet, 'Goals');
          }
          
          // Add financial summary sheet
          if (exportData.summary) {
            const summaryData = [
              { Metric: 'Total Income', Value: exportData.summary.totalIncome },
              { Metric: 'Total Expenses', Value: exportData.summary.totalExpenses },
              { Metric: 'Net Amount', Value: exportData.summary.netAmount },
              { Metric: 'Transaction Count', Value: exportData.summary.transactionCount },
              { Metric: 'Budget Count', Value: exportData.budgets?.length || 0 },
              { Metric: 'Goal Count', Value: exportData.goals?.length || 0 },
              { Metric: 'Export Date', Value: new Date().toISOString().split('T')[0] },
              { Metric: 'Date Range', Value: `${start.toDateString()} to ${end.toDateString()}` }
            ];
            const summarySheet = XLSX.utils.json_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(workbook, summarySheet, 'Financial Summary');
          }
          
          // Add charts sheet with category breakdown
          if (exportData.transactions && exportData.transactions.length > 0) {
            const categoryBreakdown: { [key: string]: number } = {};
            exportData.transactions.forEach((t: any) => {
              const category = t.categoryId || 'Uncategorized';
              categoryBreakdown[category] = (categoryBreakdown[category] || 0) + parseFloat(t.amount);
            });
            
            const chartData = Object.entries(categoryBreakdown).map(([category, amount]) => ({
              Category: category,
              Amount: amount,
              Percentage: ((amount / exportData.summary.totalExpenses) * 100).toFixed(2) + '%'
            }));
            
            const chartSheet = XLSX.utils.json_to_sheet(chartData);
            XLSX.utils.book_append_sheet(workbook, chartSheet, 'Charts & Graphs');
          }
          
          responseData = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
          filename = `financial-data-${new Date().toISOString().split('T')[0]}.xlsx`;
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        case 'pdf':
          // Use Puppeteer + Google Charts for professional PDF generation
          const pdfData = {
            transactions: exportData.transactions || [],
            budgets: exportData.budgets || [],
            goals: exportData.goals || [],
            summary: exportData.summary || {
              totalIncome: 0,
              totalExpenses: 0,
              netAmount: 0,
              transactionCount: 0,
              categoryBreakdown: {},
              month: new Date().toLocaleDateString('en-US', { month: 'long' }),
              year: new Date().getFullYear()
            },
            userName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email || 'User'
          };
          
          responseData = await generatePdfReport(pdfData);
          filename = `financial-report-${new Date().toISOString().split('T')[0]}.pdf`;
          contentType = 'application/pdf';
          break;
        default:
          responseData = JSON.stringify(exportData, null, 2);
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
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
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
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
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
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
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
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
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

  // Restore backup endpoint (premium users only)
  app.post('/api/restore-backup', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      if (!userId) {
        console.log('RESTORE: Authentication required');
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.plan !== 'premium') {
        console.log(`RESTORE: User ${userId} attempted restore without premium plan`);
        return res.status(403).json({ message: "Data restore requires Premium subscription" });
      }

      const { backupFilename } = req.body;
      if (!backupFilename) {
        console.log('RESTORE: No backup filename provided');
        return res.status(400).json({ message: "Backup filename is required" });
      }

      console.log(`RESTORE: Starting restore process for user ${userId} with backup ${backupFilename}`);
      
      // Get backup from Bunny.net storage
      const { bunnyStorage } = await import('./bunnyStorage');
      
      console.log('RESTORE: Downloading backup data from cloud storage...');
      const backupData = await bunnyStorage.restoreBackup(userId, backupFilename);
      
      console.log('RESTORE: Backup data downloaded successfully, parsing content...');
      console.log(`RESTORE: Backup contains ${Object.keys(backupData).length} data sections`);

      // Validate backup data structure
      if (!backupData.transactions || !backupData.budgets || !backupData.categories) {
        console.log('RESTORE: Invalid backup structure detected');
        return res.status(400).json({ message: "Invalid backup file structure" });
      }

      console.log(`RESTORE: Backup validation passed - transactions: ${backupData.transactions.length}, budgets: ${backupData.budgets.length}, categories: ${backupData.categories.length}`);

      // Begin restore transaction
      console.log('RESTORE: Starting database restoration process...');
      
      // Helper function to convert date strings back to Date objects
      const convertDates = (obj: any): any => {
        if (!obj) return obj;
        
        const converted = { ...obj };
        
        // Convert all potential date fields
        if (converted.date && typeof converted.date === 'string') {
          converted.date = new Date(converted.date);
        }
        if (converted.startDate && typeof converted.startDate === 'string') {
          converted.startDate = new Date(converted.startDate);
        }
        if (converted.endDate && typeof converted.endDate === 'string') {
          converted.endDate = new Date(converted.endDate);
        }
        if (converted.targetDate && typeof converted.targetDate === 'string') {
          converted.targetDate = new Date(converted.targetDate);
        }
        // Handle null targetDate values properly
        if (converted.targetDate === null) {
          converted.targetDate = null;
        }
        if (converted.nextDueDate && typeof converted.nextDueDate === 'string') {
          converted.nextDueDate = new Date(converted.nextDueDate);
        }
        if (converted.createdAt && typeof converted.createdAt === 'string') {
          converted.createdAt = new Date(converted.createdAt);
        }
        if (converted.updatedAt && typeof converted.updatedAt === 'string') {
          converted.updatedAt = new Date(converted.updatedAt);
        }
        
        return converted;
      };

      // Clear existing user data completely
      console.log('RESTORE: Clearing existing user transactions...');
      await storage.clearUserTransactions(userId);
      
      console.log('RESTORE: Clearing existing user budgets...');
      await storage.clearUserBudgets(userId);
      
      console.log('RESTORE: Clearing existing user goals...');
      await storage.clearUserGoals(userId);
      
      console.log('RESTORE: Clearing existing user expense reminders...');
      await storage.clearUserExpenseReminders(userId);
      
      console.log('RESTORE: Clearing existing user collaborative goals...');
      await storage.clearUserCollaborativeGoals(userId);

      // Restore transactions
      console.log(`RESTORE: Restoring ${backupData.transactions.length} transactions...`);
      for (const transaction of backupData.transactions) {
        const convertedTransaction = convertDates(transaction);
        await storage.createTransaction({
          ...convertedTransaction,
          userId,
          id: undefined // Let database generate new IDs
        });
      }

      // Restore budgets
      console.log(`RESTORE: Restoring ${backupData.budgets.length} budgets...`);
      for (const budget of backupData.budgets) {
        const convertedBudget = convertDates(budget);
        await storage.createBudget({
          ...convertedBudget,
          userId,
          id: undefined // Let database generate new IDs
        });
      }

      // Restore goals if present
      if (backupData.goals && backupData.goals.length > 0) {
        console.log(`RESTORE: Restoring ${backupData.goals.length} goals...`);
        for (const goal of backupData.goals) {
          const convertedGoal = convertDates(goal);
          await storage.createGoal({
            ...convertedGoal,
            userId,
            id: undefined // Let database generate new IDs
          });
        }
      }

      // Restore expense reminders if present
      if (backupData.expenseReminders && backupData.expenseReminders.length > 0) {
        console.log(`RESTORE: Restoring ${backupData.expenseReminders.length} expense reminders...`);
        for (const reminder of backupData.expenseReminders) {
          const convertedReminder = convertDates(reminder);
          await storage.createExpenseReminder({
            ...convertedReminder,
            userId,
            id: undefined // Let database generate new IDs
          });
        }
      }

      // Restore collaborative goals if present
      if (backupData.collaborativeGoals && backupData.collaborativeGoals.length > 0) {
        console.log(`RESTORE: Restoring ${backupData.collaborativeGoals.length} collaborative goals...`);
        for (const colGoal of backupData.collaborativeGoals) {
          const convertedColGoal = convertDates(colGoal);
          await storage.createCollaborativeGoal({
            ...convertedColGoal,
            createdBy: userId,
            id: undefined // Let database generate new IDs
          });
        }
      }

      // Update backup settings with restore timestamp
      console.log('RESTORE: Updating backup settings with restore timestamp...');
      let settings = await storage.getUserBackupSettings(userId);
      if (settings) {
        await storage.updateBackupSettings(userId, {
          ...settings,
          lastBackupDate: new Date()
        });
      }

      console.log(`RESTORE: Backup restoration completed successfully for user ${userId}`);
      console.log(`RESTORE: Restored ${backupData.transactions.length} transactions, ${backupData.budgets.length} budgets, ${backupData.goals?.length || 0} goals, ${backupData.expenseReminders?.length || 0} expense reminders, ${backupData.collaborativeGoals?.length || 0} collaborative goals`);

      res.json({
        success: true,
        message: "Data restored successfully from backup",
        restoredData: {
          transactions: backupData.transactions.length,
          budgets: backupData.budgets.length,
          categories: backupData.categories.length,
          goals: backupData.goals?.length || 0,
          expenseReminders: backupData.expenseReminders?.length || 0,
          collaborativeGoals: backupData.collaborativeGoals?.length || 0
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error("RESTORE ERROR: Failed to restore backup:", error);
      console.error("RESTORE ERROR Details:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ message: "Failed to restore backup: " + (error instanceof Error ? error.message : 'Unknown error') });
    }
  });

  // Get available backups for restore (premium users only)
  app.get('/api/available-backups', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "Backup access requires Premium subscription" });
      }

      console.log(`RESTORE: Getting available backups for user ${userId}`);
      
      const { bunnyStorage } = await import('./bunnyStorage');
      const backups = await bunnyStorage.getUserBackups(userId);
      
      console.log(`RESTORE: Found ${backups.length} available backups for user ${userId}`);

      // Helper function to format file sizes
      function formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      }

      const availableBackups = backups.map(backup => ({
        filename: backup.ObjectName,
        size: backup.Length || backup.Size || 0,
        date: backup.DateCreated,
        formattedSize: formatFileSize(backup.Length || backup.Size || 0),
        formattedDate: new Date(backup.DateCreated).toLocaleString()
      }));

      res.json({ backups: availableBackups });

    } catch (error) {
      console.error("Error getting available backups:", error);
      res.status(500).json({ message: "Failed to get available backups" });
    }
  });

  // Debug Bunny.net storage endpoint (premium users only)
  app.get('/api/debug/storage', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(userId);

      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "Storage debug requires premium plan" });
      }

      const { bunnyStorage } = await import('./bunnyStorage');
      
      // Get root directory listing
      const rootFiles = await bunnyStorage.listFiles('');
      
      // Get user-specific backups
      const userBackups = await bunnyStorage.getUserBackups(userId);
      
      // Get backup info
      const backupInfo = await bunnyStorage.getBackupInfo(userId);

      res.json({
        userId,
        rootDirectory: rootFiles.map(f => ({
          name: f.ObjectName,
          isDirectory: f.IsDirectory,
          size: f.Length || f.Size || 0,
          created: f.DateCreated
        })),
        userBackups: userBackups.map(f => ({
          name: f.ObjectName,
          size: f.Length || f.Size || 0,
          created: f.DateCreated
        })),
        backupInfo,
        debugInfo: {
          rootFileCount: rootFiles.length,
          userBackupCount: userBackups.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error("Error debugging storage:", error);
      res.status(500).json({ message: "Failed to debug storage: " + (error instanceof Error ? error.message : 'Unknown error') });
    }
  });

  // Cache management endpoints (admin/debugging)
  app.get('/api/admin/cache/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(userId);

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
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(userId);

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

  // Profile management endpoints
  app.get('/api/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Return profile data (excluding sensitive info)
      res.json({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || '',
        website: user.website || ''
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.put('/api/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const { firstName, lastName, email, phone, website } = req.body;

      // Basic validation
      if (!firstName || !lastName || !email) {
        return res.status(400).json({ message: "First name, last name, and email are required" });
      }

      // Get current user to check email change
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if email is already taken by another user (only if email is changing)
      if (email !== currentUser.email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ message: "Email already in use" });
        }
      }

      // Update user profile
      await storage.updateUserProfile(userId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone?.trim() || null,
        website: website?.trim() || null
      });

      // Return updated user data
      const updatedUser = await storage.getUser(userId);
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to retrieve updated user data" });
      }

      res.json({
        firstName: updatedUser.firstName || '',
        lastName: updatedUser.lastName || '',
        email: updatedUser.email || '',
        phone: updatedUser.phone || '',
        website: updatedUser.website || ''
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ 
        message: "Failed to update profile", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  app.post('/api/change-password', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters long" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Import bcrypt for password hashing
      const bcrypt = require('bcrypt');

      // If user has an existing password, verify the current password
      if (user.password) {
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
          return res.status(400).json({ message: "Current password is incorrect" });
        }
      }

      // Hash the new password
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update the password in the database
      await storage.updateUserPassword(userId, hashedNewPassword);

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.get('/api/user-settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const settings = await storage.getUserSettings(userId);
      
      res.json(settings || {
        notifications: {
          email: true,
          push: true,
          transactionReminders: true,
          budgetAlerts: true,
          weeklyReports: false
        },
        privacy: {
          profileVisibility: 'private',
          dataCollection: true,
          analytics: true
        },
        preferences: {
          theme: 'system',
          currency: 'USD',
          language: 'en',
          dateFormat: 'MM/DD/YYYY',
          dashboardLayout: 'comfortable'
        }
      });
    } catch (error) {
      console.error("Error fetching user settings:", error);
      res.status(500).json({ message: "Failed to fetch user settings" });
    }
  });

  app.put('/api/user-settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const settings = req.body;

      await storage.updateUserSettings(userId, settings);
      res.json({ message: "Settings updated successfully" });
    } catch (error) {
      console.error("Error updating user settings:", error);
      res.status(500).json({ message: "Failed to update user settings" });
    }
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
  app.post("/api/create-checkout-session", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { plan } = req.body;
      const userId = getUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      // Get user from database
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const baseUrl = `${req.headers.origin || 'http://localhost:5000'}`;
      const successUrl = `${baseUrl}/api/subscription-success?plan=${plan}&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${baseUrl}/subscribe`;

      // Plan pricing in cents (Stripe uses cents)
      const planPrices = {
        'free': { 
          priceData: {
            currency: 'usd',
            product_data: { name: 'FinanzerPro Free Plan' },
            unit_amount: 0, // $0.00
            recurring: { interval: 'month' as const }
          }
        },
        'standard': { 
          priceData: {
            currency: 'usd',
            product_data: { name: 'FinanzerPro Standard' },
            unit_amount: 499, // $4.99
            recurring: { interval: 'month' as const }
          }
        },
        'standard-yearly': { 
          priceData: {
            currency: 'usd',
            product_data: { name: 'FinanzerPro Standard (Yearly)' },
            unit_amount: 4990, // $49.90
            recurring: { interval: 'year' as const }
          }
        },
        'premium': { 
          priceData: {
            currency: 'usd',
            product_data: { name: 'FinanzerPro Premium' },
            unit_amount: 999, // $9.99
            recurring: { interval: 'month' as const }
          }
        },
        'premium-yearly': { 
          priceData: {
            currency: 'usd',
            product_data: { name: 'FinanzerPro Premium (Yearly)' },
            unit_amount: 9990, // $99.90
            recurring: { interval: 'year' as const }
          }
        }
      };

      const selectedPlan = planPrices[plan as keyof typeof planPrices];
      if (!selectedPlan) {
        return res.status(400).json({ error: "Invalid plan selected" });
      }

      let sessionConfig: any;

      // Configure checkout based on plan type
      if (plan === 'free') {
        // For free plan, just collect customer info and redirect
        sessionConfig = {
          mode: 'setup',
          payment_method_types: ['card'],
          success_url: successUrl,
          cancel_url: cancelUrl,
          setup_intent_data: {
            metadata: { plan: 'free' }
          },
          metadata: {
            plan: plan,
            userId: userId
          }
        };
      } else {
        // For paid plans, create subscription
        sessionConfig = {
          mode: 'subscription',
          payment_method_types: ['card'],
          line_items: [{
            price_data: selectedPlan.priceData,
            quantity: 1,
          }],
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            plan: plan,
            userId: userId
          }
        };
      }

      const session = await stripe!.checkout.sessions.create(sessionConfig);

      res.json({ url: session.url });

    } catch (error) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  app.get("/api/subscription-success", async (req: Request, res: Response) => {
    try {
      const { plan, session_id } = req.query;
      
      if (!session_id || !plan) {
        return res.redirect('/?error=invalid_params');
      }

      // Verify the session with Stripe
      const session = await stripe!.checkout.sessions.retrieve(session_id as string);
      
      // For free plans, we don't require payment completion
      const planRequiresPayment = plan !== 'free';
      if (planRequiresPayment && session.payment_status !== 'paid') {
        return res.redirect('/?error=payment_not_completed');
      }
      
      // For free plans, check setup completion
      if (plan === 'free' && session.mode === 'setup' && session.status !== 'complete') {
        return res.redirect('/?error=setup_not_completed');
      }

      // Map plan names to database values  
      const planMapping = {
        'free': 'free',
        'standard': 'standard',
        'standard-yearly': 'standard',
        'premium': 'premium',
        'premium-yearly': 'premium'
      };

      const dbPlan = planMapping[plan as keyof typeof planMapping] as 'free' | 'standard' | 'premium';
      if (!dbPlan) {
        return res.redirect('/?error=invalid_plan');
      }

      // Get user ID from session metadata
      const userId = session.metadata?.userId;
      if (!userId || userId === 'anonymous') {
        return res.redirect('/?error=user_not_found');
      }

      // Update user's plan in database
      try {
        await storage.updateUserPlan(userId, dbPlan);
        
        // Store Stripe customer and subscription info if available
        if (session.customer) {
          await storage.updateUserStripeInfo(
            userId, 
            session.customer as string,
            (session.subscription as string) || ''
          );
        }
        
        console.log(`Successfully upgraded user ${userId} to ${dbPlan} plan`);
        
        // Redirect to success page
        return res.redirect(`/?upgrade=success&plan=${dbPlan}`);
        
      } catch (dbError) {
        console.error('Error updating user plan in database:', dbError);
        return res.redirect('/?error=plan_update_failed');
      }

    } catch (error) {
      console.error('Error processing subscription success:', error);
      return res.redirect('/?error=subscription_processing_failed');
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
  app.use('/attached_assets', express.static('attached_assets'));

  // Error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ message: "Something went wrong!" });
  });

  // Admin routes - secure admin panel for user management
  const isAdmin = async (req: any, res: any, next: any) => {
    try {
      if (!getUserId(req)) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(userId);

      // Check if user is admin (you can customize this logic)
      const adminEmails = ['jan.milata@gmail.com', 'admin@finanzerpro.com']; // Add your admin emails
      if (!user?.email || !adminEmails.includes(user.email)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      next();
    } catch (error) {
      res.status(500).json({ message: "Admin authorization failed" });
    }
  };

  // Admin authentication routes
  app.post('/api/admin/login', adminLogin);
  app.post('/api/admin/logout', adminLogout);

  // Get all users for admin panel (requires admin authentication)
  app.get('/api/admin/users', adminAuth, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Admin login route
  app.post('/api/admin/login', adminLogin);

  // Admin logout route
  app.post('/api/admin/logout', adminLogout);

  // Get admin statistics (requires admin authentication)
  app.get('/api/admin/stats', adminAuth, async (req: any, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Create new user (requires admin authentication)
  app.post('/api/admin/users', adminAuth, async (req: any, res) => {
    try {
      const { email, firstName, lastName, plan } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Generate a unique ID for the new user
      const userId = `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const userData = {
        id: userId,
        email,
        firstName: firstName || null,
        lastName: lastName || null,
        plan: plan || 'free',
        profileImageUrl: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        settings: null
      };

      const newUser = await storage.upsertUser(userData);
      res.json(newUser);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Update user (requires admin authentication)
  app.put('/api/admin/users/:id', adminAuth, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const { email, firstName, lastName, plan } = req.body;

      const userData = {
        id: userId,
        email,
        firstName,
        lastName,
        plan,
        updatedAt: new Date()
      };

      const updatedUser = await storage.updateUser(userId, userData);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Delete user and all their encrypted data (requires admin authentication)
  app.delete('/api/admin/users/:id', adminAuth, async (req: any, res) => {
    try {
      const userId = req.params.id;

      // Delete all user data (this will handle encrypted data properly)
      await storage.deleteUserCompletely(userId);

      res.json({ success: true, message: "User and all data deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Get user's encrypted data summary (requires admin authentication)
  app.get('/api/admin/users/:id/data', adminAuth, async (req: any, res) => {
    try {
      const userId = req.params.id;
      
      // Get data counts without exposing actual encrypted content
      const dataSummary = await storage.getUserDataSummary(userId);
      
      res.json(dataSummary);
    } catch (error) {
      console.error("Error fetching user data summary:", error);
      res.status(500).json({ message: "Failed to fetch user data summary" });
    }
  });

  // Collaborative Savings Goals API Routes
  
  // Friend management routes
  app.post('/api/friends/request', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const { recipientEmail } = req.body;
      
      const friendship = await storage.sendFriendRequest(userId, recipientEmail);
      res.json(friendship);
    } catch (error) {
      console.error("Error sending friend request:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.post('/api/friends/accept/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const friendshipId = parseInt(req.params.id);
      
      const friendship = await storage.acceptFriendRequest(friendshipId, userId);
      res.json(friendship);
    } catch (error) {
      console.error("Error accepting friend request:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.delete('/api/friends/reject/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const friendshipId = parseInt(req.params.id);
      
      await storage.rejectFriendRequest(friendshipId, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error rejecting friend request:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.get('/api/friends', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const friends = await storage.getUserFriends(userId);
      res.json(friends);
    } catch (error) {
      console.error("Error fetching friends:", error);
      res.status(500).json({ message: "Failed to fetch friends" });
    }
  });

  app.get('/api/friends/requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const requests = await storage.getPendingFriendRequests(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching friend requests:", error);
      res.status(500).json({ message: "Failed to fetch friend requests" });
    }
  });

  // Collaborative goals routes
  app.post('/api/collaborative-goals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const goalData = {
        ...req.body,
        createdBy: userId,
        targetDate: new Date(req.body.targetDate), // Convert string back to Date object
      };
      
      const goal = await storage.createCollaborativeGoal(goalData);
      res.json(goal);
    } catch (error) {
      console.error("Error creating collaborative goal:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.get('/api/collaborative-goals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const goals = await storage.getUserCollaborativeGoals(userId);
      res.json(goals);
    } catch (error) {
      console.error("Error fetching collaborative goals:", error);
      res.status(500).json({ message: "Failed to fetch collaborative goals" });
    }
  });

  app.get('/api/collaborative-goals/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const goalId = parseInt(req.params.id);
      
      const goal = await storage.getCollaborativeGoal(goalId, userId);
      if (!goal) {
        return res.status(404).json({ message: "Goal not found or access denied" });
      }
      
      res.json(goal);
    } catch (error) {
      console.error("Error fetching collaborative goal:", error);
      res.status(500).json({ message: "Failed to fetch goal" });
    }
  });

  app.post('/api/collaborative-goals/:id/join', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const goalId = parseInt(req.params.id);
      const { personalTarget } = req.body;
      
      const participant = await storage.joinCollaborativeGoal(goalId, userId, personalTarget);
      res.json(participant);
    } catch (error) {
      console.error("Error joining collaborative goal:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.post('/api/collaborative-goals/:id/leave', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const goalId = parseInt(req.params.id);
      
      await storage.leaveCollaborativeGoal(goalId, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error leaving collaborative goal:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.put('/api/collaborative-goals/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const goalId = parseInt(req.params.id);
      
      const goal = await storage.updateCollaborativeGoal(goalId, userId, req.body);
      res.json(goal);
    } catch (error) {
      console.error("Error updating collaborative goal:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.delete('/api/collaborative-goals/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const goalId = parseInt(req.params.id);
      
      await storage.deleteCollaborativeGoal(goalId, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting collaborative goal:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Goal contributions
  app.post('/api/collaborative-goals/:id/contribute', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const goalId = parseInt(req.params.id);
      
      const contributionData = {
        ...req.body,
        goalId,
        userId,
      };
      
      const contribution = await storage.addGoalContribution(contributionData);
      res.json(contribution);
    } catch (error) {
      console.error("Error adding contribution:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.get('/api/collaborative-goals/:id/contributions', isAuthenticated, async (req: any, res) => {
    try {
      const goalId = parseInt(req.params.id);
      const contributions = await storage.getGoalContributions(goalId);
      res.json(contributions);
    } catch (error) {
      console.error("Error fetching contributions:", error);
      res.status(500).json({ message: "Failed to fetch contributions" });
    }
  });

  app.get('/api/collaborative-goals/:id/activities', isAuthenticated, async (req: any, res) => {
    try {
      const goalId = parseInt(req.params.id);
      const activities = await storage.getGoalActivities(goalId);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  // Email invitation endpoint for collaborative goals
  app.post('/api/collaborative-goals/:id/invite', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const goalId = parseInt(req.params.id);
      const { email } = req.body;

      if (!email || !email.includes('@')) {
        return res.status(400).json({ message: "Valid email address is required" });
      }

      // Check if user has permission to invite to this goal
      const goal = await storage.getCollaborativeGoal(goalId, userId);
      if (!goal) {
        return res.status(404).json({ message: "Goal not found or access denied" });
      }

      // Check if user with this email already exists
      const existingUser = await storage.getUserByEmail(email);
      
      if (existingUser) {
        // User exists - add them directly to the goal
        try {
          const participant = await storage.joinCollaborativeGoal(goalId, existingUser.id);
          res.json({ 
            existingUser: true, 
            email: email,
            participant 
          });
        } catch (error) {
          res.status(400).json({ message: "User is already part of this goal or cannot join" });
        }
      } else {
        // User doesn't exist - send invitation email
        // For now, we'll return a success response indicating email would be sent
        // In production, you'd integrate with SendGrid here
        res.json({ 
          existingUser: false, 
          email: email,
          message: "Invitation email sent"
        });
      }
    } catch (error) {
      console.error("Error inviting user:", error);
      res.status(500).json({ message: "Failed to send invitation" });
    }
  });

  // Add contribution to collaborative goal
  app.post('/api/collaborative-goals/:id/contributions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const goalId = parseInt(req.params.id);
      const { amount, note } = req.body;

      const contributionData = {
        goalId,
        userId,
        amount: amount.toString(),
        description: note || null,
      };
      
      const contribution = await storage.addGoalContribution(contributionData);
      res.json(contribution);
    } catch (error) {
      console.error("Error adding contribution:", error);
      res.status(400).json({ message: error.message || "Failed to add contribution" });
    }
  });

  app.get('/api/achievements', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const achievements = await storage.getUserAchievements(userId);
      res.json(achievements);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });

  // Financial Mascot endpoints
  app.get('/api/mascot', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const mascot = await storage.getUserMascot(userId);
      
      if (!mascot) {
        // Return default mascot state for new users
        return res.json({
          id: null,
          userId,
          imageUrl: null,
          healthScore: 50,
          mood: "neutral",
          lastGenerated: null,
          isEnabled: true
        });
      }
      
      res.json(mascot);
    } catch (error) {
      console.error("Error fetching mascot:", error);
      res.status(500).json({ message: "Failed to fetch mascot" });
    }
  });

  app.post('/api/mascot/generate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get user's current financial health
      const financialSummary = await storage.getUserFinancialSummary(
        userId,
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        new Date()
      );

      // Calculate financial health score
      const totalIncome = financialSummary.totalIncome || 0;
      const totalExpenses = financialSummary.totalExpenses || 0;
      const netAmount = totalIncome - totalExpenses;
      
      // Simple health score calculation (0-100)
      let healthScore = 50; // Default neutral
      if (totalIncome > 0) {
        const savingsRate = netAmount / totalIncome;
        if (savingsRate > 0.3) healthScore = 90;
        else if (savingsRate > 0.2) healthScore = 80;
        else if (savingsRate > 0.1) healthScore = 70;
        else if (savingsRate > 0) healthScore = 60;
        else if (savingsRate > -0.1) healthScore = 40;
        else if (savingsRate > -0.2) healthScore = 30;
        else healthScore = 20;
      }

      // Determine mood based on health score
      let mood = "neutral";
      if (healthScore >= 80) mood = "excellent";
      else if (healthScore >= 60) mood = "good";
      else if (healthScore >= 40) mood = "neutral";
      else if (healthScore >= 20) mood = "concerned";
      else mood = "worried";

      // Generate DALL-E 3 prompt based on financial health
      const personalityTraits = {
        excellent: "confident, cheerful, glowing with success, wearing a small crown or gold accessories",
        good: "happy, optimistic, well-dressed, with a slight smile and bright eyes",
        neutral: "calm, balanced, thoughtful, with a gentle expression",
        concerned: "slightly worried, furrowed brow, but still hopeful, looking determined",
        worried: "anxious, stressed, but cute and sympathetic, needing encouragement"
      };

      // Create unique characteristics based on user ID for personalization
      const userIdNumber = parseInt(userId.slice(-4), 10); // Use last 4 digits of user ID
      const uniqueTraits = [
        "wearing glasses", "with a bow tie", "holding a tiny calculator", "with a small hat",
        "wearing a vest", "with a monocle", "holding coins", "with a briefcase",
        "wearing suspenders", "with a pocket watch", "holding a chart", "with a cape"
      ];
      const colorSchemes = [
        "blue and gold", "green and silver", "purple and white", "orange and blue",
        "red and gold", "teal and cream", "pink and gray", "navy and yellow"
      ];
      
      const uniqueTrait = uniqueTraits[userIdNumber % uniqueTraits.length];
      const colorScheme = colorSchemes[userIdNumber % colorSchemes.length];
      
      const prompt = `A cute, friendly financial advisor mascot character that is ${personalityTraits[mood as keyof typeof personalityTraits]}. The character should be a small, adorable creature (like a mix between a piggy bank and a friendly animal) with expressive eyes, ${uniqueTrait}, in ${colorScheme} colors. The style should be modern, clean, and professional but approachable. The character represents someone's financial health and should look ${mood}. Background should be simple and clean. Digital art style, high quality, 3D rendered look. Unique identifier: ${userId.slice(-6)}.`;

      // Generate image using DALL-E 3
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const response = await openai.images.generate({
        model: "dall-e-3", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
      });

      const imageUrl = response.data?.[0]?.url;
      if (!imageUrl) {
        throw new Error("Failed to generate mascot image - no URL returned from DALL-E 3");
      }

      // Check if user already has a mascot
      const existingMascot = await storage.getUserMascot(userId);
      
      let mascot;
      if (existingMascot) {
        // Update existing mascot
        mascot = await storage.updateMascot(userId, {
          imageUrl,
          healthScore,
          mood,
          generationPrompt: prompt,
          lastGenerated: new Date(),
        });
      } else {
        // Create new mascot
        mascot = await storage.createMascot({
          userId,
          imageUrl,
          healthScore,
          mood,
          generationPrompt: prompt,
          isEnabled: true,
        });
      }

      res.json(mascot);
    } catch (error) {
      console.error("Error generating mascot:", error);
      res.status(500).json({ message: "Failed to generate mascot" });
    }
  });

  app.post('/api/mascot/toggle', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const { enabled } = req.body;

      // Check if mascot exists, if not create a default one
      let mascot = await storage.getUserMascot(userId);
      
      if (!mascot) {
        mascot = await storage.createMascot({
          userId,
          imageUrl: '', // Will be generated when user first enables
          healthScore: 50,
          mood: 'neutral',
          generationPrompt: 'Default mascot',
          isEnabled: enabled,
        });
      } else {
        mascot = await storage.toggleMascot(userId, enabled);
      }

      res.json(mascot);
    } catch (error) {
      console.error("Error toggling mascot:", error);
      res.status(500).json({ message: "Failed to toggle mascot" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}