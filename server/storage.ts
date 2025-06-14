import {
  users,
  transactions,
  recurringTransactions,
  budgets,
  categories,
  goals,
  expenseReminders,
  backupSettings,
  type User,
  type InsertUser,
  type Transaction,
  type InsertTransaction,
  type Budget,
  type InsertBudget,
  type Goal,
  type InsertGoal,
  type Category,
  type ExpenseReminder,
  type InsertExpenseReminder,
  type BackupSettings,
  type InsertBackupSettings,
} from "@shared/schema";
import { db } from "./db";
import { DataEncryption } from "./encryption";
import { eq, and, gte, lte, desc, sum, count, sql, or, isNull } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: any): Promise<User>;
  createUser(user: Omit<InsertUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  updateUserStripeInfo(userId: string, customerId: string, subscriptionId: string): Promise<User>;
  updateUserPlan(userId: string, plan: string): Promise<User>;
  updateUserPremiumStatus(userId: string, isPremium: boolean): Promise<User>;
  
  // Admin operations
  getAllUsers(): Promise<User[]>;
  updateUser(userId: string, userData: Partial<User>): Promise<User>;
  deleteUserCompletely(userId: string): Promise<void>;
  getAdminStats(): Promise<any>;
  getUserDataSummary(userId: string): Promise<any>;

  // Transaction operations
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getUserTransactions(userId: number, limit?: number): Promise<Transaction[]>;
  updateTransaction(id: number, transaction: InsertTransaction): Promise<Transaction>;
  deleteTransaction(id: number, userId: number): Promise<void>;

  // Budget operations
  createBudget(budget: InsertBudget): Promise<Budget>;
  getUserBudgets(userId: number): Promise<Budget[]>;
  updateBudget(id: number, budget: Partial<InsertBudget>): Promise<Budget>;
  deleteBudget(id: number, userId: number): Promise<void>;

  // Goal operations
  createGoal(goal: InsertGoal): Promise<Goal>;
  getUserGoals(userId: number): Promise<Goal[]>;
  updateGoal(id: number, goal: Partial<InsertGoal>): Promise<Goal>;
  deleteGoal(id: number, userId: number): Promise<void>;

  // Category operations
  getCategories(): Promise<Category[]>;
  createCategory(category: { name: string; icon: string; color: string; type: string }): Promise<Category>;

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

  // Backup settings operations
  getUserBackupSettings(userId: number): Promise<BackupSettings | undefined>;
  createBackupSettings(settings: InsertBackupSettings): Promise<BackupSettings>;
  updateBackupSettings(userId: number, settings: Partial<InsertBackupSettings>): Promise<BackupSettings>;
  getUsersWithActiveBackups(): Promise<Array<{ userId: number }>>;
  getUsersWithOverdueBackups(): Promise<Array<{ userId: number }>>;

  // Profile Management
  updateUserProfile(userId: number, profileData: { firstName: string; lastName: string; email: string; phone?: string; website?: string }): Promise<void>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<void>;
  getUserSettings(userId: number): Promise<any>;
  updateUserSettings(userId: number, settings: any): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
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

  async upsertUser(user: any): Promise<User> {
    const [upsertedUser] = await db
      .insert(users)
      .values(user)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...user,
          updatedAt: new Date(),
        },
      })
      .returning();
    return upsertedUser;
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
    // Encrypt sensitive fields
    const encryptedTransaction = {
      ...transaction,
      amount: DataEncryption.encryptAmount(transaction.amount),
      description: DataEncryption.encryptDescription(transaction.description),
      referenceNote: transaction.referenceNote ? DataEncryption.encrypt(transaction.referenceNote) : null
    };

    const [newTransaction] = await db.insert(transactions).values(encryptedTransaction).returning();

    // Decrypt for return
    return {
      ...newTransaction,
      amount: DataEncryption.decryptAmount(newTransaction.amount),
      description: DataEncryption.decryptDescription(newTransaction.description),
      referenceNote: newTransaction.referenceNote ? DataEncryption.decrypt(newTransaction.referenceNote) : null
    };
  }

  async getUserTransactions(userId: number, limit?: number): Promise<Transaction[]> {
    let query = db
      .select({
        id: transactions.id,
        userId: transactions.userId,
        categoryId: transactions.categoryId,
        amount: transactions.amount,
        description: transactions.description,
        date: transactions.date,
        type: transactions.type,
        createdAt: transactions.createdAt,
        isRecurring: transactions.isRecurring,
        recurringFrequency: transactions.recurringFrequency,
        recurringEndDate: transactions.recurringEndDate,
        parentTransactionId: transactions.parentTransactionId,
        paymentUrl: transactions.paymentUrl,
        referenceNote: transactions.referenceNote,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.date));

    if (limit) {
      query = query.limit(limit);
    }

    const userTransactions = await query;

    // Decrypt sensitive fields
    return userTransactions.map(transaction => ({
      ...transaction,
      amount: DataEncryption.decryptAmount(transaction.amount),
      description: DataEncryption.decryptDescription(transaction.description),
      referenceNote: transaction.referenceNote ? DataEncryption.decrypt(transaction.referenceNote) : null
    }));
  }

  async updateTransaction(id: number, transaction: InsertTransaction): Promise<Transaction> {
        // Encrypt sensitive fields if they're being updated
        const encryptedTransaction = { ...transaction };
        if (transaction.amount) {
            encryptedTransaction.amount = DataEncryption.encryptAmount(transaction.amount);
        }
        if (transaction.description) {
            encryptedTransaction.description = DataEncryption.encryptDescription(transaction.description);
        }
        if (transaction.referenceNote) {
            encryptedTransaction.referenceNote = DataEncryption.encrypt(transaction.referenceNote);
        }

        const [updatedTransaction] = await db
            .update(transactions)
            .set(encryptedTransaction)
            .where(and(eq(transactions.id, id), eq(transactions.userId, transaction.userId)))
            .returning();

        // Decrypt for return value
        return {
            ...updatedTransaction,
            amount: DataEncryption.decryptAmount(updatedTransaction.amount),
            description: DataEncryption.decryptDescription(updatedTransaction.description),
            referenceNote: updatedTransaction.referenceNote ? DataEncryption.decrypt(updatedTransaction.referenceNote) : null
        };
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
    const budgetData = await db
      .select({
        id: budgets.id,
        userId: budgets.userId,
        categoryId: budgets.categoryId,
        amount: budgets.amount,
        startDate: budgets.startDate,
        endDate: budgets.endDate,
        period: budgets.period,
        createdAt: budgets.createdAt,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
      })
      .from(budgets)
      .leftJoin(categories, eq(budgets.categoryId, categories.id))
      .where(eq(budgets.userId, userId))
      .orderBy(desc(budgets.createdAt));

    // Calculate actual spending for each budget
    const budgetsWithSpending = await Promise.all(
      budgetData.map(async (budget) => {
        // Calculate total spending for this category within the budget period
        const spendingResult = await db
          .select({
            totalSpent: sql`COALESCE(SUM(ABS(CAST(${transactions.amount} AS DECIMAL))), 0)`
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              eq(transactions.categoryId, budget.categoryId),
              eq(transactions.type, 'expense'),
              gte(transactions.date, budget.startDate),
              lte(transactions.date, budget.endDate)
            )
          );

        const totalSpent = Number(spendingResult[0]?.totalSpent || 0);
        const budgetAmount = parseFloat(budget.amount);
        const remaining = budgetAmount - totalSpent;
        const percentage = budgetAmount > 0 ? (totalSpent / budgetAmount) * 100 : 0;

        return {
          ...budget,
          spent: totalSpent,
          remaining: remaining,
          percentage: percentage
        };
      })
    );

    return budgetsWithSpending;
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

  // Goal operations
  async createGoal(goal: InsertGoal): Promise<Goal> {
    const [newGoal] = await db
      .insert(goals)
      .values(goal)
      .returning();
    return newGoal;
  }

  async getUserGoals(userId: number): Promise<Goal[]> {
    return await db
      .select()
      .from(goals)
      .where(eq(goals.userId, userId))
      .orderBy(desc(goals.createdAt));
  }

  async updateGoal(id: number, goal: Partial<InsertGoal>): Promise<Goal> {
    const [updatedGoal] = await db
      .update(goals)
      .set(goal)
      .where(eq(goals.id, id))
      .returning();
    return updatedGoal;
  }

  async deleteGoal(id: number, userId: number): Promise<void> {
    await db
      .delete(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, userId)));
  }

  // Category operations
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async createCategory(category: { name: string; icon: string; color: string; type: string }): Promise<Category> {
    const [newCategory] = await db
      .insert(categories)
      .values({
        name: category.name,
        icon: category.icon,
        color: category.color,
        type: category.type as "income" | "expense",
      })
      .returning();

    return newCategory;
  }

  // Analytics
  async getUserFinancialSummary(userId: number, startDate: Date, endDate: Date) {
    // Get income and expense totals with counts
    const incomeResult = await db
      .select({
        total: sum(transactions.amount),
        count: count(transactions.id),
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
        count: count(transactions.id),
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
    const incomeTransactionCount = Number(incomeResult[0]?.count || 0);
    const expenseTransactionCount = Number(expenseResult[0]?.count || 0);
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
      incomeTransactionCount,
      expenseTransactionCount,
      totalTransactionCount: incomeTransactionCount + expenseTransactionCount,
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

  // Backup settings operations
  async getUserBackupSettings(userId: number): Promise<BackupSettings | undefined> {
    const settings = await db
      .select()
      .from(backupSettings)
      .where(eq(backupSettings.userId, userId))
      .limit(1);

    return settings[0];
  }

  async createBackupSettings(settings: InsertBackupSettings): Promise<BackupSettings> {
    const result = await db
      .insert(backupSettings)
      .values(settings)
      .returning();

    return result[0];
  }

  async updateBackupSettings(userId: number, settings: Partial<InsertBackupSettings>): Promise<BackupSettings> {
    const result = await db
      .update(backupSettings)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(backupSettings.userId, userId))
      .returning();

    return result[0];
  }

  async getUsersWithActiveBackups(): Promise<Array<{ userId: number }>> {
    const result = await db
      .select({ userId: backupSettings.userId })
      .from(backupSettings)
      .innerJoin(users, eq(backupSettings.userId, users.id))
      .where(
        and(
          eq(backupSettings.autoBackup, true),
          eq(backupSettings.status, 'active'),
          eq(users.plan, 'premium')
        )
      );

    return result;
  }

  async getUsersWithOverdueBackups(): Promise<Array<{ userId: number }>> {
    const now = new Date();

    const result = await db
      .select({ userId: backupSettings.userId })
      .from(backupSettings)
      .innerJoin(users, eq(backupSettings.userId, users.id))
      .where(
        and(
          eq(backupSettings.autoBackup, true),
          eq(backupSettings.status, 'active'),
          eq(users.plan, 'premium'),
          or(
            isNull(backupSettings.nextBackupDate),
            lte(backupSettings.nextBackupDate, now)
          )
        )
      );

    return result;
  }

  async updateUserProfile(userId: number, profileData: { firstName: string; lastName: string; email: string; phone?: string; website?: string }): Promise<void> {
    const updateData: any = {
      firstName: profileData.firstName ? DataEncryption.encrypt(profileData.firstName) : null,
      lastName: profileData.lastName ? DataEncryption.encrypt(profileData.lastName) : null,
      email: profileData.email,
    };

    if (profileData.phone) {
      updateData.phone = DataEncryption.encrypt(profileData.phone);
    }
    if (profileData.website) {
      updateData.website = profileData.website;
    }

    await db.update(users).set(updateData).where(eq(users.id, userId));
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
  }

  async getUserSettings(userId: number): Promise<any> {
    const user = await this.getUser(userId);
    return user?.settings ? JSON.parse(user.settings) : null;
  }

  async updateUserSettings(userId: number, settings: any): Promise<void> {
    await db.update(users).set({ settings: JSON.stringify(settings) }).where(eq(users.id, userId));
  }

  // Admin methods for user management with encryption support
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.createdAt);
  }

  async updateUser(userId: string, userData: Partial<User>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({
        ...userData,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async deleteUserCompletely(userId: string): Promise<void> {
    // Delete all user's data in correct order (respecting foreign keys)
    // Note: This properly handles encrypted data deletion
    
    // Delete goals first
    await db.delete(goals).where(eq(goals.userId, userId));
    
    // Delete budgets
    await db.delete(budgets).where(eq(budgets.userId, userId));
    
    // Delete transactions (encrypted data will be properly removed)
    await db.delete(transactions).where(eq(transactions.userId, userId));
    
    // Delete expense reminders
    await db.delete(expenseReminders).where(eq(expenseReminders.userId, userId));
    
    // Finally delete the user
    await db.delete(users).where(eq(users.id, userId));
  }

  async getAdminStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    freeUsers: number;
    standardUsers: number;
    premiumUsers: number;
    totalTransactions: number;
    totalRevenue: number;
  }> {
    // Get user counts by plan
    const userStats = await db
      .select({
        plan: users.plan,
        count: sql<number>`count(*)`,
      })
      .from(users)
      .groupBy(users.plan);

    // Get total transaction count
    const [transactionCount] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(transactions);

    // Calculate stats
    const stats = {
      totalUsers: 0,
      activeUsers: 0,
      freeUsers: 0,
      standardUsers: 0,
      premiumUsers: 0,
      totalTransactions: transactionCount?.count || 0,
      totalRevenue: 0,
    };

    userStats.forEach(stat => {
      const count = Number(stat.count);
      stats.totalUsers += count;
      
      if (stat.plan === 'free') {
        stats.freeUsers = count;
      } else if (stat.plan === 'standard') {
        stats.standardUsers = count;
        stats.totalRevenue += count * 4.99; // $4.99/month
      } else if (stat.plan === 'premium') {
        stats.premiumUsers = count;
        stats.totalRevenue += count * 9.99; // $9.99/month
      }
    });

    // Active users are those with standard or premium plans
    stats.activeUsers = stats.standardUsers + stats.premiumUsers;

    return stats;
  }

  async getUserDataSummary(userId: string): Promise<{
    transactionCount: number;
    budgetCount: number;
    goalCount: number;
    dataSize: string;
    lastActivity: Date | null;
  }> {
    // Get counts without exposing encrypted content
    const [transactionCount] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(transactions)
      .where(eq(transactions.userId, userId));

    const [budgetCount] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(budgets)
      .where(eq(budgets.userId, userId));

    const [goalCount] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(goals)
      .where(eq(goals.userId, userId));

    // Get last activity (most recent transaction)
    const [lastTransaction] = await db
      .select({
        date: transactions.date,
      })
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.date))
      .limit(1);

    return {
      transactionCount: Number(transactionCount?.count || 0),
      budgetCount: Number(budgetCount?.count || 0),
      goalCount: Number(goalCount?.count || 0),
      dataSize: "Encrypted", // Don't expose actual size for security
      lastActivity: lastTransaction?.date || null,
    };
  }
}

export const storage = new DatabaseStorage();