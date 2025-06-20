import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { adminAuth, adminLogin, adminLogout } from "../adminAuth";
import { clerkClient } from "@clerk/express";
import { autoSyncAllUsers } from "../autoSync";

export function registerAdminRoutes(app: Express) {
  // Admin login
  app.post('/api/admin-analytics/login', adminLogin);

  // Admin logout
  app.post('/api/admin-analytics/logout', adminLogout);

  // Check admin auth status
  app.get('/api/admin-analytics/auth-status', (req: any, res: Response) => {
    if (!req.session) {
      req.session = {};
    }
    res.json({ authenticated: !!req.session?.isAdminAuthenticated });
  });

  // Admin dashboard - get all users with automatic synchronization
  app.get('/api/admin-analytics/users', adminAuth, async (req: any, res: Response) => {
    try {
      // Automatically sync all users from Clerk before displaying
      await autoSyncAllUsers();
      
      const users = await storage.getAllUsers();
      console.log(`Admin analytics - Fetched ${users.length} users:`, users.map(u => ({ id: u.id, email: u.email, plan: u.plan })));
      res.json(users);
    } catch (error) {
      console.error("Error fetching users for admin:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Admin analytics - get user transaction stats
  app.get('/api/admin-analytics/user-stats', adminAuth, async (req: any, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      const stats = users.map(user => ({
        userId: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        plan: user.plan,
        transactionCount: 0 // Will be populated by separate query if needed
      }));
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user stats for admin:", error);
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });

  // Admin - update user subscription plan (MOST IMPORTANT FOR USER)
  app.put('/api/admin-analytics/users/:userId/plan', adminAuth, async (req: any, res: Response) => {
    try {
      const { userId } = req.params;
      const { plan } = req.body;
      
      if (!['free', 'standard', 'premium'].includes(plan)) {
        return res.status(400).json({ message: "Invalid plan. Must be 'free', 'standard', or 'premium'" });
      }

      const updatedUser = await storage.updateUserPlan(userId, plan);
      res.json({ 
        success: true, 
        message: `User plan updated to ${plan}`,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          plan: updatedUser.plan
        }
      });
    } catch (error) {
      console.error("Error updating user plan:", error);
      res.status(500).json({ message: "Failed to update user plan" });
    }
  });

  // Admin analytics - get system overview
  app.get('/api/admin-analytics/overview', adminAuth, async (req: any, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      const planCounts = users.reduce((acc, user) => {
        acc[user.plan] = (acc[user.plan] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const overview = {
        totalUsers: users.length,
        planDistribution: planCounts,
        activeUsers: users.filter(u => u.updatedAt && new Date(u.updatedAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length
      };
      res.json(overview);
    } catch (error) {
      console.error("Error fetching system overview for admin:", error);
      res.status(500).json({ message: "Failed to fetch system overview" });
    }
  });

  // Admin analytics - get subscription plan distribution
  app.get('/api/admin-analytics/plans', adminAuth, async (req: any, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      const planStats = users.reduce((acc, user) => {
        acc[user.plan] = (acc[user.plan] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      res.json(planStats);
    } catch (error) {
      console.error("Error fetching plan stats for admin:", error);
      res.status(500).json({ message: "Failed to fetch plan stats" });
    }
  });

  // Bulk sync all users from Clerk
  app.post('/api/admin-analytics/sync-users', adminAuth, async (req: any, res: Response) => {
    try {
      console.log("Starting bulk user sync from Clerk...");
      
      // Get all users from local database
      const localUsers = await storage.getAllUsers();
      console.log(`Found ${localUsers.length} users in local database`);
      
      let syncedCount = 0;
      let errorCount = 0;
      
      // Sync each user with Clerk data
      for (const localUser of localUsers) {
        try {
          // Skip test users with placeholder emails
          if (localUser.email?.includes('@clerk.user') || localUser.id === 'test-user-123') {
            console.log(`Skipping placeholder user: ${localUser.id}`);
            continue;
          }
          
          // Get user data from Clerk
          const clerkUser = await clerkClient.users.getUser(localUser.id);
          
          // Update local database with Clerk data
          await storage.updateUser(localUser.id, {
            email: clerkUser.emailAddresses[0]?.emailAddress || localUser.email,
            firstName: clerkUser.firstName || '',
            lastName: clerkUser.lastName || '',
            profileImageUrl: clerkUser.imageUrl || null
          });
          
          syncedCount++;
          console.log(`Synced user: ${localUser.id} - ${clerkUser.firstName} ${clerkUser.lastName}`);
          
        } catch (userError) {
          console.error(`Failed to sync user ${localUser.id}:`, userError);
          errorCount++;
        }
      }
      
      console.log(`Bulk sync completed. Synced: ${syncedCount}, Errors: ${errorCount}`);
      res.json({ 
        success: true, 
        message: `Bulk sync completed. Updated ${syncedCount} users with ${errorCount} errors.`,
        syncedCount,
        errorCount
      });
      
    } catch (error) {
      console.error("Error in bulk user sync:", error);
      res.status(500).json({ message: "Failed to sync users from Clerk" });
    }
  });
}