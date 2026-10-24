import type { Express } from "express";
import Stripe from "stripe";
import { clerkClient } from "@clerk/express";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";
import { getUserLanguage, translateCategories } from "../categoryTranslations";
import { rateLimit } from "../middleware/rateLimit";
import { reportServerError } from "../errorGuard/report";
import { cancelPreapproval } from "../mercadopago";

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

        // A Peruvian subscriber is billed by MercadoPago, which must be stopped as well.
        if ((user as any).mpPreapprovalId) {
          try {
            await cancelPreapproval((user as any).mpPreapprovalId);
          } catch (billingError) {
            reportServerError(billingError, {
              where: 'account.delete.mercadopago',
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
}