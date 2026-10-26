import { log } from '../logger';
import type { Express } from "express";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { checkAiAccess, denyAi } from "../aiAccess";
import { storage } from "../storage";
import { checkImport } from "@shared/invariants";
import { reportInvariant } from "../errorGuard/report.js";
import { z } from "zod";
import { 
  ensureCategoryExists, 
  formatTransaction, 
  formatBudget, 
  formatGoal,
  getUserFromRequest,
  validateRequiredFields,
  validateDataSecurity
} from "../../lib/importHelpers";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { 
  saveImportLog, 
  createImportSummary, 
  determineImportStatus 
} from "../../lib/saveImportLog";
import multer from "multer";
import { processBankStatementPDF, validateTransactions } from "../../lib/pdfProcessor";
import { detectDuplicateTransactions } from "../../shared/duplicateDetection";
import { rateLimit } from "../middleware/rateLimit";
import { notifyDataChange } from "../realtime";
import { getCurrentLanguageForAPI } from "../../lib/languageUtils";

// Configure multer for PDF uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for PDFs
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Validation schemas for import data
const importTransactionSchema = z.object({
  amount: z.number().or(z.string().transform(val => parseFloat(val))),
  description: z.string(),
  type: z.enum(["income", "expense"]),
  date: z.string().or(z.date()).transform(val => new Date(val)),
  categoryName: z.string().optional(),
  isRecurring: z.boolean().optional().default(false),
  recurringFrequency: z.enum(["weekly", "monthly", "yearly"]).optional(),
  recurringEndDate: z.string().or(z.date()).transform(val => new Date(val)).optional(),
});

const importBudgetSchema = z.object({
  categoryName: z.string(),
  amount: z.number().or(z.string().transform(val => parseFloat(val))),
  period: z.enum(["monthly", "yearly"]),
  startDate: z.string().or(z.date()).transform(val => new Date(val)),
  endDate: z.string().or(z.date()).transform(val => new Date(val)),
});

const importGoalSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  targetAmount: z.number().or(z.string().transform(val => parseFloat(val))),
  currentAmount: z.number().or(z.string().transform(val => parseFloat(val))).optional().default(0),
  targetDate: z.string().or(z.date()).transform(val => new Date(val)),
  category: z.string(),
});

const importCollaborativeGoalSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  targetAmount: z.number().or(z.string().transform(val => parseFloat(val))),
  currentAmount: z.number().or(z.string().transform(val => parseFloat(val))).optional().default(0),
  targetDate: z.string().or(z.date()).transform(val => new Date(val)),
  category: z.string(),
  challengeType: z.enum(["collaborative", "competitive", "milestone"]),
  isPublic: z.boolean().optional().default(false),
});

const importCategorySchema = z.object({
  name: z.string(),
  type: z.enum(["income", "expense", "goal"]),
  icon: z.string().optional().default("DollarSign"),
  color: z.string().optional().default("#10B981"),
});

const importDataSchema = z.object({
  incomes: z.array(z.any()).optional().default([]),
  expenses: z.array(z.any()).optional().default([]),
  categories: z.array(z.any()).optional().default([]),
  budgets: z.array(z.any()).optional().default([]),
  goals: z.array(z.any()).optional().default([]),
  collaborativeGoals: z.array(z.any()).optional().default([]),
});

