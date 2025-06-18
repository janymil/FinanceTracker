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
  app.post('/api/mobile-upload/create-session', isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
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

      // Process the receipt using the existing OCR functions
      let ocrResult;
      try {
        console.log('Starting OCR processing...');
        const recognizedText = await performOCR(file.buffer);
        console.log('OCR completed, text length:', recognizedText.length);
        
        const extractedData = await extractStructuredData(recognizedText);
        console.log('Data extraction completed:', extractedData);
        
        ocrResult = {
          text: recognizedText,
          extracted: extractedData
        };
      } catch (error) {
        console.error('Mobile OCR processing failed:', error);
        mobileUploadSessions.set(sessionId, {
          userId: userId,
          status: 'error',
          error: 'OCR processing failed: ' + error.message,
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