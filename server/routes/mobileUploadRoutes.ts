import { Express } from "express";
import multer from "multer";
import crypto from "crypto";
import fetch from "node-fetch";
import FormData from "form-data";
import { isAuthenticated, getUserId } from "../clerkAuth";

// In-memory storage for mobile upload sessions
const mobileUploadSessions = new Map<string, any>();

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export function registerMobileUploadRoutes(app: any) {
  // Create a new mobile upload session
  app.post('/api/mobile-upload/create-session', async (req: any, res: any) => {
    try {
      // Get user ID from Authorization header directly
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const token = authHeader.split(' ')[1];
      // Use the actual user ID from the Bearer token
      const userId = token;
      
      console.log('Creating session for user:', userId);
      
      const sessionId = crypto.randomUUID();
      
      // Store session data
      mobileUploadSessions.set(sessionId, {
        userId: userId,
        status: 'pending',
        createdAt: new Date()
      });
      
      // Clean up old sessions (older than 1 hour) and sessions from different users
      for (const [id, session] of Array.from(mobileUploadSessions.entries())) {
        if (Date.now() - session.createdAt.getTime() > 60 * 60 * 1000 || session.userId !== userId) {
          mobileUploadSessions.delete(id);
        }
      }
      
      return res.json({ sessionId });
    } catch (error) {
      console.error('Session creation error:', error);
      return res.status(500).json({ error: 'Failed to create session' });
    }
  });

  // Upload receipt from mobile
  app.post('/api/mobile-upload/upload/:sessionId', upload.single('receipt'), async (req: any, res: any) => {
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

      const userToken = existingSession.userId;
      
      // Extract user ID from JWT token stored in session
      let userId: string;
      try {
        // Parse JWT token to extract user ID
        const tokenParts = userToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          userId = payload.sub;
        } else {
          throw new Error('Invalid JWT format');
        }
      } catch (error) {
        console.error('Failed to extract user ID from JWT:', error);
        return res.status(401).json({ error: 'Invalid session token' });
      }

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

      // Process OCR directly without HTTP calls to avoid timeout issues in production
      let ocrResult: {
        text: string;
        extracted: {
          amount?: number;
          date?: string;
          vendor?: string;
          error?: string;
        };
        imageUrl?: string;
        category?: string;
      };
      try {
        console.log('Processing OCR directly...');
        
        // Import OCR processing functions
        const { extractStructuredData, uploadToBunny } = await import('../uploadReceipt');
        const { categorizeExpense } = await import('../openai');
        const { checkAiAccess } = await import('../aiAccess');
        const { anonymizeText } = await import('../../shared/aiAnonymizer');
        const { anonymizeImageForAI } = await import('../imageAnonymizer');
        const { performOCR } = await import('../ocr');
        const { storage } = await import('../storage');
        
        // Same gate as the web upload: paid plan, AI switch on.
        const access = await checkAiAccess(userId);
        if (!access?.allowed) {
          mobileUploadSessions.set(sessionId, {
            userId,
            status: 'error',
            error: access?.code === 'ai_disabled' ? 'AI is turned off for this account' : 'AI receipt scanning requires the Standard or Premium plan',
            createdAt: new Date()
          });
          return res.status(403).json({ error: 'AI receipt scanning is not available for this account', code: access?.code });
        }

        const userPlan = access.plan as 'free' | 'standard' | 'premium';
        const canStore = userPlan === 'standard' || userPlan === 'premium';

        // Read the photo with the OCR models, but only after the identifying lines have
        // been blacked out locally.
        const user = await storage.getUser(userId);
        const extras = { names: [user?.firstName, user?.lastName], email: user?.email };
        const { image: safeImage, detectedWords } = await anonymizeImageForAI(file.buffer, extras);

        if (detectedWords === 0) {
          mobileUploadSessions.set(sessionId, {
            userId,
            status: 'error',
            error: 'We could not read this receipt. Please enter the details manually.',
            createdAt: new Date()
          });
          return res.status(422).json({ error: 'We could not read this receipt', code: 'ocr_empty' });
        }

        const rawText = await performOCR(safeImage);
        const recognizedText = anonymizeText(rawText, extras).text;
        console.log('OCR completed successfully');

        // Extract structured data using the AI model (anonymised text only)
        const extractedData = await extractStructuredData(recognizedText);
        console.log('Data extraction completed');

        // AI Categorization for standard+ users
        let predictedCategory: string | undefined;
        if (userPlan === 'standard' || userPlan === 'premium') {
          try {
            const descriptionForCategorization = extractedData.vendor || recognizedText;
            const amountForCategorization = extractedData.amount || 0;
            const categorization = await categorizeExpense(descriptionForCategorization, amountForCategorization);
            predictedCategory = categorization.category;
            console.log('AI categorization completed');
          } catch (categoryError) {
            console.error('AI categorization failed:', categoryError);
          }
        }

        let imageUrl: string | undefined;

        // Upload to Bunny.net if user has appropriate plan
        if (canStore) {
          const timestamp = Date.now();
          const fileName = `receipt-${userId}-${timestamp}.${file.mimetype.split('/')[1]}`;
          
          try {
            imageUrl = await uploadToBunny(fileName, file.buffer, file.mimetype);
            console.log('Image upload to Bunny.net completed');
          } catch (uploadError) {
            console.error('Upload to Bunny.net failed:', uploadError);
          }
        }

        // Prepare response
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

        console.log('Direct OCR processing completed successfully');
        
      } catch (error) {
        console.error('Direct OCR processing failed:', error);
        mobileUploadSessions.set(sessionId, {
          userId: userId,
          status: 'error',
          error: 'OCR processing failed: ' + (error as Error).message,
          createdAt: new Date()
        });
        return res.status(500).json({ error: 'OCR processing failed' });
      }

      // Store the upload result in session with proper structure for frontend
      const sessionData = {
        userId: userId,
        status: 'completed',
        data: {
          text: ocrResult.text,
          extracted: ocrResult.extracted,
          imageUrl: ocrResult.imageUrl,
          category: ocrResult.category
        },
        createdAt: new Date()
      };

      mobileUploadSessions.set(sessionId, sessionData);
      
      return res.json({ 
        success: true, 
        message: 'Receipt processed successfully' 
      });
    } catch (error) {
      console.error('Mobile upload error:', error);
      return res.status(500).json({ error: 'Upload failed' });
    }
  });

  // Check upload status
  app.get('/api/mobile-upload/status/:sessionId', async (req: any, res: any) => {
    try {
      const { sessionId } = req.params;
      const session = mobileUploadSessions.get(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      return res.json({
        status: session.status,
        data: session.data || null,
        error: session.error || null
      });
    } catch (error) {
      console.error('Status check error:', error);
      return res.status(500).json({ error: 'Status check failed' });
    }
  });
}