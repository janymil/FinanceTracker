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
import { 
  saveImportLog, 
  createImportSummary, 
  determineImportStatus 
} from "../../lib/saveImportLog";

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
  incomes: z.array(importTransactionSchema).optional().default([]),
  expenses: z.array(importTransactionSchema).optional().default([]),
  categories: z.array(importCategorySchema).optional().default([]),
  budgets: z.array(importBudgetSchema).optional().default([]),
  goals: z.array(importGoalSchema).optional().default([]),
  collaborativeGoals: z.array(importCollaborativeGoalSchema).optional().default([]),
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

    // Validate required fields
    const validation = validateRequiredFields(row, dataType);
    if (!validation.valid) {
      errors.push(`Row ${index + 2}: ${validation.errors.join(', ')}`);
      return;
    }
    
    try {
      // Process transactions
      if (dataType === 'transaction') {
        const transaction = formatTransaction(row);
        
        if (row.transactionType === 'income') {
          result.incomes.push(transaction);
        } else if (row.transactionType === 'expense') {
          result.expenses.push(transaction);
        }
      }
      
      // Process budgets
      else if (dataType === 'budget') {
        const budget = formatBudget(row);
        result.budgets.push(budget);
      }
      
      // Process goals
      else if (dataType === 'goal') {
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

export function registerImportRoutes(app: Express) {
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

      return res.json({
        success: true,
        message: "Data imported successfully",
        summary,
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
}