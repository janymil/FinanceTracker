
import multer from 'multer';
import { Request, Response } from 'express';
import { getUserId } from './clerkAuth';
import { db } from './db';
import { users } from '../shared/schema.ts';
import { eq } from 'drizzle-orm';
import { categorizeExpense } from './openai';
// Receipt extraction is split on purpose:
//   shared/receiptExtraction.ts – pure normalization (unit tested, no SDK/keys)
//   server/receiptExtraction.ts – the single AI call + legacy wrapper
import { extractStructuredData } from './receiptExtraction';
export { extractStructuredData };
export type { LegacyExtractedReceipt } from '../shared/receiptExtraction';

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// OCR lives in ./ocr: Mistral primary, Google Vision fallback, both injectable for tests.
import { performOCR } from './ocr';
export { performOCR };

import { cloudStorage } from './cloudStorage';

interface UserPlan {
  plan: 'free' | 'standard' | 'premium';
}

// Get user plan from database
async function getUserPlan(userId: string): Promise<UserPlan> {
  try {
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (user.length > 0) {
      return { plan: (user[0].plan as 'free' | 'standard' | 'premium') || 'free' };
    }
    return { plan: 'free' };
  } catch (error) {
    console.error('Error fetching user plan:', error);
    return { plan: 'free' };
  }
}

// Upload receipt file to Cloud Storage (Cloudflare R2 or fallback)
export async function uploadReceiptFile(fileName: string, fileBuffer: Buffer, mimeType: string): Promise<string> {
  const filePath = `receipts/${fileName}`;
  return await cloudStorage.uploadFile(filePath, fileBuffer, mimeType);
}

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

      // Get user plan
      const userPlan = await getUserPlan(userId);
      const canStore = userPlan.plan === 'standard' || userPlan.plan === 'premium';

      // Perform OCR
      const recognizedText = await performOCR(req.file.buffer);

      // Extract structured data using OpenAI
      const extractedData = await extractStructuredData(recognizedText);

      // AI Categorization for standard+ users
      let predictedCategory: string | undefined;
      if (userPlan.plan === 'standard' || userPlan.plan === 'premium') {
        try {
          // Use the vendor name or fallback to the full OCR text for categorization
          const descriptionForCategorization = extractedData.vendor || recognizedText;
          const amountForCategorization = extractedData.amount || 0;
          
          const categorization = await categorizeExpense(descriptionForCategorization, amountForCategorization);
          predictedCategory = categorization.category;
        } catch (categoryError) {
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

