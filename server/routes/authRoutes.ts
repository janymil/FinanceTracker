import type { Express } from "express";
import { setupClerkAuth, isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";

export function registerAuthRoutes(app: Express) {
  // Auth middleware
  setupClerkAuth(app);

  // Explicitly block old auth endpoints that no longer exist
  app.get('/api/login', (req, res) => {
    return res.status(404).json({ error: 'Login endpoint no longer exists. Please use /sign-in-clerk' });
  });
  
  app.get('/api/logout', (req, res) => {
    return res.status(404).json({ error: 'Logout endpoint no longer exists. Please use Clerk sign out' });
  });
  
  app.get('/api/callback', (req, res) => {
    return res.status(404).json({ error: 'Callback endpoint no longer exists. Authentication handled by Clerk' });
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      if (!userId) {
        return res.status(401).json({ message: "No user ID found" });
      }

      let user = await storage.getUser(userId);
      
      // If user doesn't exist, check if they were deleted from Clerk
      if (!user) {
        try {
          // Get user data from Clerk API directly since req.auth().user might be incomplete
          const { createClerkClient } = await import('@clerk/backend');
          const clerkClient = createClerkClient({ 
            secretKey: process.env.CLERK_SECRET_KEY 
          });
          
          const clerkUser = await clerkClient.users.getUser(userId);
          if (!clerkUser) {
            console.log(`User ${userId} not found in Clerk - account likely deleted`);
            return res.status(401).json({ 
              message: 'User account no longer exists',
              redirectToAuth: true 
            });
          }
          
          const primaryEmail = clerkUser.emailAddresses?.find(email => 
            email.id === clerkUser.primaryEmailAddressId
          )?.emailAddress;
          
          const userData = {
            id: userId,
            email: primaryEmail || null,
            firstName: clerkUser.firstName || null,
            lastName: clerkUser.lastName || null,
            profileImageUrl: clerkUser.imageUrl || null,
            plan: 'free',
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            settings: null
          };
          user = await storage.upsertUser(userData);
          console.log(`Created user from Clerk API: ${userId} - ${primaryEmail} (${clerkUser.firstName} ${clerkUser.lastName})`);
        } catch (error) {
          console.error('Error creating user from Clerk data:', error);
          // If this fails, the user likely doesn't exist in Clerk anymore
          return res.status(401).json({ 
            message: 'User account no longer exists',
            redirectToAuth: true 
          });
          const userData = {
            id: userId,
            email: null,
            firstName: null,
            lastName: null,
            profileImageUrl: null,
            plan: 'free',
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            settings: null
          };
          user = await storage.upsertUser(userData);
        }
      }

      return res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      return res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}