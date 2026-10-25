import { log } from '../logger';
import { Express } from "express";
import multer from "multer";
import crypto from "crypto";
import fetch from "node-fetch";
import FormData from "form-data";
import { isAuthenticated, getUserId } from "../clerkAuth";

import { rateLimit } from "../middleware/rateLimit";

// In-memory storage for mobile upload sessions
const mobileUploadSessions = new Map<string, any>();
const SESSION_TTL_MS = 60 * 60 * 1000;
const MAX_SESSIONS_PER_USER = 5;

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export function registerMobileUploadRoutes(app: any) {
  // Create a new mobile upload session
  app.post('/api/mobile-upload/create-session', isAuthenticated, rateLimit({ windowMs: 60_000, max: 20, keyPrefix: 'mobile-session', perUser: true }), async (req: any, res: any) => {
    try {
      // The user id is the verified Clerk id, never something the caller typed.
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Drop expired sessions (any user), then cap how many one user can hold open.
      for (const [id, session] of Array.from(mobileUploadSessions.entries())) {
        if (Date.now() - session.createdAt.getTime() > SESSION_TTL_MS) {
          mobileUploadSessions.delete(id);
        }
      }
      const mine = Array.from(mobileUploadSessions.entries()).filter(([, s]) => s.userId === userId);
      if (mine.length >= MAX_SESSIONS_PER_USER) {
        mine
          .sort((a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime())
          .slice(0, mine.length - MAX_SESSIONS_PER_USER + 1)
          .forEach(([id]) => mobileUploadSessions.delete(id));
      }

      const sessionId = crypto.randomUUID();
      mobileUploadSessions.set(sessionId, {
        userId,
        status: 'pending',
        createdAt: new Date()
      });

      return res.json({ sessionId });
    } catch (error) {
      console.error('Session creation error:', error);
      return res.status(500).json({ error: 'Failed to create session' });
    }
  });

  // Upload receipt from mobile
  // The phone has no login: the unguessable session id from the QR code is the credential,
  // and it was issued to an authenticated user above.
  app.post('/api/mobile-upload/upload/:sessionId', rateLimit({ windowMs: 60_000, max: 10, keyPrefix: 'mobile-upload' }), upload.single('receipt'), async (req: any, res: any) => {
    try {
      const { sessionId } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const extension = ALLOWED_IMAGE_TYPES[file.mimetype];
      if (!extension) {
        return res.status(415).json({ error: 'Only JPEG, PNG, WebP or HEIC photos are accepted' });
      }

      const existingSession = mobileUploadSessions.get(sessionId);
      if (
        !existingSession ||
        Date.now() - existingSession.createdAt.getTime() > SESSION_TTL_MS
      ) {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (existingSession.status !== 'pending' && existingSession.status !== 'error') {
        return res.status(409).json({ error: 'This session already received a photo' });
      }

      const userId: string = existingSession.userId;
      existingSession.status = 'processing';

      log.info('Processing mobile upload, file size:', file.buffer.length);

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
        log.info('Processing OCR directly...');
        
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
        log.info('OCR completed successfully');

        // Extract structured data using the AI model (anonymised text only)
        const extractedData = await extractStructuredData(recognizedText);
        log.info('Data extraction completed');

        // AI Categorization for standard+ users
        let predictedCategory: string | undefined;
        if (userPlan === 'standard' || userPlan === 'premium') {
          try {
            const descriptionForCategorization = extractedData.vendor || recognizedText;
            const amountForCategorization = extractedData.amount || 0;
            const categorization = await categorizeExpense(descriptionForCategorization, amountForCategorization);
            // A failed answer is "Other 0.1", which would look like a real suggestion
            if (!categorization.failed) predictedCategory = categorization.category;
            log.info('AI categorization completed');
          } catch (categoryError) {
            console.error('AI categorization failed:', categoryError);
          }
        }

        let imageUrl: string | undefined;

        // Upload to Bunny.net if user has appropriate plan
        if (canStore) {
          const timestamp = Date.now();
          const fileName = `receipt-${userId}-${timestamp}.${extension}`;
          
          try {
            imageUrl = await uploadToBunny(fileName, file.buffer, file.mimetype);
            log.info('Image upload to Bunny.net completed');
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

        log.info('Direct OCR processing completed successfully');
        
      } catch (error) {
        console.error('Direct OCR processing failed:', error);
        mobileUploadSessions.set(sessionId, {
          userId: userId,
          status: 'error',
          // Generic text: this string is shown to the person, and used to carry the raw
          // exception (database/host details) out to whoever held the session id.
          error: 'We could not process this receipt. Please try again or enter the details manually.',
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
  //
  // Only the signed-in desktop app polls this, so it is authenticated and bound to the
  // session owner — the QR code's id alone is no longer enough to read a receipt. The
  // phone never calls this route: it only POSTs the photo above.
  app.get(
    '/api/mobile-upload/status/:sessionId',
    isAuthenticated,
    rateLimit({ windowMs: 60_000, max: 60, keyPrefix: 'mobile-status', perUser: true }),
    async (req: any, res: any) => {
      try {
        const { sessionId } = req.params;
        const session = mobileUploadSessions.get(sessionId);

        // Same 1-hour TTL the upload path enforces; without this an expired receipt stayed
        // readable until some user happened to create a new session.
        if (!session || Date.now() - session.createdAt.getTime() > SESSION_TTL_MS) {
          mobileUploadSessions.delete(sessionId);
          return res.status(404).json({ error: 'Session not found' });
        }

        // 404 rather than 403: do not confirm that someone else's session exists.
        if (session.userId !== getUserId(req)) {
          return res.status(404).json({ error: 'Session not found' });
        }

        res.setHeader('Cache-Control', 'no-store');
        return res.json({
          status: session.status,
          data: session.data || null,
          error: session.error || null,
        });
      } catch (error) {
        console.error('Status check error:', error);
        return res.status(500).json({ error: 'Status check failed' });
      }
    }
  );
}