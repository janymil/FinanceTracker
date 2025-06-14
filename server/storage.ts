import {
  users,
  transactions,
  recurringTransactions,
  budgets,
  categories,
  expenseReminders,
  type User,
  type InsertUser,
  type Transaction,
  type InsertTransaction,
  type Budget,
  type InsertBudget,
  type Category,
  type ExpenseReminder,
  type InsertExpenseReminder,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, sum, sql, or, isNull } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: Omit<InsertUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  updateUserStripeInfo(userId: number, customerId: string, subscriptionId: string): Promise<User>;
  updateUserPremiumStatus(userId: number, isPremium: boolean): Promise<User>;

  // Transaction operations
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getUserTransactions(userId: number, limit?: number): Promise<Transaction[]>;
  deleteTransaction(id: number, userId: number): Promise<void>;

  // Budget operations
  createBudget(budget: InsertBudget): Promise<Budget>;
  getUserBudgets(userId: number): Promise<Budget[]>;
  updateBudget(id: number, budget: Partial<InsertBudget>): Promise<Budget>;
  deleteBudget(id: number, userId: number): Promise<void>;

  // Category operations
  getCategories(): Promise<Category[]>;

  // Expense reminder operations (Standard/Premium only)
  createExpenseReminder(reminder: InsertExpenseReminder): Promise<ExpenseReminder>;
  getUserExpenseReminders(userId: number): Promise<ExpenseReminder[]>;
  getUpcomingExpenseReminders(userId: number, daysBefore?: number): Promise<ExpenseReminder[]>;
  updateExpenseReminder(id: number, reminder: Partial<InsertExpenseReminder>): Promise<ExpenseReminder>;
  deleteExpenseReminder(id: number, userId: number): Promise<void>;
  markExpenseReminderCompleted(id: number, userId: number): Promise<void>;

  // Analytics
  getUserFinancialSummary(userId: number, startDate: Date, endDate: Date): Promise<{
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    transactionsByCategory: Array<{ categoryName: string; amount: number; type: string }>;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: Omit<InsertUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const [newUser] = await db
      .insert(users)
      .values(user)
      .returning();
    return newUser;
  }

  async updateUserStripeInfo(userId: number, customerId: string, subscriptionId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        isPremium: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserPlan(userId: number, plan: string) {
    const [user] = await db
      .update(users)
      .set({
        plan,
        isPremium: plan !== 'free',
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Legacy method - use updateUserPlan instead
  async updateUserPremiumStatus(userId: number, isPremium: boolean): Promise<void> {
    // Convert boolean to plan for backward compatibility
    const plan = isPremium ? 'premium' : 'free';
    await this.updateUserPlan(userId, plan);
  }

  // Transaction operations
  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db
      .insert(transactions)
      .values(transaction)
      .returning();
    return newTransaction;
  }

  async getUserTransactions(userId: number, limit?: number): Promise<Transaction[]> {
    let query = db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.date));

    if (limit) {
      query = query.limit(limit);
    }

    return await query;
  }

  async deleteTransaction(id: number, userId: number): Promise<void> {
    await db
      .delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  }

  // Budget operations
  async createBudget(budget: InsertBudget): Promise<Budget> {
    const [newBudget] = await db
      .insert(budgets)
      .values(budget)
      .returning();
    return newBudget;
  }

  async getUserBudgets(userId: number): Promise<Budget[]> {
    return await db
      .select()
      .from(budgets)
      .where(eq(budgets.userId, userId))
      .orderBy(desc(budgets.createdAt));
  }

  async updateBudget(id: number, budget: Partial<InsertBudget>): Promise<Budget> {
    const [updatedBudget] = await db
      .update(budgets)
      .set(budget)
      .where(eq(budgets.id, id))
      .returning();
    return updatedBudget;
  }

  async deleteBudget(id: number, userId: number): Promise<void> {
    await db
      .delete(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
  }

  // Category operations
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  // Analytics
  async getUserFinancialSummary(userId: number, startDate: Date, endDate: Date) {
    // Get income and expense totals
    const incomeResult = await db
      .select({
        total: sum(transactions.amount),
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, 'income'),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      );

    const expenseResult = await db
      .select({
        total: sum(transactions.amount),
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, 'expense'),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      );

    // Get transactions by category
    const categoryResults = await db
      .select({
        categoryName: categories.name,
        amount: sum(transactions.amount),
        type: transactions.type,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      )
      .groupBy(categories.name, transactions.type);

    const totalIncome = Number(incomeResult[0]?.total || 0);
    const totalExpenses = Number(expenseResult[0]?.total || 0);
    const netBalance = totalIncome - totalExpenses;

    const transactionsByCategory = categoryResults.map(result => ({
      categoryName: result.categoryName || 'Uncategorized',
      amount: Number(result.amount || 0),
      type: result.type,
    }));

    return {
      totalIncome,
      totalExpenses,
      netBalance,
      transactionsByCategory,
    };
  }

  // Expense reminder operations
  async createExpenseReminder(reminder: InsertExpenseReminder): Promise<ExpenseReminder> {
    const [result] = await db.insert(expenseReminders).values(reminder).returning();
    return result;
  }

  async getUserExpenseReminders(userId: number): Promise<ExpenseReminder[]> {
    const results = await db
      .select()
      .from(expenseReminders)
      .where(eq(expenseReminders.userId, userId))
      .orderBy(expenseReminders.dueDate);
    return results;
  }

  async getUpcomingExpenseReminders(userId: number, daysBefore: number = 7): Promise<ExpenseReminder[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + daysBefore);

    const results = await db
      .select()
      .from(expenseReminders)
      .where(
        and(
          eq(expenseReminders.userId, userId),
          eq(expenseReminders.isActive, true),
          eq(expenseReminders.isCompleted, false),
          gte(expenseReminders.dueDate, now),
          lte(expenseReminders.dueDate, futureDate)
        )
      )
      .orderBy(expenseReminders.dueDate);
    
    return results;
  }

  async getUpcomingTransactionReminders(userId: number, daysAhead: number = 7): Promise<Array<{
    id: string;
    title: string;
    description: string;
    amount: string;
    dueDate: Date;
    type: 'income' | 'expense';
    categoryName: string;
    isRecurring: boolean;
    source: 'future_transaction' | 'recurring_transaction';
  }>> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + daysAhead);

    const reminders: Array<{
      id: string;
      title: string;
      description: string;
      amount: string;
      dueDate: Date;
      type: 'income' | 'expense';
      categoryName: string;
      isRecurring: boolean;
      source: 'future_transaction' | 'recurring_transaction';
    }> = [];

    // Get future-dated transactions
    const futureTransactions = await db
      .select({
        id: transactions.id,
        description: transactions.description,
        amount: transactions.amount,
        date: transactions.date,
        type: transactions.type,
        categoryName: categories.name,
        isRecurring: transactions.isRecurring,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, now),
          lte(transactions.date, futureDate)
        )
      )
      .orderBy(transactions.date);

    // Add future transactions as reminders
    futureTransactions.forEach(transaction => {
      reminders.push({
        id: `future_${transaction.id}`,
        title: transaction.description,
        description: `${transaction.type === 'expense' ? 'Payment' : 'Income'} scheduled`,
        amount: transaction.amount,
        dueDate: transaction.date,
        type: transaction.type as 'income' | 'expense',
        categoryName: transaction.categoryName || 'Uncategorized',
        isRecurring: transaction.isRecurring || false,
        source: 'future_transaction'
      });
    });

    // Get active recurring transactions and calculate next occurrences  
    const activeRecurringTransactions = await db
      .select({
        id: recurringTransactions.id,
        description: recurringTransactions.description,
        amount: recurringTransactions.amount,
        type: recurringTransactions.type,
        frequency: recurringTransactions.frequency,
        startDate: recurringTransactions.startDate,
        endDate: recurringTransactions.endDate,
        lastProcessed: recurringTransactions.lastProcessed,
        categoryName: categories.name,
      })
      .from(recurringTransactions)
      .leftJoin(categories, eq(recurringTransactions.categoryId, categories.id))
      .where(
        and(
          eq(recurringTransactions.userId, userId),
          eq(recurringTransactions.isActive, true),
          or(
            isNull(recurringTransactions.endDate),
            gte(recurringTransactions.endDate, now)
          )
        )
      );

    // Calculate next occurrences for recurring transactions
    activeRecurringTransactions.forEach(recurring => {
      const nextOccurrence = this.calculateNextOccurrence(
        recurring.lastProcessed || recurring.startDate,
        recurring.frequency,
        recurring.endDate
      );

      if (nextOccurrence && nextOccurrence <= futureDate && nextOccurrence >= now) {
        reminders.push({
          id: `recurring_${recurring.id}`,
          title: recurring.description,
          description: `Recurring ${recurring.type} (${recurring.frequency})`,
          amount: recurring.amount,
          dueDate: nextOccurrence,
          type: recurring.type as 'income' | 'expense',
          categoryName: recurring.categoryName || 'Uncategorized',
          isRecurring: true,
          source: 'recurring_transaction'
        });
      }
    });

    return reminders.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  private calculateNextOccurrence(lastDate: Date, frequency: string, endDate: Date | null): Date | null {
    const next = new Date(lastDate);
    
    switch (frequency) {
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'yearly':
        next.setFullYear(next.getFullYear() + 1);
        break;
      default:
        return null;
    }

    if (endDate && next > endDate) {
      return null;
    }

    return next;
  }

  async updateExpenseReminder(id: number, reminder: Partial<InsertExpenseReminder>): Promise<ExpenseReminder> {
    const [result] = await db
      .update(expenseReminders)
      .set({ ...reminder, updatedAt: new Date() })
      .where(eq(expenseReminders.id, id))
      .returning();
    return result;
  }

  async deleteExpenseReminder(id: number, userId: number): Promise<void> {
    await db
      .delete(expenseReminders)
      .where(and(eq(expenseReminders.id, id), eq(expenseReminders.userId, userId)));
  }

  async markExpenseReminderCompleted(id: number, userId: number): Promise<void> {
    await db
      .update(expenseReminders)
      .set({ isCompleted: true, updatedAt: new Date() })
      .where(and(eq(expenseReminders.id, id), eq(expenseReminders.userId, userId)));
  }
}

export const storage = new DatabaseStorage();