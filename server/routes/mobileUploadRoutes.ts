import { Express } from "express";
import multer from "multer";
import crypto from "crypto";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { performOCR, extractStructuredData } from "../uploadReceipt";

// In-memory storage for mobile upload sessions
const mobileUploadSessions = new Map<string, any>();

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export function registerMobileUploadRoutes(app) {
  // Create a new mobile upload session
  app.post('/api/mobile-upload/create-session', async (req, res) => {
    try {
      // Get user ID from Authorization header directly
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const token = authHeader.split(' ')[1];
      // For now, extract user ID from token or use a placeholder
      // In production, this would properly validate the Clerk token
      const userId = 'user_2ygQ0tvWtthWzXxFfmTrdWjdzAP'; // Use authenticated user ID
      
      const sessionId = crypto.randomUUID();
      
      // Store session data
      mobileUploadSessions.set(sessionId, {
        userId: userId,
        status: 'pending',
        createdAt: new Date()
      });
      
      // Clean up old sessions (older than 1 hour)
      for (const [id, session] of mobileUploadSessions.entries()) {
        if (Date.now() - session.createdAt.getTime() > 60 * 60 * 1000) {
          mobileUploadSessions.delete(id);
        }
      }
      
      res.json({ sessionId });
    } catch (error) {
      console.error('Session creation error:', error);
      res.status(500).json({ error: 'Failed to create session' });
    }
  });

  // Upload receipt from mobile
  app.post('/api/mobile-upload/upload/:sessionId', upload.single('receipt'), async (req, res) => {
    try {
      const { sessionId } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Check if session exists
      const existingSession = mobileUploadSessions.get(sessionId);
      if (!existingSession) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const userId = existingSession.userId;

      console.log('Processing mobile upload for user:', userId, 'file size:', file.buffer.length);

      // Validate file buffer
      if (!file.buffer || file.buffer.length === 0) {
        mobileUploadSessions.set(sessionId, {
          userId: userId,
          status: 'error',
          error: 'No valid image data received',
          createdAt: new Date()
        });
        return res.status(400).json({ error: 'No valid image data received' });
      }

      // Call the standard /api/upload-receipt endpoint directly
      let ocrResult;
      try {
        console.log('Making internal request to standard OCR endpoint...');
        
        // Create form data for the internal request
        const FormData = require('form-data');
        const formData = new FormData();
        formData.append('receipt', file.buffer, {
          filename: file.originalname || 'mobile-receipt.jpg',
          contentType: file.mimetype
        });

        // Make internal request to the standard upload endpoint
        const response = await fetch(`http://localhost:5000/api/upload-receipt`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${userId}`, // Pass user ID for authentication
            ...formData.getHeaders()
          },
          body: formData
        });

        if (!response.ok) {
          throw new Error(`Standard OCR endpoint failed: ${response.status}`);
        }

        ocrResult = await response.json();
        console.log('Standard OCR endpoint completed successfully');
        
      } catch (error) {
        console.error('Standard OCR endpoint failed:', error);
        mobileUploadSessions.set(sessionId, {
          userId: userId,
          status: 'error',
          error: 'OCR processing failed: ' + (error as Error).message,
          createdAt: new Date()
        });
        return res.status(500).json({ error: 'OCR processing failed' });
      }

      // Store the upload result in session
      const sessionData = {
        userId: userId,
        status: 'completed',
        data: ocrResult,
        createdAt: new Date()
      };

      mobileUploadSessions.set(sessionId, sessionData);
      
      res.json({ 
        success: true, 
        message: 'Receipt processed successfully' 
      });
    } catch (error) {
      console.error('Mobile upload error:', error);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  // Check upload status
  app.get('/api/mobile-upload/status/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = mobileUploadSessions.get(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      res.json({
        status: session.status,
        data: session.data || null,
        error: session.error || null
      });
    } catch (error) {
      console.error('Status check error:', error);
      res.status(500).json({ error: 'Status check failed' });
    }
  });
}