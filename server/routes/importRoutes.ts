import type { Express } from "express";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";
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

// Store active SSE connections for progress updates
const progressConnections = new Map<string, Express.Response>();

export function registerImportRoutes(app: Express) {
  
  // SSE endpoint for PDF processing progress
  app.get('/api/import/pdf-progress/:sessionId', isAuthenticated, (req, res) => {
    const { sessionId } = req.params;
    
    // Set headers for SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Store connection for this session
    progressConnections.set(sessionId, res);

    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({ stage: 'connected', percentage: 0, message: 'Connected to progress stream' })}\n\n`);

    // Clean up on client disconnect
    req.on('close', () => {
      progressConnections.delete(sessionId);
    });
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
      console.error("Error fetching import logs:", error);
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
        console.error("Import data validation failed:", validationResult.error.issues);
        console.error("Import data structure:", JSON.stringify(importData, null, 2));
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
      // Cache system removed - direct Fly.io calls only
      
      console.log(`Cleared all AI caches for user ${userId} after data import`);

      return res.json({
        success: true,
        message: "Data imported successfully",
        summary,
        cacheCleared: true // Signal frontend to invalidate local cache
      });

    } catch (error) {
      console.error("Error importing data:", error);
      
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
        console.error("Failed to log import error:", logError);
      }
      
      return res.status(500).json({ 
        message: "Failed to import data", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // PDF Bank Statement Upload Route
  app.post("/api/import/pdf-statement", upload.single('pdf'), async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No PDF file uploaded' });
      }

      // Get session ID for progress tracking
      const sessionId = req.headers['x-session-id'] as string || Date.now().toString();
      const language = req.headers['x-user-language'] as string || 'en-us';

      console.log(`Processing PDF bank statement for user ${userId}, session ${sessionId}, file size: ${req.file.size} bytes`);

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

      console.log(`Found ${formattedExisting.length} existing transactions for duplicate detection`);

      // Progress callback function
      const onProgress = (progress: any) => {
        const connection = progressConnections.get(sessionId);
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

      console.log(`PDF processing completed: ${validationResult.valid.length} valid transactions extracted`);

      return res.json(response);

    } catch (error) {
      console.error('PDF processing error:', error);
      
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to process PDF bank statement',
        success: false
      });
    }
  });

  // Final import endpoint - saves transactions and creates user-edited categories
  app.post('/api/import/bank-statement/confirm', isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { transactions, categoryMappings } = req.body;
      
      if (!transactions || !Array.isArray(transactions)) {
        return res.status(400).json({ error: 'Transactions array is required' });
      }

      console.log(`Processing final import for ${transactions.length} transactions with category mappings`);

      // Step 1: Create new categories from user-edited names
      const categoryNameToIdMap: Record<string, number> = {};
      
      if (categoryMappings && typeof categoryMappings === 'object') {
        for (const [originalName, userEditedName] of Object.entries(categoryMappings)) {
          if (userEditedName && typeof userEditedName === 'string') {
            try {
              // Check if category already exists
              const existingCategories = await storage.getCategories(userId);
              const existingCategory = existingCategories.find(cat => 
                cat.name.toLowerCase() === userEditedName.toLowerCase() && cat.type === 'expense'
              );
              
              if (existingCategory) {
                categoryNameToIdMap[originalName] = existingCategory.id;
                console.log(`Using existing category: ${userEditedName} (ID: ${existingCategory.id})`);
              } else {
                const newCategory = await storage.createCategory(userId, {
                  name: userEditedName,
                  type: 'expense',
                  description: `Created from bank statement import`
                });
                categoryNameToIdMap[originalName] = newCategory.id;
                console.log(`Created new category: ${userEditedName} (ID: ${newCategory.id})`);
              }
            } catch (error) {
              console.error(`Failed to create/find category ${userEditedName}:`, error);
            }
          }
        }
      }

      // Step 2: Process and save transactions
      const savedTransactions = [];
      const errors = [];

      for (const transaction of transactions) {
        try {
          // Determine category ID
          let categoryId = null;
          
          if (transaction.categoryId) {
            // Existing category ID
            categoryId = transaction.categoryId;
          } else if (transaction.category && categoryNameToIdMap[transaction.category]) {
            // New category created from mapping
            categoryId = categoryNameToIdMap[transaction.category];
          }

          const transactionData = {
            amount: Math.abs(parseFloat(transaction.amount)),
            description: transaction.description,
            date: transaction.date,
            type: transaction.type || 'expense',
            categoryId: categoryId,
            reference: transaction.reference || null,
            recurring: false,
            receiptUrl: null
          };

          const savedTransaction = await storage.createTransaction(userId, transactionData);
          savedTransactions.push(savedTransaction);
        } catch (error) {
          console.error(`Failed to save transaction: ${transaction.description}`, error);
          errors.push(`Failed to save: ${transaction.description}`);
        }
      }

      console.log(`Import completed: ${savedTransactions.length} transactions saved, ${errors.length} errors`);

      return res.json({
        success: true,
        savedTransactions: savedTransactions.length,
        createdCategories: Object.keys(categoryNameToIdMap).length,
        errors: errors
      });

    } catch (error) {
      console.error('Final import error:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to complete import',
        success: false
      });
    }
  });
}