import type { Express } from "express";
import { setupClerkAuth, isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";

export function registerAuthRoutes(app: Express) {
  // Auth middleware
  setupClerkAuth(app);

  // Explicitly block old auth endpoints that no longer exist
  app.get('/api/login', (req, res) => {
    return res.status(404).json({ error: 'Login endpoint no longer exists. Please use /sign-in-clerk' });
  });
  
  app.get('/api/logout', (req, res) => {
    return res.status(404).json({ error: 'Logout endpoint no longer exists. Please use Clerk sign out' });
  });
  
  app.get('/api/callback', (req, res) => {
    return res.status(404).json({ error: 'Callback endpoint no longer exists. Authentication handled by Clerk' });
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      if (!userId) {
        return res.status(401).json({ message: "No user ID found" });
      }

      let user = await storage.getUser(userId);
      
      // If user doesn't exist in database, create them
      if (!user) {
        try {
          // Create user with basic data from authentication
          const userData = {
            id: userId,
            email: null, // Will be populated from Clerk webhooks
            firstName: null,
            lastName: null,
            profileImageUrl: null,
            plan: 'free',
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            settings: null
          };
          user = await storage.upsertUser(userData);
          console.log(`Created new user in database: ${userId}`);
        } catch (error) {
          console.error('Error creating user in database:', error);
          return res.status(500).json({ 
            message: 'Failed to create user account'
          });
        }
      }

      return res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      return res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update user data (including currency)
  app.put('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { currency, ...otherFields } = req.body;
      
      // Validate currency if provided
      if (currency && typeof currency !== 'string') {
        return res.status(400).json({ message: "Invalid currency format" });
      }

      const updateData: any = { ...otherFields };
      if (currency) {
        updateData.currency = currency;
      }

      const updatedUser = await storage.updateUser(userId, updateData);
      
      return res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      return res.status(500).json({ message: "Failed to update user" });
    }
  });
}