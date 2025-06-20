import { storage } from "./storage";
import { clerkClient } from "@clerk/express";

// Cache to track when users were last synced to avoid excessive API calls
const lastSyncCache = new Map<string, number>();
const SYNC_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

export async function autoSyncUser(userId: string): Promise<void> {
  try {
    const now = Date.now();
    const lastSync = lastSyncCache.get(userId) || 0;
    
    // Skip if user was synced recently
    if (now - lastSync < SYNC_INTERVAL) {
      return;
    }
    
    // Get current user from local database
    const localUser = await storage.getUser(userId);
    if (!localUser) {
      console.log(`User ${userId} not found in local database, skipping sync`);
      return;
    }
    
    // Skip test users and placeholder accounts
    if (localUser.email?.includes('@clerk.user') || userId === 'test-user-123') {
      return;
    }
    
    // Get fresh data from Clerk
    const clerkUser = await clerkClient.users.getUser(userId);
    
    // Update local database if Clerk data is different
    const needsUpdate = 
      localUser.email !== clerkUser.emailAddresses[0]?.emailAddress ||
      localUser.firstName !== (clerkUser.firstName || '') ||
      localUser.lastName !== (clerkUser.lastName || '') ||
      localUser.profileImageUrl !== (clerkUser.imageUrl || null);
    
    if (needsUpdate) {
      await storage.updateUser(userId, {
        email: clerkUser.emailAddresses[0]?.emailAddress || localUser.email,
        firstName: clerkUser.firstName || '',
        lastName: clerkUser.lastName || '',
        profileImageUrl: clerkUser.imageUrl || null
      });
      
      console.log(`Auto-synced user ${userId}: ${clerkUser.firstName} ${clerkUser.lastName}`);
    }
    
    // Update cache
    lastSyncCache.set(userId, now);
    
  } catch (error) {
    console.error(`Failed to auto-sync user ${userId}:`, error);
  }
}

// Auto-sync all users in admin analytics
export async function autoSyncAllUsers(): Promise<void> {
  try {
    const users = await storage.getAllUsers();
    const syncPromises = users.map(user => autoSyncUser(user.id));
    await Promise.all(syncPromises);
  } catch (error) {
    console.error('Failed to auto-sync all users:', error);
  }
}