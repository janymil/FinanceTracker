import { notifyDataChange } from "../realtime";

import type { Express } from "express";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";
import { insertGoalSchema, insertExpenseReminderSchema } from "@shared/schema";
import { cleanPositiveAmount, cleanNonNegativeAmount, cleanDateValue, cleanText, cleanId } from "@shared/trackingInput";

export function registerGoalRoutes(app: Express) {
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
      return res.json(goals);
    } catch (error) {
      console.error("Error fetching goals:", error);
      return res.status(500).json({ message: "Failed to fetch goals" });
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

      const { name, targetAmount, targetDate, category, description } = req.body;

      const cleanName = cleanText(name, 100);
      if (!cleanName) {
        return res.status(400).json({ message: "A goal name of up to 100 characters is required" });
      }
      const cleanTarget = cleanPositiveAmount(targetAmount);
      if (!cleanTarget) {
        return res.status(400).json({ message: "Target amount must be a positive number" });
      }
      const cleanTargetDate = cleanDateValue(targetDate);
      if (!cleanTargetDate) {
        return res.status(400).json({ message: "A valid target date is required" });
      }
      const cleanCategory = cleanText(category, 100);
      if (!cleanCategory) {
        return res.status(400).json({ message: "A category is required" });
      }
      if (description && String(description).length > 1000) {
        return res.status(400).json({ message: "Description is limited to 1000 characters" });
      }

      const goalData = {
        userId,
        name: cleanName,
        targetAmount: cleanTarget, // decimal column takes a string
        targetDate: cleanTargetDate,
        category: cleanCategory,
        description: description ? String(description) : null,
        currentAmount: "0.00",
        status: "active"
      };

      const goal = await storage.createGoal(goalData);
      notifyDataChange(userId, 'goal');
      return res.json(goal);
    } catch (error) {
      console.error("Error creating goal:", error);
      return res.status(400).json({ message: "Failed to create goal" });
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

      const id = cleanId(req.params.id);
      if (id === null) {
        return res.status(400).json({ message: "Invalid goal id" });
      }
      const { name, targetAmount, targetDate, category, description, currentAmount } = req.body;

      // Security: Verify goal ownership before update
      const existingGoal = await storage.getGoal(id, userId);
      if (!existingGoal) {
        return res.status(404).json({ message: "Goal not found" });
      }

      const updateData: any = {};
      if (name !== undefined) {
        const cleanName = cleanText(name, 100);
        if (!cleanName) return res.status(400).json({ message: "A goal name of up to 100 characters is required" });
        updateData.name = cleanName;
      }
      if (targetAmount !== undefined) {
        const cleanTarget = cleanPositiveAmount(targetAmount);
        if (!cleanTarget) return res.status(400).json({ message: "Target amount must be a positive number" });
        updateData.targetAmount = cleanTarget;
      }
      if (targetDate !== undefined) {
        const cleanTargetDate = cleanDateValue(targetDate);
        if (!cleanTargetDate) return res.status(400).json({ message: "A valid target date is required" });
        updateData.targetDate = cleanTargetDate;
      }
      if (category !== undefined) {
        const cleanCategory = cleanText(category, 100);
        if (!cleanCategory) return res.status(400).json({ message: "A category is required" });
        updateData.category = cleanCategory;
      }
      if (description !== undefined) {
        if (description && String(description).length > 1000) {
          return res.status(400).json({ message: "Description is limited to 1000 characters" });
        }
        updateData.description = description ? String(description) : null;
      }
      if (currentAmount !== undefined) {
        const cleanCurrent = cleanNonNegativeAmount(currentAmount);
        if (!cleanCurrent) return res.status(400).json({ message: "Saved amount must be zero or more" });
        updateData.currentAmount = cleanCurrent;
      }

      const goal = await storage.updateGoal(id, userId, updateData);
      notifyDataChange(userId, 'goal');
      return res.json(goal);
    } catch (error) {
      console.error("Error updating goal:", error);
      return res.status(400).json({ message: "Failed to update goal" });
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

      const id = cleanId(req.params.id);
      if (id === null) {
        return res.status(400).json({ message: "Invalid goal id" });
      }
      if (!(await storage.deleteGoal(id, userId))) {
        return res.status(404).json({ message: "Goal not found" });
      }
      notifyDataChange(userId, 'goal');
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting goal:", error);
      return res.status(500).json({ message: "Failed to delete goal" });
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
      return res.json(reminder);
    } catch (error) {
      console.error("Error creating expense reminder:", error);
      return res.status(400).json({ message: "Failed to create expense reminder" });
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
      return res.json(reminders);
    } catch (error) {
      console.error("Error fetching expense reminders:", error);
      return res.status(500).json({ message: "Failed to fetch expense reminders" });
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
      return res.json(reminders);
    } catch (error) {
      console.error("Error fetching upcoming expense reminders:", error);
      return res.status(500).json({ message: "Failed to fetch upcoming expense reminders" });
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

      // Security: Verify reminder ownership before update
      const userReminders = await storage.getUserExpenseReminders(userId);
      const existingReminder = userReminders.find(reminder => reminder.id === id);
      if (!existingReminder) {
        return res.status(403).json({ message: "Expense reminder not found or access denied" });
      }

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
      return res.json(reminder);
    } catch (error) {
      console.error("Error updating expense reminder:", error);
      return res.status(400).json({ message: "Failed to update expense reminder" });
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
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting expense reminder:", error);
      return res.status(500).json({ message: "Failed to delete expense reminder" });
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
      return res.json({ success: true });
    } catch (error) {
      console.error("Error completing expense reminder:", error);
      return res.status(500).json({ message: "Failed to complete expense reminder" });
    }
  });
}