/**
 * PDF Processing Pipeline for Bank Statement Import
 * Hybrid approach: PDF text extraction → OCR fallback → AI parsing
 * SECURITY: Enhanced protection for sensitive financial data
 */

import { performOCR } from '../server/uploadReceipt';
import { getCurrentLanguageForAPI } from './languageUtils';
import { DataEncryption } from '../server/encryption';
import crypto from 'crypto';

export interface ExtractedTransaction {
  date: string; // YYYY-MM-DD format
  description: string;
  amount: number; // positive for income, negative for expenses
  type: 'income' | 'expense';
  confidence: number; // 0-1 confidence score
  rawText?: string; // original text for verification
  detectedFormat?: string; // format type detected
  category?: string | null; // AI-suggested category
}

export interface PDFProcessingResult {
  transactions: ExtractedTransaction[];
  totalPages: number;
  processingMethod: 'text' | 'ocr' | 'hybrid';
  errors: string[];
  confidence: number; // overall confidence score
  securityLog: SecurityEvent[]; // Security audit trail
}

interface SecurityEvent {
  timestamp: Date;
  event: string;
  status: 'success' | 'warning' | 'error';
  details?: string;
}

/**
 * Security utility functions for PDF processing
 */
class PDFSecurityManager {
  static logSecurityEvent(log: SecurityEvent[], event: string, status: 'success' | 'warning' | 'error', details?: string) {
    log.push({
      timestamp: new Date(),
      event,
      status,
      details
    });
  }

  static sanitizeExtractedText(text: string, securityLog: SecurityEvent[]): string {
    this.logSecurityEvent(securityLog, 'text_sanitization_start', 'success');
    
    // Remove potential sensitive patterns that shouldn't be in transactions
    let sanitized = text;
    
    // Remove social security numbers (xxx-xx-xxxx)
    sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN_REDACTED]');
    
