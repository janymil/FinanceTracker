import { Request, Response, NextFunction } from 'express';

// Admin authentication middleware using secure environment variable
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  throw new Error('ADMIN_PASSWORD environment variable must be set for admin access');
}

interface AdminRequest extends Request {
  session: any;
}

export const adminAuth = (req: AdminRequest, res: Response, next: NextFunction) => {
  // Initialize session if it doesn't exist
  if (!req.session) {
    req.session = {};
  }
  
  console.log('Admin auth check:', {
    sessionExists: !!req.session,
    isAuthenticated: req.session?.isAdminAuthenticated,
    sessionId: req.sessionID
  });
  
  if (req.session.isAdminAuthenticated) {
    return next();
  }
  
  return res.status(401).json({ message: 'Admin authentication required' });
};

export const adminLogin = async (req: AdminRequest, res: Response) => {
  const { password } = req.body;
  
  console.log('Admin login attempt:', { 
    hasPassword: !!password, 
    sessionExists: !!req.session,
    expectedPassword: !!ADMIN_PASSWORD,
    passwordLength: password?.length,
    envPasswordLength: ADMIN_PASSWORD?.length,
    actualPassword: password,
    actualEnv: ADMIN_PASSWORD
  });
  
  if (!password) {
    return res.status(400).json({ message: 'Password required' });
  }
  
  // Initialize session if it doesn't exist
  if (!req.session) {
    req.session = {};
  }
  
  // Simple password check - in production, use hashed passwords
  console.log('Password comparison:', { provided: password, expected: ADMIN_PASSWORD, match: password === ADMIN_PASSWORD });
  if (password === ADMIN_PASSWORD) {
    req.session.isAdminAuthenticated = true;
    req.session.save((err: any) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ message: 'Session save failed' });
      }
      console.log('Admin login successful, session saved');
      return res.json({ message: 'Admin login successful' });
    });
  } else {
    console.log('Invalid admin password provided');
    return res.status(401).json({ message: 'Invalid admin password' });
  }
};

export const adminLogout = (req: AdminRequest, res: Response) => {
  if (req.session) {
    req.session.isAdminAuthenticated = false;
  }
  return res.json({ message: 'Admin logged out successfully' });
};