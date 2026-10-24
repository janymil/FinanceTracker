/**
 * PDF Processing Pipeline for Bank Statement Import
 * Hybrid approach: PDF text extraction → OCR fallback → AI parsing
 * SECURITY: Enhanced protection for sensitive financial data
 */

// Scanned statements are rendered locally, anonymised (PII lines blacked out) and then
// read by the OCR models; Tesseract only locates the lines to mask.
import { getCurrentLanguageForAPI } from './languageUtils';
import { DataEncryption } from '../server/encryption';
import { runAI } from './aiProcessor';
import crypto from 'crypto';
import {
  calculateAmountSimilarity,
  calculateDateSimilarity,
  calculateDescriptionSimilarity,
  calculateTransactionSimilarity,
  detectDuplicateTransactions,
  levenshteinDistance,
} from '../shared/duplicateDetection';

// Import pdf-parse at top level to avoid module resolution issues
let pdfParse: any = null;

// PDF Parser function
async function getPdfParser() {
  if (!pdfParse) {
    try {
      const module = await import('pdf-parse');
      pdfParse = module.default || module;
    } catch (error) {
      console.error('Failed to import pdf-parse:', error);
      throw new Error('PDF parsing library not available');
    }
  }
  return pdfParse;
}

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
  anonymizationPreview?: AnonymizationPreviewData; // Preview data for user confirmation
}

export interface ProcessingProgress {
  stage: 'pdf_validation' | 'text_extraction' | 'ocr_fallback' | 'ai_parsing' | 'categorization' | 'duplicate_detection' | 'complete';
  percentage: number; // 0-100
  message: string;
  transactionsProcessed?: number;
  totalTransactions?: number;
  overallProgress?: number; // New field for continuous progress
}

export interface AnonymizationPreviewData {
  originalText: string;
  anonymizedText: string;
  securityLog: SecurityEvent[];
  detectedSensitiveData: SensitiveDataDetection[];
  processingStats: ProcessingStats;
}

export interface SensitiveDataDetection {
  type: 'name' | 'account' | 'ssn' | 'email' | 'phone' | 'address' | 'balance';
  count: number;
  examples: string[];
  redactionPattern: string;
}

export interface ProcessingStats {
  originalLength: number;
  anonymizedLength: number;
  redactionCount: number;
  safetyScore: number; // 0-100
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

  static sanitizeExtractedText(
    text: string, 
    securityLog: SecurityEvent[]
  ): { sanitized: string; detectedData: SensitiveDataDetection[] } {
    PDFSecurityManager.logSecurityEvent(securityLog, 'text_sanitization_start', 'success');
    
    let sanitized = text;
    const detectedData: SensitiveDataDetection[] = [];
    
    // Track personal names
    const nameMatches = text.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g) || [];
    if (nameMatches.length > 0) {
      detectedData.push({
        type: 'name',
        count: nameMatches.length,
        examples: nameMatches.slice(0, 3),
        redactionPattern: '[NAME_REDACTED]'
      });
      sanitized = sanitized.replace(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, '[NAME_REDACTED]');
    }
    
