import { ClerkExpressWithAuth } from '@clerk/clerk-sdk-node';
import type { Request, Response, NextFunction } from 'express';

if (!process.env.CLERK_SECRET_KEY) {
  throw new Error('CLERK_SECRET_KEY must be set');
}

// Initialize Clerk middleware
export const clerkMiddleware = ClerkExpressWithAuth();

// Enhanced request interface with Clerk auth
export interface AuthenticatedRequest extends Request {
  auth: {
    userId: string | null;
    sessionId: string | null;
    getToken: (options?: any) => Promise<string | null>;
  };
}

// Authentication middleware that ensures user is logged in
export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.auth?.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};

// Plan-based authorization middleware
export const requirePlan = (requiredPlan: 'standard' | 'premium') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth?.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      // Get user from database to check their plan
      const { storage } = await import('./storage');
      const user = await storage.getUser(req.auth.userId);
      
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      const planHierarchy = { free: 0, standard: 1, premium: 2 };
      const userLevel = planHierarchy[user.plan as keyof typeof planHierarchy] ?? 0;
      const requiredLevel = planHierarchy[requiredPlan];

      if (userLevel < requiredLevel) {
        return res.status(403).json({ 
          message: `${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} plan required` 
        });
      }

      next();
    } catch (error) {
      console.error('Error checking user plan:', error);
      res.status(500).json({ message: 'Server error' });
    }
  };
};