    // Remove full credit card numbers (keep last 4 for reference)
    sanitized = sanitized.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, (match) => {
      const last4 = match.slice(-4);
      return `****-****-****-${last4}`;
    });
    
    // Remove routing numbers in isolation (9 digits starting with 0,1,2,3)
    sanitized = sanitized.replace(/\b[0-3]\d{8}\b/g, '[ROUTING_REDACTED]');
    
    this.logSecurityEvent(securityLog, 'text_sanitization_complete', 'success', `Processed ${text.length} chars`);
    return sanitized;
  }

  static encryptSensitiveData(transaction: ExtractedTransaction, securityLog: SecurityEvent[]): ExtractedTransaction {
    this.logSecurityEvent(securityLog, 'transaction_encryption_start', 'success');
    
    try {
      // Encrypt sensitive fields using AES-256 encryption
      const encrypted = {
        ...transaction,
        description: DataEncryption.encrypt(transaction.description),
        rawText: transaction.rawText ? DataEncryption.encrypt(transaction.rawText) : transaction.rawText
      };
      
      this.logSecurityEvent(securityLog, 'transaction_encryption_success', 'success');
      return encrypted;
    } catch (error) {
      this.logSecurityEvent(securityLog, 'transaction_encryption_failed', 'error', error instanceof Error ? error.message : 'Unknown error');
      return transaction; // Return original if encryption fails
    }
  }

  static secureMemoryCleanup(buffers: Buffer[], securityLog: SecurityEvent[]) {
    this.logSecurityEvent(securityLog, 'memory_cleanup_start', 'success');
    
    try {
      // Overwrite buffer memory with zeros for security
      buffers.forEach((buffer, index) => {
        if (buffer && buffer.length > 0) {
          buffer.fill(0);
          this.logSecurityEvent(securityLog, `buffer_${index}_cleared`, 'success', `${buffer.length} bytes`);
        }
      });
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        this.logSecurityEvent(securityLog, 'garbage_collection_forced', 'success');
      }
      
      this.logSecurityEvent(securityLog, 'memory_cleanup_complete', 'success');
    } catch (error) {
      this.logSecurityEvent(securityLog, 'memory_cleanup_error', 'error', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  static validatePDFSecurity(pdfBuffer: Buffer, securityLog: SecurityEvent[]): boolean {
    this.logSecurityEvent(securityLog, 'pdf_security_validation_start', 'success');
    
    try {
      // Check PDF file size (limit to 50MB for security)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (pdfBuffer.length > maxSize) {
        this.logSecurityEvent(securityLog, 'pdf_size_exceeded', 'error', `File size: ${pdfBuffer.length} bytes`);
        return false;
      }
      
      // Verify PDF magic number
      const magicNumber = pdfBuffer.subarray(0, 4).toString();
      if (!magicNumber.startsWith('%PDF')) {
        this.logSecurityEvent(securityLog, 'invalid_pdf_format', 'error', `Magic number: ${magicNumber}`);
        return false;
      }
      
      // Check for potential malicious patterns
      const pdfString = pdfBuffer.toString('binary');
      const suspiciousPatterns = ['/JavaScript', '/JS', '/Launch', '/SubmitForm', '/GoToR'];
      
      for (const pattern of suspiciousPatterns) {
        if (pdfString.includes(pattern)) {
          this.logSecurityEvent(securityLog, 'suspicious_pdf_content', 'warning', `Found: ${pattern}`);
        }
      }
      
      this.logSecurityEvent(securityLog, 'pdf_security_validation_passed', 'success', `Size: ${pdfBuffer.length} bytes`);
      return true;
    } catch (error) {
      this.logSecurityEvent(securityLog, 'pdf_security_validation_error', 'error', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }
}

/**
 * Main PDF processing pipeline with enhanced security
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
    confidence: 0,
    securityLog: []
  };

  // Array to track buffers for secure cleanup
  const buffers: Buffer[] = [pdfBuffer];

  try {
    // Step 0: Security validation
    if (!PDFSecurityManager.validatePDFSecurity(pdfBuffer, result.securityLog)) {
      result.errors.push('PDF failed security validation');
      return result;
    }

    // Step 1: Try PDF text extraction first (dynamic import to avoid startup issues)
    const { default: pdf } = await import('pdf-parse');
    const pdfData = await pdf(pdfBuffer);
    result.totalPages = pdfData.numpages;

    let extractedText = pdfData.text;
    let textQuality = assessTextQuality(extractedText);

    console.log(`PDF text extraction: ${extractedText.length} characters, quality: ${textQuality}`);

    // Step 1.5: Sanitize extracted text for security
    extractedText = PDFSecurityManager.sanitizeExtractedText(extractedText, result.securityLog);

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
      
      // Step 4: Encrypt sensitive transaction data
      result.transactions = transactions.map(transaction => 
        PDFSecurityManager.encryptSensitiveData(transaction, result.securityLog)
      );
      
      result.confidence = calculateOverallConfidence(transactions);
    } else {
      result.errors.push('No readable text found in PDF');
      result.confidence = 0;
    }

  } catch (error) {
    console.error('PDF processing error:', error);
    result.errors.push(`PDF processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    result.confidence = 0;
    PDFSecurityManager.logSecurityEvent(result.securityLog, 'processing_error', 'error', error instanceof Error ? error.message : 'Unknown error');
  } finally {
    // Step 5: Secure memory cleanup
    PDFSecurityManager.secureMemoryCleanup(buffers, result.securityLog);
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
  try {
    // Dynamic imports to avoid startup issues
    const { fromBuffer } = await import('pdf2pic');
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    
    console.log('Converting PDF pages to images for OCR processing...');
    
    // Create a unique temp directory for this operation
    const tempDir = path.join(os.tmpdir(), `pdf-ocr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    
    try {
      await fs.promises.mkdir(tempDir, { recursive: true });
      
      // Configure pdf2pic options to use buffer response (no file saving)
      const convert = fromBuffer(pdfBuffer, {
        density: 200,           // DPI - higher = better quality but slower
        saveFilename: "page",   // filename prefix (not used with buffer response)
        savePath: tempDir,      // temp directory (not used with buffer response)
        format: "png",          // image format
        width: 2000,            // max width
        height: 2000            // max height
      });
      
      // Convert all pages to images in memory (buffer response)
      const convertedPages = await convert.bulk(-1, { responseType: "buffer" });
      
      if (!convertedPages || convertedPages.length === 0) {
        console.log('No pages converted from PDF');
        return '';
      }
      
      console.log(`Converted ${convertedPages.length} PDF pages to images`);
      
      // Perform OCR on each page using Google Cloud Vision
      let combinedText = '';
      
      for (let i = 0; i < convertedPages.length; i++) {
        const page = convertedPages[i];
        if (page && page.buffer) {
          try {
            console.log(`Performing OCR on page ${i + 1}/${convertedPages.length}`);
            
            // Use existing Google Cloud Vision OCR function
            const pageText = await performOCR(page.buffer);
            
            if (pageText && pageText.trim()) {
              combinedText += `\n--- PAGE ${i + 1} ---\n${pageText}\n`;
            }
          } catch (ocrError) {
            console.error(`OCR failed for page ${i + 1}:`, ocrError);
            // Continue with other pages even if one fails
          }
        }
      }
      
      console.log(`OCR completed. Extracted ${combinedText.length} characters from PDF`);
      return combinedText.trim();
      
    } finally {
      // Cleanup temp directory
      try {
        await fs.promises.rmdir(tempDir, { recursive: true });
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp directory:', cleanupError);
      }
    }
    
  } catch (error) {
    console.error('PDF to image conversion failed:', error);
    
    // If pdf2pic fails, try alternative approach with existing OCR
    try {
      console.log('Falling back to direct OCR attempt...');
      return await performOCR(pdfBuffer);
    } catch (fallbackError) {
      console.error('Fallback OCR also failed:', fallbackError);
      throw new Error(`PDF OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Add AI categorization to extracted transactions
 */
async function addAICategorization(
  transactions: ExtractedTransaction[],
  language: string
): Promise<ExtractedTransaction[]> {
  try {
    // Import categorization function
    const { categorizeExpense } = await import('../server/openai');
    
    const categorizedTransactions = await Promise.all(
      transactions.map(async (transaction) => {
        try {
          if (transaction.description && transaction.amount !== 0) {
            const categorization = await categorizeExpense(
              transaction.description,
              Math.abs(transaction.amount),
              language
            );
            
            transaction.category = categorization.category;
            console.log(`Categorized "${transaction.description}" as "${categorization.category}"`);
          }
        } catch (error) {
          console.error(`Failed to categorize transaction: ${transaction.description}`, error);
          // Keep transaction without category rather than failing the whole batch
        }
        
        return transaction;
      })
    );

    return categorizedTransactions;
  } catch (error) {
    console.error('AI categorization failed, returning transactions without categories:', error);
    return transactions;
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
      const parsedTransactions = result.transactions.map((tx: any) => ({
        date: tx.date || '',
        description: tx.description || '',
        amount: parseFloat(tx.amount) || 0,
        type: tx.type || 'expense',
        confidence: tx.confidence || 0.8,
        rawText: tx.rawText || '',
        detectedFormat: tx.detectedFormat || 'unknown',
        category: null as string | null // Will be filled by categorization
      }));

      // Add AI categorization for each transaction
      return await addAICategorization(parsedTransactions, language);
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

  return `You are an expert financial data extraction system specialized in bank statement analysis. 

CRITICAL MISSION: Extract ALL transactions with 100% accuracy from bank statement text.

MANDATORY JSON OUTPUT FORMAT:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "Clean transaction description",
      "amount": number (positive for income, negative for expenses),
      "type": "income" or "expense",
      "confidence": 0.0-1.0,
      "rawText": "original text line",
      "detectedFormat": "format_type"
    }
  ],
  "statementInfo": {
    "accountNumber": "if found",
    "bankName": "if identifiable",
    "statementPeriod": "date range if found"
  }
}

HANDLE ALL BANK FORMATS:

FORMAT A - SIGNED AMOUNTS:
Date | Description | Amount
01/15/2025 | ATM Withdrawal | -$100.00
01/16/2025 | Salary Deposit | +$2,500.00

FORMAT B - DEBIT/CREDIT COLUMNS:
Date | Description | Debit | Credit
01/15/2025 | ATM Withdrawal | $100.00 | 
01/16/2025 | Salary Deposit |  | $2,500.00

FORMAT C - NEGATIVE EXPENSES:
Date | Description | Amount
01/15/2025 | ATM Withdrawal | -100.00
01/16/2025 | Salary Deposit | 2500.00

FORMAT D - RUNNING BALANCE:
Date | Description | Amount | Balance
01/15/2025 | ATM Withdrawal | -100.00 | $1,400.00
01/16/2025 | Salary Deposit | +2500.00 | $3,900.00

FORMAT E - EUROPEAN STYLE:
Date | Description | Amount
15.01.2025 | ATM Withdrawal | -100,00 EUR
16.01.2025 | Salary Deposit | 2.500,00 EUR

SMART PARSING RULES:

1. DATE DETECTION:
   - MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD
   - DD.MM.YYYY, MM-DD-YYYY
   - Jan 15, 2025, 15 Jan 2025
   - Convert ALL to YYYY-MM-DD

2. AMOUNT PROCESSING:
   - Remove currency symbols ($, €, £, etc.)
   - Handle thousands separators (1,000.00 or 1.000,00)
   - Detect decimal formats (.00 vs ,00)
   - Process +/- signs or debit/credit columns
   - Ignore balance columns

3. TRANSACTION TYPE LOGIC:
   - Debit column, negative amounts, withdrawals → "expense"
   - Credit column, positive amounts, deposits → "income"
   - Keywords: withdrawal, payment, fee, charge → "expense"
   - Keywords: deposit, credit, refund, interest → "income"

4. DESCRIPTION CLEANING:
   - Remove redundant bank codes
   - Clean merchant names
   - Preserve essential details
   - Remove trailing spaces/numbers

5. CONFIDENCE SCORING:
   - 0.95+: Clear date, amount, description
   - 0.80-0.94: Minor formatting issues
   - 0.60-0.79: Partial data extraction
   - Below 0.60: Questionable data

IGNORE THESE LINES:
- Account balances (opening/closing)
- Statement headers/footers
- Page numbers
- Total summaries
- Account information blocks

BANK-SPECIFIC PATTERNS:
- Chase: "DEBIT CARD PURCHASE"
- Wells Fargo: "POS DEBIT"
- Bank of America: "ATM WITHDRAWAL"
- Citi: "ONLINE PAYMENT"
- European banks: "SEPA TRANSFER"

ERROR HANDLING:
- If date unclear → confidence 0.4
- If amount unclear → confidence 0.3
- If both unclear → skip transaction
- Report parsing issues in confidence score

LANGUAGE: Respond in ${languageLabel} for transaction descriptions while maintaining JSON structure.

EXAMPLES OF COMPLEX SCENARIOS:

Multi-line transaction:
"01/15/2025 AMAZON.COM
AMZN MKTP US
Purchase -$45.99"
→ Combine into single description: "Amazon.com Purchase"

Split debit/credit:
"01/15/2025 | Transfer | $500.00 | $500.00"
→ Two transactions: outgoing expense (-500) and incoming income (+500)

European decimal format:
"15.01.2025 | Grocery Store | -125,45 EUR"
→ Convert to: amount: -125.45

Your mission: Extract every legitimate transaction with maximum accuracy and proper categorization.`;
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