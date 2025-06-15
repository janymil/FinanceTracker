import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express): Promise<void> {
  // Configure session middleware
  app.use(session({
    store: new (require('connect-pg-simple')(session))({
      pool,
      tableName: 'sessions'
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    name: 'replit.sid',
    cookie: {
      secure: false, // Set to true in production with HTTPS
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: 'lax'
    }
  }));

  // Replit Auth middleware
  app.use(async (req: any, res, next) => {
    const userId = req.headers['x-replit-user-id'];
    const userName = req.headers['x-replit-user-name'];
    const userRoles = req.headers['x-replit-user-roles'];

    if (userId && userName) {
      try {
        // Store user data in session
        req.session.userId = userId;
        req.session.userName = userName;
        req.session.userRoles = userRoles || '';

        // Save session explicitly
        await new Promise((resolve, reject) => {
          req.session.save((err: any) => {
            if (err) reject(err);
            else resolve(undefined);
          });
        });

        // Upsert user to database
        const userData = {
          id: userId,
          email: userName.includes('@') ? userName : `${userName}@replit.com`,
          firstName: userName.split(' ')[0] || userName,
          lastName: userName.split(' ').slice(1).join(' ') || null,
          profileImageUrl: `https://replit.com/@${userName}/avatar`,
          plan: 'free',
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          settings: null
        };

        await storage.upsertUser(userData);

        // Set user object for routes
        req.user = {
          id: userId,
          claims: { sub: userId },
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName
        };

      } catch (error) {
        console.error('Error in auth middleware:', error);
      }
    } else if (req.session && req.session.userId) {
      // Use session data if headers are missing but session exists
      try {
        const user = await storage.getUser(req.session.userId);
        if (user) {
          req.user = {
            id: req.session.userId,
            claims: { sub: req.session.userId },
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName
          };
        } else {
          // Clear invalid session
          req.session.destroy(() => {});
        }
      } catch (error) {
        console.error('Error restoring user from session:', error);
        // Clear invalid session
        req.session.destroy(() => {});
      }
    }

    next();
  });

  // Login endpoint
  app.get('/api/login', (req, res) => {
    res.redirect('/auth');
  });

  // Logout endpoint
  app.post('/api/logout', (req: any, res) => {
    req.session.destroy((err: any) => {
      if (err) {
        console.error('Error destroying session:', err);
      }
      res.clearCookie('replit.sid');
      res.json({ success: true });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    return res.redirect("/api/login");
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    return res.redirect("/api/login");
  }
};