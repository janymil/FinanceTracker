import { notifyDataChange } from "../realtime";

import type { Express } from "express";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";
import { getUserLanguage, translateCategoryName } from "../categoryTranslations";
import { cleanPositiveAmount, cleanDateValue, cleanId } from "@shared/trackingInput";
import { log } from '../logger';

const BUDGET_PERIODS = ['weekly', 'monthly', 'quarterly', 'yearly', 'custom'];

/** A budget may use the person's own categories or a shared default. */
async function ownsCategory(categoryId: number, userId: string): Promise<boolean> {
  const categories = await storage.getCategories(userId);
  return categories.some((category) => category.id === categoryId);
}

export function registerBudgetRoutes(app: Express) {
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

      const { categoryId, amount, startDate, endDate, period } = req.body;

      const cleanCategory = cleanId(categoryId);
      if (cleanCategory === null || !(await ownsCategory(cleanCategory, userId))) {
        return res.status(400).json({ message: "Choose a valid category" });
      }
      const cleanAmount = cleanPositiveAmount(amount);
      if (!cleanAmount) {
        return res.status(400).json({ message: "Budget amount must be a positive number" });
      }
      const start = cleanDateValue(startDate);
      const end = cleanDateValue(endDate);
      if (!start || !end) {
        return res.status(400).json({ message: "Start and end dates must be valid dates" });
      }
      if (end < start) {
        return res.status(400).json({ message: "End date must not be before the start date" });
      }
      const cleanPeriod = String(period || 'monthly');
      if (!BUDGET_PERIODS.includes(cleanPeriod)) {
        return res.status(400).json({ message: "Invalid budget period" });
      }

      const budget = await storage.createBudget({
        userId,
        categoryId: cleanCategory,
        amount: cleanAmount, // decimal column takes a string
        startDate: start,
        endDate: end,
        period: cleanPeriod,
      });
      notifyDataChange(userId, 'budget');
      return res.json(budget);
    } catch (error) {
      log.error("Error creating budget:", error);
      return res.status(400).json({ message: "Failed to create budget" });
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

      const id = cleanId(req.params.id);
      if (id === null) {
        return res.status(400).json({ message: "Invalid budget id" });
      }
      const { categoryId, amount, startDate, endDate, period } = req.body;

      // Security: Verify budget ownership before update
      const existingBudget = await storage.getBudget(id);
      if (!existingBudget || existingBudget.userId !== userId) {
        return res.status(404).json({ message: "Budget not found" });
      }

      const updateData: any = { userId }; // Include userId for ownership verification
      if (categoryId !== undefined) {
        const cleanCategory = cleanId(categoryId);
        if (cleanCategory === null || !(await ownsCategory(cleanCategory, userId))) {
          return res.status(400).json({ message: "Choose a valid category" });
        }
        updateData.categoryId = cleanCategory;
      }
      if (amount !== undefined) {
        const cleanAmount = cleanPositiveAmount(amount);
        if (!cleanAmount) {
          return res.status(400).json({ message: "Budget amount must be a positive number" });
        }
        updateData.amount = cleanAmount;
      }
      if (startDate !== undefined) {
        const start = cleanDateValue(startDate);
        if (!start) return res.status(400).json({ message: "Invalid start date" });
        updateData.startDate = start;
      }
      if (endDate !== undefined) {
        const end = cleanDateValue(endDate);
        if (!end) return res.status(400).json({ message: "Invalid end date" });
        updateData.endDate = end;
      }
      if ((updateData.endDate ?? existingBudget.endDate) < (updateData.startDate ?? existingBudget.startDate)) {
        return res.status(400).json({ message: "End date must not be before the start date" });
      }
      if (period !== undefined) {
        if (!BUDGET_PERIODS.includes(String(period))) {
          return res.status(400).json({ message: "Invalid budget period" });
        }
        updateData.period = String(period);
      }

      const budget = await storage.updateBudget(id, updateData);
      notifyDataChange(userId, 'budget');
      return res.json(budget);
    } catch (error) {
      log.error("Error updating budget:", error);
      return res.status(400).json({ message: "Failed to update budget" });
    }
  });

  app.delete('/api/budgets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);

      if (user?.plan === 'free') {
        return res.status(403).json({ message: "Standard or Premium subscription required" });
      }

      const id = cleanId(req.params.id);
      if (id === null) {
        return res.status(400).json({ message: "Invalid budget id" });
      }
      if (!(await storage.deleteBudget(id, userId))) {
        return res.status(404).json({ message: "Budget not found" });
      }
      notifyDataChange(userId, 'budget');
      return res.json({ success: true });
    } catch (error) {
      log.error("Error deleting budget:", error);
      return res.status(500).json({ message: "Failed to delete budget" });
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

      // Get user language and translate predefined category names
      const userLanguage = getUserLanguage(req);
      const translatedBudgets = budgets.map(budget => {
        if (budget.categoryName) {
          return {
            ...budget,
            categoryName: translateCategoryName(budget.categoryName, userLanguage)
          };
        }
        return budget;
      });

      return res.json(translatedBudgets);
    } catch (error) {
      log.error("Error fetching budgets:", error);
      return res.status(500).json({ message: "Failed to fetch budgets" });
    }
  });
}