// CSV parsing utility with auto-delimiter detection
function parseCSV(csvContent: string): Record<string, any>[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];
  
  // Auto-detect delimiter: check if semicolon is more common than comma in the header
  const headerLine = lines[0];
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ';' : ',';
  
  const headers = headerLine.split(delimiter).map(h => h.trim().replace(/"/g, ''));
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim().replace(/"/g, ''));
    if (values.length === headers.length) {
      const row: Record<string, any> = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      rows.push(row);
    }
  }
  
  return rows;
}

// CSV to JSON converter for financial data
function convertCSVToJSON(csvData: Record<string, any>[]): any {
  const result = {
    incomes: [] as any[],
    expenses: [] as any[],
    categories: [] as any[],
    budgets: [] as any[],
    goals: [] as any[],
    collaborativeGoals: [] as any[]
  };

  const errors: string[] = [];

  csvData.forEach((row, index) => {
    const dataType = row.dataType?.toLowerCase();
    
    if (!dataType) {
      errors.push(`Row ${index + 2}: Missing dataType`);
      return;
    }

    // Skip validation here - we'll handle it in the processing section for better error messages
    
    try {
      // Process transactions
      if (dataType === 'transaction') {
        // Validate transaction fields
        if (!row.amount || isNaN(parseFloat(row.amount))) {
          errors.push(`Row ${index + 2}: amount is required and must be a valid number`);
          return;
        }
        if (!row.description || row.description.trim() === '') {
          errors.push(`Row ${index + 2}: description is required`);
          return;
        }
        if (!row.date) {
          errors.push(`Row ${index + 2}: date is required`);
          return;
        }
        if (!row.transactionType || !['income', 'expense'].includes(row.transactionType)) {
          errors.push(`Row ${index + 2}: transactionType must be either "income" or "expense"`);
          return;
        }
        
        // Validate recurring frequency if provided
        if (row.isRecurring === 'true' && row.recurringFrequency) {
          const frequency = row.recurringFrequency.toLowerCase();
          if (!['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(frequency)) {
            errors.push(`Row ${index + 2}: recurringFrequency must be one of: daily, weekly, monthly, quarterly, yearly`);
            return;
          }
        }
        
        const transaction = formatTransaction(row);
        
        if (row.transactionType === 'income') {
          result.incomes.push(transaction);
        } else if (row.transactionType === 'expense') {
          result.expenses.push(transaction);
        }
      }
      
      // Process budgets
      else if (dataType === 'budget') {
        // Check if category exists for budget
        if (!row.category || row.category.trim() === '') {
          errors.push(`Row ${index + 2}: category is required for budgets`);
          return;
        }
        
        // Check if budgetAmount exists
        if (!row.budgetAmount || isNaN(parseFloat(row.budgetAmount))) {
          errors.push(`Row ${index + 2}: budgetAmount is required and must be a valid number`);
          return;
        }
        
        const budget = formatBudget(row);
        result.budgets.push(budget);
      }
      
      // Process goals
      else if (dataType === 'goal') {
        // Validate goal fields
        if (!row.goalTargetAmount || isNaN(parseFloat(row.goalTargetAmount))) {
          errors.push(`Row ${index + 2}: goalTargetAmount is required and must be a valid number`);
          return;
        }
        if (!row.goalTargetDate) {
          errors.push(`Row ${index + 2}: goalTargetDate is required`);
          return;
        }
        if (!row.goalCategory || row.goalCategory.trim() === '') {
          errors.push(`Row ${index + 2}: goalCategory is required`);
          return;
        }
        
        const goal = formatGoal(row);
        result.goals.push(goal);
      }
    } catch (error) {
      errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : 'Processing error'}`);
    }
  });

  if (errors.length > 0) {
    throw new Error(`CSV validation errors:\n${errors.join('\n')}`);
  }

  return result;
}

// Store active SSE connections for progress updates.
//
// The key includes the account. The session id is chosen by the client, so two people can
// legitimately pick the same one; keyed on the id alone, whoever connected second took the
// stream over and the first person silently stopped receiving updates.
const progressConnections = new Map<string, any>();
const progressKey = (userId: string, sessionId: string) => `${userId}:${sessionId}`;

export function registerImportRoutes(app: Express) {
  
  // SSE endpoint for PDF processing progress
  app.get('/api/import/pdf-progress/:sessionId', isAuthenticated, (req: any, res) => {
    const { sessionId } = req.params;
    const userId = getUserId(req);
    if (!userId || typeof sessionId !== 'string' || !sessionId || sessionId.length > 128) {
      return res.status(400).json({ error: 'Invalid progress session' });
    }
    const key = progressKey(userId, sessionId);

    log.info(`[PDF Progress] New SSE connection for session: ${sessionId}`);
    
    try {
      // Set headers for SSE
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      // Store connection for this session
      progressConnections.set(key, res);
      log.info(`[PDF Progress] Connection stored for session: ${sessionId}`);

      // Send initial connection confirmation
      const initialMessage = JSON.stringify({ 
        stage: 'connected', 
        percentage: 0, 
        message: 'Connected to progress stream' 
      });
      res.write(`data: ${initialMessage}\n\n`);
      log.info(`[PDF Progress] Initial message sent for session: ${sessionId}`);

      // Clean up on client disconnect
      req.on('close', () => {
        log.info(`[PDF Progress] Client disconnected for session: ${sessionId}`);
        progressConnections.delete(key);
      });
      
      // Handle errors
      req.on('error', (error: any) => {
        log.error(`[PDF Progress] Request error for session ${sessionId}:`, error);
        progressConnections.delete(key);
      });
      
    } catch (error) {
      log.error(`[PDF Progress] Error setting up SSE for session ${sessionId}:`, error);
      res.status(500).json({ error: 'Failed to establish progress connection' });
    }
  });
  // Get import logs for a user
  app.get('/api/import-logs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const user = await storage.getUser(userId);
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "Data import requires Premium subscription" });
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const logs = await storage.getUserImportLogs(userId, limit);
      
      return res.json(logs);
    } catch (error) {
      log.error("Error fetching import logs:", error);
      return res.status(500).json({ message: "Failed to fetch import logs" });
    }
  });

  app.post('/api/import-data', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const user = await storage.getUser(userId);
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "Data import requires Premium subscription" });
      }

      const { content, format } = req.body;
      
      if (!content) {
        return res.status(400).json({ message: "Content is required" });
      }

      let importData: any;
      
      // Parse content based on format
      if (format === 'csv') {
        const csvData = parseCSV(content);
        importData = convertCSVToJSON(csvData);
      } else if (format === 'json') {
        try {
          importData = JSON.parse(content);
        } catch (error) {
          return res.status(400).json({ message: "Invalid JSON format" });
        }
      } else {
        return res.status(400).json({ message: "Unsupported format. Use 'json' or 'csv'" });
      }

      // Validate the import data structure
      const validationResult = importDataSchema.safeParse(importData);
      if (!validationResult.success) {
        log.error("Import data validation failed:", validationResult.error.issues);
        log.error("Import data structure:", JSON.stringify(importData, null, 2));
        return res.status(400).json({ 
          message: "Invalid data structure", 
          errors: validationResult.error.issues 
        });
      }

      const validData = validationResult.data;
      const summary = {
        categories: 0,
        incomes: 0,
        expenses: 0,
        budgets: 0,
        goals: 0,
        collaborativeGoals: 0,
        errors: [] as string[]
      };

      // Create a map to store category name to ID mapping
      const categoryMap = new Map<string, number>();
      
      // Get existing categories for the user
      const existingCategories = await storage.getCategories(userId);
      existingCategories.forEach(cat => {
        categoryMap.set(`${cat.name}_${cat.type}`, cat.id);
      });

      // Process categories first (create missing ones)
      for (const categoryData of validData.categories) {
        try {
          const categoryKey = `${categoryData.name}_${categoryData.type}`;
          
          if (!categoryMap.has(categoryKey)) {
            const newCategory = await storage.createCategory({
              userId,
              name: categoryData.name,
              type: categoryData.type,
              icon: categoryData.icon,
              color: categoryData.color,
            });
            categoryMap.set(categoryKey, newCategory.id);
            summary.categories++;
          }
        } catch (error) {
          summary.errors.push(`Failed to create category "${categoryData.name}": ${error}`);
        }
      }

      // Process income transactions
      for (const incomeData of validData.incomes) {
        try {
          let categoryId = null;
          if (incomeData.categoryName) {
            categoryId = await ensureCategoryExists(incomeData.categoryName, 'income', userId);
            if (!categoryMap.has(`${incomeData.categoryName}_income`)) {
              categoryMap.set(`${incomeData.categoryName}_income`, categoryId);
              summary.categories++;
            }
          }

          await storage.createTransaction({
            userId, // Security: Always use authenticated user's ID
            categoryId,
            amount: incomeData.amount.toString(),
            description: incomeData.description,
            type: 'income',
            date: incomeData.date,
            isRecurring: incomeData.isRecurring,
            recurringFrequency: incomeData.recurringFrequency,
            recurringEndDate: incomeData.recurringEndDate,
          });
          summary.incomes++;
        } catch (error) {
          summary.errors.push(`Failed to create income transaction: ${error}`);
        }
      }

      // Process expense transactions
      for (const expenseData of validData.expenses) {
        try {
          let categoryId = null;
          if (expenseData.categoryName) {
            categoryId = await ensureCategoryExists(expenseData.categoryName, 'expense', userId);
            if (!categoryMap.has(`${expenseData.categoryName}_expense`)) {
              categoryMap.set(`${expenseData.categoryName}_expense`, categoryId);
              summary.categories++;
            }
          }

          await storage.createTransaction({
            userId, // Security: Always use authenticated user's ID
            categoryId,
            amount: expenseData.amount.toString(),
            description: expenseData.description,
            type: 'expense',
            date: expenseData.date,
            isRecurring: expenseData.isRecurring,
            recurringFrequency: expenseData.recurringFrequency,
            recurringEndDate: expenseData.recurringEndDate,
          });
          summary.expenses++;
        } catch (error) {
          summary.errors.push(`Failed to create expense transaction: ${error}`);
        }
      }

      // Process budgets
      for (const budgetData of validData.budgets) {
        try {
          let categoryId = null;
          if (budgetData.categoryName) {
            categoryId = await ensureCategoryExists(budgetData.categoryName, 'expense', userId);
            if (!categoryMap.has(`${budgetData.categoryName}_budget`)) {
              categoryMap.set(`${budgetData.categoryName}_budget`, categoryId);
            }
          }

          await storage.createBudget({
            userId, // Security: Always use authenticated user's ID
            categoryId,
            amount: budgetData.amount.toString(),
            period: budgetData.period,
            startDate: budgetData.startDate,
            endDate: budgetData.endDate,
          });
          summary.budgets++;
        } catch (error) {
          summary.errors.push(`Failed to create budget: ${error}`);
        }
      }

      // Process goals
      for (const goalData of validData.goals) {
        try {
          await storage.createGoal({
            userId,
            name: goalData.name,
            description: goalData.description || '',
            targetAmount: goalData.targetAmount.toString(),
            currentAmount: goalData.currentAmount.toString(),
            targetDate: goalData.targetDate,
            category: goalData.category,
            status: 'active',
          });
          summary.goals++;
        } catch (error) {
          summary.errors.push(`Failed to create goal "${goalData.name}": ${error}`);
        }
      }

      // Process collaborative goals
      for (const collabGoalData of validData.collaborativeGoals) {
        try {
          await storage.createCollaborativeGoal({
            name: collabGoalData.name,
            description: collabGoalData.description || '',
            targetAmount: collabGoalData.targetAmount.toString(),
            currentAmount: collabGoalData.currentAmount.toString(),
            targetDate: collabGoalData.targetDate,
            category: collabGoalData.category,
            challengeType: collabGoalData.challengeType,
            status: 'active',
            createdBy: userId,
            isPublic: collabGoalData.isPublic,
          });
          summary.collaborativeGoals++;
        } catch (error) {
          summary.errors.push(`Failed to create collaborative goal "${collabGoalData.name}": ${error}`);
        }
      }

      // Create import summary and log the import
      const importSummary = createImportSummary(summary);
      const importStatus = determineImportStatus(importSummary);
      
      // Extract filename from content or use default
      const filename = `import_${new Date().toISOString().split('T')[0]}.${format}`;
      
      // Save import log
      await saveImportLog(
        userId,
        importSummary,
        filename,
        format as 'csv' | 'json',
        importStatus
      );

      // Clear all AI caches after successful import to trigger fresh AI insights
      // Cache system removed - direct AI calls only
      
      log.info(`Cleared all AI caches for user ${userId} after data import`);

      return res.json({
        success: true,
        message: "Data imported successfully",
        summary,
        cacheCleared: true // Signal frontend to invalidate local cache
      });

    } catch (error) {
      log.error("Error importing data:", error);
      
      // Log failed import
      try {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        const { format } = req.body;
        const filename = `import_${new Date().toISOString().split('T')[0]}.${format || 'unknown'}`;
        
        // Ensure userId is available for error logging
        const currentUserId = getUserId(req);
        if (currentUserId) {
          await saveImportLog(
            currentUserId,
            createImportSummary({
              categories: 0,
              incomes: 0,
              expenses: 0,
              budgets: 0,
              goals: 0,
              collaborativeGoals: 0,
              errors: [errorMessage]
            }),
            filename,
            (format as 'csv' | 'json') || 'csv',
            'failed',
            errorMessage
          );
        }
      } catch (logError) {
        log.error("Failed to log import error:", logError);
      }
      
      return res.status(500).json({ 
        message: "Failed to import data", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // PDF Bank Statement Upload Route
  app.post("/api/import/pdf-statement", isAuthenticated, rateLimit({ windowMs: 10 * 60 * 1000, max: 10, keyPrefix: 'pdf-statement', perUser: true }), upload.single('pdf'), async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Reading a PDF statement means AI parsing, so the same gate applies as every other
      // AI feature: paid plan + the account switch on.
      const access = await checkAiAccess(userId);
      if (!access?.allowed) {
        return denyAi(res, access?.code ?? 'unauthenticated');
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No PDF file uploaded' });
      }

      // Get session ID for progress tracking
      const rawSessionId = req.headers['x-session-id'] as string || Date.now().toString();
      // Same 128-character ceiling the progress stream enforces, so a stream can always match.
      const sessionId = rawSessionId.length <= 128 ? rawSessionId : Date.now().toString();
      const language = req.headers['x-user-language'] as string || 'en-us';

      log.info(`Processing PDF bank statement for user ${userId}, session ${sessionId}, file size: ${req.file.size} bytes`);

      // Get existing transactions for duplicate detection (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const existingTransactions = await storage.getUserTransactions(userId);
      
      // Filter to last 6 months and format for duplicate detection
      const formattedExisting = existingTransactions
        .filter(tx => tx.date >= sixMonthsAgo)
        .map(tx => ({
          id: tx.id,
          date: tx.date.toISOString().split('T')[0],
          description: tx.description,
          amount: parseFloat(tx.amount),
          type: tx.type as 'income' | 'expense'
        }));

      log.info(`Found ${formattedExisting.length} existing transactions for duplicate detection`);

      // Progress callback function
      const onProgress = (progress: any) => {
        const connection = progressConnections.get(progressKey(userId, sessionId));
        if (connection) {
          connection.write(`data: ${JSON.stringify(progress)}\n\n`);
        }
      };

      // Process the PDF using our hybrid approach with duplicate detection and progress tracking
      const processingResult = await processBankStatementPDF(req.file.buffer, language, formattedExisting, onProgress, userId);

      // Validate extracted transactions
      const validationResult = validateTransactions(processingResult.transactions);

      // Prepare response with processing details including duplicates
      const response = {
        success: true,
        processingMethod: processingResult.processingMethod,
        totalPages: processingResult.totalPages,
        extractedTransactions: validationResult.valid.length,
        invalidTransactions: validationResult.invalid.length,
        overallConfidence: processingResult.confidence,
        errors: processingResult.errors,
        transactions: validationResult.valid,
        invalidData: validationResult.invalid,
        duplicates: processingResult.duplicates || [],
        preview: true // Indicates this is for preview, not final import
      };

      log.info(`PDF processing completed: ${validationResult.valid.length} valid transactions extracted`);

      // Import invariants (blueprint 07 §18): zero-amount rows, unparseable dates and rows
      // lost between "parsed" and "imported + duplicate + invalid" are silent data bugs.
      // The parser does not expose the raw text length, so the emptiness check is skipped.
      for (const violation of checkImport({
        textLength: 0,
        parsedCount:
          validationResult.valid.length +
          (processingResult.duplicates?.length ?? 0) +
          validationResult.invalid.length,
        importedCount: validationResult.valid.length,
        duplicateCount: processingResult.duplicates?.length ?? 0,
        invalidCount: validationResult.invalid.length,
        rows: validationResult.valid.map((transaction: { date?: string; amount?: number | string }) => ({
          date: transaction.date ?? null,
          amountCents:
            transaction.amount == null ? null : Math.round(Number(transaction.amount) * 100),
        })),
      })) {
        reportInvariant(violation.code, {
          expected: violation.expected,
          actual: violation.actual,
          where: 'importRoutes.processBankStatementPDF',
        });
      }

      return res.json(response);

    } catch (error) {
      log.error('PDF processing error:', error);
      
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to process PDF bank statement',
        success: false
      });
    }
  });

  // Rows read from a bank's CSV/Excel export (parsed in the browser by
  // shared/statementImport.ts). No AI is involved, so any paid plan may use it; the server
  // validates every row again and flags likely duplicates of what is already recorded.
  app.post('/api/import/statement-preview',
    isAuthenticated,
    rateLimit({ windowMs: 10 * 60 * 1000, max: 20, keyPrefix: 'statement-preview', perUser: true }),
    async (req: any, res: any) => {
      try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ error: 'Authentication required' });

        const user = await storage.getUser(userId);
        if (!user || user.plan === 'free') {
          return res.status(403).json({ error: 'Importing an account file requires the Standard or Premium plan', code: 'plan_required' });
        }

        const parsed = z.object({
          transactions: z.array(z.object({
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            description: z.string().trim().min(1).max(300),
            amount: z.number().positive().max(999_999_999),
            type: z.enum(['income', 'expense']),
          })).min(1).max(5000),
        }).safeParse(req.body);

        if (!parsed.success) {
          return res.status(400).json({ error: 'Invalid statement rows' });
        }

        const oneYearAgo = new Date(Date.now() - 366 * 24 * 60 * 60 * 1000);
        const existing = (await storage.getUserTransactions(userId))
          .filter((tx) => tx.date >= oneYearAgo)
          .map((tx) => ({
            id: tx.id,
            date: tx.date.toISOString().split('T')[0],
            description: tx.description,
            amount: parseFloat(tx.amount),
            type: tx.type as 'income' | 'expense',
          }));

        const rows = parsed.data.transactions.map((row) => ({ ...row, confidence: 1 }));
        const duplicates = detectDuplicateTransactions(rows, existing);

        return res.json({
          success: true,
          processingMethod: 'file',
          totalPages: 1,
          extractedTransactions: rows.length,
          invalidTransactions: 0,
          overallConfidence: 1,
          errors: [],
          transactions: rows,
          invalidData: [],
          duplicates,
          preview: true,
        });
      } catch (error) {
        log.error('Statement preview error:', error instanceof Error ? error.message : error);
        return res.status(500).json({ error: 'Could not prepare the preview', success: false });
      }
    });

  // Final import endpoint - saves transactions and creates the categories the person named.
  app.post('/api/import/bank-statement/confirm', isAuthenticated, rateLimit({ windowMs: 10 * 60 * 1000, max: 10, keyPrefix: 'statement-confirm', perUser: true }), async (req: any, res: any) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const user = await storage.getUser(userId);
      if (!user || user.plan === 'free') {
        return res.status(403).json({ error: 'Importing transactions requires the Standard or Premium plan', code: 'plan_required' });
      }

      const { transactions } = req.body;

      if (!transactions || !Array.isArray(transactions)) {
        return res.status(400).json({ error: 'Transactions array is required' });
      }
      if (transactions.length > 5000) {
        return res.status(400).json({ error: 'Too many transactions in one import (5000 max)' });
      }

      // Categories are matched by name within the transaction's own type (an income called
      // "Salary" and an expense called "Salary" are different categories) and created when
      // they do not exist yet.
      const categories = await storage.getCategories(userId);
      const categoryIdByKey = new Map<string, number>();
      categories.forEach((category) => categoryIdByKey.set(`${category.type}|${category.name.toLowerCase()}`, category.id));
      let createdCategories = 0;

      const savedTransactions = [];
      const errors: string[] = [];

      for (const transaction of transactions) {
        try {
          const amount = Math.abs(parseFloat(transaction.amount));
          // yyyy-MM-dd means a calendar day: noon UTC shows the same day in every timezone
          // (midnight UTC would display as the previous evening in Lima).
          const rawDate = String(transaction.date ?? '');
          const date = /^d{4}-d{2}-d{2}$/.test(rawDate) ? new Date(`${rawDate}T12:00:00Z`) : new Date(transaction.date);
          const description = String(transaction.description ?? '').trim();
          const type: 'income' | 'expense' = transaction.type === 'income' ? 'income' : 'expense';

          if (!Number.isFinite(amount) || amount <= 0 || Number.isNaN(date.getTime()) || !description) {
            errors.push(`Skipped an invalid row: ${description || '(no description)'}`);
            continue;
          }

          let categoryId: number | null = null;
          if (Number.isInteger(transaction.categoryId)) {
            // Only the person's own (or shared default) categories may be used.
            categoryId = categories.some((category) => category.id === transaction.categoryId) ? transaction.categoryId : null;
          } else if (typeof transaction.category === 'string' && transaction.category.trim()) {
            const name = transaction.category.trim().slice(0, 60);
            const key = `${type}|${name.toLowerCase()}`;
            let id = categoryIdByKey.get(key);
            if (!id) {
              const created = await storage.createCategory({ userId, name, type, icon: 'Tag', color: '#6366f1' });
              id = created.id;
              categoryIdByKey.set(key, id);
              createdCategories++;
            }
            categoryId = id;
          }

          const savedTransaction = await storage.createTransaction({
            userId,
            amount: String(amount),
            description,
            date,
            type,
            categoryId,
            referenceNote: transaction.reference || null,
            isRecurring: false,
            imageUrl: null,
          });
          savedTransactions.push(savedTransaction);
        } catch (error) {
          log.error('Failed to save an imported transaction:', error instanceof Error ? error.message : error);
          errors.push(`Failed to save: ${String(transaction?.description ?? '').slice(0, 80)}`);
        }
      }

      if (savedTransactions.length > 0) {
        notifyDataChange(userId, 'transaction');
      }

      return res.json({
        success: true,
        savedTransactions: savedTransactions.length,
        createdCategories,
        errors
      });

    } catch (error) {
      log.error('Final import error:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to complete import',
        success: false
      });
    }
  });
}