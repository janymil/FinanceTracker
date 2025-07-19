import { clerkMiddleware, requireAuth } from '@clerk/express';
import type { Request, Response, NextFunction } from 'express';

export const setupClerkAuth = (app: any) => {
  console.log('Setting up Clerk middleware with keys:', {
    publishable: process.env.VITE_CLERK_PUBLISHABLE_KEY?.substring(0, 20) + '...',
    secret: process.env.CLERK_SECRET_KEY?.substring(0, 20) + '...'
  });
  
  // Add Clerk middleware only for routes that need authentication
  app.use((req: any, res: any, next: any) => {
    // Skip Clerk middleware for static assets, webhooks, and public SEO routes
    if (req.path.startsWith('/uploads/') ||
        req.path.startsWith('/api/clerk-webhooks') ||
        req.path.startsWith('/api/stripe-webhook') ||
        req.path.includes('.') || // Static files (css, js, images, etc.)
        req.path === '/robots.txt' ||
        req.path === '/sitemap.xml') {
      return next();
    }
    
    // Apply Clerk middleware for protected routes and API endpoints that need auth
    clerkMiddleware({
      publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY,
      secretKey: process.env.CLERK_SECRET_KEY,
    })(req, res, next);
  });
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
    if ((error as Error).message?.includes('User not found') || (error as Error).message?.includes('deleted')) {
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