import type { Express } from "express";
import { setupClerkAuth, isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";

export function registerAuthRoutes(app: Express) {
  // Auth middleware
  setupClerkAuth(app);

  // Explicitly block old auth endpoints that no longer exist
  app.get('/api/login', (req, res) => {
    res.status(404).json({ error: 'Login endpoint no longer exists. Please use /sign-in-clerk' });
  });
  
  app.get('/api/logout', (req, res) => {
    res.status(404).json({ error: 'Logout endpoint no longer exists. Please use Clerk sign out' });
  });
  
  app.get('/api/callback', (req, res) => {
    res.status(404).json({ error: 'Callback endpoint no longer exists. Authentication handled by Clerk' });
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
      
      // Get full user data from Clerk
      const { clerkClient } = await import('@clerk/express');
      let clerkUser;
      try {
        clerkUser = await clerkClient.users.getUser(userId);
      } catch (error) {
        console.error('Error fetching Clerk user:', error);
        clerkUser = null;
      }
      
      // Always sync latest Clerk data (for existing users) or create new user
      const userData = {
        id: userId,
        email: clerkUser?.emailAddresses?.[0]?.emailAddress || user?.email || `${userId}@clerk.user`,
        firstName: clerkUser?.firstName || null,
        lastName: clerkUser?.lastName || null,
        profileImageUrl: clerkUser?.imageUrl || null,
        plan: user?.plan || 'free',
        stripeCustomerId: user?.stripeCustomerId || null,
        stripeSubscriptionId: user?.stripeSubscriptionId || null,
        settings: user?.settings || null
      };
      user = await storage.upsertUser(userData);

      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}