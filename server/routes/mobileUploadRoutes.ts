import { Express } from "express";
import multer from "multer";
import crypto from "crypto";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { performOCR, extractStructuredData } from "../uploadReceipt";

// In-memory storage for mobile upload sessions
const mobileUploadSessions = new Map<string, any>();

// Configure multer for mobile uploads
const mobileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

export function registerMobileUploadRoutes(app: Express) {
  // Get upload status for mobile session
  app.get('/api/mobile-upload/status/:sessionId', isAuthenticated, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const userId = getUserId(req);

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const sessionData = mobileUploadSessions.get(sessionId);
      
      if (!sessionData) {
        return res.json({ status: 'pending', message: 'Session not found yet, continuing to poll...' });
      }

      // Verify session belongs to authenticated user
      if (sessionData.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Prevent caching for dynamic status updates
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.json(sessionData);
    } catch (error) {
      console.error('Mobile upload status error:', error);
      res.status(500).json({ error: 'Failed to get upload status' });
    }
  });

  // Handle mobile file upload (no auth required - session contains user info)
  app.post('/api/mobile-upload/upload/:sessionId', mobileUpload.single('receipt'), async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Get user ID from existing session data
      const existingSession = mobileUploadSessions.get(sessionId);
      if (!existingSession || !existingSession.userId) {
        return res.status(400).json({ error: 'Invalid or expired session' });
      }

      const userId = existingSession.userId;

      // Process the receipt using the existing OCR functions
      try {
        const recognizedText = await performOCR(file.buffer);
        const extractedData = await extractStructuredData(recognizedText);
        
        var ocrResult = {
          text: recognizedText,
          extracted: extractedData
        };
      } catch (error) {
        console.error('Mobile OCR processing failed:', error);
        mobileUploadSessions.set(sessionId, {
          userId: userId,
          status: 'error',
          error: 'OCR processing failed',
          createdAt: new Date()
        });
        return res.status(500).json({ error: 'OCR processing failed' });
      }

      // Store the upload result in session
      const sessionData = {
        userId: userId,
        status: 'completed',
        uploadedAt: new Date(),
        filename: file.originalname,
        ocrData: ocrResult
      };

      mobileUploadSessions.set(sessionId, sessionData);

      // Clean up session after 1 hour
      setTimeout(() => {
        mobileUploadSessions.delete(sessionId);
      }, 60 * 60 * 1000);

      res.json({
        success: true,
        message: 'Receipt uploaded and processed successfully',
        ocrData: ocrResult
      });
    } catch (error) {
      console.error('Mobile upload error:', error);
      
      // Store error in session
      const sessionData = {
        userId: getUserId(req),
        status: 'error',
        error: 'Failed to process receipt',
        uploadedAt: new Date()
      };
      
      mobileUploadSessions.set(req.params.sessionId, sessionData);
      
      res.status(500).json({ error: 'Failed to upload receipt' });
    }
  });

  // Create new mobile upload session
  app.post('/api/mobile-upload/create-session', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const sessionId = crypto.randomUUID();
      
      // Initialize session
      const sessionData = {
        userId,
        status: 'pending',
        createdAt: new Date()
      };
      
      mobileUploadSessions.set(sessionId, sessionData);
      
      // Clean up session after 1 hour if not used
      setTimeout(() => {
        const session = mobileUploadSessions.get(sessionId);
        if (session && session.status === 'pending') {
          mobileUploadSessions.delete(sessionId);
        }
      }, 60 * 60 * 1000);

      res.json({ sessionId });
    } catch (error) {
      console.error('Create session error:', error);
      res.status(500).json({ error: 'Failed to create upload session' });
    }
  });
}