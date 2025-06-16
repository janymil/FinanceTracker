import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { adminAuth, adminLogin, adminLogout } from "../adminAuth";

interface AdminRequest extends Request {
  session: any;
}

export function registerAdminRoutes(app: Express) {
  // Admin authentication middleware
  const requireAdminAuth = (req: AdminRequest, res: Response, next: NextFunction) => {
    if (!req.session?.adminAuthenticated) {
      return res.status(401).json({ message: "Admin authentication required" });
    }
    next();
  };

  // Admin login
  app.post('/api/admin-analytics/login', adminLogin, (req: AdminRequest, res: Response) => {
    res.json({ success: true, message: "Admin login successful" });
  });

  // Admin logout
  app.post('/api/admin-analytics/logout', adminLogout, (req: AdminRequest, res: Response) => {
    res.json({ success: true, message: "Admin logout successful" });
  });

  // Check admin auth status
  app.get('/api/admin-analytics/auth-status', (req: AdminRequest, res: Response) => {
    res.json({ authenticated: !!req.session?.adminAuthenticated });
  });

  // Admin dashboard - get all users
  app.get('/api/admin-analytics/users', requireAdminAuth, async (req: AdminRequest, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users for admin:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Admin analytics - get user transaction stats
  app.get('/api/admin-analytics/user-stats', requireAdminAuth, async (req: AdminRequest, res: Response) => {
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
  app.put('/api/admin-analytics/users/:userId/plan', requireAdminAuth, async (req: AdminRequest, res: Response) => {
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
  app.get('/api/admin-analytics/overview', requireAdminAuth, async (req: AdminRequest, res: Response) => {
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
  app.get('/api/admin-analytics/plans', requireAdminAuth, async (req: AdminRequest, res: Response) => {
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
}