
import multer from 'multer';
import { Request, Response } from 'express';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { getUserId } from './clerkAuth';
import { db } from './db';
import { users } from '../shared/schema.ts';
import { eq } from 'drizzle-orm';
import fetch from 'node-fetch';
import { openai } from './openaiClient';
import { categorizeExpense } from './openai';

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

// Validate Google Cloud environment variables
if (!process.env.GOOGLE_CLOUD_PROJECT_ID || !process.env.GOOGLE_CLOUD_PRIVATE_KEY || !process.env.GOOGLE_CLOUD_CLIENT_EMAIL) {
  console.error('Missing required Google Cloud environment variables');
  throw new Error('Google Cloud Vision configuration is incomplete');
}

// Initialize Google Cloud Vision client with environment variables
const visionClient = new ImageAnnotatorClient({
  credentials: {
    type: 'service_account',
    project_id: process.env.GOOGLE_CLOUD_PROJECT_ID,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
  },
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
});

// Bunny.net configuration
const bunnyConfig = {
  apiKey: process.env.BUNNY_ACCESS_KEY,
  storagePassword: process.env.BUNNY_STORAGE_PASSWORD,
  storageZone: process.env.BUNNY_STORAGE_ZONE,
  storageHost: 'la.storage.bunnycdn.com',
  pullzoneUrl: 'https://finanzerpro.b-cdn.net',
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
export async function uploadToBunny(fileName: string, fileBuffer: Buffer, mimeType: string): Promise<string> {
  if (!bunnyConfig.storagePassword || !bunnyConfig.storageZone || !bunnyConfig.storageHost) {
    throw new Error('Bunny.net configuration is incomplete');
  }

  const url = `https://${bunnyConfig.storageHost}/${bunnyConfig.storageZone}/receipts/${fileName}`;
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'AccessKey': bunnyConfig.storagePassword,
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
export async function performOCR(imageBuffer: Buffer): Promise<string> {
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

// Extract structured data from OCR text using OpenAI
export async function extractStructuredData(ocrText: string): Promise<{
  amount?: number;
  date?: string;
  vendor?: string;
  error?: string;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a financial application. Based on this OCR text from a receipt, extract: - amount (as a number) - purchase date (in YYYY-MM-DD format) - store/vendor name. Return the response in JSON format with keys: amount, date, vendor."
        },
        {
          role: "user",
          content: ocrText
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    // Normalize extracted data
    const extractedData: any = {};
    
    // Normalize amount to number
    if (result.amount !== undefined) {
      const numAmount = Number(result.amount);
      if (!isNaN(numAmount) && numAmount > 0) {
        extractedData.amount = numAmount;
      }
    }
    
    // Normalize date to YYYY-MM-DD format
    if (result.date) {
      const dateStr = String(result.date).trim();
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        extractedData.date = dateStr;
      } else {
        // Try to parse and reformat common date formats
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          extractedData.date = date.toISOString().split('T')[0];
        }
      }
    }
    
    // Normalize vendor string
    if (result.vendor) {
      const vendor = String(result.vendor).trim();
      if (vendor.length > 0 && vendor.length <= 100) {
        extractedData.vendor = vendor;
      }
    }
    
    return extractedData;
  } catch (error) {
    console.error('OpenAI extraction error:', error);
    return {
      error: 'Failed to extract structured data'
    };
  }
}

// Main upload handler
export const uploadReceiptHandler = [
  upload.single('receipt'),
  async (req: Request, res: Response) => {
    try {
      // Check for internal authentication from mobile uploads
      let userId = req.headers['x-internal-auth'] as string;
      
      // If no internal auth, use standard Clerk authentication
      if (!userId) {
        userId = getUserId(req);
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


