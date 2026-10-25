import { log } from '../logger';
import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage.js";
import { adminAuth, adminLogin, adminLogout } from "../adminAuth.js";
import { rateLimit } from "../middleware/rateLimit";
import { db } from "../db.js";
import { blockedCountries } from "../../shared/schema.ts";
import {
  AI_ACTION_WEIGHTS,
  AI_QUOTAS,
  QUOTA_WARNING_RATIO,
  monthStart,
  nextResetAt,
  quotaForPlan,
  weightFor,
  type QuotaPlan,
} from "../../shared/aiQuota";

import { eq } from "drizzle-orm";

export function registerAdminRoutes(app: Express) {
  // Admin login
  app.post(
    '/api/admin-analytics/login',
    rateLimit({ windowMs: 15 * 60 * 1000, max: 5, keyPrefix: 'admin-login', message: 'Too many login attempts. Try again in 15 minutes.' }),
    adminLogin
  );

  // Admin logout
  app.post('/api/admin-analytics/logout', adminLogout);

  // Check admin auth status
  app.get('/api/admin-analytics/auth-status', (req: any, res: Response) => {
    if (!req.session) {
      req.session = {};
    }
    return res.json({ authenticated: !!req.session?.isAdminAuthenticated });
  });

  // Admin dashboard - get all users with payment details
  app.get('/api/admin-analytics/users', adminAuth, async (req: any, res: Response) => {
    try {
      const usersWithPaymentData = await storage.getAdminUserPaymentDetails();
      log.info(`Admin analytics - Fetched ${usersWithPaymentData.length} users with payment data`);
      return res.json(usersWithPaymentData);
    } catch (error) {
      console.error("Error fetching users with payment data for admin:", error);
      return res.status(500).json({ message: "Failed to fetch users with payment data" });
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
      console.error("Error fetching user stats for admin:", error);
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
            log.info(`Synced user ${user.id} with Clerk data: ${primaryEmail}`);
          }
        } catch (userError: any) {
          console.error(`Failed to sync user ${user.id}:`, userError);
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
      console.error("Error syncing users with Clerk:", error);
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
      console.error("Error updating user plan:", error);
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
      console.error("Error fetching system overview for admin:", error);
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
      console.error("Error updating user:", error);
      return res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Admin - delete user
  app.delete('/api/admin-analytics/users/:userId', adminAuth, async (req: any, res: Response) => {
    try {
      const { userId } = req.params;
      log.info(`Admin attempting to delete user: ${userId}`);
      
      // Check if user exists first
      const user = await storage.getUser(userId);
      if (!user) {
        log.info(`User ${userId} not found in database`);
        return res.status(404).json({ 
          success: false, 
          message: "User not found" 
        });
      }
      
      log.info(`Deleting user: ${userId} (${user.email})`);
      await storage.deleteUserCompletely(userId);
      log.info(`Successfully deleted user: ${userId}`);
      
      return res.json({ 
        success: true, 
        message: "User deleted successfully"
      });
    } catch (error: any) {
      console.error("Error deleting user:", error);
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
      console.error("Error fetching plan stats for admin:", error);
      return res.status(500).json({ message: "Failed to fetch plan stats" });
    }
  });

  // === AI CACHE MANAGEMENT ROUTES ===

  // Get global AI cache statistics
  app.get('/api/admin-analytics/ai-cache/global', adminAuth, async (req: any, res: Response) => {
    try {
      const { UnifiedAICache } = await import('../../lib/unifiedAICache');
      const globalStats = await UnifiedAICache.getGlobalStats();
      
      // Get cache entries by function
      const entries = await storage.getAllAICacheEntries();
      const functionStats = entries.reduce((acc, entry) => {
        if (!acc[entry.functionKey]) {
          acc[entry.functionKey] = {
            totalEntries: 0,
            totalHits: 0,
            errorEntries: 0,
            avgHitsPerEntry: 0
          };
        }
        acc[entry.functionKey].totalEntries++;
        acc[entry.functionKey].totalHits += entry.hitCount;
        if (entry.isError) acc[entry.functionKey].errorEntries++;
        return acc;
      }, {} as Record<string, any>);

      // Calculate averages
      Object.keys(functionStats).forEach(key => {
        functionStats[key].avgHitsPerEntry = functionStats[key].totalEntries > 0 
          ? Math.round((functionStats[key].totalHits / functionStats[key].totalEntries) * 100) / 100
          : 0;
      });

      return res.json({
        ...globalStats,
        functionStats
      });
    } catch (error) {
      console.error("Error fetching AI cache global stats:", error);
      return res.status(500).json({ message: "Failed to fetch AI cache stats" });
    }
  });

  // Get AI cache statistics by function
  app.get('/api/admin-analytics/ai-cache/functions', adminAuth, async (req: any, res: Response) => {
    try {
      const entries = await storage.getAllAICacheEntries();
      
      const functionStats = entries.reduce((acc, entry) => {
        if (!acc[entry.functionKey]) {
          acc[entry.functionKey] = {
            functionKey: entry.functionKey,
            totalEntries: 0,
            totalHits: 0,
            errorEntries: 0,
            users: new Set(),
            avgHitsPerEntry: 0,
            lastAccessed: null,
            oldestEntry: null,
            newestEntry: null
          };
        }
        
        const stat = acc[entry.functionKey];
        stat.totalEntries++;
        stat.totalHits += entry.hitCount;
        if (entry.isError) stat.errorEntries++;
        stat.users.add(entry.userId);
        
        if (!stat.lastAccessed || entry.lastAccessed > stat.lastAccessed) {
          stat.lastAccessed = entry.lastAccessed;
        }
        if (!stat.oldestEntry || entry.createdAt < stat.oldestEntry) {
          stat.oldestEntry = entry.createdAt;
        }
        if (!stat.newestEntry || entry.createdAt > stat.newestEntry) {
          stat.newestEntry = entry.createdAt;
        }
        
        return acc;
      }, {} as Record<string, any>);

      // Convert Set to count and calculate averages
      const result = Object.values(functionStats).map((stat: any) => ({
        ...stat,
        uniqueUsers: stat.users.size,
        avgHitsPerEntry: stat.totalEntries > 0 
          ? Math.round((stat.totalHits / stat.totalEntries) * 100) / 100
          : 0,
        users: undefined // Remove Set object
      }));

      return res.json(result);
    } catch (error) {
      console.error("Error fetching AI cache function stats:", error);
      return res.status(500).json({ message: "Failed to fetch AI cache function stats" });
    }
  });

  // Get AI cache statistics by user
  app.get('/api/admin-analytics/ai-cache/users', adminAuth, async (req: any, res: Response) => {
    try {
      const entries = await storage.getAllAICacheEntries();
      const users = await storage.getAllUsers();
      
      const userCacheStats = entries.reduce((acc, entry) => {
        if (!acc[entry.userId]) {
          acc[entry.userId] = {
            userId: entry.userId,
            totalEntries: 0,
            totalHits: 0,
            errorEntries: 0,
            functions: new Set(),
            avgHitsPerEntry: 0,
            lastAccessed: null
          };
        }
        
        const stat = acc[entry.userId];
        stat.totalEntries++;
        stat.totalHits += entry.hitCount;
        if (entry.isError) stat.errorEntries++;
        stat.functions.add(entry.functionKey);
        
        if (!stat.lastAccessed || entry.lastAccessed > stat.lastAccessed) {
          stat.lastAccessed = entry.lastAccessed;
        }
        
        return acc;
      }, {} as Record<string, any>);

      // Add user details and calculate averages
      const result = Object.values(userCacheStats).map((stat: any) => {
        const user = users.find(u => u.id === stat.userId);
        return {
          ...stat,
          userEmail: user?.email || 'Unknown',
          userPlan: user?.plan || 'free',
          uniqueFunctions: stat.functions.size,
          avgHitsPerEntry: stat.totalEntries > 0 
            ? Math.round((stat.totalHits / stat.totalEntries) * 100) / 100
            : 0,
          functions: undefined // Remove Set object
        };
      });

      return res.json(result);
    } catch (error) {
      console.error("Error fetching AI cache user stats:", error);
      return res.status(500).json({ message: "Failed to fetch AI cache user stats" });
    }
  });

  // Clear AI cache by function
  app.delete('/api/admin-analytics/ai-cache/function/:functionKey', adminAuth, async (req: any, res: Response) => {
    try {
      const { functionKey } = req.params;
      const { UnifiedAICache } = await import('../../lib/unifiedAICache');
      
      const deletedCount = await UnifiedAICache.clearFunctionCache(functionKey);
      
      log.info(`Admin cleared ${deletedCount} cache entries for function: ${functionKey}`);
      return res.json({ 
        success: true, 
        deletedCount,
        message: `Cleared ${deletedCount} cache entries for function ${functionKey}` 
      });
    } catch (error) {
      console.error("Error clearing AI cache by function:", error);
      return res.status(500).json({ message: "Failed to clear cache by function" });
    }
  });

  // Clear AI cache by user
  app.delete('/api/admin-analytics/ai-cache/user/:userId', adminAuth, async (req: any, res: Response) => {
    try {
      const { userId } = req.params;
      const { UnifiedAICache } = await import('../../lib/unifiedAICache');
      
      const deletedCount = await UnifiedAICache.clearUserCache(userId);
      
      log.info(`Admin cleared ${deletedCount} cache entries for user: ${userId}`);
      return res.json({ 
        success: true, 
        deletedCount,
        message: `Cleared ${deletedCount} cache entries for user ${userId}` 
      });
    } catch (error) {
      console.error("Error clearing AI cache by user:", error);
      return res.status(500).json({ message: "Failed to clear cache by user" });
    }
  });

  // Clean up expired cache entries
  app.delete('/api/admin-analytics/ai-cache/expired', adminAuth, async (req: any, res: Response) => {
    try {
      const { UnifiedAICache } = await import('../../lib/unifiedAICache');
      
      const deletedCount = await UnifiedAICache.cleanupExpired();
      
      log.info(`Admin cleaned up ${deletedCount} expired cache entries`);
      return res.json({ 
        success: true, 
        deletedCount,
        message: `Cleaned up ${deletedCount} expired cache entries` 
      });
    } catch (error) {
      console.error("Error cleaning up expired cache:", error);
      return res.status(500).json({ message: "Failed to clean up expired cache" });
    }
  });

  // Get current TTL configuration
  app.get('/api/admin-analytics/ai-cache/ttl-config', adminAuth, async (req: any, res: Response) => {
    try {
      // Return the current TTL configuration from UnifiedAICache
      const defaultTTLConfig = {
        'financial-tips': 168, // 7 days
        'daily-recommendations': 24, // 1 day
        'contextual-tips': 72, // 3 days
        'expense-predictions': 48, // 2 days
        'financial-health-score': 24, // 1 day
        'spending-insights': 72, // 3 days
        'trend-predictions': 48, // 2 days
      };
      
      return res.json(defaultTTLConfig);
    } catch (error) {
      console.error("Error fetching TTL config:", error);
      return res.status(500).json({ message: "Failed to fetch TTL configuration" });
    }
  });

  // === AI FUNCTIONS USAGE STATISTICS ROUTES ===

  // Get AI function usage statistics for admin
  app.get('/api/admin-analytics/ai-functions/stats', adminAuth, async (req: any, res: Response) => {
    try {
      const stats = await storage.getAIUsageByFunction();
      return res.json(stats);
    } catch (error) {
      console.error("Error fetching AI function stats:", error);
      return res.status(500).json({ message: "Failed to fetch AI function statistics" });
    }
  });

  // Get AI usage statistics by user for admin
  app.get('/api/admin-analytics/ai-functions/users', adminAuth, async (req: any, res: Response) => {
    try {
      const stats = await storage.getAIUsageByUser();
      return res.json(stats);
    } catch (error) {
      console.error("Error fetching AI user stats:", error);
      return res.status(500).json({ message: "Failed to fetch AI user statistics" });
    }
  });

  // Get global AI usage statistics for admin
  app.get('/api/admin-analytics/ai-functions/global', adminAuth, async (req: any, res: Response) => {
    try {
      // Get current month stats
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const monthlyStats = await storage.getGlobalAIUsageSummary('month');
      const allTimeStats = await storage.getGlobalAIUsageSummary('all');
      
      // Get user count from users table
      const users = await storage.getAllUsers();
      const aiUsers = new Set();
      
      // Count unique AI users
      const aiUsageRecords = await storage.getAllAIUsage(10000, 0);
      aiUsageRecords.forEach(record => aiUsers.add(record.userId));

      return res.json({
        monthlyApiCalls: monthlyStats.totalRequests,
        monthlyCost: monthlyStats.totalCost,
        monthlyUniqueUsers: aiUsers.size,
        errorRate: monthlyStats.totalRequests > 0 
          ? ((monthlyStats.totalRequests - monthlyStats.successfulRequests) / monthlyStats.totalRequests) * 100 
          : 0,
        allTimeApiCalls: allTimeStats.totalRequests,
        allTimeCost: allTimeStats.totalCost,
        totalUsers: users.length
      });
    } catch (error) {
      console.error("Error fetching global AI stats:", error);
      return res.status(500).json({ message: "Failed to fetch global AI statistics" });
    }
  });

  // AI allowance for the month: per-plan totals, and the people closest to their cap.
  // The limits come from shared/aiQuota — the same numbers the customer sees in the app, so
  // this screen can never disagree with the meter.
  app.get('/api/admin-analytics/ai-functions/quota', adminAuth, async (_req: any, res: Response) => {
    try {
      const now = new Date();
      const rows = await storage.getAIQuotaUsageByUser(monthStart(now));

      // One accumulator per person, so the pool is counted across all functions together.
      const people = new Map<string, {
        userId: string;
        email: string | null;
        plan: string;
        calls: number;
        actions: number;
        cost: number;
      }>();

      for (const row of rows) {
        const entry = people.get(row.userId) ?? {
          userId: row.userId,
          email: row.email,
          plan: row.plan,
          calls: 0,
          actions: 0,
          cost: 0,
        };
        entry.calls += row.calls;
        entry.actions += row.calls * weightFor(row.functionName);
        entry.cost += row.cost;
        people.set(row.userId, entry);
      }

      const planOrder: QuotaPlan[] = ['free', 'standard', 'premium'];
      const plans = planOrder.map((plan) => {
        const monthlyLimit = quotaForPlan(plan).monthlyActions;
        const members = Array.from(people.values()).filter((person) => person.plan === plan);
        const actions = members.reduce((total, person) => total + person.actions, 0);
        const cost = members.reduce((total, person) => total + person.cost, 0);

        return {
          plan,
          monthlyLimit,
          users: members.length,
          calls: members.reduce((total, person) => total + person.calls, 0),
          actions,
          cost: Number(cost.toFixed(4)),
          avgActionsPerUser: members.length ? Math.round(actions / members.length) : 0,
          usersAtWarning: members.filter(
            (person) => monthlyLimit > 0 && person.actions / monthlyLimit >= QUOTA_WARNING_RATIO,
          ).length,
          usersAtLimit: members.filter(
            (person) => monthlyLimit > 0 && person.actions >= monthlyLimit,
          ).length,
        };
      });

      const topUsers = Array.from(people.values())
        .map((person) => {
          const monthlyLimit = quotaForPlan(person.plan).monthlyActions;
          return {
            ...person,
            monthlyLimit,
            remaining: Math.max(0, monthlyLimit - person.actions),
            percentUsed: monthlyLimit > 0
              ? Math.min(100, Math.round((person.actions / monthlyLimit) * 100))
              : 100,
            cost: Number(person.cost.toFixed(4)),
          };
        })
        .sort((a, b) => b.actions - a.actions)
        .slice(0, 15);

      return res.json({
        monthStart: monthStart(now).toISOString(),
        resetsAt: nextResetAt(now).toISOString(),
        warningRatio: QUOTA_WARNING_RATIO,
        quotas: AI_QUOTAS,
        actionWeights: AI_ACTION_WEIGHTS,
        plans,
        topUsers,
      });
    } catch (error) {
      console.error("Error fetching AI quota stats:", error);
      return res.status(500).json({ message: "Failed to fetch AI quota statistics" });
    }
  });

  // Get all AI usage limits
  app.get('/api/admin-analytics/ai-functions/limits', adminAuth, async (req: any, res: Response) => {
    try {
      const limits = await storage.getAllAIUsageLimits();
      return res.json(limits);
    } catch (error) {
      console.error("Error fetching AI usage limits:", error);
      return res.status(500).json({ message: "Failed to fetch AI usage limits" });
    }
  });

  // Set AI usage limit for a plan and function
  app.post('/api/admin-analytics/ai-functions/limits', adminAuth, async (req: any, res: Response) => {
    try {
      const { plan, functionName, monthlyRequestLimit, monthlyCostLimit, dailyRequestLimit, dailyCostLimit, cooldownSeconds, description } = req.body;
      
      if (!plan || !functionName) {
        return res.status(400).json({ message: "Plan and function name are required" });
      }

      const limit = await storage.setAIUsageLimit({
        plan,
        functionName,
        monthlyRequestLimit: monthlyRequestLimit || 0,
        monthlyCostLimit: monthlyCostLimit?.toString() || '0.00',
        dailyRequestLimit: dailyRequestLimit || 0,
        dailyCostLimit: dailyCostLimit?.toString() || '0.00',
        maxTokensPerRequest: 0,
        cooldownSeconds: cooldownSeconds || 0,
        isActive: true,
        resetDay: 1,
        description: description || null,
      });

      return res.json({ success: true, limit });
    } catch (error) {
      console.error("Error setting AI usage limit:", error);
      return res.status(500).json({ message: "Failed to set AI usage limit" });
    }
  });

  // Get user-specific AI overrides
  app.get('/api/admin-analytics/ai-functions/user-overrides', adminAuth, async (req: any, res: Response) => {
    try {
      const overrides = await storage.getAllAIUserOverrides();
      
      // Get user details for each override
      const users = await storage.getAllUsers();
      const userMap = new Map(users.map(u => [u.id, u]));
      
      const overridesWithUsers = overrides.map(override => ({
        ...override,
        userEmail: userMap.get(override.userId)?.email || 'Unknown',
        userPlan: userMap.get(override.userId)?.plan || 'free'
      }));

      return res.json(overridesWithUsers);
    } catch (error) {
      console.error("Error fetching AI user overrides:", error);
      return res.status(500).json({ message: "Failed to fetch AI user overrides" });
    }
  });

  // Set user-specific AI override
  app.post('/api/admin-analytics/ai-functions/user-overrides', adminAuth, async (req: any, res: Response) => {
    try {
      const { userId, functionName, monthlyRequestLimit, monthlyCostLimit, dailyRequestLimit, dailyCostLimit, cooldownSeconds, isBlocked, reason, expiresAt } = req.body;
      
      if (!userId || !functionName) {
        return res.status(400).json({ message: "User ID and function name are required" });
      }

      const override = await storage.setAIUserOverride({
        userId,
        functionName,
        monthlyRequestLimit: monthlyRequestLimit || null,
        monthlyCostLimit: monthlyCostLimit?.toString() || null,
        dailyRequestLimit: dailyRequestLimit || null,
        dailyCostLimit: dailyCostLimit?.toString() || null,
        maxTokensPerRequest: null,
        cooldownSeconds: cooldownSeconds || null,
        isBlocked: isBlocked || false,
        reason: reason || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: 'admin', // In a real app, this would be the admin user ID
      });

      return res.json({ success: true, override });
    } catch (error) {
      console.error("Error setting AI user override:", error);
      return res.status(500).json({ message: "Failed to set AI user override" });
    }
  });

  // Delete user-specific AI override
  app.delete('/api/admin-analytics/ai-functions/user-overrides/:userId/:functionName', adminAuth, async (req: any, res: Response) => {
    try {
      const { userId, functionName } = req.params;
      
      await storage.deleteAIUserOverride(userId, functionName);
      
      return res.json({ success: true, message: "User override deleted successfully" });
    } catch (error) {
      console.error("Error deleting AI user override:", error);
      return res.status(500).json({ message: "Failed to delete AI user override" });
    }
  });

  // Country Blocking Routes
  
  // Get all blocked countries
  app.get("/api/admin-analytics/blocked-countries", adminAuth, async (req: any, res: Response) => {
    try {
      const countries = await db.select()
        .from(blockedCountries)
        .orderBy(blockedCountries.countryName);

      res.json({ countries });
    } catch (error) {
      console.error("Error fetching blocked countries:", error);
      res.status(500).json({ error: "Failed to fetch blocked countries" });
    }
  });

  // Add a blocked country
  app.post("/api/admin-analytics/blocked-countries", adminAuth, async (req: any, res: Response) => {
    try {
      const { countryCode, countryName, reason } = req.body;

      if (!countryCode || !countryName) {
        return res.status(400).json({ error: "Country code and name are required" });
      }

      // Check if already blocked
      const existing = await db.select()
        .from(blockedCountries)
        .where(eq(blockedCountries.countryCode, countryCode.toUpperCase()))
        .limit(1);

      if (existing.length > 0) {
        return res.status(400).json({ error: "Country is already blocked" });
      }

      const [newCountry] = await db.insert(blockedCountries)
        .values({
          countryCode: countryCode.toUpperCase(),
          countryName,
          reason,
          blockedBy: req.session.adminUserId || 'admin'
        })
        .returning();

      // Cache invalidation removed for now

      res.json({ country: newCountry });
    } catch (error) {
      console.error("Error adding blocked country:", error);
      res.status(500).json({ error: "Failed to add blocked country" });
    }
  });

  // Remove a blocked country
  app.delete("/api/admin-analytics/blocked-countries/:countryCode", adminAuth, async (req: any, res: Response) => {
    try {
      const { countryCode } = req.params;

      const deleted = await db.delete(blockedCountries)
        .where(eq(blockedCountries.countryCode, countryCode.toUpperCase()))
        .returning();

      if (deleted.length === 0) {
        return res.status(404).json({ error: "Country not found" });
      }

      // Cache invalidation removed for now

      res.json({ success: true });
    } catch (error) {
      console.error("Error removing blocked country:", error);
      res.status(500).json({ error: "Failed to remove blocked country" });
    }
  });

  // Get common country codes for UI
  app.get("/api/admin-analytics/country-codes", adminAuth, async (req: any, res: Response) => {
    // Common countries with their ISO codes
    const countries = [
      { code: "AF", name: "Afghanistan" },
      { code: "AL", name: "Albania" },
      { code: "DZ", name: "Algeria" },
      { code: "AR", name: "Argentina" },
      { code: "AU", name: "Australia" },
      { code: "AT", name: "Austria" },
      { code: "BD", name: "Bangladesh" },
      { code: "BE", name: "Belgium" },
      { code: "BR", name: "Brazil" },
      { code: "BG", name: "Bulgaria" },
      { code: "CA", name: "Canada" },
      { code: "CL", name: "Chile" },
      { code: "CN", name: "China" },
      { code: "CO", name: "Colombia" },
      { code: "HR", name: "Croatia" },
      { code: "CZ", name: "Czech Republic" },
      { code: "DK", name: "Denmark" },
      { code: "EG", name: "Egypt" },
      { code: "FI", name: "Finland" },
      { code: "FR", name: "France" },
      { code: "DE", name: "Germany" },
      { code: "GR", name: "Greece" },
      { code: "HK", name: "Hong Kong" },
      { code: "HU", name: "Hungary" },
      { code: "IN", name: "India" },
      { code: "ID", name: "Indonesia" },
      { code: "IR", name: "Iran" },
      { code: "IQ", name: "Iraq" },
      { code: "IE", name: "Ireland" },
      { code: "IL", name: "Israel" },
      { code: "IT", name: "Italy" },
      { code: "JP", name: "Japan" },
      { code: "KE", name: "Kenya" },
      { code: "KP", name: "North Korea" },
      { code: "KR", name: "South Korea" },
      { code: "MY", name: "Malaysia" },
      { code: "MX", name: "Mexico" },
      { code: "NL", name: "Netherlands" },
      { code: "NZ", name: "New Zealand" },
      { code: "NG", name: "Nigeria" },
      { code: "NO", name: "Norway" },
      { code: "PK", name: "Pakistan" },
      { code: "PE", name: "Peru" },
      { code: "PH", name: "Philippines" },
      { code: "PL", name: "Poland" },
      { code: "PT", name: "Portugal" },
      { code: "RO", name: "Romania" },
      { code: "RU", name: "Russia" },
      { code: "SA", name: "Saudi Arabia" },
      { code: "RS", name: "Serbia" },
      { code: "SG", name: "Singapore" },
      { code: "SK", name: "Slovakia" },
      { code: "ZA", name: "South Africa" },
      { code: "ES", name: "Spain" },
      { code: "SE", name: "Sweden" },
      { code: "CH", name: "Switzerland" },
      { code: "TW", name: "Taiwan" },
      { code: "TH", name: "Thailand" },
      { code: "TR", name: "Turkey" },
      { code: "UA", name: "Ukraine" },
      { code: "AE", name: "United Arab Emirates" },
      { code: "GB", name: "United Kingdom" },
      { code: "US", name: "United States" },
      { code: "VN", name: "Vietnam" },
      { code: "ZW", name: "Zimbabwe" }
    ];

    res.json({ countries });
  });
}