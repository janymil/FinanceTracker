
import { clerkMiddleware, createClerkClient } from '@clerk/clerk-sdk-node';
import type { RequestHandler } from 'express';

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export const clerkAuth = clerkMiddleware();

export const isClerkAuthenticated: RequestHandler = async (req, res, next) => {
  try {
    const { userId } = req.auth || {};
    
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized - Clerk auth required" });
    }

    // Get user from Clerk
    const user = await clerk.users.getUser(userId);
    
    // Attach Clerk user to request
    (req as any).clerkUser = user;
    
    return next();
  } catch (error) {
    console.error('Clerk authentication error:', error);
    return res.status(401).json({ message: "Unauthorized - Clerk auth failed" });
  }
};

export async function upsertClerkUser(clerkUserId: string, clerkUser: any) {
  // This will be used to sync Clerk users with your database
  // Implementation depends on your storage layer
  console.log('Upserting Clerk user:', clerkUserId, clerkUser);
}