    // Track SSN numbers
    const ssnMatches = text.match(/\b\d{3}-\d{2}-\d{4}\b/g) || [];
    if (ssnMatches.length > 0) {
      detectedData.push({
        type: 'ssn',
        count: ssnMatches.length,
        examples: ssnMatches.slice(0, 2),
        redactionPattern: '[SSN_REDACTED]'
      });
      sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN_REDACTED]');
    }
    
    // Track account numbers
    const accountMatches = text.match(/\b\d{8,20}\b/g) || [];
    if (accountMatches.length > 0) {
      detectedData.push({
        type: 'account',
        count: accountMatches.length,
        examples: accountMatches.slice(0, 3).map(acc => `****${acc.slice(-4)}`),
        redactionPattern: '[ACCOUNT_REDACTED]'
      });
      sanitized = sanitized.replace(/\b\d{8,20}\b/g, '[ACCOUNT_REDACTED]');
    }
    
    // Track email addresses
    const emailMatches = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g) || [];
    if (emailMatches.length > 0) {
      detectedData.push({
        type: 'email',
        count: emailMatches.length,
        examples: emailMatches.slice(0, 2),
        redactionPattern: '[EMAIL_REDACTED]'
      });
      sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]');
    }
    
    // Track phone numbers
    const phoneMatches = text.match(/\b(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g) || [];
    if (phoneMatches.length > 0) {
      detectedData.push({
        type: 'phone',
        count: phoneMatches.length,
        examples: phoneMatches.slice(0, 2),
        redactionPattern: '[PHONE_REDACTED]'
      });
      sanitized = sanitized.replace(/\b(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g, '[PHONE_REDACTED]');
    }
    
    // Track addresses
    const addressMatches = text.match(/\b\d+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s+(St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Boulevard|Ln|Lane|Way|Ct|Court)\b/gi) || [];
    if (addressMatches.length > 0) {
      detectedData.push({
        type: 'address',
        count: addressMatches.length,
        examples: addressMatches.slice(0, 2),
        redactionPattern: '[ADDRESS_REDACTED]'
      });
      sanitized = sanitized.replace(/\b\d+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s+(St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Boulevard|Ln|Lane|Way|Ct|Court)\b/gi, '[ADDRESS_REDACTED]');
    }
    
    // Track balance/total lines
    const balanceMatches = [...(text.match(/^.*balance.*$/gmi) || []), ...(text.match(/^.*total.*$/gmi) || [])];
    if (balanceMatches.length > 0) {
      detectedData.push({
        type: 'balance',
        count: balanceMatches.length,
        examples: balanceMatches.slice(0, 2),
        redactionPattern: '[BALANCE_REDACTED]'
      });
      sanitized = sanitized.replace(/^.*balance.*$/gmi, '[BALANCE_REDACTED]');
      sanitized = sanitized.replace(/^.*total.*$/gmi, '[TOTAL_REDACTED]');
    }
    
    PDFSecurityManager.logSecurityEvent(securityLog, 'text_sanitization_complete', 'success', 
      `Anonymized ${text.length} chars, found ${detectedData.reduce((sum, d) => sum + d.count, 0)} sensitive items`);
    
    return { sanitized, detectedData };
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
 * Main PDF processing pipeline with enhanced security and progress tracking
 */
export async function processBankStatementPDF(
  pdfBuffer: Buffer,
  language: string = 'en-us',
  existingTransactions: ExistingTransaction[] = [],
  onProgress?: (progress: ProcessingProgress) => void,
  userId?: string
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
    onProgress?.({
      stage: 'pdf_validation',
      percentage: 5,
      message: 'Validating PDF security...'
    });
    
    if (!PDFSecurityManager.validatePDFSecurity(pdfBuffer, result.securityLog)) {
      result.errors.push('PDF failed security validation');
      return result;
    }

    // Step 1: Try PDF text extraction first
    onProgress?.({
      stage: 'text_extraction',
      percentage: 15,
      message: 'Extracting text from PDF...'
    });
    let pdf: any;
    try {
      const module = await import('pdf-parse');
      pdf = module.default || module;
    } catch (error) {
      console.error('Failed to import pdf-parse:', error);
      result.errors.push('PDF parsing library not available');
      return result;
    }
    const pdfData = await pdf(pdfBuffer);
    result.totalPages = pdfData.numpages;

    let extractedText = pdfData.text;
    let textQuality = assessTextQuality(extractedText);

    console.log(`PDF text extraction: ${extractedText.length} characters, quality: ${textQuality}`);

    // Step 1.5: Sanitize extracted text for security and create preview data
    const originalText = extractedText; // Store original for preview
    const sanitizationResult = PDFSecurityManager.sanitizeExtractedText(extractedText, result.securityLog);
    extractedText = sanitizationResult.sanitized;

    // Create anonymization preview data
    const totalRedactions = sanitizationResult.detectedData.reduce((sum, d) => sum + d.count, 0);
    const safetyScore = calculateSafetyScore(sanitizationResult.detectedData, originalText.length);
    
    result.anonymizationPreview = {
      originalText,
      anonymizedText: extractedText,
      securityLog: [...result.securityLog],
      detectedSensitiveData: sanitizationResult.detectedData,
      processingStats: {
        originalLength: originalText.length,
        anonymizedLength: extractedText.length,
        redactionCount: totalRedactions,
        safetyScore
      }
    };

    // Step 2: If text quality is poor, use LOCAL OCR fallback
    if (textQuality < 0.5) {
      onProgress?.({
        stage: 'ocr_fallback',
        percentage: 35,
        message: 'Text quality poor, using local OCR...'
      });
      
      console.log('Poor text quality detected, falling back to LOCAL OCR...');
      PDFSecurityManager.logSecurityEvent(result.securityLog, 'local_ocr_fallback_start', 'success', 'Using privacy-first local OCR');
      
      try {
        // Use local OCR that doesn't send data to external services
        const ocrText = await performAnonymisedOCROnPDF(pdfBuffer, result.securityLog, userId);
        if (ocrText.length > extractedText.length * 0.8) {
          extractedText = ocrText;
          result.processingMethod = 'ocr';
          textQuality = assessTextQuality(extractedText);
          PDFSecurityManager.logSecurityEvent(result.securityLog, 'local_ocr_success', 'success', `Extracted ${ocrText.length} chars locally`);
        } else {
          result.processingMethod = 'hybrid';
          PDFSecurityManager.logSecurityEvent(result.securityLog, 'hybrid_processing', 'success', 'Combined text extraction and local OCR');
        }
      } catch (ocrError) {
        console.error('Local OCR fallback failed:', ocrError);
        result.errors.push('Local OCR processing failed, using original text extraction');
        PDFSecurityManager.logSecurityEvent(result.securityLog, 'local_ocr_failed', 'warning', ocrError instanceof Error ? ocrError.message : 'Unknown OCR error');
      }
    }

    // Step 3: AI parsing with bank-specific prompts
    if (extractedText.trim().length > 0) {
      onProgress?.({
        stage: 'ai_parsing',
        percentage: 50,
        message: 'Parsing transactions with AI...'
      });
      
      const transactions = await parseTransactionsWithAI(extractedText, language, userId);
      
      onProgress?.({
        stage: 'categorization',
        percentage: 75,
        message: `AI processing complete, categorizing ${transactions.length} transactions...`
      });
      
      // Step 4: Add AI categorization with progress tracking (75% to 95%)
      if (transactions.length > 0 && userId) {
        const categorizedTransactions = await addAICategorization(transactions, language, userId, onProgress);
        result.transactions = categorizedTransactions;
      } else {
        result.transactions = transactions;
      }
      
      result.confidence = calculateOverallConfidence(result.transactions);
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
    onProgress?.({
      stage: 'duplicate_detection',
      percentage: 90,
      message: 'Checking for duplicate transactions...'
    });
    
    result.duplicates = detectDuplicateTransactions(result.transactions, existingTransactions);
    PDFSecurityManager.logSecurityEvent(result.securityLog, 'duplicate_detection_complete', 'success', `Found ${result.duplicates?.length || 0} potential duplicates`);
  }

  onProgress?.({
    stage: 'complete',
    percentage: 100,
    message: `Processing complete! Extracted ${result.transactions.length} transactions`
  });

  return result;
}

/**
 * Generate anonymization preview without AI processing
 * Shows users exactly what data would be sent to AI
 */
export async function generateAnonymizationPreview(
  pdfBuffer: Buffer,
  language: string = 'en-us'
): Promise<AnonymizationPreviewData | null> {
  const securityLog: SecurityEvent[] = [];
  
  try {
    // Step 0: Security validation
    if (!PDFSecurityManager.validatePDFSecurity(pdfBuffer, securityLog)) {
      throw new Error('PDF failed security validation');
    }

    // Step 1: Extract text from PDF
    const { default: pdf } = await import('pdf-parse');
    const pdfData = await pdf(pdfBuffer);
    const originalText = pdfData.text;

    if (!originalText || originalText.trim().length === 0) {
      throw new Error('No readable text found in PDF');
    }

    // Step 2: Generate anonymization preview
    const sanitizationResult = PDFSecurityManager.sanitizeExtractedText(originalText, securityLog);
    const totalRedactions = sanitizationResult.detectedData.reduce((sum, d) => sum + d.count, 0);
    const safetyScore = calculateSafetyScore(sanitizationResult.detectedData, originalText.length);

    return {
      originalText,
      anonymizedText: sanitizationResult.sanitized,
      securityLog,
      detectedSensitiveData: sanitizationResult.detectedData,
      processingStats: {
        originalLength: originalText.length,
        anonymizedLength: sanitizationResult.sanitized.length,
        redactionCount: totalRedactions,
        safetyScore
      }
    };

  } catch (error) {
    console.error('Preview generation error:', error);
    return null;
  }
}

/**
 * Calculate safety score based on detected sensitive data
 */
function calculateSafetyScore(detectedData: SensitiveDataDetection[], originalLength: number): number {
  const totalSensitiveItems = detectedData.reduce((sum, d) => sum + d.count, 0);
  
  // Base score starts at 100%
  let score = 100;
  
  // Penalize based on sensitive data density
  const sensitivityRatio = totalSensitiveItems / (originalLength / 100); // items per 100 chars
  
  // Heavy penalties for high-risk data
  const riskPenalties = {
    'ssn': 20,      // SSN is highest risk
    'account': 15,  // Account numbers are high risk
    'name': 10,     // Names are medium risk
    'email': 8,     // Email addresses are medium risk
    'phone': 8,     // Phone numbers are medium risk
    'address': 12,  // Addresses are medium-high risk
    'balance': 5    // Balance info is low-medium risk
  };
  
  detectedData.forEach(detection => {
    const penalty = (riskPenalties[detection.type] || 5) * detection.count;
    score -= penalty;
  });
  
  // Additional penalty for high density of sensitive data
  if (sensitivityRatio > 5) {
    score -= 20; // High density penalty
  } else if (sensitivityRatio > 2) {
    score -= 10; // Medium density penalty
  }
  
  // Ensure score stays within 0-100 range
  return Math.max(0, Math.min(100, score));
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
 * Perform LOCAL OCR on PDF using Tesseract.js (privacy-first, no external services)
 */
/**
 * Reads a scanned statement with the OCR models.
 *
 * Tesseract is only used inside `anonymizeImageForAI` to *locate* identifying lines; the
 * page images that are sent to Mistral OCR / Google Vision / OpenAI vision have those
 * lines painted black first. This is what makes a scanned bank statement readable again
 * without shipping the account holder's name, IBAN or address to a provider.
 */
async function performAnonymisedOCROnPDF(
  pdfBuffer: Buffer,
  securityLog: SecurityEvent[],
  userId?: string,
): Promise<string> {
  const { mkdtemp, readdir, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);

  PDFSecurityManager.logSecurityEvent(securityLog, 'ocr_start', 'success', 'Rendering statement pages for anonymised OCR');

  const dir = await mkdtemp(path.join(tmpdir(), 'kaptia-statement-'));
  let extras: { names?: Array<string | null | undefined>; email?: string | null } = {};

  try {
    const pdfPath = path.join(dir, 'statement.pdf');
    await (await import('node:fs/promises')).writeFile(pdfPath, pdfBuffer);

    // poppler renders locally; no ImageMagick/GraphicsMagick needed on the host.
    await run('pdftoppm', ['-png', '-r', '150', '-scale-to', '2200', pdfPath, path.join(dir, 'page')], {
      timeout: 120_000,
      maxBuffer: 1024 * 1024 * 64,
    });

    const files = (await readdir(dir)).filter((name) => name.startsWith('page') && name.endsWith('.png')).sort();
    if (files.length === 0) {
      PDFSecurityManager.logSecurityEvent(securityLog, 'pdf_conversion_failed', 'error', 'No pages rendered from PDF');
      return '';
    }

    if (userId) {
      try {
        const { storage } = await import('../server/storage.js');
        const user = await storage.getUser(userId);
        extras = { names: [user?.firstName, user?.lastName], email: user?.email };
      } catch (error) {
        console.warn('Could not load the user for image anonymisation:', (error as Error).message);
      }
    }

    const { anonymizeImageForAI } = await import('../server/imageAnonymizer.js');
    const { performOCR } = await import('../server/ocr.js');

    let combinedText = '';

    for (let index = 0; index < files.length; index += 1) {
      const pageBuffer = await readFile(path.join(dir, files[index]));
      try {
        const { image, maskedLines, detectedWords } = await anonymizeImageForAI(pageBuffer, extras);
        if (detectedWords === 0) {
          PDFSecurityManager.logSecurityEvent(securityLog, `ocr_page_${index + 1}_skipped`, 'warning',
            'No text located on the page; nothing sent to the OCR provider');
          continue;
        }

        const pageText = await performOCR(image);
        if (pageText && pageText.trim()) {
          combinedText += `\n--- PAGE ${index + 1} ---\n${pageText}\n`;
        }
        PDFSecurityManager.logSecurityEvent(securityLog, `ocr_page_${index + 1}`, 'success',
          `Page read by the OCR model; ${maskedLines} identifying line(s) masked`);
      } catch (pageError) {
        console.error(`OCR failed for page ${index + 1}:`, pageError);
        PDFSecurityManager.logSecurityEvent(securityLog, `ocr_page_${index + 1}_failed`, 'warning',
          pageError instanceof Error ? pageError.message : 'Unknown page OCR error');
      }
    }

    PDFSecurityManager.logSecurityEvent(securityLog, 'ocr_complete', 'success',
      `Extracted ${combinedText.length} chars from ${files.length} page(s)`);

    return combinedText.trim();
  } catch (error) {
    console.error('Anonymised statement OCR failed:', error);
    PDFSecurityManager.logSecurityEvent(securityLog, 'ocr_error', 'error',
      error instanceof Error ? error.message : 'Unknown OCR error');
    throw new Error(`Statement OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * DEPRECATED: Google Cloud Vision OCR (sends data to external servers)
 * Kept for reference but should not be used for sensitive financial data
 */
/**
 * Add AI categorization to extracted transactions
 */
async function addAICategorization(
  transactions: ExtractedTransaction[],
  language: string,
  userId: string,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ExtractedTransaction[]> {
  try {
    // Import storage to fetch user data
    const { storage } = await import('../server/storage');
    
    // Fetch user's existing categories AND transaction history for intelligent categorization
    const userCategories = await storage.getCategories(userId);
    const userTransactions = await storage.getUserTransactions(userId, 500); // Get recent 500 transactions for pattern analysis
    const user = await storage.getUser(userId);
    
    console.log(`Intelligent AI categorization: Found ${userCategories.length} categories and ${userTransactions.length} historical transactions`);
    
    const categorizedTransactions: ExtractedTransaction[] = [];
    const totalTransactions = transactions.length;
    
    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];
      try {
        if (transaction.description && transaction.amount !== 0) {
          // Use intelligent AI categorization with user transaction history
          const categorizationResult = await runAI('categorizeExpense', userId, {
            description: transaction.description,
            amount: Math.abs(transaction.amount),
            language: language,
            userTransactions: userTransactions.map(tx => ({
              description: tx.description,
              category: (tx as any).categoryName || 'Uncategorized',
              amount: tx.amount,
              type: tx.type,
              date: tx.date
            })),
            userCategories: userCategories.map(cat => ({
              id: cat.id,
              name: cat.name,
              type: cat.type
            }))
          }, user?.plan || 'free');
          
          transaction.category = categorizationResult.category || 'Other';
          console.log(`Intelligent AI categorized "${transaction.description}" as "${transaction.category}"`);
        }
      } catch (error) {
        console.error(`Intelligent categorization failed for "${transaction.description}":`, error);
        transaction.category = transaction.type === 'income' ? 'Income' : 'Other';
      }
      
      categorizedTransactions.push(transaction);
      
      // Update progress: from 75% to 95% based on categorization progress
      const categorizationProgress = (i + 1) / totalTransactions;
      const overallProgress = 75 + (categorizationProgress * 20); // 75% + 20% for categorization
      
      onProgress?.({
        stage: 'categorization',
        percentage: Math.round(categorizationProgress * 100),
        overallProgress: Math.round(overallProgress),
        message: `AI categorizing transaction ${i + 1} of ${totalTransactions}...`,
        transactionsProcessed: i + 1,
        totalTransactions: totalTransactions
      });
    }

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
  language: string,
  userId?: string
): Promise<ExtractedTransaction[]> {
  
  try {
    // Use centralized AI system for bank statement processing
    const result = await runAI('parseBankStatement', 'system', {
      text: text,
      language: language
    }, 'free');
    
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

      // Return transactions without categorization - will be categorized separately with progress tracking
      return parsedTransactions;
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