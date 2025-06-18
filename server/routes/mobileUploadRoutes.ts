import { Express } from "express";
import multer from "multer";
import { authenticateToken } from "../auth";
import { processReceiptOCR } from "../uploadReceipt";

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
  app.get('/api/mobile-upload/status/:sessionId', authenticateToken, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const sessionData = mobileUploadSessions.get(sessionId);
      
      if (!sessionData) {
        return res.status(404).json({ error: 'Session not found', status: 'not_found' });
      }

      // Verify session belongs to authenticated user
      if (sessionData.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json(sessionData);
    } catch (error) {
      console.error('Mobile upload status error:', error);
      res.status(500).json({ error: 'Failed to get upload status' });
    }
  });

  // Handle mobile file upload
  app.post('/api/mobile-upload/upload/:sessionId', authenticateToken, mobileUpload.single('receipt'), async (req, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.claims?.sub;
      const file = req.file;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Process the receipt with OCR
      const ocrResult = await processReceiptOCR(file.buffer, file.originalname);

      // Store the upload result in session
      const sessionData = {
        userId,
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
        userId: req.user?.claims?.sub,
        status: 'error',
        error: 'Failed to process receipt',
        uploadedAt: new Date()
      };
      
      mobileUploadSessions.set(req.params.sessionId, sessionData);
      
      res.status(500).json({ error: 'Failed to upload receipt' });
    }
  });

  // Create new mobile upload session
  app.post('/api/mobile-upload/create-session', authenticateToken, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;

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