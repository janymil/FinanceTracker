import type { Express, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { processReceiptImage } from "../uploadReceipt";

// In-memory storage for mobile upload session data
const mobileUploadSessions: Map<string, any> = new Map();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const sessionId = req.params.sessionId;
    const extension = path.extname(file.originalname) || '.jpg';
    cb(null, `${sessionId}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

export function registerMobileUploadRoutes(app: Express) {
  // POST /api/mobile-upload/upload/:sessionId - Handle mobile receipt upload
  app.post('/api/mobile-upload/upload/:sessionId', upload.single('receipt'), async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }

      console.log(`Processing mobile upload for session: ${sessionId}`);
      
      // Update session status to processing
      mobileUploadSessions.set(sessionId, {
        status: 'processing',
        timestamp: new Date().toISOString(),
        filename: req.file.filename
      });

      try {
        // Process the uploaded image with OCR
        const filePath = req.file.path;
        const ocrResult = await processReceiptImage(filePath);
        
        // Store the processed data in memory
        const processedData = {
          status: 'completed',
          timestamp: new Date().toISOString(),
          filename: req.file.filename,
          ocrData: ocrResult,
          imageUrl: `/uploads/${req.file.filename}` // Relative path for frontend
        };
        
        mobileUploadSessions.set(sessionId, processedData);
        
        console.log(`Mobile upload processed successfully for session: ${sessionId}`);
        
        res.status(200).json({
          success: true,
          message: 'Receipt uploaded and processed successfully',
          data: processedData
        });

      } catch (ocrError) {
        console.error('OCR processing error:', ocrError);
        
        // Store error data
        const errorData = {
          status: 'error',
          timestamp: new Date().toISOString(),
          filename: req.file.filename,
          error: 'Failed to process receipt image',
          imageUrl: `/uploads/${req.file.filename}`
        };
        
        mobileUploadSessions.set(sessionId, errorData);
        
        res.status(200).json({
          success: true,
          message: 'Receipt uploaded but processing failed',
          data: errorData
        });
      }

    } catch (error) {
      console.error('Mobile upload error:', error);
      
      const { sessionId } = req.params;
      if (sessionId) {
        mobileUploadSessions.set(sessionId, {
          status: 'error',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Upload failed'
        });
      }
      
      res.status(500).json({
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/mobile-upload/status/:sessionId - Check upload status
  app.get('/api/mobile-upload/status/:sessionId', (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      const sessionData = mobileUploadSessions.get(sessionId);
      
      if (!sessionData) {
        return res.status(404).json({ 
          error: 'Session not found',
          status: 'not_found'
        });
      }

      res.status(200).json({
        success: true,
        data: sessionData
      });

    } catch (error) {
      console.error('Status check error:', error);
      res.status(500).json({
        error: 'Failed to check status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // DELETE /api/mobile-upload/session/:sessionId - Clear session data
  app.delete('/api/mobile-upload/session/:sessionId', (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      const sessionData = mobileUploadSessions.get(sessionId);
      if (sessionData) {
        // Clean up uploaded file if it exists
        if (sessionData.filename) {
          const filePath = path.join(process.cwd(), 'uploads', sessionData.filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
        
        mobileUploadSessions.delete(sessionId);
      }

      res.status(200).json({
        success: true,
        message: 'Session cleared successfully'
      });

    } catch (error) {
      console.error('Session cleanup error:', error);
      res.status(500).json({
        error: 'Failed to clear session',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Cleanup old sessions (called periodically)
  setInterval(() => {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    mobileUploadSessions.forEach((data, sessionId) => {
      if (data.timestamp) {
        const sessionTime = new Date(data.timestamp);
        if (now.getTime() - sessionTime.getTime() > maxAge) {
          // Clean up old file
          if (data.filename) {
            const filePath = path.join(process.cwd(), 'uploads', data.filename);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          }
          mobileUploadSessions.delete(sessionId);
          console.log(`Cleaned up expired session: ${sessionId}`);
        }
      }
    });
  }, 60 * 60 * 1000); // Run cleanup every hour
}

// Export session storage for potential use by other modules
export { mobileUploadSessions };