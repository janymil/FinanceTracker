import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { adminAuth, adminLogin, adminLogout } from "../adminAuth";

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
    return res.json({ authenticated: !!req.session?.isAdminAuthenticated });
  });

  // Admin dashboard - get all users
  app.get('/api/admin-analytics/users', adminAuth, async (req: any, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      return res.json(users);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch users" });
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
      return res.json(stats);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });

  // Admin - sync all users with Clerk data
  app.post('/api/admin-analytics/sync-clerk-users', adminAuth, async (req: any, res: Response) => {
    try {
      const { createClerkClient } = await import('@clerk/backend');
      const clerkClient = createClerkClient({ 
        secretKey: process.env.CLERK_SECRET_KEY 
      });

      const users = await storage.getAllUsers();
      const updatedUsers = [];
      let errors = [];

      for (const user of users) {
        try {
          // Fetch user data from Clerk API
          const clerkUser = await clerkClient.users.getUser(user.id);
          
          if (clerkUser) {
            const primaryEmail = clerkUser.emailAddresses?.find(email => 
              email.id === clerkUser.primaryEmailAddressId
            )?.emailAddress;
            
            const updatedUserData = {
              ...user,
              email: primaryEmail || user.email,
              firstName: clerkUser.firstName || user.firstName,
              lastName: clerkUser.lastName || user.lastName,
              profileImageUrl: clerkUser.imageUrl || user.profileImageUrl,
              updatedAt: new Date()
            };

            await storage.updateUser(user.id, updatedUserData);
            updatedUsers.push(user.id);
          }
        } catch (userError: any) {
          errors.push({ userId: user.id, error: userError.message });
        }
      }

      return res.json({
        success: true,
        updatedUsers: updatedUsers.length,
        totalUsers: users.length,
        errors: errors.length,
        details: errors
      });
    } catch (error: any) {
      return res.status(500).json({ 
        success: false, 
        message: "Failed to sync users with Clerk",
        error: error.message 
      });
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
      return res.json({ 
        success: true, 
        message: `User plan updated to ${plan}`,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          plan: updatedUser.plan
        }
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to update user plan" });
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
      return res.json(overview);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch system overview" });
    }
  });

  // Admin - update user data (edit user)
  app.put('/api/admin-analytics/users/:userId', adminAuth, async (req: any, res: Response) => {
    try {
      const { userId } = req.params;
      const { email, firstName, lastName, plan } = req.body;
      
      if (plan && !['free', 'standard', 'premium'].includes(plan)) {
        return res.status(400).json({ message: "Invalid plan. Must be 'free', 'standard', or 'premium'" });
      }

      const updatedUser = await storage.updateUser(userId, {
        email: email || null,
        firstName: firstName || null,
        lastName: lastName || null,
        plan: plan
      });
      
      return res.json({ 
        success: true, 
        message: "User updated successfully",
        user: updatedUser
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Admin - delete user
  app.delete('/api/admin-analytics/users/:userId', adminAuth, async (req: any, res: Response) => {
    try {
      const { userId } = req.params;
      
      // Check if user exists first
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: "User not found" 
        });
      }
      
      await storage.deleteUserCompletely(userId);
      
      return res.json({ 
        success: true, 
        message: "User deleted successfully"
      });
    } catch (error: any) {
      return res.status(500).json({ 
        success: false, 
        message: error.message || "Failed to delete user" 
      });
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
      return res.json(planStats);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch plan stats" });
    }
  });
}