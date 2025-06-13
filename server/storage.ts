import {
  users,
  transactions,
  budgets,
  categories,
  type User,
  type InsertUser,
  type Transaction,
  type InsertTransaction,
  type Budget,
  type InsertBudget,
  type Category,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, sum, sql } from "drizzle-orm";

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
}

export const storage = new DatabaseStorage();