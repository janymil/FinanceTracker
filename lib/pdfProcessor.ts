/**
 * PDF Processing Pipeline for Bank Statement Import
 * Hybrid approach: PDF text extraction → OCR fallback → AI parsing
 */

import { performOCR } from '../server/uploadReceipt';
import { getCurrentLanguageForAPI } from './languageUtils';

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