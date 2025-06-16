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
      const stats = await storage.getUserTransactionStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user stats for admin:", error);
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });

  // Admin analytics - get system overview
  app.get('/api/admin-analytics/overview', requireAdminAuth, async (req: AdminRequest, res: Response) => {
    try {
      const overview = await storage.getSystemOverview();
      res.json(overview);
    } catch (error) {
      console.error("Error fetching system overview for admin:", error);
      res.status(500).json({ message: "Failed to fetch system overview" });
    }
  });

  // Admin analytics - get category usage stats
  app.get('/api/admin-analytics/categories', requireAdminAuth, async (req: AdminRequest, res: Response) => {
    try {
      const categoryStats = await storage.getCategoryUsageStats();
      res.json(categoryStats);
    } catch (error) {
      console.error("Error fetching category stats for admin:", error);
      res.status(500).json({ message: "Failed to fetch category stats" });
    }
  });

  // Admin analytics - get subscription plan distribution
  app.get('/api/admin-analytics/plans', requireAdminAuth, async (req: AdminRequest, res: Response) => {
    try {
      const planStats = await storage.getPlanDistribution();
      res.json(planStats);
    } catch (error) {
      console.error("Error fetching plan stats for admin:", error);
      res.status(500).json({ message: "Failed to fetch plan stats" });
    }
  });

  // Admin analytics - get recent activity
  app.get('/api/admin-analytics/activity', requireAdminAuth, async (req: AdminRequest, res: Response) => {
    try {
      const activity = await storage.getRecentActivity();
      res.json(activity);
    } catch (error) {
      console.error("Error fetching recent activity for admin:", error);
      res.status(500).json({ message: "Failed to fetch recent activity" });
    }
  });

  // Admin analytics - get financial insights
  app.get('/api/admin-analytics/insights', requireAdminAuth, async (req: AdminRequest, res: Response) => {
    try {
      const insights = await storage.getFinancialInsights();
      res.json(insights);
    } catch (error) {
      console.error("Error fetching financial insights for admin:", error);
      res.status(500).json({ message: "Failed to fetch financial insights" });
    }
  });
}