import { clerkMiddleware, requireAuth } from '@clerk/express';
import type { Request, Response, NextFunction } from 'express';

export const setupClerkAuth = (app: any) => {
  // Add Clerk middleware to handle authentication
  app.use(clerkMiddleware({
    publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  }));
};

// Middleware to require authentication
export const isAuthenticated = (req: any, res: Response, next: NextFunction) => {
  try {
    // Use req.auth() as a function (new Clerk API)
    const auth = req.auth();
    console.log('AUTH DEBUG: auth object:', auth);
    console.log('AUTH DEBUG: userId:', auth?.userId);
    console.log('AUTH DEBUG: headers:', req.headers.authorization);
    
    // Check if user is authenticated via Clerk
    if (!auth || !auth.userId) {
      console.log('AUTH DEBUG: Authentication failed - no userId');
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    console.log('AUTH DEBUG: Authentication successful for user:', auth.userId);
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Authentication failed' });
  }
};

// Helper to get user ID from Clerk
export const getUserId = (req: any): string | null => {
  try {
    const auth = req.auth();
    return auth?.userId || null;
  } catch (error) {
    return null;
  }
};

// Helper to get user ID and throw if not authenticated (for use after isAuthenticated middleware)
export const requireUserId = (req: any): string => {
  const userId = getUserId(req);
  if (!userId) {
    throw new Error('User ID not found after authentication');
  }
  return userId;
};