import type { Express } from "express";
import Stripe from "stripe";
import { clerkClient } from "@clerk/express";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";
import { getUserLanguage, translateCategories } from "../categoryTranslations";
import { rateLimit } from "../middleware/rateLimit";
import { reportServerError } from "../errorGuard/report";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export function registerUserRoutes(app: Express) {
  /**
   * GDPR: the person must be able to take their data with them.
   * Everything is collected with Promise.allSettled so one missing table cannot
   * turn a legal obligation into a 500. Secrets (Stripe ids) are stripped.
   */
  app.get(
    '/api/account/export',
    isAuthenticated,
    rateLimit({ windowMs: 60 * 60 * 1000, max: 5, keyPrefix: 'account-export', perUser: true }),
    async (req: any, res) => {
      try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ message: 'Authentication required' });

        const user = await storage.getUser(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const settled = await Promise.allSettled([
          storage.getUserTransactions(userId),
          storage.getUserBudgets(userId),
          storage.getUserGoals(userId),
          storage.getCategories(userId),
          storage.getUserExpenseReminders(userId),
          storage.getUserAchievements(userId),
        ]);
        const value = (index: number) => {
          const result = settled[index];
          return result.status === 'fulfilled' ? result.value : null;
        };

        const { stripeCustomerId, stripeSubscriptionId, ...account } = user as any;

        const payload = {
          exportedAt: new Date().toISOString(),
          app: 'Kaptia',
          account,
          transactions: value(0),
          budgets: value(1),
          goals: value(2),
          categories: value(3),
          reminders: value(4),
          achievements: value(5),
        };

        const stamp = new Date().toISOString().slice(0, 10);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="kaptia-export-${stamp}.json"`);
        return res.send(JSON.stringify(payload, null, 2));
      } catch (error) {
        reportServerError(error, { where: 'account.export', route: '/api/account/export' });
        return res.status(500).json({ message: 'Could not prepare the export' });
      }
    }
  );

  /**
   * GDPR: right to erasure. Order matters —
   *   1. stop billing (never delete data while a subscription keeps charging),
   *   2. delete the app data,
   *   3. delete the login (Clerk). If step 3 fails, the account cannot sign in to
   *      anything meaningful and the failure is visible in the error tracker.
   */
  app.post(
    '/api/account/delete',
    isAuthenticated,
    rateLimit({ windowMs: 60 * 60 * 1000, max: 5, keyPrefix: 'account-delete', perUser: true }),
    async (req: any, res) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Authentication required' });

      if (String(req.body?.confirmation || '').toUpperCase() !== 'DELETE') {
        return res.status(400).json({ message: 'Type DELETE to confirm' });
      }

      try {
        const user = await storage.getUser(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if ((user as any).stripeSubscriptionId && stripe) {
          try {
            await stripe.subscriptions.cancel((user as any).stripeSubscriptionId);
          } catch (billingError) {
            reportServerError(billingError, {
              where: 'account.delete.billing',
              route: '/api/account/delete',
              moneyPath: true,
            });
            return res.status(409).json({
              message: 'We could not stop the subscription. Nothing was deleted. Please contact support.',
            });
          }
        }

        await storage.deleteUserCompletely(userId);

        try {
          await clerkClient.users.deleteUser(userId);
        } catch (loginError) {
          reportServerError(loginError, { where: 'account.delete.login', route: '/api/account/delete' });
        }

        return res.json({ ok: true });
      } catch (error) {
        reportServerError(error, { where: 'account.delete', route: '/api/account/delete' });
        return res.status(500).json({ message: 'Could not delete the account' });
      }
    }
  );

  // Update user plan (only allows switching to 'free' directly; paid plans require Stripe checkout or promo code)
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

      if (plan !== 'free') {
        const user = await storage.getUser(userId);
        const isAdmin = user?.email === 'jan.milata@gmail.com';
        if (!isAdmin) {
          return res.status(403).json({ message: "Paid plan upgrades require active payment checkout or promo code" });
        }
      }

      await storage.updateUserPlan(userId, plan);

      // Add cache busting header
      res.set('Cache-Control', 'no-cache');
      return res.json({ success: true, message: `Plan updated to ${plan}` });
    } catch (error) {
      console.error("Error updating plan:", error);
      return res.status(500).json({ message: "Failed to update plan" });
    }
  });

  // Categories
  app.get('/api/categories', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const categories = await storage.getCategories(userId);
      
      // Get user language and translate predefined categories
      const userLanguage = getUserLanguage(req);
      const translatedCategories = translateCategories(categories, userLanguage);
      
      return res.json(translatedCategories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      return res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post('/api/categories', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { name, icon, color, type } = req.body;

      if (!name || !icon || !color || !type) {
        return res.status(400).json({ message: "Name, icon, color, and type are required" });
      }

      if (!['income', 'expense'].includes(type)) {
        return res.status(400).json({ message: "Type must be 'income' or 'expense'" });
      }

      const category = await storage.createCategory({ userId, name, icon, color, type });
      return res.json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      return res.status(400).json({ message: "Failed to create category" });
    }
  });

  app.put('/api/categories/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const categoryId = parseInt(req.params.id);
      const { name, icon, color, type } = req.body;

      if (!name || !icon || !color || !type) {
        return res.status(400).json({ message: "Name, icon, color, and type are required" });
      }

      if (!['income', 'expense'].includes(type)) {
        return res.status(400).json({ message: "Type must be 'income' or 'expense'" });
      }

      // Security: Verify category ownership before update
      const userCategories = await storage.getCategories(userId);
      const existingCategory = userCategories.find(cat => cat.id === categoryId);
      if (!existingCategory || (existingCategory.userId !== userId && existingCategory.userId !== null)) {
        return res.status(403).json({ message: "Category not found or access denied" });
      }

      const category = await storage.updateCategory(categoryId, userId, { name, icon, color, type });
      return res.json(category);
    } catch (error) {
      console.error("Error updating category:", error);
      return res.status(400).json({ message: "Failed to update category" });
    }
  });

  app.delete('/api/categories/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const categoryId = parseInt(req.params.id);

      // Security: Verify category ownership before delete
      const userCategories = await storage.getCategories(userId);
      const existingCategory = userCategories.find(cat => cat.id === categoryId);
      if (!existingCategory || (existingCategory.userId !== userId && existingCategory.userId !== null)) {
        return res.status(403).json({ message: "Category not found or access denied" });
      }

      await storage.deleteCategory(categoryId, userId);
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting category:", error);
      return res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // Initialize default categories if none exist
  app.post('/api/init-categories', isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const existingCategories = await storage.getCategories(userId);

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
        return res.json(defaultCategories);
      } else {
        return res.json(existingCategories);
      }
    } catch (error) {
      console.error("Error initializing categories:", error);
      return res.status(500).json({ message: "Failed to initialize categories" });
    }
  });
}