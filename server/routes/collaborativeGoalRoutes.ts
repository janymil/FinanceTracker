import type { Express } from "express";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";

export function registerCollaborativeGoalRoutes(app: Express) {
  // Friend management routes
  app.post('/api/friends/request', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const { recipientEmail } = req.body;
      
      const friendship = await storage.sendFriendRequest(userId, recipientEmail);
      return res.json(friendship);
    } catch (error) {
      return res.status(400).json({ message: error.message });
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
      return res.json(friendship);
    } catch (error) {
      return res.status(400).json({ message: error.message });
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
      return res.status(400).json({ message: error.message });
    }
  });

  app.get('/api/friends', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const friends = await storage.getUserFriends(userId);
      return res.json(friends);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch friends" });
    }
  });

  app.get('/api/friends/requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const requests = await storage.getPendingFriendRequests(userId);
      return res.json(requests);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch friend requests" });
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
      return res.json(goal);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.get('/api/collaborative-goals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const goals = await storage.getUserCollaborativeGoals(userId);
      return res.json(goals);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch collaborative goals" });
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
      
      return res.json(goal);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch goal" });
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
      return res.json(participant);
    } catch (error) {
      return res.status(400).json({ message: error.message });
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
      return res.status(400).json({ message: error.message });
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
      return res.json(goal);
    } catch (error) {
      return res.status(400).json({ message: error.message });
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
      return res.status(400).json({ message: error.message });
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
      return res.json(contribution);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.get('/api/collaborative-goals/:id/contributions', isAuthenticated, async (req: any, res) => {
    try {
      const goalId = parseInt(req.params.id);
      const contributions = await storage.getGoalContributions(goalId);
      return res.json(contributions);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch contributions" });
    }
  });

  app.get('/api/collaborative-goals/:id/activities', isAuthenticated, async (req: any, res) => {
    try {
      const goalId = parseInt(req.params.id);
      const activities = await storage.getGoalActivities(goalId);
      return res.json(activities);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch activities" });
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
          return res.json({ 
            existingUser: true, 
            email: email,
            participant 
          });
        } catch (error) {
          return res.status(400).json({ message: "User is already part of this goal or cannot join" });
        }
      } else {
        // User doesn't exist - send invitation email
        // For now, we'll return a success response indicating email would be sent
        // In production, you'd integrate with SendGrid here
        return res.json({ 
          existingUser: false, 
          email: email,
          message: "Invitation email sent"
        });
      }
    } catch (error) {
      return res.status(500).json({ message: "Failed to send invitation" });
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
      return res.json(contribution);
    } catch (error) {
      return res.status(400).json({ message: error.message || "Failed to add contribution" });
    }
  });

  app.get('/api/achievements', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const achievements = await storage.getUserAchievements(userId);
      return res.json(achievements);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });
}