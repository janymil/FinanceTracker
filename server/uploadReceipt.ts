
import multer from 'multer';
import { Request, Response } from 'express';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { getUserId } from './clerkAuth';
import { db } from './db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import fetch from 'node-fetch';

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

// Initialize Google Cloud Vision client
const visionClient = new ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

// Bunny.net configuration
const bunnyConfig = {
  apiKey: process.env.BUNNY_API_KEY,
  storageZone: process.env.BUNNY_STORAGE_ZONE,
  storageHost: process.env.BUNNY_STORAGE_HOST,
  pullzoneUrl: process.env.BUNNY_PULLZONE_URL,
};

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

// Upload file to Bunny.net
async function uploadToBunny(fileName: string, fileBuffer: Buffer, mimeType: string): Promise<string> {
  if (!bunnyConfig.apiKey || !bunnyConfig.storageZone || !bunnyConfig.storageHost) {
    throw new Error('Bunny.net configuration is incomplete');
  }

  const url = `https://${bunnyConfig.storageHost}/${bunnyConfig.storageZone}/receipts/${fileName}`;
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'AccessKey': bunnyConfig.apiKey,
      'Content-Type': mimeType,
    },
    body: fileBuffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload to Bunny.net: ${response.status} - ${errorText}`);
  }

  return `${bunnyConfig.pullzoneUrl}/receipts/${fileName}`;
}

// Perform OCR using Google Cloud Vision
async function performOCR(imageBuffer: Buffer): Promise<string> {
  try {
    const [result] = await visionClient.textDetection({
      image: { content: imageBuffer },
    });

    const detections = result.textAnnotations;
    if (detections && detections.length > 0) {
      return detections[0].description || '';
    }

    // Fallback to fullTextAnnotation if textAnnotations is empty
    const fullTextAnnotation = result.fullTextAnnotation;
    return fullTextAnnotation?.text || '';
  } catch (error) {
    console.error('OCR Error:', error);
    throw new Error('Failed to process image with OCR');
  }
}

// Main upload handler
export const uploadReceiptHandler = [
  upload.single('receipt'),
  async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Get user plan
      const userPlan = await getUserPlan(userId);
      const canStore = userPlan.plan === 'standard' || userPlan.plan === 'premium';

      // Perform OCR
      const recognizedText = await performOCR(req.file.buffer);

      let imageUrl: string | undefined;

      // Upload to Bunny.net if user has appropriate plan
      if (canStore) {
        const timestamp = Date.now();
        const fileName = `receipt-${userId}-${timestamp}.${req.file.mimetype.split('/')[1]}`;
        
        try {
          imageUrl = await uploadToBunny(fileName, req.file.buffer, req.file.mimetype);
        } catch (uploadError) {
          console.error('Upload to Bunny.net failed:', uploadError);
          // Continue without storing the image, but still return OCR results
        }
      }

      // Prepare response
      const response: any = {
        recognizedText,
        extractedData: {
          // You can add more sophisticated parsing logic here
          amount: extractAmount(recognizedText),
          merchant: extractMerchant(recognizedText),
          date: extractDate(recognizedText),
        }
      };

      if (imageUrl) {
        response.imageUrl = imageUrl;
      }

      res.json(response);

    } catch (error) {
      console.error('Receipt upload error:', error);
      
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
        }
      }

      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to process receipt' 
      });
    }
  }
];

// Helper functions to extract specific data from OCR text
function extractAmount(text: string): string | null {
  // Look for currency patterns (€, $, etc.) followed by numbers
  const amountRegex = /[€$£¥]\s*(\d+(?:[.,]\d{2})?)|(\d+(?:[.,]\d{2})?)\s*[€$£¥]/g;
  const matches = text.match(amountRegex);
  
  if (matches && matches.length > 0) {
    // Return the last match (usually the total)
    return matches[matches.length - 1].trim();
  }
  
  // Look for "Total" or "Sum" followed by numbers
  const totalRegex = /(?:total|sum|celkom|spolu)[\s:]*(\d+(?:[.,]\d{2})?)/i;
  const totalMatch = text.match(totalRegex);
  
  if (totalMatch) {
    return totalMatch[1];
  }
  
  return null;
}

function extractMerchant(text: string): string | null {
  // Extract first few lines that might contain merchant name
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  if (lines.length > 0) {
    // Usually merchant name is in the first few lines
    const firstLine = lines[0].trim();
    if (firstLine.length > 2 && firstLine.length < 50) {
      return firstLine;
    }
  }
  
  return null;
}

function extractDate(text: string): string | null {
  // Look for date patterns
  const dateRegex = /(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})|(\d{2,4}[./-]\d{1,2}[./-]\d{1,2})/g;
  const matches = text.match(dateRegex);
  
  if (matches && matches.length > 0) {
    return matches[0];
  }
  
  return null;
}
