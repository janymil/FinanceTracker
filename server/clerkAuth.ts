import { clerkMiddleware, requireAuth } from '@clerk/express';
import type { Request, Response, NextFunction } from 'express';

export const setupClerkAuth = (app: any) => {
  // Use CLERK_PUBLISHABLE_KEY in production, VITE_CLERK_PUBLISHABLE_KEY in development
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY;
  const secretKey = process.env.CLERK_SECRET_KEY;
  
  console.log('Setting up Clerk middleware with keys:', {
    publishable: publishableKey?.substring(0, 20) + '...',
    secret: secretKey?.substring(0, 20) + '...',
    environment: process.env.NODE_ENV
  });
  
  if (!publishableKey || !secretKey) {
    console.error('Missing Clerk keys:', {
      publishable: !!publishableKey,
      secret: !!secretKey
    });
    throw new Error('Clerk authentication keys are missing');
  }
  
  // Add Clerk middleware to handle authentication
  app.use(clerkMiddleware({
    publishableKey,
    secretKey
  }));
};

// Middleware to require authentication
export const isAuthenticated = (req: any, res: Response, next: NextFunction) => {
  try {
    // Use req.auth() as a function (new Clerk API)
    const auth = req.auth();
    
    // Check if user is authenticated via Clerk
    if (!auth || !auth.userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    // If this is a user deletion scenario, return 401 instead of 500
    if (error.message?.includes('User not found') || error.message?.includes('deleted')) {
      return res.status(401).json({ message: 'User account no longer exists' });
    }
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