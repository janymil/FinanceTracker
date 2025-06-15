import {
  users,
  transactions,
  recurringTransactions,
  budgets,
  categories,
  goals,
  expenseReminders,
  backupSettings,
  friendships,
  collaborativeGoals,
  collaborativeGoalParticipants,
  goalContributions,
  challengeActivities,
  milestoneAchievements,
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
  type Friendship,
  type InsertFriendship,
  type CollaborativeGoal,
  type InsertCollaborativeGoal,
  type CollaborativeGoalParticipant,
  type InsertCollaborativeGoalParticipant,
  type GoalContribution,
  type InsertGoalContribution,
  type ChallengeActivity,
  type InsertChallengeActivity,
  type MilestoneAchievement,
  type InsertMilestoneAchievement,
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
  updateCategory(categoryId: number, category: { name: string; icon: string; color: string; type: string }): Promise<Category>;
  deleteCategory(categoryId: number): Promise<Category>;

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

  // Collaborative Savings Goals
  // Friend management
  sendFriendRequest(requesterId: string, recipientEmail: string): Promise<Friendship>;
  acceptFriendRequest(friendshipId: number, userId: string): Promise<Friendship>;
  rejectFriendRequest(friendshipId: number, userId: string): Promise<void>;
  getUserFriends(userId: string): Promise<Array<Friendship & { friend: User }>>;
  getPendingFriendRequests(userId: string): Promise<Array<Friendship & { requester: User }>>;

  // Collaborative goal management
  createCollaborativeGoal(goal: InsertCollaborativeGoal): Promise<CollaborativeGoal>;
  getUserCollaborativeGoals(userId: string): Promise<Array<CollaborativeGoal & { participants: CollaborativeGoalParticipant[], creator: User }>>;
  getCollaborativeGoal(goalId: number, userId: string): Promise<(CollaborativeGoal & { participants: Array<CollaborativeGoalParticipant & { user: User }>, creator: User, contributions: GoalContribution[], activities: ChallengeActivity[] }) | undefined>;
  joinCollaborativeGoal(goalId: number, userId: string, personalTarget?: number): Promise<CollaborativeGoalParticipant>;
  leaveCollaborativeGoal(goalId: number, userId: string): Promise<void>;
  updateCollaborativeGoal(goalId: number, userId: string, updates: Partial<InsertCollaborativeGoal>): Promise<CollaborativeGoal>;
  deleteCollaborativeGoal(goalId: number, userId: string): Promise<void>;

  // Goal contributions and activities
  addGoalContribution(contribution: InsertGoalContribution): Promise<GoalContribution>;
  getGoalContributions(goalId: number): Promise<Array<GoalContribution & { user: User }>>;
  updateGoalProgress(goalId: number): Promise<void>;
  createChallengeActivity(activity: InsertChallengeActivity): Promise<ChallengeActivity>;
  getGoalActivities(goalId: number): Promise<Array<ChallengeActivity & { user: User }>>;

  // Milestone and achievement tracking
  checkAndCreateMilestones(goalId: number): Promise<MilestoneAchievement[]>;
  getUserAchievements(userId: string): Promise<MilestoneAchievement[]>;
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

  async upsertUser(userData: any): Promise<User> {
    try {
      // Try to insert new user first
      const [newUser] = await db
        .insert(users)
        .values({
          id: userData.id,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          plan: userData.plan || 'free',
          stripeCustomerId: userData.stripeCustomerId,
          stripeSubscriptionId: userData.stripeSubscriptionId,
          settings: userData.settings,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      return newUser;
    } catch (error: any) {
      // If it's a constraint violation (user already exists), just fetch the existing user
      if (error.code === '23505' || error.message?.includes('duplicate key')) {
        const [existingUser] = await db.select().from(users).where(eq(users.id, userData.id));
        if (existingUser) {
          return existingUser;
        }
        // If not found by ID, try by email
        const [userByEmail] = await db.select().from(users).where(eq(users.email, userData.email));
        if (userByEmail) {
          return userByEmail;
        }
      }
      throw error;
    }
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

  async updateCategory(categoryId: number, updateData: { name: string; icon: string; color: string; type: 'income' | 'expense' }) {
    const [category] = await db
      .update(categories)
      .set(updateData)
      .where(eq(categories.id, categoryId))
      .returning();

    if (!category) {
      throw new Error("Category not found");
    }

    return category;
  }

  async deleteCategory(categoryId: number) {
    // Check if category is in use by any transactions
    const transactionsUsingCategory = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(eq(transactions.categoryId, categoryId));

    if (transactionsUsingCategory[0].count > 0) {
      throw new Error("Cannot delete category that is in use by transactions");
    }

    const [deletedCategory] = await db
      .delete(categories)
      .where(eq(categories.id, categoryId))
      .returning();

    if (!deletedCategory) {
      throw new Error("Category not found");
    }

    return deletedCategory;
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

  // Collaborative Savings Goals Implementation
  // Friend management
  async sendFriendRequest(requesterId: string, recipientEmail: string): Promise<Friendship> {
    // Find recipient by email
    const [recipient] = await db.select().from(users).where(eq(users.email, recipientEmail));
    if (!recipient) {
      throw new Error("User not found with that email address");
    }

    // Check if friendship already exists
    const existingFriendship = await db
      .select()
      .from(friendships)
      .where(
        or(
          and(eq(friendships.requesterId, requesterId), eq(friendships.recipientId, recipient.id)),
          and(eq(friendships.requesterId, recipient.id), eq(friendships.recipientId, requesterId))
        )
      );

    if (existingFriendship.length > 0) {
      throw new Error("Friendship request already exists or you are already friends");
    }

    const [friendship] = await db
      .insert(friendships)
      .values({
        requesterId,
        recipientId: recipient.id,
        status: "pending",
      })
      .returning();

    return friendship;
  }

  async acceptFriendRequest(friendshipId: number, userId: string): Promise<Friendship> {
    const [friendship] = await db
      .update(friendships)
      .set({ 
        status: "accepted", 
        acceptedAt: new Date() 
      })
      .where(
        and(
          eq(friendships.id, friendshipId),
          eq(friendships.recipientId, userId),
          eq(friendships.status, "pending")
        )
      )
      .returning();

    if (!friendship) {
      throw new Error("Friend request not found or already processed");
    }

    return friendship;
  }

  async rejectFriendRequest(friendshipId: number, userId: string): Promise<void> {
    await db
      .delete(friendships)
      .where(
        and(
          eq(friendships.id, friendshipId),
          eq(friendships.recipientId, userId),
          eq(friendships.status, "pending")
        )
      );
  }

  async getUserFriends(userId: string): Promise<Array<Friendship & { friend: User }>> {
    const friends = await db
      .select({
        friendship: friendships,
        friend: users,
      })
      .from(friendships)
      .innerJoin(
        users,
        or(
          and(eq(friendships.requesterId, userId), eq(users.id, friendships.recipientId)),
          and(eq(friendships.recipientId, userId), eq(users.id, friendships.requesterId))
        )
      )
      .where(
        and(
          or(eq(friendships.requesterId, userId), eq(friendships.recipientId, userId)),
          eq(friendships.status, "accepted")
        )
      );

    return friends.map(f => ({ ...f.friendship, friend: f.friend }));
  }

  async getPendingFriendRequests(userId: string): Promise<Array<Friendship & { requester: User }>> {
    const requests = await db
      .select({
        friendship: friendships,
        requester: users,
      })
      .from(friendships)
      .innerJoin(users, eq(friendships.requesterId, users.id))
      .where(
        and(
          eq(friendships.recipientId, userId),
          eq(friendships.status, "pending")
        )
      );

    return requests.map(r => ({ ...r.friendship, requester: r.requester }));
  }

  // Collaborative goal management
  async createCollaborativeGoal(goal: InsertCollaborativeGoal): Promise<CollaborativeGoal> {
    const [createdGoal] = await db
      .insert(collaborativeGoals)
      .values({
        ...goal,
        joinCode: this.generateJoinCode(),
      })
      .returning();

    // Add creator as participant
    await db.insert(collaborativeGoalParticipants).values({
      goalId: createdGoal.id,
      userId: goal.createdBy,
      role: "creator",
      status: "active",
    });

    return createdGoal;
  }

  private generateJoinCode(): string {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  async getUserCollaborativeGoals(userId: string): Promise<Array<CollaborativeGoal & { participants: CollaborativeGoalParticipant[], creator: User }>> {
    const goals = await db
      .select({
        goal: collaborativeGoals,
        creator: users,
      })
      .from(collaborativeGoals)
      .innerJoin(users, eq(collaborativeGoals.createdBy, users.id))
      .innerJoin(collaborativeGoalParticipants, eq(collaborativeGoals.id, collaborativeGoalParticipants.goalId))
      .where(
        and(
          eq(collaborativeGoalParticipants.userId, userId),
          eq(collaborativeGoalParticipants.status, "active")
        )
      );

    // Get participants for each goal
    const result = [];
    for (const { goal, creator } of goals) {
      const participants = await db
        .select()
        .from(collaborativeGoalParticipants)
        .where(
          and(
            eq(collaborativeGoalParticipants.goalId, goal.id),
            eq(collaborativeGoalParticipants.status, "active")
          )
        );

      result.push({ ...goal, participants, creator });
    }

    return result;
  }

  async getCollaborativeGoal(goalId: number, userId: string): Promise<(CollaborativeGoal & { participants: Array<CollaborativeGoalParticipant & { user: User }>, creator: User, contributions: GoalContribution[], activities: ChallengeActivity[] }) | undefined> {
    // Check if user is participant
    const [participant] = await db
      .select()
      .from(collaborativeGoalParticipants)
      .where(
        and(
          eq(collaborativeGoalParticipants.goalId, goalId),
          eq(collaborativeGoalParticipants.userId, userId),
          eq(collaborativeGoalParticipants.status, "active")
        )
      );

    if (!participant) {
      return undefined;
    }

    const [goalWithCreator] = await db
      .select({
        goal: collaborativeGoals,
        creator: users,
      })
      .from(collaborativeGoals)
      .innerJoin(users, eq(collaborativeGoals.createdBy, users.id))
      .where(eq(collaborativeGoals.id, goalId));

    if (!goalWithCreator) {
      return undefined;
    }

    // Get participants with user details
    const participants = await db
      .select({
        participant: collaborativeGoalParticipants,
        user: users,
      })
      .from(collaborativeGoalParticipants)
      .innerJoin(users, eq(collaborativeGoalParticipants.userId, users.id))
      .where(
        and(
          eq(collaborativeGoalParticipants.goalId, goalId),
          eq(collaborativeGoalParticipants.status, "active")
        )
      );

    // Get contributions
    const contributions = await db
      .select()
      .from(goalContributions)
      .where(eq(goalContributions.goalId, goalId))
      .orderBy(desc(goalContributions.createdAt));

    // Get activities
    const activities = await db
      .select()
      .from(challengeActivities)
      .where(eq(challengeActivities.goalId, goalId))
      .orderBy(desc(challengeActivities.createdAt));

    return {
      ...goalWithCreator.goal,
      creator: goalWithCreator.creator,
      participants: participants.map(p => ({ ...p.participant, user: p.user })),
      contributions,
      activities,
    };
  }

  async joinCollaborativeGoal(goalId: number, userId: string, personalTarget?: number): Promise<CollaborativeGoalParticipant> {
    // Check if goal exists and is active
    const [goal] = await db
      .select()
      .from(collaborativeGoals)
      .where(
        and(
          eq(collaborativeGoals.id, goalId),
          eq(collaborativeGoals.status, "active")
        )
      );

    if (!goal) {
      throw new Error("Goal not found or not active");
    }

    // Check if already participant
    const [existingParticipant] = await db
      .select()
      .from(collaborativeGoalParticipants)
      .where(
        and(
          eq(collaborativeGoalParticipants.goalId, goalId),
          eq(collaborativeGoalParticipants.userId, userId)
        )
      );

    if (existingParticipant) {
      throw new Error("Already a participant in this goal");
    }

    const [participant] = await db
      .insert(collaborativeGoalParticipants)
      .values({
        goalId,
        userId,
        personalTarget: personalTarget ? personalTarget.toString() : null,
        role: "participant",
        status: "active",
      })
      .returning();

    // Create activity
    await this.createChallengeActivity({
      goalId,
      userId,
      activityType: "join",
      title: "Joined the challenge",
      description: "Welcome to the savings challenge!",
    });

    return participant;
  }

  async leaveCollaborativeGoal(goalId: number, userId: string): Promise<void> {
    await db
      .update(collaborativeGoalParticipants)
      .set({ status: "left" })
      .where(
        and(
          eq(collaborativeGoalParticipants.goalId, goalId),
          eq(collaborativeGoalParticipants.userId, userId)
        )
      );

    // Create activity
    await this.createChallengeActivity({
      goalId,
      userId,
      activityType: "leave",
      title: "Left the challenge",
      description: "User has left the savings challenge",
    });
  }

  async updateCollaborativeGoal(goalId: number, userId: string, updates: Partial<InsertCollaborativeGoal>): Promise<CollaborativeGoal> {
    // Check if user is creator
    const [goal] = await db
      .select()
      .from(collaborativeGoals)
      .where(
        and(
          eq(collaborativeGoals.id, goalId),
          eq(collaborativeGoals.createdBy, userId)
        )
      );

    if (!goal) {
      throw new Error("Goal not found or you don't have permission to update it");
    }

    const [updatedGoal] = await db
      .update(collaborativeGoals)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(collaborativeGoals.id, goalId))
      .returning();

    return updatedGoal;
  }

  async deleteCollaborativeGoal(goalId: number, userId: string): Promise<void> {
    // Check if user is creator
    const [goal] = await db
      .select()
      .from(collaborativeGoals)
      .where(
        and(
          eq(collaborativeGoals.id, goalId),
          eq(collaborativeGoals.createdBy, userId)
        )
      );

    if (!goal) {
      throw new Error("Goal not found or you don't have permission to delete it");
    }

    // Delete related data
    await db.delete(milestoneAchievements).where(eq(milestoneAchievements.goalId, goalId));
    await db.delete(challengeActivities).where(eq(challengeActivities.goalId, goalId));
    await db.delete(goalContributions).where(eq(goalContributions.goalId, goalId));
    await db.delete(collaborativeGoalParticipants).where(eq(collaborativeGoalParticipants.goalId, goalId));
    await db.delete(collaborativeGoals).where(eq(collaborativeGoals.id, goalId));
  }

  // Goal contributions and activities
  async addGoalContribution(contribution: InsertGoalContribution): Promise<GoalContribution> {
    const [newContribution] = await db
      .insert(goalContributions)
      .values(contribution)
      .returning();

    // Update participant contribution
    await db
      .update(collaborativeGoalParticipants)
      .set({
        currentContribution: sql`${collaborativeGoalParticipants.currentContribution} + ${contribution.amount}`,
        lastContribution: new Date(),
      })
      .where(
        and(
          eq(collaborativeGoalParticipants.goalId, contribution.goalId),
          eq(collaborativeGoalParticipants.userId, contribution.userId)
        )
      );

    // Update goal total
    await this.updateGoalProgress(contribution.goalId);

    // Create activity
    await this.createChallengeActivity({
      goalId: contribution.goalId,
      userId: contribution.userId,
      activityType: "contribution",
      title: "Made a contribution",
      description: contribution.description || `Contributed $${contribution.amount}`,
      amount: contribution.amount,
    });

    // Check for milestones
    await this.checkAndCreateMilestones(contribution.goalId);

    return newContribution;
  }

  async getGoalContributions(goalId: number): Promise<Array<GoalContribution & { user: User }>> {
    const contributions = await db
      .select({
        contribution: goalContributions,
        user: users,
      })
      .from(goalContributions)
      .innerJoin(users, eq(goalContributions.userId, users.id))
      .where(eq(goalContributions.goalId, goalId))
      .orderBy(desc(goalContributions.createdAt));

    return contributions.map(c => ({ ...c.contribution, user: c.user }));
  }

  async updateGoalProgress(goalId: number): Promise<void> {
    const [result] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${goalContributions.amount}), 0)`,
      })
      .from(goalContributions)
      .where(eq(goalContributions.goalId, goalId));

    await db
      .update(collaborativeGoals)
      .set({
        currentAmount: result.total.toString(),
        updatedAt: new Date(),
      })
      .where(eq(collaborativeGoals.id, goalId));
  }

  async createChallengeActivity(activity: InsertChallengeActivity): Promise<ChallengeActivity> {
    const [newActivity] = await db
      .insert(challengeActivities)
      .values(activity)
      .returning();

    return newActivity;
  }

  async getGoalActivities(goalId: number): Promise<Array<ChallengeActivity & { user: User }>> {
    const activities = await db
      .select({
        activity: challengeActivities,
        user: users,
      })
      .from(challengeActivities)
      .innerJoin(users, eq(challengeActivities.userId, users.id))
      .where(eq(challengeActivities.goalId, goalId))
      .orderBy(desc(challengeActivities.createdAt));

    return activities.map(a => ({ ...a.activity, user: a.user }));
  }

  // Milestone and achievement tracking
  async checkAndCreateMilestones(goalId: number): Promise<MilestoneAchievement[]> {
    const [goal] = await db
      .select()
      .from(collaborativeGoals)
      .where(eq(collaborativeGoals.id, goalId));

    if (!goal) return [];

    const achievements: MilestoneAchievement[] = [];
    const currentAmount = parseFloat(goal.currentAmount);
    const targetAmount = parseFloat(goal.targetAmount);
    const percentageComplete = (currentAmount / targetAmount) * 100;

    // Check for percentage milestones (25%, 50%, 75%, 100%)
    const milestones = [25, 50, 75, 100];

    for (const milestone of milestones) {
      if (percentageComplete >= milestone) {
        // Check if milestone already achieved
        const [existing] = await db
          .select()
          .from(milestoneAchievements)
          .where(
            and(
              eq(milestoneAchievements.goalId, goalId),
              eq(milestoneAchievements.milestoneType, "percentage"),
              eq(milestoneAchievements.targetAmount, (targetAmount * milestone / 100).toString())
            )
          );

        if (!existing) {
          const [achievement] = await db
            .insert(milestoneAchievements)
            .values({
              goalId,
              userId: null, // Group milestone
              milestoneType: "percentage",
              title: `${milestone}% Complete!`,
              description: `The group has reached ${milestone}% of the savings goal!`,
              targetAmount: (targetAmount * milestone / 100).toString(),
              achievedAmount: currentAmount.toString(),
              rewardType: "badge",
              rewardData: { type: "percentage", value: milestone },
            })
            .returning();

          achievements.push(achievement);

          // Create activity for milestone
          await this.createChallengeActivity({
            goalId,
            userId: goal.createdBy, // Use creator as activity creator
            activityType: "milestone",
            title: `Milestone Achieved: ${milestone}% Complete!`,
            description: `Congratulations! The group has reached ${milestone}% of the savings goal!`,
            amount: currentAmount.toString(),
          });
        }
      }
    }

    return achievements;
  }

  async getUserAchievements(userId: string): Promise<MilestoneAchievement[]> {
    return await db
      .select()
      .from(milestoneAchievements)
      .where(eq(milestoneAchievements.userId, userId))
      .orderBy(desc(milestoneAchievements.achievedAt));
  }
}

export const storage = new DatabaseStorage();