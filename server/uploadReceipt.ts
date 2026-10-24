
import multer from 'multer';
import { Request, Response } from 'express';
import { getUserId } from './clerkAuth';
import { storage } from './storage';
import { anonymizeImageForAI } from './imageAnonymizer';



import { categorizeExpense } from './openai';
// Receipt extraction is split on purpose:
//   shared/receiptExtraction.ts – pure normalization (unit tested, no SDK/keys)
//   server/receiptExtraction.ts – the single AI call + legacy wrapper
import { extractStructuredData } from './receiptExtraction';
export { extractStructuredData };
export type { LegacyExtractedReceipt } from '../shared/receiptExtraction';
import { checkReceiptDraft } from '@shared/invariants';
import { reportInvariant, reportSwallowed } from './errorGuard/report.js';

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Photos only: SVG can carry script, and the file extension is built from this type.
    if (file.mimetype.startsWith('image/') && !file.mimetype.includes('svg')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// OCR lives in ./ocr: Mistral primary, Google Vision fallback, both injectable for tests.
// The upload route below no longer calls it: receipts are read locally with Tesseract so
// the image itself never leaves this server. The function stays exported for the mobile
// pipeline and the tests.
import { performOCR } from './ocr';
export { performOCR };
import { checkAiAccess, denyAi } from './aiAccess';
import { anonymizeText } from '../shared/aiAnonymizer';

import { cloudStorage } from './cloudStorage';

interface UserPlan {
  plan: 'free' | 'standard' | 'premium';
}

// Upload receipt file to Cloud Storage (Cloudflare R2 or fallback)
export async function uploadReceiptFile(fileName: string, fileBuffer: Buffer, mimeType: string): Promise<string> {
  const filePath = `receipts/${fileName}`;
  return await cloudStorage.uploadFile(filePath, fileBuffer, mimeType);
}

/**
 * Receipt images are read by the OCR models (Mistral → Google Vision → OpenAI vision).
 * Before the image leaves the server it is passed through `anonymizeImageForAI`, which
 * blacks out every line carrying an identifier. Tesseract is used only to locate those
 * lines, never as the reader.
 */

// Legacy alias
export const uploadToBunny = uploadReceiptFile;

// Main upload handler
export const uploadReceiptHandler = [
  upload.single('receipt'),
  async (req: Request, res: Response) => {
    try {
      // Check for internal authentication from mobile uploads
      let userId: string | undefined = req.headers['x-internal-auth'] as string | undefined;
      
      // If no internal auth, use standard Clerk authentication
      if (!userId) {
        userId = getUserId(req) ?? undefined;
        if (!userId) {
          return res.status(401).json({ error: 'Authentication required' });
        }
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Reading a receipt is an AI feature: paid plan, and only while the account switch
      // is on. Free accounts never reach an OCR or AI provider.
      const access = await checkAiAccess(userId);
      if (!access?.allowed) {
        return denyAi(res, access?.code ?? 'unauthenticated');
      }

      // Get user plan
      const userPlan = { plan: access.plan as 'free' | 'standard' | 'premium' };
      const canStore = userPlan.plan === 'standard' || userPlan.plan === 'premium';

      // Black out the identifying lines, then let the OCR model read the cleaned image.
      const user = await storage.getUser(userId);
      const extras = { names: [user?.firstName, user?.lastName], email: user?.email };
      let safeImage: Buffer;
      let detectedWords = 0;
      try {
        const anonymized = await anonymizeImageForAI(req.file.buffer, extras);
        safeImage = anonymized.image;
        detectedWords = anonymized.detectedWords;
        console.log(`[Receipt] OCR image prepared: ${anonymized.maskedLines}/${anonymized.detectedLines} identifying lines masked`);
      } catch (error) {
        console.warn('[Receipt] Could not prepare the image for OCR:', (error as Error).message);
        return res.status(422).json({
          error: 'This image format could not be read. Please use a JPEG, PNG or WebP photo.',
          code: 'ocr_unsupported',
        });
      }

      if (detectedWords === 0) {
        return res.status(422).json({
          error: 'We could not read this receipt. Please enter the details manually.',
          code: 'ocr_empty',
        });
      }

      // Mistral OCR → Google Vision → OpenAI vision, on the masked image only.
      const rawText = await performOCR(safeImage);
      const recognizedText = anonymizeText(rawText, extras).text;

      if (recognizedText.trim().length < 5) {
        return res.status(422).json({
          error: 'We could not read this receipt. Please enter the details manually.',
          code: 'ocr_empty',
        });
      }

      // Extract structured data using the AI model (text only, already anonymised)
      const extractedData = await extractStructuredData(recognizedText);

      // Money invariant (blueprint 07 §18): a draft with a non-positive amount, a future
      // date or a paragraph-length vendor is a parsing bug, and it would silently reach the
      // user's expense form. Report it and continue — the OCR text is still useful.
      for (const violation of checkReceiptDraft({
        amount: extractedData.amount ?? null,
        date: extractedData.date ?? null,
        vendor: extractedData.vendor ?? null,
      })) {
        reportInvariant(violation.code, {
          expected: violation.expected,
          actual: violation.actual,
          where: 'uploadReceipt.extractStructuredData',
        });
      }

      // AI Categorization for standard+ users
      let predictedCategory: string | undefined;
      if (userPlan.plan === 'standard' || userPlan.plan === 'premium') {
        try {
          // Use the vendor name or fallback to the full OCR text for categorization
          const descriptionForCategorization = extractedData.vendor || recognizedText;
          const amountForCategorization = extractedData.amount || 0;
          
          const categorization = await categorizeExpense(descriptionForCategorization, amountForCategorization);
          // A failed answer is "Other 0.1", which would look like a real suggestion
          if (!categorization.failed) predictedCategory = categorization.category;
        } catch (categoryError) {
          reportSwallowed(categoryError, {
            where: 'uploadReceipt.categorizeExpense',
            fallback: 'uncategorized',
            route: '/api/upload-receipt',
            moneyPath: true,
          });
          console.error('AI categorization failed:', categoryError);
          // Continue without categorization
        }
      }

      let imageUrl: string | undefined;

      // Upload to Cloud Storage if user has appropriate plan
      if (canStore) {
        const timestamp = Date.now();
        const extension = req.file.mimetype.split('/')[1] || 'jpg';
        const fileName = `receipt-${userId}-${timestamp}.${extension}`;
        
        try {
          imageUrl = await uploadReceiptFile(fileName, req.file.buffer, req.file.mimetype);
        } catch (uploadError) {
          reportSwallowed(uploadError, {
            where: 'uploadReceipt.storeImage',
            fallback: 'no imageUrl',
            route: '/api/upload-receipt',
          });
          console.error('Upload to Cloud Storage failed:', uploadError);
          // Continue without storing the image, but still return OCR results
        }
      }

      // Prepare response
      const response: any = {
        text: recognizedText,
        extracted: extractedData
      };

      if (imageUrl) {
        response.imageUrl = imageUrl;
      }

      if (predictedCategory) {
        response.category = predictedCategory;
      }

      return res.json(response);

    } catch (error) {
      console.error('Receipt upload error:', error);
      
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
        }
      }

      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to process receipt' 
      });
    }
  }
];

