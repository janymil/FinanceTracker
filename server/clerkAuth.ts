import { clerkMiddleware, requireAuth } from '@clerk/express';
import type { Request, Response, NextFunction } from 'express';

export const setupClerkAuth = (app: any) => {
  // Use production keys in production environment
  const isProduction = process.env.NODE_ENV === 'production';
  const publishableKey = isProduction 
    ? process.env.VITE_CLERK_PUBLISHABLE_KEY_PROD || process.env.VITE_CLERK_PUBLISHABLE_KEY
    : process.env.VITE_CLERK_PUBLISHABLE_KEY;
  const secretKey = isProduction 
    ? process.env.CLERK_SECRET_KEY_PROD || process.env.CLERK_SECRET_KEY
    : process.env.CLERK_SECRET_KEY;

  console.log('Setting up Clerk middleware with keys:', {
    environment: isProduction ? 'production' : 'development',
    publishable: publishableKey?.substring(0, 20) + '...',
    secret: secretKey?.substring(0, 20) + '...'
  });
  
  if (!publishableKey || !secretKey) {
    throw new Error(`Missing Clerk keys for ${isProduction ? 'production' : 'development'} environment`);
  }
  
  // Add Clerk middleware to handle authentication
  app.use(clerkMiddleware({
    publishableKey,
    secretKey,
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