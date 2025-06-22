import { storage } from "../server/storage";
import { getUserId } from "../server/clerkAuth";
import type { Request } from "express";

/**
 * Ensures a category exists for the user. If not, creates it with default icon and color.
 * @param name - Category name
 * @param type - Category type (expense or income)
 * @param userId - User ID
 * @returns Category ID
 */
export async function ensureCategoryExists(
  name: string, 
  type: "expense" | "income", 
  userId: string
): Promise<number> {
  // Get existing categories for the user
  const categories = await storage.getCategories(userId);
  
  // Check if category already exists
  const existingCategory = categories.find(
    cat => cat.name === name && cat.type === type
  );
  
  if (existingCategory) {
    return existingCategory.id;
  }
  
  // Create new category with appropriate defaults
  const defaultIcons = {
    income: {
      'Salary': 'DollarSign',
      'Freelance': 'Briefcase',
      'Investment': 'TrendingUp',
      'Business': 'Building',
      'Rental': 'Home',
      'Other': 'Plus'
    },
    expense: {
      'Housing': 'Home',
      'Food & Dining': 'Utensils',
      'Transportation': 'Car',
      'Utilities': 'Zap',
      'Healthcare': 'Heart',
      'Entertainment': 'Music',
      'Shopping': 'ShoppingBag',
      'Education': 'BookOpen',
      'Insurance': 'Shield',
      'Other': 'Minus'
    }
  };
  
  const defaultColors = {
    income: {
      'Salary': '#10B981',
      'Freelance': '#059669',
      'Investment': '#0D9488',
      'Business': '#0F766E',
      'Rental': '#047857',
      'Other': '#065F46'
    },
    expense: {
      'Housing': '#EF4444',
      'Food & Dining': '#F59E0B',
      'Transportation': '#3B82F6',
      'Utilities': '#8B5CF6',
      'Healthcare': '#EC4899',
      'Entertainment': '#F97316',
      'Shopping': '#84CC16',
      'Education': '#06B6D4',
      'Insurance': '#6366F1',
      'Other': '#64748B'
    }
  };
  
  const icon = defaultIcons[type][name as keyof typeof defaultIcons[typeof type]] || 
               (type === 'income' ? 'DollarSign' : 'ShoppingCart');
  const color = defaultColors[type][name as keyof typeof defaultColors[typeof type]] || 
                (type === 'income' ? '#10B981' : '#EF4444');
  
  const newCategory = await storage.createCategory({
    userId,
    name,
    type,
    icon,
    color
  });
  
  return newCategory.id;
}

/**
 * Formats transaction data from CSV row into proper schema format
 * @param data - Raw CSV row data
 * @returns Formatted transaction object
 */
export function formatTransaction(data: any) {
  // Parse and validate date
  let formattedDate: Date;
  try {
    formattedDate = new Date(data.date);
    if (isNaN(formattedDate.getTime())) {
      throw new Error('Invalid date');
    }
  } catch {
    formattedDate = new Date(); // Default to current date if invalid
  }
  
  // Parse amount
  const amount = parseFloat(data.amount || '0');
  if (isNaN(amount) || amount <= 0) {
    throw new Error(`Invalid amount: ${data.amount}`);
  }
  
  // Parse recurring settings
  const isRecurring = data.isRecurring === 'true' || data.isRecurring === true;
  const recurringFrequency = isRecurring && data.recurringFrequency ? 
    data.recurringFrequency : undefined;
  
  // Parse recurring end date if provided
  let recurringEndDate: Date | undefined;
  if (isRecurring && data.recurringEndDate) {
    try {
      recurringEndDate = new Date(data.recurringEndDate);
      if (isNaN(recurringEndDate.getTime())) {
        recurringEndDate = undefined;
      }
    } catch {
      recurringEndDate = undefined;
    }
  }
  
  return {
    amount: amount.toString(), // Convert to string for decimal storage
    description: data.description?.trim() || 'Imported transaction',
    type: data.transactionType || data.type,
    date: formattedDate,
    categoryName: data.category?.trim(),
    isRecurring,
    recurringFrequency,
    recurringEndDate
  };
}

