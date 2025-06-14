import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';

// Admin authentication middleware using secure environment variable
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  throw new Error('ADMIN_PASSWORD environment variable must be set for admin access');
}

interface AdminRequest extends Request {
  session: {
    isAdminAuthenticated?: boolean;
    [key: string]: any;
  };
}

export const adminAuth = (req: AdminRequest, res: Response, next: NextFunction) => {
  if (req.session?.isAdminAuthenticated) {
    return next();
  }
  
  res.status(401).json({ message: 'Admin authentication required' });
};

export const adminLogin = async (req: AdminRequest, res: Response) => {
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({ message: 'Password required' });
  }
  
  // Simple password check - in production, use hashed passwords
  if (password === ADMIN_PASSWORD) {
    req.session.isAdminAuthenticated = true;
    return res.json({ message: 'Admin login successful' });
  }
  
  res.status(401).json({ message: 'Invalid admin password' });
};

export const adminLogout = (req: AdminRequest, res: Response) => {
  req.session.isAdminAuthenticated = false;
  res.json({ message: 'Admin logged out successfully' });
};