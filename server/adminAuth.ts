import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

// Admin authentication middleware using secure environment variable
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  console.warn('ADMIN_PASSWORD environment variable is not set - legacy admin login will be disabled until configured.');
}

interface AdminRequest extends Request {
  session: any;
}

/** Constant-time comparison; hashing first makes both inputs the same length. */
function passwordMatches(candidate: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(candidate).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export const adminAuth = (req: AdminRequest, res: Response, next: NextFunction) => {
  if (req.session?.isAdminAuthenticated) {
    return next();
  }

  return res.status(401).json({ message: 'Admin authentication required' });
};

export const adminLogin = async (req: AdminRequest, res: Response) => {
  const password = req.body?.password;

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ message: 'Password required' });
  }

  if (!ADMIN_PASSWORD || !passwordMatches(password, ADMIN_PASSWORD)) {
    console.warn('Invalid admin login attempt');
    return res.status(401).json({ message: 'Invalid admin password' });
  }

  // A fresh session id on login, so a session id planted before login is worthless.
  const markAuthenticated = () => {
    req.session.isAdminAuthenticated = true;
    return res.json({ message: 'Admin login successful' });
  };

  if (typeof req.session?.regenerate === 'function') {
    return req.session.regenerate((error: unknown) => {
      if (error) {
        console.error('Admin session regenerate failed:', error);
        return res.status(500).json({ message: 'Login failed' });
      }
      return markAuthenticated();
    });
  }

  if (!req.session) {
    req.session = {};
  }
  return markAuthenticated();
};

export const adminLogout = (req: AdminRequest, res: Response) => {
  if (typeof req.session?.destroy === 'function') {
    return req.session.destroy(() => res.json({ message: 'Admin logged out successfully' }));
  }
  if (req.session) {
    req.session.isAdminAuthenticated = false;
  }
  return res.json({ message: 'Admin logged out successfully' });
};
