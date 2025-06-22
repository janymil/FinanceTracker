import type { Express } from "express";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";
import { z } from "zod";

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

// CSV parsing utility
function parseCSV(csvContent: string): Record<string, any>[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
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

  csvData.forEach(row => {
    // Process transactions (income/expense)
    if (row.type === 'income' || row.type === 'expense') {
      const transaction = {
        amount: parseFloat(row.amount || '0'),
        description: row.description || '',
        type: row.type,
        date: row.date,
        categoryName: row.category || row.categoryName,
        isRecurring: row.isRecurring === 'true' || row.isRecurring === true,
        recurringFrequency: row.recurringFrequency,
        recurringEndDate: row.recurringEndDate,
      };
      
      if (row.type === 'income') {
        result.incomes.push(transaction);
      } else {
        result.expenses.push(transaction);
      }
    }
    
    // Process categories - removed as system will auto-create with default icons/colors
    
    // Process budgets
    if (row.budgetCategory && row.budgetAmount) {
      result.budgets.push({
        categoryName: row.budgetCategory,
        amount: parseFloat(row.budgetAmount),
        period: row.budgetPeriod || 'monthly',
        startDate: row.budgetStartDate,
        endDate: row.budgetEndDate,
      });
    }
    
    // Process goals
    if (row.goalName && row.goalTargetAmount) {
      result.goals.push({
        name: row.goalName,
        description: row.goalDescription,
        targetAmount: parseFloat(row.goalTargetAmount),
        currentAmount: parseFloat(row.goalCurrentAmount || '0'),
        targetDate: row.goalTargetDate,
        category: row.goalCategory || 'Other',
      });
    }
    
    // Process collaborative goals
    if (row.collaborativeGoalName && row.collaborativeGoalTargetAmount) {
      result.collaborativeGoals.push({
        name: row.collaborativeGoalName,
        description: row.collaborativeGoalDescription,
        targetAmount: parseFloat(row.collaborativeGoalTargetAmount),
        currentAmount: parseFloat(row.collaborativeGoalCurrentAmount || '0'),
        targetDate: row.collaborativeGoalTargetDate,
        category: row.collaborativeGoalCategory || 'Other',
        challengeType: row.collaborativeGoalType || 'collaborative',
        isPublic: row.collaborativeGoalIsPublic === 'true',
      });
    }
  });

  return result;
}

export function registerImportRoutes(app: Express) {
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
            const categoryKey = `${incomeData.categoryName}_income`;
            if (!categoryMap.has(categoryKey)) {
              // Create category if it doesn't exist
              const newCategory = await storage.createCategory({
                userId,
                name: incomeData.categoryName,
                type: 'income',
                icon: 'DollarSign',
                color: '#10B981',
              });
              categoryMap.set(categoryKey, newCategory.id);
              summary.categories++;
            }
            categoryId = categoryMap.get(categoryKey) || null;
          }

          await storage.createTransaction({
            userId,
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
            const categoryKey = `${expenseData.categoryName}_expense`;
            if (!categoryMap.has(categoryKey)) {
              // Create category if it doesn't exist
              const newCategory = await storage.createCategory({
                userId,
                name: expenseData.categoryName,
                type: 'expense',
                icon: 'ShoppingCart',
                color: '#EF4444',
              });
              categoryMap.set(categoryKey, newCategory.id);
              summary.categories++;
            }
            categoryId = categoryMap.get(categoryKey) || null;
          }

          await storage.createTransaction({
            userId,
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
            const categoryKey = `${budgetData.categoryName}_expense`;
            if (!categoryMap.has(categoryKey)) {
              // Create category if it doesn't exist
              const newCategory = await storage.createCategory({
                userId,
                name: budgetData.categoryName,
                type: 'expense',
                icon: 'Target',
                color: '#8B5CF6',
              });
              categoryMap.set(categoryKey, newCategory.id);
              summary.categories++;
            }
            categoryId = categoryMap.get(categoryKey) || null;
          }

          await storage.createBudget({
            userId,
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

      return res.json({
        success: true,
        message: "Data imported successfully",
        summary,
      });

    } catch (error) {
      console.error("Error importing data:", error);
      return res.status(500).json({ 
        message: "Failed to import data", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });
}