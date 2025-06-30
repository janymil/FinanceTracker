/**
 * PDF Processing Pipeline for Bank Statement Import
 * Hybrid approach: PDF text extraction → OCR fallback → AI parsing
 */

import pdf from 'pdf-parse';
import { performOCR } from '../server/uploadReceipt';
import { getCurrentLanguageForAPI } from './languageUtils';

export interface ExtractedTransaction {
  date: string; // YYYY-MM-DD format
  description: string;
  amount: number; // positive for income, negative for expenses
  type: 'income' | 'expense';
  confidence: number; // 0-1 confidence score
  rawText?: string; // original text for verification
}

export interface PDFProcessingResult {
  transactions: ExtractedTransaction[];
  totalPages: number;
  processingMethod: 'text' | 'ocr' | 'hybrid';
  errors: string[];
  confidence: number; // overall confidence score
}

/**
 * Main PDF processing pipeline
 */
export async function processBankStatementPDF(
  pdfBuffer: Buffer,
  language: string = 'en-us'
): Promise<PDFProcessingResult> {
  const result: PDFProcessingResult = {
    transactions: [],
    totalPages: 0,
    processingMethod: 'text',
    errors: [],
    confidence: 0
  };

  try {
    // Step 1: Try PDF text extraction first
    const pdfData = await pdf(pdfBuffer);
    result.totalPages = pdfData.numpages;

    let extractedText = pdfData.text;
    let textQuality = assessTextQuality(extractedText);

    console.log(`PDF text extraction: ${extractedText.length} characters, quality: ${textQuality}`);

    // Step 2: If text quality is poor, use OCR fallback
    if (textQuality < 0.5) {
      console.log('Poor text quality detected, falling back to OCR...');
      try {
        // Convert PDF to images and perform OCR
        const ocrText = await performOCROnPDF(pdfBuffer);
        if (ocrText.length > extractedText.length * 0.8) {
          extractedText = ocrText;
          result.processingMethod = 'ocr';
          textQuality = assessTextQuality(extractedText);
        } else {
          result.processingMethod = 'hybrid';
        }
      } catch (ocrError) {
        console.error('OCR fallback failed:', ocrError);
        result.errors.push('OCR processing failed, using original text extraction');
      }
    }

    // Step 3: AI parsing with bank-specific prompts
    if (extractedText.trim().length > 0) {
      const transactions = await parseTransactionsWithAI(extractedText, language);
      result.transactions = transactions;
      result.confidence = calculateOverallConfidence(transactions);
    } else {
      result.errors.push('No readable text found in PDF');
      result.confidence = 0;
    }

  } catch (error) {
    console.error('PDF processing error:', error);
    result.errors.push(`PDF processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    result.confidence = 0;
  }

  return result;
}

/**
 * Assess quality of extracted text
 */
function assessTextQuality(text: string): number {
  if (!text || text.trim().length === 0) return 0;

  let score = 0;
  
  // Check for common banking terms
  const bankingTerms = [
    'balance', 'transaction', 'debit', 'credit', 'deposit', 'withdrawal',
    'payment', 'transfer', 'fee', 'interest', 'statement', 'account'
  ];
  
  const foundTerms = bankingTerms.filter(term => 
    text.toLowerCase().includes(term)
  ).length;
  
  score += (foundTerms / bankingTerms.length) * 0.4;
  
  // Check for date patterns
  const datePatterns = [
    /\d{1,2}\/\d{1,2}\/\d{2,4}/g, // MM/DD/YYYY or DD/MM/YYYY
    /\d{4}-\d{2}-\d{2}/g,         // YYYY-MM-DD
    /\d{1,2}-\d{1,2}-\d{2,4}/g    // MM-DD-YYYY or DD-MM-YYYY
  ];
  
  const hasDatePattern = datePatterns.some(pattern => pattern.test(text));
  if (hasDatePattern) score += 0.3;
  
  // Check for amount patterns
  const amountPatterns = [
    /\$[\d,]+\.?\d*/g,           // $1,234.56
    /[\d,]+\.?\d*\s*(USD|EUR|GBP|CAD)/g, // 1234.56 USD
    /[-+]?\s*[\d,]+\.?\d*/g      // +1234.56 or -1234.56
  ];
  
  const hasAmountPattern = amountPatterns.some(pattern => pattern.test(text));
  if (hasAmountPattern) score += 0.3;

  return Math.min(score, 1);
}

/**
 * Perform OCR on PDF by converting to images
 */
async function performOCROnPDF(pdfBuffer: Buffer): Promise<string> {
  // For now, we'll use a simplified approach
  // In production, you might want to use pdf2pic or similar to convert PDF pages to images
  // then run OCR on each page
  
  try {
    // This is a placeholder - in a real implementation you'd:
    // 1. Convert PDF pages to images using pdf2pic or canvas
    // 2. Run OCR on each image
    // 3. Combine the results
    
    // For now, we'll return empty string to indicate OCR should be skipped
    console.log('OCR on PDF not yet implemented - would require pdf2pic integration');
    return '';
  } catch (error) {
    console.error('PDF OCR error:', error);
    throw new Error('Failed to perform OCR on PDF');
  }
}

/**
 * Parse transactions using AI with bank-specific prompts
 */
async function parseTransactionsWithAI(
  text: string, 
  language: string
): Promise<ExtractedTransaction[]> {
  
  const bankStatementPrompt = createBankStatementPrompt(language);
  
  try {
    // Import OpenAI here to avoid circular dependencies
    const { default: OpenAI } = await import('openai');
    
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: bankStatementPrompt
        },
        {
          role: "user",
          content: `Please analyze this bank statement text and extract all transactions:\n\n${text}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    if (result.transactions && Array.isArray(result.transactions)) {
      return result.transactions.map((tx: any) => ({
        date: tx.date || '',
        description: tx.description || '',
        amount: parseFloat(tx.amount) || 0,
        type: tx.type || 'expense',
        confidence: tx.confidence || 0.8,
        rawText: tx.rawText || ''
      }));
    }

    return [];

  } catch (error) {
    console.error('AI parsing error:', error);
    throw new Error('Failed to parse transactions with AI');
  }
}

/**
 * Create bank-specific AI prompt based on language
 */
function createBankStatementPrompt(language: string): string {
  const languageLabel = language.startsWith('es') ? 'Spanish' : 
                       language.startsWith('sk') ? 'Slovak' : 'English';

  return `You are a financial data extraction expert. Analyze bank statement text and extract ALL transactions.

CRITICAL INSTRUCTIONS:
- Return valid JSON with "transactions" array
- Each transaction must have: date, description, amount, type, confidence
- Convert dates to YYYY-MM-DD format
- Amount: positive numbers for income/deposits, negative for expenses/withdrawals
- Type: "income" for deposits/credits, "expense" for withdrawals/debits
- Confidence: 0.0-1.0 based on data clarity

HANDLE MULTIPLE FORMATS:
Format A: Date | Description | Amount (+/- signs)
Format B: Date | Description | Debit | Credit (separate columns)
Format C: Date | Description | Amount (expenses as negative numbers)
Format D: Running balance format with transaction amounts

COMMON PATTERNS TO RECOGNIZE:
- Opening/closing balances (ignore these)
- ATM withdrawals, deposits, transfers
- Direct debits, standing orders
- Card payments, online transfers
- Interest payments, fees, charges
- Salary deposits, refunds

EXAMPLE OUTPUT:
{
  "transactions": [
    {
      "date": "2025-06-15",
      "description": "ATM Withdrawal - Main Street",
      "amount": -100.00,
      "type": "expense",
      "confidence": 0.95,
      "rawText": "15/06/2025 ATM WITHDRAWAL MAIN ST -$100.00"
    },
    {
      "date": "2025-06-14", 
      "description": "Salary Deposit",
      "amount": 2500.00,
      "type": "income",
      "confidence": 0.98,
      "rawText": "14/06/2025 SALARY DEPOSIT +$2,500.00"
    }
  ]
}

RESPOND IN ${languageLabel} for descriptions when possible, but keep JSON structure in English.`;
}

/**
 * Calculate overall confidence score
 */
function calculateOverallConfidence(transactions: ExtractedTransaction[]): number {
  if (transactions.length === 0) return 0;
  
  const totalConfidence = transactions.reduce((sum, tx) => sum + tx.confidence, 0);
  return totalConfidence / transactions.length;
}

/**
 * Validate extracted transactions
 */
export function validateTransactions(transactions: ExtractedTransaction[]): {
  valid: ExtractedTransaction[];
  invalid: { transaction: ExtractedTransaction; errors: string[] }[];
} {
  const valid: ExtractedTransaction[] = [];
  const invalid: { transaction: ExtractedTransaction; errors: string[] }[] = [];

  transactions.forEach(tx => {
    const errors: string[] = [];

    // Validate date
    if (!tx.date || !isValidDate(tx.date)) {
      errors.push('Invalid or missing date');
    }

    // Validate description
    if (!tx.description || tx.description.trim().length === 0) {
      errors.push('Missing description');
    }

    // Validate amount
    if (tx.amount === undefined || tx.amount === null || isNaN(tx.amount)) {
      errors.push('Invalid or missing amount');
    }

    // Validate type
    if (!['income', 'expense'].includes(tx.type)) {
      errors.push('Invalid transaction type');
    }

    if (errors.length === 0) {
      valid.push(tx);
    } else {
      invalid.push({ transaction: tx, errors });
    }
  });

  return { valid, invalid };
}

/**
 * Check if date string is valid
 */
function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}