/**
 * Formats budget data from CSV row into proper schema format
 * @param data - Raw CSV row data
 * @returns Formatted budget object
 */
export function formatBudget(data: any) {
  const amount = parseFloat(data.budgetAmount || '0');
  if (isNaN(amount) || amount <= 0) {
    throw new Error(`Invalid budget amount: ${data.budgetAmount}`);
  }
  
  const period = data.budgetPeriod?.toLowerCase() || 'monthly';
  if (!['monthly', 'yearly'].includes(period)) {
    throw new Error(`Invalid budget period: ${data.budgetPeriod}. Must be 'monthly' or 'yearly'`);
  }
  
  // Generate start and end dates based on period
  const now = new Date();
  let startDate: Date;
  let endDate: Date;
  
  if (period === 'monthly') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else { // yearly
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear(), 11, 31);
  }
  
  return {
    categoryName: data.category?.trim(),
    amount: amount.toString(),
    period,
    startDate,
    endDate
  };
}

/**
 * Formats goal data from CSV row into proper schema format
 * @param data - Raw CSV row data
 * @returns Formatted goal object
 */
export function formatGoal(data: any) {
  const targetAmount = parseFloat(data.goalTargetAmount || '0');
  if (isNaN(targetAmount) || targetAmount <= 0) {
    throw new Error(`Invalid goal target amount: ${data.goalTargetAmount}`);
  }
  
  const currentAmount = parseFloat(data.goalCurrentAmount || '0');
  if (isNaN(currentAmount) || currentAmount < 0) {
    throw new Error(`Invalid goal current amount: ${data.goalCurrentAmount}`);
  }
  
  // Parse target date
  let targetDate: Date;
  try {
    targetDate = new Date(data.goalTargetDate);
    if (isNaN(targetDate.getTime())) {
      throw new Error('Invalid target date');
    }
  } catch {
    // Default to one year from now if invalid
    targetDate = new Date();
    targetDate.setFullYear(targetDate.getFullYear() + 1);
  }
  
  const category = data.goalCategory?.trim() || 'Other';
  
  return {
    name: category,
    description: `Goal for ${category}`,
    targetAmount: targetAmount.toString(),
    currentAmount: currentAmount.toString(),
    targetDate,
    category,
    status: 'active'
  };
}

/**
 * Extracts user ID from request using Clerk authentication
 * @param req - Express request object
 * @returns User ID string
 * @throws Error if user is not authenticated
 */
export function getUserFromRequest(req: Request): string {
  const userId = getUserId(req as any);
  if (!userId) {
    throw new Error('User authentication required');
  }
  return userId;
}

/**
 * Validates that required fields are present for a specific data type
 * @param data - CSV row data
 * @param dataType - Type of data (transaction, budget, goal)
 * @returns Validation result
 */
export function validateRequiredFields(data: any, dataType: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  switch (dataType.toLowerCase()) {
    case 'transaction':
      if (!data.transactionType) errors.push('transactionType is required for transactions');
      if (!data.amount) errors.push('amount is required for transactions');
      if (!data.description) errors.push('description is required for transactions');
      if (!data.date) errors.push('date is required for transactions');
      if (!data.category) errors.push('category is required for transactions');
      break;
      
    case 'budget':
      if (!data.category) errors.push('category is required for budgets');
      if (!data.budgetAmount) errors.push('budgetAmount is required for budgets');
      break;
      
    case 'goal':
      if (!data.goalTargetAmount) errors.push('goalTargetAmount is required for goals');
      if (!data.goalTargetDate) errors.push('goalTargetDate is required for goals');
      if (!data.goalCategory) errors.push('goalCategory is required for goals');
      break;
      
    default:
      errors.push(`Unknown data type: ${dataType}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Creates a hash from data for deduplication purposes
 * @param data - Data to hash
 * @returns Simple hash string
 */
export function createDataHash(data: any): string {
  const key = `${data.type}-${data.amount}-${data.description}-${data.date}`;
  return Buffer.from(key).toString('base64').slice(0, 16);
}