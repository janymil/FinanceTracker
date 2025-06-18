import type { Express } from "express";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";

export function registerCollaborativeGoalRoutes(app: Express) {
  // Get user's collaborative goals
  app.get('/api/collaborative-goals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (user?.plan === 'free') {
        return res.status(403).json({ message: "Standard or Premium subscription required" });
      }

      const goals = await storage.getUserCollaborativeGoals(userId);
      res.json(goals);
    } catch (error) {
      console.error("Error fetching collaborative goals:", error);
      res.status(500).json({ message: "Failed to fetch collaborative goals" });
    }
  });

  // Get specific collaborative goal
  app.get('/api/collaborative-goals/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const goalId = parseInt(req.params.id);
      if (isNaN(goalId)) {
        return res.status(400).json({ message: "Invalid goal ID" });
      }

      const goal = await storage.getCollaborativeGoal(goalId, userId);
      if (!goal) {
        return res.status(404).json({ message: "Goal not found" });
      }

      res.json(goal);
    } catch (error) {
      console.error("Error fetching collaborative goal:", error);
      res.status(500).json({ message: "Failed to fetch collaborative goal" });
    }
  });

  // Create new collaborative goal
  app.post('/api/collaborative-goals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (user?.plan === 'free') {
        return res.status(403).json({ message: "Standard or Premium subscription required" });
      }

      const { name, description, targetAmount, targetDate, category, challengeType } = req.body;

      if (!name || !targetAmount || !targetDate || !category || !challengeType) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const goalData = {
        name,
        description: description || '',
        targetAmount: targetAmount.toString(),
        targetDate: new Date(targetDate),
        category,
        challengeType,
        createdBy: userId
      };

      const newGoal = await storage.createCollaborativeGoal(goalData);
      res.status(201).json(newGoal);
    } catch (error) {
      console.error("Error creating collaborative goal:", error);
      res.status(500).json({ message: "Failed to create collaborative goal" });
    }
  });

  // Friends routes
  app.get('/api/friends', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // For now, return empty array as friends feature needs implementation
      res.json([]);
    } catch (error) {
      console.error("Error fetching friends:", error);
      res.status(500).json({ message: "Failed to fetch friends" });
    }
  });

  // Friend requests routes  
  app.get('/api/friends/requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // For now, return empty array as friend requests feature needs implementation
      res.json([]);
    } catch (error) {
      console.error("Error fetching friend requests:", error);
      res.status(500).json({ message: "Failed to fetch friend requests" });
    }
  });
}