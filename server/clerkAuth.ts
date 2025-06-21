import { clerkMiddleware, requireAuth } from '@clerk/express';
import type { Request, Response, NextFunction } from 'express';

export const setupClerkAuth = (app: any) => {
  console.log('Setting up Clerk middleware with keys:', {
    publishable: process.env.VITE_CLERK_PUBLISHABLE_KEY?.substring(0, 20) + '...',
    secret: process.env.CLERK_SECRET_KEY?.substring(0, 20) + '...'
  });
  
  // Add Clerk middleware to handle authentication
  app.use(clerkMiddleware({
    publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
    // Add production domain configuration
    domain: process.env.NODE_ENV === 'production' ? process.env.CLERK_DOMAIN : undefined,
    isSatellite: false,
    signInUrl: '/auth',
    afterSignInUrl: '/dashboard',
    afterSignUpUrl: '/dashboard'
  }));
};

// Middleware to require authentication
export const isAuthenticated = (req: any, res: Response, next: NextFunction) => {
  try {
    // Use req.auth() as a function (new Clerk API)
    const auth = req.auth();
    
    // Enhanced logging for production debugging
    console.log('Auth check:', {
      hasAuth: !!auth,
      hasUserId: !!auth?.userId,
      sessionId: auth?.sessionId?.substring(0, 10) + '...' || 'none',
      headers: {
        authorization: !!req.headers.authorization,
        'clerk-db-jwt': !!req.headers['clerk-db-jwt']
      },
      environment: process.env.NODE_ENV
    });
    
    // Check if user is authenticated via Clerk
    if (!auth || !auth.userId) {
      console.log('Authentication failed: No auth or userId');
      return res.status(401).json({ 
        message: 'Authentication required',
        redirect: '/auth',
        error: 'NO_AUTH'
      });
    }
    
    // Additional validation for production
    if (process.env.NODE_ENV === 'production') {
      if (!auth.sessionId) {
        console.log('Authentication failed: No session ID in production');
        return res.status(401).json({ 
          message: 'Invalid session',
          redirect: '/auth',
          error: 'NO_SESSION'
        });
      }
    }
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    // If this is a user deletion scenario, return 401 instead of 500
    if (error.message?.includes('User not found') || error.message?.includes('deleted')) {
      return res.status(401).json({ 
        message: 'User account no longer exists',
        redirect: '/auth',
        error: 'USER_DELETED'
      });
    }
    res.status(401).json({ 
      message: 'Authentication failed',
      redirect: '/auth',
      error: 'AUTH_ERROR'
    });
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