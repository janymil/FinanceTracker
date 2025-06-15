import { clerkMiddleware, requireAuth } from '@clerk/express';
import type { Request, Response, NextFunction } from 'express';

export const setupClerkAuth = (app: any) => {
  // Add Clerk middleware to handle authentication
  app.use(clerkMiddleware({
    secretKey: process.env.CLERK_SECRET_KEY,
    publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY,
    // Disable redirects for API routes
    signInUrl: '/auth',
    signUpUrl: '/auth',
    afterSignInUrl: '/',
    afterSignUpUrl: '/',
    // Configure for API usage
    apiRoutes: ['/api/*']
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