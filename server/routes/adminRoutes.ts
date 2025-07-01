import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { adminAuth, adminLogin, adminLogout } from "../adminAuth";
import { 
  getBlockedCountriesInfo, 
  addBlockedCountry, 
  removeBlockedCountry, 
  isCountryBlocked,
  GEO_BLOCKING_CONFIG 
} from "../geoConfig";

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

  // Admin dashboard - get all users with payment details
  app.get('/api/admin-analytics/users', adminAuth, async (req: any, res: Response) => {
    try {
      const usersWithPaymentData = await storage.getAdminUserPaymentDetails();
      console.log(`Admin analytics - Fetched ${usersWithPaymentData.length} users with payment data`);
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
            console.log(`Synced user ${user.id} with Clerk data: ${primaryEmail}`);
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
      console.log(`Admin attempting to delete user: ${userId}`);
      
      // Check if user exists first
      const user = await storage.getUser(userId);
      if (!user) {
        console.log(`User ${userId} not found in database`);
        return res.status(404).json({ 
          success: false, 
          message: "User not found" 
        });
      }
      
      console.log(`Deleting user: ${userId} (${user.email})`);
      await storage.deleteUserCompletely(userId);
      console.log(`Successfully deleted user: ${userId}`);
      
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
      
      console.log(`Admin cleared ${deletedCount} cache entries for function: ${functionKey}`);
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
      
      console.log(`Admin cleared ${deletedCount} cache entries for user: ${userId}`);
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
      
      console.log(`Admin cleaned up ${deletedCount} expired cache entries`);
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

  // === GEO-BLOCKING MANAGEMENT ROUTES ===

  // Get geo-blocking configuration and blocked countries
  app.get('/api/admin-analytics/geo-blocking/config', adminAuth, async (req: any, res: Response) => {
    try {
      const config = {
        enabled: GEO_BLOCKING_CONFIG.enabled,
        blockedCountries: getBlockedCountriesInfo(),
        failOpen: GEO_BLOCKING_CONFIG.failOpen,
        customMessages: GEO_BLOCKING_CONFIG.customMessages
      };
      
      return res.json(config);
    } catch (error) {
      console.error("Error fetching geo-blocking config:", error);
      return res.status(500).json({ message: "Failed to fetch geo-blocking configuration" });
    }
  });

  // Add a country to the blocked list
  app.post('/api/admin-analytics/geo-blocking/block', adminAuth, async (req: any, res: Response) => {
    try {
      const { countryCode, countryName, reason } = req.body;
      
      if (!countryCode || !countryName) {
        return res.status(400).json({ message: "Country code and name are required" });
      }

      if (isCountryBlocked(countryCode.toUpperCase())) {
        return res.status(400).json({ message: "Country is already blocked" });
      }

      addBlockedCountry(countryCode.toUpperCase(), countryName, reason);
      
      console.log(`Admin blocked country: ${countryName} (${countryCode.toUpperCase()})`);
      return res.json({ 
        success: true, 
        message: `Successfully blocked ${countryName}`,
        blockedCountries: getBlockedCountriesInfo()
      });
    } catch (error) {
      console.error("Error blocking country:", error);
      return res.status(500).json({ message: "Failed to block country" });
    }
  });

  // Remove a country from the blocked list
  app.delete('/api/admin-analytics/geo-blocking/unblock/:countryCode', adminAuth, async (req: any, res: Response) => {
    try {
      const { countryCode } = req.params;
      
      const success = removeBlockedCountry(countryCode.toUpperCase());
      
      if (!success) {
        return res.status(404).json({ message: "Country not found in blocked list" });
      }

      console.log(`Admin unblocked country: ${countryCode.toUpperCase()}`);
      return res.json({ 
        success: true, 
        message: `Successfully unblocked ${countryCode.toUpperCase()}`,
        blockedCountries: getBlockedCountriesInfo()
      });
    } catch (error) {
      console.error("Error unblocking country:", error);
      return res.status(500).json({ message: "Failed to unblock country" });
    }
  });

  // Toggle geo-blocking system on/off
  app.post('/api/admin-analytics/geo-blocking/toggle', adminAuth, async (req: any, res: Response) => {
    try {
      const { enabled } = req.body;
      
      GEO_BLOCKING_CONFIG.enabled = Boolean(enabled);
      
      console.log(`Admin ${enabled ? 'enabled' : 'disabled'} geo-blocking system`);
      return res.json({ 
        success: true, 
        enabled: GEO_BLOCKING_CONFIG.enabled,
        message: `Geo-blocking ${enabled ? 'enabled' : 'disabled'}` 
      });
    } catch (error) {
      console.error("Error toggling geo-blocking:", error);
      return res.status(500).json({ message: "Failed to toggle geo-blocking" });
    }
  });

  // Update custom message for a blocked country
  app.put('/api/admin-analytics/geo-blocking/message/:countryCode', adminAuth, async (req: any, res: Response) => {
    try {
      const { countryCode } = req.params;
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ message: "Custom message is required" });
      }

      if (!isCountryBlocked(countryCode.toUpperCase())) {
        return res.status(404).json({ message: "Country is not blocked" });
      }

      GEO_BLOCKING_CONFIG.customMessages[countryCode.toUpperCase()] = message;
      
      console.log(`Admin updated custom message for ${countryCode.toUpperCase()}`);
      return res.json({ 
        success: true, 
        message: `Updated custom message for ${countryCode.toUpperCase()}` 
      });
    } catch (error) {
      console.error("Error updating custom message:", error);
      return res.status(500).json({ message: "Failed to update custom message" });
    }
  });
}