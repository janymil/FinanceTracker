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
      console.error("Error sending friend request:", error);
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
      console.error("Error accepting friend request:", error);
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
      console.error("Error rejecting friend request:", error);
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
      console.error("Error fetching friends:", error);
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
      console.error("Error fetching friend requests:", error);
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
      console.error("Error creating collaborative goal:", error);
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
      console.error("Error fetching collaborative goals:", error);
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
      console.error("Error fetching collaborative goal:", error);
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
      console.error("Error joining collaborative goal:", error);
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
      console.error("Error leaving collaborative goal:", error);
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
      console.error("Error updating collaborative goal:", error);
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
      console.error("Error deleting collaborative goal:", error);
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
      console.error("Error adding contribution:", error);
      return res.status(400).json({ message: error.message });
    }
  });

  app.get('/api/collaborative-goals/:id/contributions', isAuthenticated, async (req: any, res) => {
    try {
      const goalId = parseInt(req.params.id);
      const contributions = await storage.getGoalContributions(goalId);
      return res.json(contributions);
    } catch (error) {
      console.error("Error fetching contributions:", error);
      return res.status(500).json({ message: "Failed to fetch contributions" });
    }
  });

  app.get('/api/collaborative-goals/:id/activities', isAuthenticated, async (req: any, res) => {
    try {
      const goalId = parseInt(req.params.id);
      const activities = await storage.getGoalActivities(goalId);
      return res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
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

      // Check if user has permission to invite to this goal (creator only)
      const goal = await storage.getCollaborativeGoal(goalId, userId);
      if (!goal) {
        return res.status(404).json({ message: "Goal not found or access denied" });
      }

      // Get inviter details
      const inviter = await storage.getUser(userId);
      if (!inviter) {
        return res.status(404).json({ message: "Inviter not found" });
      }

      // Check if user with this email already exists
      const existingUser = await storage.getUserByEmail(email);
      
      if (existingUser) {
        // User exists - check if they're already a participant
        const existingParticipant = await storage.getGoalParticipant(goalId, existingUser.id);
        if (existingParticipant) {
          return res.status(400).json({ message: "User is already a participant in this goal" });
        }
        
        // User exists but not in this goal - add them directly to the goal
        try {
          const participant = await storage.joinCollaborativeGoal(goalId, existingUser.id);
          
          // Send notification email to existing user
          const { sendGoalInvitationEmail } = await import('../emailService');
          const goalUrl = `${req.get('origin') || 'https://finanzerpro.com'}/collaborative-goals/${goalId}`;
          
          const emailSent = await sendGoalInvitationEmail({
            recipientEmail: email,
            recipientName: `${existingUser.firstName} ${existingUser.lastName}`,
            inviterName: `${inviter.firstName} ${inviter.lastName}`,
            goalName: goal.name,
            goalDescription: goal.description || '',
            targetAmount: goal.targetAmount,
            targetDate: goal.targetDate,
            goalUrl,
            isExistingUser: true
          });
          
          return res.json({ 
            existingUser: true, 
            email: email,
            participant,
            emailSent
          });
        } catch (error) {
          return res.status(400).json({ message: "User is already part of this goal or cannot join" });
        }
      } else {
        // User doesn't exist - send invitation email
        const { sendGoalInvitationEmail } = await import('../emailService');
        const goalUrl = `${req.get('origin') || 'https://finanzerpro.com'}/collaborative-goals/${goalId}`;
        
        const emailSent = await sendGoalInvitationEmail({
          recipientEmail: email,
          recipientName: 'there', // Generic greeting for new users
          inviterName: `${inviter.firstName} ${inviter.lastName}`,
          goalName: goal.name,
          goalDescription: goal.description || '',
          targetAmount: goal.targetAmount,
          targetDate: goal.targetDate,
          goalUrl,
          isExistingUser: false
        });
        
        return res.json({ 
          existingUser: false, 
          email: email,
          message: "Invitation email sent",
          emailSent
        });
      }
    } catch (error) {
      console.error("Error inviting user:", error);
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
      console.error("Error adding contribution:", error);
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
      console.error("Error fetching achievements:", error);
      return res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });


}