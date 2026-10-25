import { log } from '../logger';
import type { Express } from "express";
import { isValidTimeZone } from "@shared/timezones";
import { setupClerkAuth, isAuthenticated, getUserId } from "../clerkAuth";
import { storage, type ClerkProfile } from "../storage";
import { resolveStoredCurrency } from "../../shared/currencies";

let clerkClientPromise: Promise<any> | null = null;

async function getClerkClient() {
  if (!clerkClientPromise) {
    clerkClientPromise = import('@clerk/backend').then(({ createClerkClient }) =>
      createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
    );
  }
  return clerkClientPromise;
}

/**
 * Reads the authoritative identity from Clerk. Only a *verified* primary email is
 * returned, because it is used to match a Clerk login against an existing database
 * user (account re-linking) and must not be spoofable.
 */
export async function getVerifiedClerkProfile(userId: string): Promise<Partial<ClerkProfile> | null> {
  try {
    const client = await getClerkClient();
    const clerkUser = await client.users.getUser(userId);
    const primary = clerkUser?.emailAddresses?.find(
      (address: any) => address.id === clerkUser.primaryEmailAddressId
    );
    const isVerified = primary?.verification?.status === 'verified';

    return {
      email: isVerified ? primary?.emailAddress ?? null : null,
      firstName: clerkUser?.firstName ?? null,
      lastName: clerkUser?.lastName ?? null,
      profileImageUrl: clerkUser?.imageUrl ?? null,
    };
  } catch (error) {
    log.warn(`[AUTH] Could not load Clerk profile for ${userId}:`, (error as Error).message);
    return null;
  }
}

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

      let user = await storage.getUser(userId);

      // Rows created before the Clerk webhook was reachable carry a placeholder email
      // (`<clerk_id>@clerk.user`, see storage.upsertUser). Refresh those from Clerk so the
      // real identity is stored - and re-home existing data when Clerk reissued the user
      // id for the same verified email (deleted user, or database seeded from another
      // Clerk instance). Without this, such a login resolves to an empty account.
      const needsIdentitySync = !user || !user.email || user.email.endsWith('@clerk.user');

      if (needsIdentitySync) {
        const profile = await getVerifiedClerkProfile(userId);

        if (profile?.email) {
          const emailOwner = await storage.getUserByEmail(profile.email);
          if (emailOwner && emailOwner.id !== userId) {
            try {
              user = await storage.adoptUserAccount(emailOwner.id, userId, profile);
              log.info(`[AUTH] Re-linked data from ${emailOwner.id} to ${userId} (${profile.email})`);
            } catch (adoptionError) {
              log.error('[AUTH] Could not re-link existing account:', adoptionError);
            }
          }
        }

        // If user doesn't exist in database, create them
        if (!user) {
          try {
            // Create user with basic data from authentication
            const userData = {
              id: userId,
              email: profile?.email ?? null, // Populated from Clerk when available
              firstName: profile?.firstName ?? null,
              lastName: profile?.lastName ?? null,
              profileImageUrl: profile?.profileImageUrl ?? null,
              plan: 'free',
              stripeCustomerId: null,
              stripeSubscriptionId: null,
              settings: null,
              currency: null // Explicitly set to null to trigger currency setup modal
            };
            user = await storage.upsertUser(userData);
            log.info(`Created new user in database: ${userId}`);
          } catch (error) {
            log.error('Error creating user in database:', error);
            return res.status(500).json({ 
              message: 'Failed to create user account'
            });
          }
        } else if (profile?.email && user.email !== profile.email) {
          try {
            user = await storage.updateUser(userId, { email: profile.email });
          } catch (updateError) {
            log.warn(`[AUTH] Could not backfill email for ${userId}:`, (updateError as Error).message);
          }
        }
      }

      // Remember the language so reminder e-mails arrive in it.
      const headerLanguage = String(req.headers['x-user-language'] || '').toLowerCase().slice(0, 2);
      if (user && ['en', 'es', 'sk'].includes(headerLanguage) && (user as any).language !== headerLanguage) {
        try {
          user = await storage.updateUser(userId, { language: headerLanguage } as any);
        } catch (languageError) {
          log.warn('[AUTH] Could not store the language preference:', (languageError as Error).message);
        }
      }

      return res.json(user);
    } catch (error) {
      log.error("Error fetching user:", error);
      log.error("Stack trace:", (error as Error).stack);
      return res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update user data (including currency)
  app.put('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { currency, aiEnabled, emailNotifications, firstName, lastName, phone, website, timezone } = req.body ?? {};

      // Validate currency if provided
      if (currency !== undefined && typeof currency !== "string") {
        return res.status(400).json({ message: "Invalid currency format" });
      }

      // Explicit allow-list. The old handler spread the whole body into the update, which
      // let a request change its own `plan`, `stripeCustomerId` or `graceExpiresAt`.
      const updateData: any = {};
      if (typeof currency === "string") {
        // Stored as the ISO code. Older clients may still send a symbol; it is translated.
        const resolved = resolveStoredCurrency(currency);
        if (!resolved) {
          return res.status(400).json({ message: "Unsupported currency" });
        }
        // Amounts are stored without a currency, so switching it later would silently relabel the
        // person's whole history. The app already hides the switch once transactions exist.
        const current = await storage.getUser(userId);
        const storedCode = current?.currency ? resolveStoredCurrency(current.currency)?.code : null;
        if (storedCode && storedCode !== resolved.code && (await storage.countUserTransactions(userId)) > 0) {
          return res.status(409).json({ message: "The currency can't be changed after you have added transactions" });
        }
        updateData.currency = resolved.code;
      }
      if (timezone !== undefined) {
        if (!isValidTimeZone(timezone)) {
          return res.status(400).json({ message: "Unknown time zone" });
        }
        updateData.timezone = timezone;
      }
      if (typeof aiEnabled === "boolean") updateData.aiEnabled = aiEnabled;
      if (typeof emailNotifications === "boolean") updateData.emailNotifications = emailNotifications;
      for (const [key, value] of Object.entries({ firstName, lastName, phone, website })) {
        if (typeof value === "string") updateData[key] = value;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No supported fields to update" });
      }

      const updatedUser = await storage.updateUser(userId, updateData);
      
      return res.json(updatedUser);
    } catch (error) {
      log.error("Error updating user:", error);
      log.error("Stack trace:", (error as Error).stack);
      return res.status(500).json({ message: "Failed to update user" });
    }
  });
}