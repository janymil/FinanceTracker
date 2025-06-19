import type { Express } from "express";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";

export function registerUserRoutes(app: Express) {
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

      // Add cache busting header
      res.set('Cache-Control', 'no-cache');
      res.json({ success: true, message: `Plan updated to ${plan}` });
    } catch (error) {
      console.error("Error updating plan:", error);
      res.status(500).json({ message: "Failed to update plan" });
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
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
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
      res.json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(400).json({ message: "Failed to create category" });
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
      res.json(category);
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(400).json({ message: "Failed to update category" });
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
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Failed to delete category" });
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
        res.json(defaultCategories);
      } else {
        res.json(existingCategories);
      }
    } catch (error) {
      console.error("Error initializing categories:", error);
      res.status(500).json({ message: "Failed to initialize categories" });
    }
  });
}