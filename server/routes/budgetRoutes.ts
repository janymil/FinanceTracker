import { notifyDataChange } from "../realtime";

import type { Express } from "express";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";
import { getUserLanguage, translateCategoryName } from "../categoryTranslations";

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
      notifyDataChange(userId, 'budget');
      return res.json(budget);
    } catch (error) {
      console.error("Error creating budget:", error);
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

      const id = parseInt(req.params.id);
      const { categoryId, amount, startDate, endDate, period = 'monthly' } = req.body;

      // Security: Verify budget ownership before update
      const existingBudget = await storage.getBudget(id);
      console.log('Budget update debug:', {
        budgetId: id,
        userId,
        existingBudget: existingBudget ? { id: existingBudget.id, userId: existingBudget.userId } : null,
        requestBody: req.body
      });
      
      if (!existingBudget || existingBudget.userId !== userId) {
        return res.status(403).json({ message: "Budget not found or access denied" });
      }

      const updateData: any = { userId }; // Include userId for ownership verification
      if (categoryId !== undefined) updateData.categoryId = parseInt(categoryId);
      if (amount !== undefined) updateData.amount = String(amount);
      if (startDate !== undefined) updateData.startDate = new Date(startDate);
      if (endDate !== undefined) updateData.endDate = new Date(endDate);
      if (period !== undefined) updateData.period = String(period);

      console.log('Update data being sent:', updateData);
      const budget = await storage.updateBudget(id, updateData);
      notifyDataChange(userId, 'budget');
      return res.json(budget);
    } catch (error) {
      console.error("Error updating budget:", error);
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

      const id = parseInt(req.params.id);
      await storage.deleteBudget(id, userId);
      notifyDataChange(userId, 'budget');
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting budget:", error);
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
      console.error("Error fetching budgets:", error);
      return res.status(500).json({ message: "Failed to fetch budgets" });
    }
  });
}