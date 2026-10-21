import { Request, Response, NextFunction } from 'express';

// Admin authentication middleware using secure environment variable
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  console.warn('ADMIN_PASSWORD environment variable is not set - legacy admin login will be disabled until configured.');
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
  
  console.log('Admin login attempt for FinanzerPro admin portal');
  
  if (!password) {
    return res.status(400).json({ message: 'Password required' });
  }
  
  // Initialize session if it doesn't exist
  if (!req.session) {
    req.session = {};
  }
  
  // Simple password check - in production, use hashed passwords
  if (ADMIN_PASSWORD && password === ADMIN_PASSWORD) {
    req.session.isAdminAuthenticated = true;
    console.log('Admin login successful, session updated');
    console.log('Session after login:', {
      sessionExists: !!req.session,
      isAuthenticated: req.session?.isAdminAuthenticated,
      sessionId: req.sessionID
    });
    return res.json({ message: 'Admin login successful' });
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