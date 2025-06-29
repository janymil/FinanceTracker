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
        // User exists - add them directly to the goal
        try {
          const participant = await storage.joinCollaborativeGoal(goalId, existingUser.id);
          
          // Send notification email to existing user
          const { sendEmail } = await import('../emailService');
          const formattedAmount = `$${parseFloat(goal.targetAmount).toLocaleString()}`;
          const formattedDate = new Date(goal.targetDate).toLocaleDateString();
          
          const emailSent = await sendEmail({
            to: email,
            from: 'noreply@finanzerpro.com',
            subject: `${inviter.firstName} ${inviter.lastName} invited you to join "${goal.name}" savings goal`,
            text: `Hi ${existingUser.firstName},

${inviter.firstName} ${inviter.lastName} has invited you to join their collaborative savings goal "${goal.name}"!

Goal Details:
• Target Amount: ${formattedAmount}
• Target Date: ${formattedDate}
• Description: ${goal.description || 'No description'}

You've been automatically added to this goal. Log in to view your progress and start contributing!

Best regards,
The FinanzerPro Team`,
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>You've been added to a savings goal!</h2>
  <p>Hi ${existingUser.firstName},</p>
  <p><strong>${inviter.firstName} ${inviter.lastName}</strong> has invited you to join their collaborative savings goal "<strong>${goal.name}</strong>"!</p>
  
  <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 25px 0;">
    <h3>Goal Details</h3>
    <ul>
      <li><strong>Target Amount:</strong> ${formattedAmount}</li>
      <li><strong>Target Date:</strong> ${formattedDate}</li>
      <li><strong>Description:</strong> ${goal.description || 'No description'}</li>
    </ul>
  </div>
  
  <p>You've been automatically added to this goal. Log in to view your progress and start contributing!</p>
  <p>Best regards,<br>The FinanzerPro Team</p>
</div>`
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
        const { sendEmail } = await import('../emailService');
        const formattedAmount = `$${parseFloat(goal.targetAmount).toLocaleString()}`;
        const formattedDate = new Date(goal.targetDate).toLocaleDateString();
        
        const emailSent = await sendEmail({
          to: email,
          from: 'noreply@finanzerpro.com',
          subject: `${inviter.firstName} ${inviter.lastName} invited you to join "${goal.name}" savings goal`,
          text: `Hi there,

${inviter.firstName} ${inviter.lastName} has invited you to join FinanzerPro and participate in their collaborative savings goal "${goal.name}"!

Goal Details:
• Target Amount: ${formattedAmount}
• Target Date: ${formattedDate}
• Description: ${goal.description || 'No description'}

Join for free and start saving together!

Best regards,
The FinanzerPro Team`,
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>You're invited to save together!</h2>
  <p>Hi there,</p>
  <p><strong>${inviter.firstName} ${inviter.lastName}</strong> has invited you to join <strong>FinanzerPro</strong> and participate in their collaborative savings goal "<strong>${goal.name}</strong>"!</p>
  
  <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 25px 0;">
    <h3>Goal Details</h3>
    <ul>
      <li><strong>Target Amount:</strong> ${formattedAmount}</li>
      <li><strong>Target Date:</strong> ${formattedDate}</li>
      <li><strong>Description:</strong> ${goal.description || 'No description'}</li>
    </ul>
  </div>
  
  <p>Join for free and start saving together!</p>
  <p>Best regards,<br>The FinanzerPro Team</p>
</div>`
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