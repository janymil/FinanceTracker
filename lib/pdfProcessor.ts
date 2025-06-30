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

    // Step 1: Try PDF text extraction first
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
      console.log('Poor text quality detected, falling back to LOCAL OCR...');
      PDFSecurityManager.logSecurityEvent(result.securityLog, 'local_ocr_fallback_start', 'success', 'Using privacy-first local OCR');
      
      try {
        // Use local OCR that doesn't send data to external services
        const ocrText = await performLocalOCROnPDF(pdfBuffer, result.securityLog);
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
 * Perform LOCAL OCR on PDF using Tesseract.js (privacy-first, no external services)
 */
async function performLocalOCROnPDF(pdfBuffer: Buffer, securityLog: SecurityEvent[]): Promise<string> {
  try {
    PDFSecurityManager.logSecurityEvent(securityLog, 'local_ocr_start', 'success', 'Starting local Tesseract OCR processing');
    
    // Dynamic imports for Tesseract.js
    const { createWorker } = await import('tesseract.js');
    const { fromBuffer } = await import('pdf2pic');
    
    console.log('Converting PDF to images for LOCAL OCR processing...');
    
    // Configure pdf2pic for in-memory processing (no external data transmission)
    const convert = fromBuffer(pdfBuffer, {
      density: 200,
      format: "png",
      width: 2000,
      height: 2000
    });
    
    // Convert all pages to images in memory
    const convertedPages = await convert.bulk(-1, { responseType: "buffer" });
    
    if (!convertedPages || convertedPages.length === 0) {
      PDFSecurityManager.logSecurityEvent(securityLog, 'pdf_conversion_failed', 'error', 'No pages converted from PDF');
      return '';
    }
    
    PDFSecurityManager.logSecurityEvent(securityLog, 'pdf_conversion_success', 'success', `Converted ${convertedPages.length} pages locally`);
    
    // Initialize Tesseract worker for LOCAL processing
    const worker = await createWorker('eng', 1, {
      logger: (m) => console.log(`Tesseract: ${m.status} ${m.progress}`)
    });
    
    let combinedText = '';
    
    try {
      // Process each page locally with Tesseract
      for (let i = 0; i < convertedPages.length; i++) {
        const page = convertedPages[i];
        if (page && page.buffer) {
          try {
            console.log(`Performing LOCAL OCR on page ${i + 1}/${convertedPages.length}`);
            
            // OCR processing happens entirely in Node.js - no external transmission
            const { data } = await worker.recognize(page.buffer);
            
            if (data.text && data.text.trim()) {
              combinedText += `\n--- PAGE ${i + 1} ---\n${data.text}\n`;
              PDFSecurityManager.logSecurityEvent(securityLog, `local_ocr_page_${i + 1}`, 'success', 
                `Extracted ${data.text.length} chars locally (confidence: ${data.confidence}%)`);
            }
          } catch (pageError) {
            console.error(`Local OCR failed for page ${i + 1}:`, pageError);
            PDFSecurityManager.logSecurityEvent(securityLog, `local_ocr_page_${i + 1}_failed`, 'warning', 
              pageError instanceof Error ? pageError.message : 'Unknown page OCR error');
          }
        }
      }
    } finally {
      // Cleanup Tesseract worker
      await worker.terminate();
      PDFSecurityManager.logSecurityEvent(securityLog, 'tesseract_cleanup', 'success', 'Local OCR worker terminated');
    }
    
    console.log(`LOCAL OCR completed. Extracted ${combinedText.length} characters without external transmission`);
    PDFSecurityManager.logSecurityEvent(securityLog, 'local_ocr_complete', 'success', 
      `Total extraction: ${combinedText.length} chars - all processing local`);
    
    return combinedText.trim();
    
  } catch (error) {
    console.error('Local OCR processing failed:', error);
    PDFSecurityManager.logSecurityEvent(securityLog, 'local_ocr_error', 'error', 
      error instanceof Error ? error.message : 'Unknown local OCR error');
    throw new Error(`Local OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * DEPRECATED: Google Cloud Vision OCR (sends data to external servers)
 * Kept for reference but should not be used for sensitive financial data
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