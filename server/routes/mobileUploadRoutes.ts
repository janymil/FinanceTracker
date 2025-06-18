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

      // Use the exact same OCR functions as desktop upload
      let ocrResult;
      try {
        console.log('Starting standard OCR processing...');
        
        // Import the OCR functions from uploadReceipt
        const { performOCR, extractStructuredData, getUserPlan, uploadToBunny, categorizeExpense } = await import('../uploadReceipt');
        
        // Get user plan (same as desktop)
        const userPlan = await getUserPlan(userId);
        const canStore = userPlan.plan === 'standard' || userPlan.plan === 'premium';

        // Perform OCR (same as desktop)
        const recognizedText = await performOCR(file.buffer);

        // Extract structured data using OpenAI (same as desktop)
        const extractedData = await extractStructuredData(recognizedText);

        // AI Categorization for standard+ users (same as desktop)
        let predictedCategory: string | undefined;
        if (userPlan.plan === 'standard' || userPlan.plan === 'premium') {
          try {
            const descriptionForCategorization = extractedData.vendor || recognizedText;
            const amountForCategorization = extractedData.amount || 0;
            
            const categorization = await categorizeExpense(descriptionForCategorization, amountForCategorization);
            predictedCategory = categorization.category;
          } catch (categoryError) {
            console.error('AI categorization failed:', categoryError);
          }
        }

        let imageUrl: string | undefined;

        // Upload to Bunny.net if user has appropriate plan (same as desktop)
        if (canStore) {
          const timestamp = Date.now();
          const fileName = `receipt-${userId}-${timestamp}.${file.mimetype.split('/')[1]}`;
          
          try {
            imageUrl = await uploadToBunny(fileName, file.buffer, file.mimetype);
          } catch (uploadError) {
            console.error('Upload to Bunny.net failed:', uploadError);
          }
        }

        // Prepare response (same structure as desktop)
        ocrResult = {
          text: recognizedText,
          extracted: extractedData
        };

        if (imageUrl) {
          ocrResult.imageUrl = imageUrl;
        }

        if (predictedCategory) {
          ocrResult.category = predictedCategory;
        }
        
        console.log('Standard OCR processing completed');
        
      } catch (error) {
        console.error('Standard OCR processing failed:', error);
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