/**
 * PDF Processing Pipeline for Bank Statement Import
 * Hybrid approach: PDF text extraction → OCR fallback → AI parsing
 * SECURITY: Enhanced protection for sensitive financial data
 */

import { performOCR } from '../server/uploadReceipt';
import { getCurrentLanguageForAPI } from './languageUtils';
import { DataEncryption } from '../server/encryption';
import { runAI } from './aiProcessor';
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
  duplicates?: DuplicateDetection[]; // Potential duplicate transactions
}

export interface DuplicateDetection {
  extractedTransaction: ExtractedTransaction;
  existingTransactions: ExistingTransaction[];
  similarityScore: number; // 0-1 confidence of duplicate
  matchReasons: string[]; // Why it's considered a duplicate
}

export interface ExistingTransaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
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
    PDFSecurityManager.logSecurityEvent(securityLog, 'text_sanitization_start', 'success');
    
    // COMPREHENSIVE anonymization for AI processing
    let sanitized = text;
    
    // Remove personal names (common patterns)
    sanitized = sanitized.replace(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, '[NAME_REDACTED]');
    
    // Remove social security numbers (xxx-xx-xxxx)
    sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN_REDACTED]');
    
    // Remove full credit card numbers (keep last 4 for reference)
    sanitized = sanitized.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, (match) => {
      const last4 = match.slice(-4);
      return `****-****-****-${last4}`;
    });
    
    // Remove account numbers (8+ consecutive digits)
    sanitized = sanitized.replace(/\b\d{8,20}\b/g, '[ACCOUNT_REDACTED]');
    
    // Remove routing numbers in isolation (9 digits starting with 0,1,2,3)
    sanitized = sanitized.replace(/\b[0-3]\d{8}\b/g, '[ROUTING_REDACTED]');
    
    // Remove email addresses
    sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]');
    
    // Remove phone numbers
    sanitized = sanitized.replace(/\b(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g, '[PHONE_REDACTED]');
    
    // Remove addresses (street numbers + street names)
    sanitized = sanitized.replace(/\b\d+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s+(St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Boulevard|Ln|Lane|Way|Ct|Court)\b/gi, '[ADDRESS_REDACTED]');
    
    // Remove balance information lines (preserves transaction data)
    sanitized = sanitized.replace(/^.*balance.*$/gmi, '[BALANCE_REDACTED]');
    sanitized = sanitized.replace(/^.*total.*$/gmi, '[TOTAL_REDACTED]');
    
    PDFSecurityManager.logSecurityEvent(securityLog, 'text_sanitization_complete', 'success', `Anonymized ${text.length} chars`);
    return sanitized;
  }

  static encryptSensitiveData(transaction: ExtractedTransaction, securityLog: SecurityEvent[]): ExtractedTransaction {
    PDFSecurityManager.logSecurityEvent(securityLog, 'transaction_encryption_start', 'success');
    
    try {
      // Encrypt sensitive fields using AES-256 encryption
      const encrypted = {
        ...transaction,
        description: DataEncryption.encrypt(transaction.description),
        rawText: transaction.rawText ? DataEncryption.encrypt(transaction.rawText) : transaction.rawText
      };
      
      PDFSecurityManager.logSecurityEvent(securityLog, 'transaction_encryption_success', 'success');
      return encrypted;
    } catch (error) {
      PDFSecurityManager.logSecurityEvent(securityLog, 'transaction_encryption_failed', 'error', error instanceof Error ? error.message : 'Unknown error');
      return transaction; // Return original if encryption fails
    }
  }

  static secureMemoryCleanup(buffers: Buffer[], securityLog: SecurityEvent[]) {
    PDFSecurityManager.logSecurityEvent(securityLog, 'memory_cleanup_start', 'success');
    
    try {
      // Overwrite buffer memory with zeros for security
      buffers.forEach((buffer, index) => {
        if (buffer && buffer.length > 0) {
          buffer.fill(0);
          PDFSecurityManager.logSecurityEvent(securityLog, `buffer_${index}_cleared`, 'success', `${buffer.length} bytes`);
        }
      });
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        PDFSecurityManager.logSecurityEvent(securityLog, 'garbage_collection_forced', 'success');
      }
      
      PDFSecurityManager.logSecurityEvent(securityLog, 'memory_cleanup_complete', 'success');
    } catch (error) {
      PDFSecurityManager.logSecurityEvent(securityLog, 'memory_cleanup_error', 'error', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  static validatePDFSecurity(pdfBuffer: Buffer, securityLog: SecurityEvent[]): boolean {
    PDFSecurityManager.logSecurityEvent(securityLog, 'pdf_security_validation_start', 'success');
    
    try {
      // Check PDF file size (limit to 50MB for security)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (pdfBuffer.length > maxSize) {
        PDFSecurityManager.logSecurityEvent(securityLog, 'pdf_size_exceeded', 'error', `File size: ${pdfBuffer.length} bytes`);
        return false;
      }
      
      // Verify PDF magic number
      const magicNumber = pdfBuffer.subarray(0, 4).toString();
      if (!magicNumber.startsWith('%PDF')) {
        PDFSecurityManager.logSecurityEvent(securityLog, 'invalid_pdf_format', 'error', `Magic number: ${magicNumber}`);
        return false;
      }
      
      // Check for potential malicious patterns
      const pdfString = pdfBuffer.toString('binary');
      const suspiciousPatterns = ['/JavaScript', '/JS', '/Launch', '/SubmitForm', '/GoToR'];
      
      for (const pattern of suspiciousPatterns) {
        if (pdfString.includes(pattern)) {
          PDFSecurityManager.logSecurityEvent(securityLog, 'suspicious_pdf_content', 'warning', `Found: ${pattern}`);
        }
      }
      
      PDFSecurityManager.logSecurityEvent(securityLog, 'pdf_security_validation_passed', 'success', `Size: ${pdfBuffer.length} bytes`);
      return true;
    } catch (error) {
      PDFSecurityManager.logSecurityEvent(securityLog, 'pdf_security_validation_error', 'error', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }
}

/**
 * Main PDF processing pipeline with enhanced security
 */
export async function processBankStatementPDF(
  pdfBuffer: Buffer,
  language: string = 'en-us',
  existingTransactions: ExistingTransaction[] = []
): Promise<PDFProcessingResult> {
  const result: PDFProcessingResult = {
    transactions: [],
    totalPages: 0,
    processingMethod: 'text',
    errors: [],
    confidence: 0,
    securityLog: [],
    duplicates: []
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

  // Step 6: Duplicate detection if existing transactions provided
  if (existingTransactions.length > 0 && result.transactions.length > 0) {
    result.duplicates = detectDuplicateTransactions(result.transactions, existingTransactions);
    PDFSecurityManager.logSecurityEvent(result.securityLog, 'duplicate_detection_complete', 'success', `Found ${result.duplicates?.length || 0} potential duplicates`);
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
 * Detect duplicate transactions between extracted and existing transactions
 */
function detectDuplicateTransactions(
  extractedTransactions: ExtractedTransaction[],
  existingTransactions: ExistingTransaction[]
): DuplicateDetection[] {
  const duplicates: DuplicateDetection[] = [];

  for (const extracted of extractedTransactions) {
    const potentialDuplicates: ExistingTransaction[] = [];
    const matchReasons: string[] = [];
    let highestSimilarity = 0;

    for (const existing of existingTransactions) {
      const similarity = calculateTransactionSimilarity(extracted, existing);
      
      if (similarity >= 0.7) { // 70% similarity threshold
        potentialDuplicates.push(existing);
        highestSimilarity = Math.max(highestSimilarity, similarity);
        
        // Track specific match reasons
        if (extracted.date === existing.date) {
          matchReasons.push('Exact date match');
        }
        if (Math.abs(extracted.amount - existing.amount) < 0.01) {
          matchReasons.push('Exact amount match');
        }
        if (calculateDescriptionSimilarity(extracted.description, existing.description) > 0.8) {
          matchReasons.push('Very similar description');
        }
      }
    }

    if (potentialDuplicates.length > 0) {
      duplicates.push({
        extractedTransaction: extracted,
        existingTransactions: potentialDuplicates,
        similarityScore: highestSimilarity,
        matchReasons: Array.from(new Set(matchReasons)) // Remove duplicates
      });
    }
  }

  return duplicates;
}

/**
 * Calculate similarity score between two transactions
 */
function calculateTransactionSimilarity(
  extracted: ExtractedTransaction,
  existing: ExistingTransaction
): number {
  let score = 0;
  
  // Date similarity (40% weight)
  const dateSimilarity = calculateDateSimilarity(extracted.date, existing.date);
  score += dateSimilarity * 0.4;
  
  // Amount similarity (35% weight)
  const amountSimilarity = calculateAmountSimilarity(extracted.amount, existing.amount);
  score += amountSimilarity * 0.35;
  
  // Description similarity (20% weight)
  const descSimilarity = calculateDescriptionSimilarity(extracted.description, existing.description);
  score += descSimilarity * 0.2;
  
  // Type similarity (5% weight)
  const typeSimilarity = extracted.type === existing.type ? 1 : 0;
  score += typeSimilarity * 0.05;
  
  return score;
}

/**
 * Calculate date similarity (exact match = 1, within 3 days = 0.5, otherwise 0)
 */
function calculateDateSimilarity(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  if (d1.toDateString() === d2.toDateString()) {
    return 1; // Exact date match
  }
  
  const diffDays = Math.abs((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 3) {
    return 0.5; // Within 3 days
  }
  
  return 0;
}

/**
 * Calculate amount similarity (exact = 1, within 1% = 0.8, within 5% = 0.5)
 */
function calculateAmountSimilarity(amount1: number, amount2: number): number {
  const diff = Math.abs(amount1 - amount2);
  
  if (diff < 0.01) {
    return 1; // Exact match (considering rounding)
  }
  
  const percentDiff = diff / Math.max(Math.abs(amount1), Math.abs(amount2));
  
  if (percentDiff <= 0.01) {
    return 0.8; // Within 1%
  }
  
  if (percentDiff <= 0.05) {
    return 0.5; // Within 5%
  }
  
  return 0;
}

/**
 * Calculate description similarity using Levenshtein distance
 */
function calculateDescriptionSimilarity(desc1: string, desc2: string): number {
  const s1 = desc1.toLowerCase().trim();
  const s2 = desc2.toLowerCase().trim();
  
  if (s1 === s2) {
    return 1;
  }
  
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  
  if (maxLength === 0) {
    return 1;
  }
  
  return 1 - (distance / maxLength);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i;
  }
  
  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j;
  }
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
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
  
  try {
    // Use centralized AI system for bank statement processing
    const result = await runAI('parseBankStatement', 'system', {
      text: text,
      language: language
    });
    
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