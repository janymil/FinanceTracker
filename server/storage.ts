import { log } from './logger';
import crypto from 'crypto';
import { PLAN_PRICES } from '../shared/pricing';
import {
  merchantLearning,
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
  goalMessages,
  challengeActivities,
  milestoneAchievements,
  financialMascots,
  redeemCodes,
  importLogs,
  aiCache,
  aiUsage,
  aiUsageLimits,
  aiUserOverrides,
  paymentFailures,
  webhookEvents,
  courseProgress,
  userAchievements, 
  learningStats,
  // contextualFinancialTips, // Removed - using unified ai_cache
  type User,
  type InsertUser,
  type RecurringTransaction,
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
  type GoalMessage,
  type InsertGoalMessage,
  type ChallengeActivity,
  type InsertChallengeActivity,
  type MilestoneAchievement,
  type InsertMilestoneAchievement,
  type FinancialMascot,
  type InsertFinancialMascot,
  type RedeemCode,
  type InsertRedeemCode,
  type ImportLog,
  type InsertImportLog,
  type AiCache,
  type InsertAiCache,
  type AiUsage,
  type InsertAiUsage,
  type AiUsageLimit,
  type InsertAiUsageLimit,
  type AiUserOverride,
  type InsertAiUserOverride,
  type PaymentFailure,
  type InsertPaymentFailure,
  type CourseProgress,
  type InsertCourseProgress,
  type UserAchievement,
  type InsertUserAchievement,
  type LearningStats,
  type InsertLearningStats,
  // Removed: contextualFinancialTips types - using unified ai_cache
} from "@shared/schema";
import { db } from "./db";
import { DataEncryption } from "./encryption";
import { centsToNumber, parseAmountToCents } from "@shared/money";
import { checkSummary } from "@shared/invariants";
import { calendarDaysRange, resolveTimeZone } from "@shared/timezones";
import { reportInvariant } from "./errorGuard/report.js";
import { UNCATEGORIZED } from "@shared/calculations";
import { isRecurrenceFrequency, occurrenceAt } from "@shared/recurrence";
import { isUniqueViolation } from "./dbErrors";
import { eq, and, gte, lte, desc, sum, count, sql, or, isNull, gt, lt, inArray } from "drizzle-orm";

// Verified identity fields fetched from Clerk (see server/routes/authRoutes.ts)
export interface ClerkProfile {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

/**
 * A recurring rule as the API returns it: the stored row plus the category labels it was joined
 * with. Declared instead of `any[]` because the shape is what the client renders.
 */
export type RecurringRuleWithCategory = RecurringTransaction & {
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
};

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByStripeCustomerId(customerId: string): Promise<User | undefined>;
  upsertUser(userData: InsertUser): Promise<User>;
  adoptUserAccount(sourceUserId: string, targetUserId: string, profile?: Partial<ClerkProfile>): Promise<User>;
  createUser(user: Omit<InsertUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  updateUserStripeInfo(userId: string, customerId: string, subscriptionId: string): Promise<User>;
  updateUserPlan(userId: string, plan: 'free' | 'standard' | 'premium', billingInterval?: 'monthly' | 'yearly'): Promise<User>;
  updateUserPremiumStatus(userId: string, isPremium: boolean): Promise<User>;

  // Admin operations
  getAllUsers(): Promise<User[]>;
  updateUser(userId: string, userData: Partial<User>): Promise<User>;
  deleteUserCompletely(userId: string): Promise<void>;
  getAdminStats(): Promise<any>;
  getUserDataSummary(userId: string): Promise<any>;

  // Transaction operations
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getUserTransactions(userId: string, limit?: number): Promise<(Transaction & { categoryName?: string | null; categoryIcon?: string | null; categoryColor?: string | null })[]>;
  getTransactionsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<Array<Transaction & { categoryName?: string | null; categoryIcon?: string | null; categoryColor?: string | null }>>;
  updateTransaction(id: number, transaction: Partial<InsertTransaction>): Promise<Transaction>;
  deleteTransaction(id: number, userId: string): Promise<boolean>;
  countUserTransactions(userId: string): Promise<number>;
  getUserTimeZone(userId: string): Promise<string>;
  clearUserTransactions(userId: string): Promise<void>;

  // Budget operations
  createBudget(budget: InsertBudget): Promise<Budget>;
  getUserBudgets(userId: string, timeZone?: string): Promise<(Budget & { categoryName?: string | null; categoryIcon?: string | null; categoryColor?: string | null; spent?: number; remaining?: number; percentage?: number })[]>;
  getBudget(id: number): Promise<Budget | undefined>;
  updateBudget(id: number, budget: Partial<InsertBudget>): Promise<Budget>;
  deleteBudget(id: number, userId: string): Promise<boolean>;
  clearUserBudgets(userId: string): Promise<void>;

  // Goal operations
  createGoal(goal: InsertGoal): Promise<Goal>;
  getUserGoals(userId: string): Promise<Goal[]>;
  getGoal(id: number, userId: string): Promise<Goal | undefined>;
  updateGoal(id: number, userId: string, goal: Partial<InsertGoal>): Promise<Goal>;
  deleteGoal(id: number, userId: string): Promise<boolean>;

  // Category operations
  getCategories(userId?: string): Promise<Category[]>;
  getCategory(categoryId: number): Promise<Category | undefined>;
  createCategory(category: { userId: string; name: string; icon: string; color: string; type: string }): Promise<Category>;
  updateCategory(categoryId: number, userId: string, updateData: { name: string; icon: string; color: string; type: 'income' | 'expense' }): Promise<Category>;
  deleteCategory(categoryId: number, userId: string): Promise<Category>;

  // Expense reminder operations (Standard/Premium only)
  createExpenseReminder(reminder: InsertExpenseReminder): Promise<ExpenseReminder>;
  getUserExpenseReminders(userId: string): Promise<ExpenseReminder[]>;
  getUpcomingExpenseReminders(userId: string, daysBefore?: number): Promise<ExpenseReminder[]>;
  updateExpenseReminder(id: number, reminder: Partial<InsertExpenseReminder>): Promise<ExpenseReminder>;
  deleteExpenseReminder(id: number, userId: string): Promise<void>;
  markExpenseReminderCompleted(id: number, userId: string): Promise<void>;

  // Analytics
  getUserFinancialSummary(userId: string, startDate: Date, endDate: Date): Promise<{
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    /** Cent-exact values; the plain numbers below are derived from these. */
    totalIncomeInCents: number;
    totalExpensesInCents: number;
    netBalanceInCents: number;
    transactionsByCategory: Array<{ categoryName: string; amount: number; amountInCents: number; type: string }>;
  }>;

  // Backup settings operations
  getUserBackupSettings(userId: string): Promise<BackupSettings | undefined>;
  createBackupSettings(settings: InsertBackupSettings): Promise<BackupSettings>;
  updateBackupSettings(userId: string, settings: Partial<InsertBackupSettings>): Promise<BackupSettings>;
  getUsersWithActiveBackups(): Promise<Array<{ userId: string }>>;
  getUsersWithOverdueBackups(): Promise<Array<{ userId: string }>>;

  // Profile Management
  updateUserProfile(userId: string, profileData: { firstName: string; lastName: string; email: string; phone?: string; website?: string }): Promise<void>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<void>;
  getUserSettings(userId: string): Promise<any>;
  updateUserSettings(userId: string, settings: any): Promise<void>;

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
  getCollaborativeGoal(goalId: number, userId: string): Promise<(CollaborativeGoal & { participants: Array<CollaborativeGoalParticipant & { user: User }>, creator: User, contributions: Array<GoalContribution & { user: User }>, activities: ChallengeActivity[] }) | undefined>;
  getCollaborativeGoalPreview(goalId: number): Promise<(CollaborativeGoal & { creator: User; participantCount: number }) | undefined>;
  getGoalParticipant(goalId: number, userId: string): Promise<CollaborativeGoalParticipant | undefined>;
  joinCollaborativeGoal(goalId: number, userId: string, personalTarget?: number): Promise<CollaborativeGoalParticipant>;
  leaveCollaborativeGoal(goalId: number, userId: string): Promise<void>;
  updateCollaborativeGoal(goalId: number, userId: string, updates: Partial<InsertCollaborativeGoal>): Promise<CollaborativeGoal>;
  deleteCollaborativeGoal(goalId: number, userId: string): Promise<void>;

  // Goal contributions and activities
  addGoalContribution(contribution: InsertGoalContribution): Promise<GoalContribution>;
  getGoalContributions(goalId: number): Promise<Array<GoalContribution & { user: User }>>;
  updateGoalProgress(goalId: number): Promise<void>;
  createChallengeActivity(activity: InsertChallengeActivity): Promise<ChallengeActivity>;

  // Financial Mascot operations
  getUserMascot(userId: string): Promise<FinancialMascot | undefined>;
  createMascot(mascot: InsertFinancialMascot): Promise<FinancialMascot>;
  updateMascot(userId: string, updates: Partial<InsertFinancialMascot>): Promise<FinancialMascot>;
  toggleMascot(userId: string, enabled: boolean): Promise<FinancialMascot>;
  getGoalActivities(goalId: number): Promise<Array<ChallengeActivity & { user: User }>>;

  // Milestone and achievement tracking
  checkAndCreateMilestones(goalId: number): Promise<MilestoneAchievement[]>;
  getUserAchievements(userId: string): Promise<MilestoneAchievement[]>;

  // Redeem code operations
  getRedeemCode(code: string): Promise<RedeemCode | undefined>;
  redeemCode(code: string, userId: string): Promise<RedeemCode>;
  redeemMultipleCodes(codes: string[], userId: string): Promise<{ validCodes: RedeemCode[], invalidCodes: string[] }>;
  getUserRedeemedCodes(userId: string): Promise<RedeemCode[]>;

  // Import log operations
  createImportLog(importLog: InsertImportLog): Promise<ImportLog>;
  getUserImportLogs(userId: string, limit?: number): Promise<ImportLog[]>;
  getImportLogById(id: number): Promise<ImportLog | null>;

  // AI Cache operations for unified cache system
  getAICacheEntry(userId: string, functionKey: string, inputHash: string): Promise<AiCache | null>;
  setAICacheEntry(userId: string, functionKey: string, inputHash: string, input: any, output: any, month?: string, isError?: boolean): Promise<void>;
  getRecentAICacheEntry(userId: string, functionKey: string): Promise<any>;

  // Payment failure operations for grace period handling
  createPaymentFailure(failure: InsertPaymentFailure): Promise<PaymentFailure>;
  getPaymentFailures(userId: string): Promise<PaymentFailure[]>;
  getPaymentFailureByInvoice(stripeInvoiceId: string): Promise<PaymentFailure | null>;
  updatePaymentFailureAttempt(failureId: number, attemptCount: number, failureReason?: string | null): Promise<void>;
  updatePaymentFailureNotification(failureId: number, notificationSent: boolean): Promise<void>;
  resolvePaymentFailure(failureId: number): Promise<void>;
  setUserGracePeriod(userId: string, graceExpiresAt: Date, failureCount: number): Promise<User>;
  clearUserGracePeriod(userId: string): Promise<User>;
  getUsersInGracePeriod(): Promise<User[]>;
  getUsersWithExpiredGrace(): Promise<User[]>;

  // Gateway notification de-duplication (survives restarts, shared by both gateways)
  claimWebhookEvent(event: { source: string; key: string; type?: string | null }): Promise<boolean>;
  releaseWebhookEvent(source: string, key: string): Promise<void>;
  pruneWebhookEvents(olderThan: Date): Promise<void>;

  // Course-related operations
  getUserCourseProgress(userId: string): Promise<CourseProgress[]>;
  updateCourseProgress(userId: string, progress: {
    moduleId: string;
    levelId: string;
    score: number;
    timeSpent: number;
    isCompleted: boolean;
    completedAt: Date | null;
  }): Promise<void>;
  getUserLearningStats(userId: string): Promise<LearningStats | null>;
  updateLearningStats(userId: string, updates: {
    xpGained: number;
    timeSpent: number;
    lessonCompleted: boolean;
  }): Promise<void>;
  getUserCourseAchievements(userId: string): Promise<UserAchievement[]>;
  awardAchievement(userId: string, badgeId: string): Promise<UserAchievement>;
}

/**
 * What other members of a shared goal may see about a person: a name and an avatar.
 * Never the e-mail, phone, plan or any billing id that lives on the users row.
 */
function publicUser(user: User): User {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl,
  } as User;
}

/** A friend is someone you chose to connect with by e-mail, so the e-mail may be shown; billing ids and phone never. */
function friendUser(user: User): User {
  return { ...publicUser(user), email: user.email } as User;
}

export class DatabaseStorage implements IStorage {
  // User operations
  /** The zone the person chose in Profile; UTC until they do. */
  async getUserTimeZone(userId: string): Promise<string> {
    const [row] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId));
    return resolveTimeZone(row?.timezone);
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  /**
   * Re-home every row owned by `sourceUserId` onto `targetUserId`, then delete the stale
   * user row. This is required when Clerk re-creates a user with a new id for the same
   * verified email (deleted user, imported database, or a DB seeded from another Clerk
   * instance). Without it, the login resolves to a brand new empty account and the user
   * sees a dashboard with no data.
   */
  async adoptUserAccount(
    sourceUserId: string,
    targetUserId: string,
    profile?: Partial<ClerkProfile>,
  ): Promise<User> {
    if (sourceUserId === targetUserId) {
      throw new Error('Cannot adopt a user onto itself');
    }

    const [source] = await db.select().from(users).where(eq(users.id, sourceUserId));
    const [target] = await db.select().from(users).where(eq(users.id, targetUserId));
    if (!source) throw new Error(`Source user ${sourceUserId} not found`);
    if (!target) throw new Error(`Target user ${targetUserId} not found`);

    const adopted = await db.transaction(async (tx) => {
      // Safety: never merge into an account that already accumulated its own financial data
      const existingData: any = await tx.execute(sql`
        select count(*)::int as owned_transactions
          from transactions
         where user_id = ${targetUserId}
      `);
      const ownedTransactions = Number((existingData?.rows ?? existingData)?.[0]?.owned_transactions ?? 0);
      if (ownedTransactions > 0) {
        throw new Error(`Target user ${targetUserId} already owns transactions - refusing to merge`);
      }

      // 1. Move every child row. Discover the columns rather than the FK constraints:
      //    this database has drifted from the Drizzle schema and some tables (transactions,
      //    budgets, recurring_transactions) have no FK declared on user_id.
      const columnsResult: any = await tx.execute(sql`
        select table_name, column_name
          from information_schema.columns
         where table_schema = 'public'
           and table_name <> 'sessions'
           and column_name in ('user_id', 'owner_id')
        union
        select tc.table_name, kcu.column_name
          from information_schema.table_constraints tc
          join information_schema.key_column_usage kcu
            on kcu.constraint_name = tc.constraint_name
           and kcu.constraint_schema = tc.constraint_schema
          join information_schema.constraint_column_usage ccu
            on ccu.constraint_name = tc.constraint_name
           and ccu.constraint_schema = tc.constraint_schema
         where tc.constraint_type = 'FOREIGN KEY'
           and ccu.table_name = 'users'
           and ccu.column_name = 'id'
      `);
      const targets: Array<{ table_name: string; column_name: string }> = (columnsResult?.rows ?? columnsResult) || [];

      for (const ref of targets) {
        await tx.execute(sql`
          update ${sql.identifier(ref.table_name)}
             set ${sql.identifier(ref.column_name)} = ${targetUserId}
           where ${sql.identifier(ref.column_name)} = ${sourceUserId}
        `);
      }

      // 1b. Never delete the old row while anything still points at it
      for (const ref of targets) {
        const residualResult: any = await tx.execute(sql`
          select count(*)::int as remaining
            from ${sql.identifier(ref.table_name)}
           where ${sql.identifier(ref.column_name)} = ${sourceUserId}
        `);
        const remaining = Number((residualResult?.rows ?? residualResult)?.[0]?.remaining ?? 0);
        if (remaining > 0) {
          throw new Error(
            `Refusing to delete ${sourceUserId}: ${remaining} row(s) still reference it in ${ref.table_name}.${ref.column_name}`
          );
        }
      }

      // 2. Carry over the account state (plan, subscription, currency, settings)
      await tx
        .update(users)
        .set({
          plan: source.plan,
          billingInterval: target.billingInterval ?? source.billingInterval,
          currency: target.currency ?? source.currency,
          stripeCustomerId: target.stripeCustomerId ?? source.stripeCustomerId,
          stripeSubscriptionId: target.stripeSubscriptionId ?? source.stripeSubscriptionId,
          activatedAt: target.activatedAt ?? source.activatedAt,
          settings: target.settings ?? source.settings,
          createdAt:
            source.createdAt && target.createdAt
              ? new Date(Math.min(source.createdAt.getTime(), target.createdAt.getTime()))
              : target.createdAt,
          updatedAt: new Date(),
        })
        .where(eq(users.id, targetUserId));

      // 3. Drop the stale row before writing the email (users.email is unique)
      await tx.delete(users).where(eq(users.id, sourceUserId));

      const [survivor] = await tx
        .update(users)
        .set({
          email: profile?.email ?? source.email ?? target.email,
          firstName: target.firstName ?? source.firstName ?? profile?.firstName ?? null,
          lastName: target.lastName ?? source.lastName ?? profile?.lastName ?? null,
          profileImageUrl: target.profileImageUrl ?? source.profileImageUrl ?? profile?.profileImageUrl ?? null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, targetUserId))
        .returning();

      return survivor;
    });

    return adopted;
  }

  async getUserByStripeCustomerId(customerId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, customerId));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db
      .insert(users)
      .values(user)
      .returning();
    return newUser;
  }

  async upsertUser(userData: InsertUser): Promise<User> {
    try {
      // Try to insert new user first
      const [newUser] = await db
        .insert(users)
        .values({
          id: userData.id,
          email: userData.email || `${userData.id}@clerk.user`, // Fallback email for Clerk users
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          plan: userData.plan || 'free',
          currency: userData.currency,
          stripeCustomerId: userData.stripeCustomerId,
          stripeSubscriptionId: userData.stripeSubscriptionId,
          settings: userData.settings,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      return newUser;
    } catch (error: any) {
      // If it's a constraint violation (user already exists), fetch and potentially update the existing user
      if (isUniqueViolation(error)) {
        const [existingUser] = await db.select().from(users).where(eq(users.id, userData.id));
        if (existingUser) {
          // Update existing user if needed (e.g., if email is missing)
          if (!existingUser.email || existingUser.email.endsWith('@clerk.user')) {
            const emailToUse = userData.email || `${userData.id}@clerk.user`;
            const [updatedUser] = await db
              .update(users)
              .set({
                email: emailToUse,
                firstName: userData.firstName || existingUser.firstName,
                lastName: userData.lastName || existingUser.lastName,
                profileImageUrl: userData.profileImageUrl || existingUser.profileImageUrl,
                updatedAt: new Date()
              })
              .where(eq(users.id, userData.id))
              .returning();
            return updatedUser;
          }
          return existingUser;
        }
      }
      throw error;
    }
  }

  async updateUserStripeInfo(userId: string, customerId: string, subscriptionId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Removed duplicate getAllUsers - using the one at line 1153

  async updateUserPlan(userId: string, plan: 'free' | 'standard' | 'premium', billingInterval: 'monthly' | 'yearly' = 'monthly'): Promise<User> {
    const updatedUsers = await db
      .update(users)
      .set({ 
        plan,
        billingInterval,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (updatedUsers.length === 0) {
      throw new Error('User not found');
    }

    return updatedUsers[0];
  }

  async updateUserPremiumStatus(userId: string, isPremium: boolean): Promise<User> {
    // Convert boolean to plan for backward compatibility
    const plan = isPremium ? 'premium' : 'free';
    return await this.updateUserPlan(userId, plan);
  }

  // Transaction operations
  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    // Encrypt sensitive fields (but keep amount as numeric for database compatibility)
    const encryptedTransaction = {
      ...transaction,
      // amount stays as string/numeric - NOT encrypted to maintain database compatibility
      description: DataEncryption.encryptDescription(transaction.description),
      referenceNote: transaction.referenceNote ? DataEncryption.encrypt(transaction.referenceNote) : null
    };

    const [newTransaction] = await db.insert(transactions).values(encryptedTransaction).returning();

    // If this is a recurring transaction, create a recurring transaction record
    // Repeats made by the job carry parentTransactionId; restoring or importing them must not
    // start a new rule for each one.
    if (transaction.isRecurring && transaction.recurringFrequency && !transaction.parentTransactionId) {
      try {
        await db.insert(recurringTransactions).values({
          userId: transaction.userId,
          categoryId: transaction.categoryId,
          description: transaction.description, // Use original unencrypted description
          amount: transaction.amount, // Use original unencrypted amount
          type: transaction.type,
          frequency: transaction.recurringFrequency,
          startDate: transaction.date,
          endDate: transaction.recurringEndDate,
          isActive: true,
          lastProcessed: transaction.date,
          sourceTransactionId: newTransaction.id,
        });
      } catch (error) {
        log.error('Error creating recurring transaction record:', error);
      }
    }

    // Decrypt for return (amount is not encrypted, so no decryption needed)
    return {
      ...newTransaction,
      // amount stays as-is since it's not encrypted
      description: DataEncryption.decryptDescription(newTransaction.description),
      referenceNote: newTransaction.referenceNote ? DataEncryption.decrypt(newTransaction.referenceNote) : null
    };
  }

  async getUserTransactions(userId: string, limit?: number): Promise<(Transaction & { categoryName?: string | null; categoryIcon?: string | null; categoryColor?: string | null })[]> {
    const baseQuery = db
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
        imageUrl: transactions.imageUrl,
        ocrText: transactions.ocrText,
        ocrVendor: transactions.ocrVendor,
        ocrDetectedAmount: transactions.ocrDetectedAmount,
        ocrDetectedDate: transactions.ocrDetectedDate,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.date));

    const userTransactions = limit ? await baseQuery.limit(limit) : await baseQuery;

    // Decrypt sensitive fields (amount is not encrypted)
    return userTransactions.map(transaction => ({
      ...transaction,
      // amount stays as-is since it's not encrypted
      description: DataEncryption.decryptDescription(transaction.description),
      referenceNote: transaction.referenceNote ? DataEncryption.decrypt(transaction.referenceNote) : null
    }));
  }

  async getTransactionsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<Array<Transaction & { categoryName?: string | null; categoryIcon?: string | null; categoryColor?: string | null }>> {
    const userTransactions = await db
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
        imageUrl: transactions.imageUrl,
        ocrText: transactions.ocrText,
        ocrVendor: transactions.ocrVendor,
        ocrDetectedAmount: transactions.ocrDetectedAmount,
        ocrDetectedDate: transactions.ocrDetectedDate,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
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
      .orderBy(desc(transactions.date));

    return userTransactions.map(transaction => ({
      ...transaction,
      description: DataEncryption.decryptDescription(transaction.description),
      referenceNote: transaction.referenceNote ? DataEncryption.decrypt(transaction.referenceNote) : null
    }));
  }

  async updateTransaction(id: number, transaction: Partial<InsertTransaction>): Promise<Transaction> {
        // Only encrypt and update fields that are actually provided
        const updateFields: any = {};

        // Only update fields that are explicitly provided
        if (transaction.amount !== undefined) {
            updateFields.amount = transaction.amount; // Keep amount unencrypted for database compatibility
        }
        if (transaction.description !== undefined && transaction.description !== DataEncryption.UNREADABLE) {
            updateFields.description = DataEncryption.encryptDescription(transaction.description);
        }
        if (transaction.referenceNote !== undefined && transaction.referenceNote !== DataEncryption.UNREADABLE) {
            updateFields.referenceNote = transaction.referenceNote ? DataEncryption.encrypt(transaction.referenceNote) : null;
        }
        if (transaction.categoryId !== undefined) {
            updateFields.categoryId = transaction.categoryId;
        }
        if (transaction.date !== undefined) {
            updateFields.date = transaction.date;
        }
        if (transaction.type !== undefined) {
            updateFields.type = transaction.type;
        }
        if (transaction.isRecurring !== undefined) {
            updateFields.isRecurring = transaction.isRecurring;
        }
        if (transaction.recurringFrequency !== undefined) {
            updateFields.recurringFrequency = transaction.recurringFrequency;
        }
        if (transaction.recurringEndDate !== undefined) {
            updateFields.recurringEndDate = transaction.recurringEndDate;
        }
        if (transaction.paymentUrl !== undefined) {
            updateFields.paymentUrl = transaction.paymentUrl;
        }

        // Nothing writable left (e.g. the client only echoed the undecryptable marker):
        // return the stored row instead of issuing an empty UPDATE.
        if (Object.keys(updateFields).length === 0) {
            const [existing] = await db
                .select()
                .from(transactions)
                .where(and(eq(transactions.id, id), eq(transactions.userId, transaction.userId!)));

            if (!existing) {
                throw new Error('Transaction not found');
            }

            return {
                ...existing,
                amount: existing.amount,
                description: DataEncryption.decryptDescription(existing.description),
                referenceNote: existing.referenceNote ? DataEncryption.decrypt(existing.referenceNote) : null
            };
        }

        const [updatedTransaction] = await db
            .update(transactions)
            .set(updateFields)
            .where(and(eq(transactions.id, id), eq(transactions.userId, transaction.userId!)))
            .returning();

        if (!updatedTransaction) {
            throw new Error('Transaction not found');
        }

        // Keep the repeat rule in step with the transaction the user just edited.
        await this.syncRecurringRule(updatedTransaction, transaction);

        // Return value with proper decryption
        return {
            ...updatedTransaction,
            amount: updatedTransaction.amount, // Keep amount as-is since it's not encrypted
            description: DataEncryption.decryptDescription(updatedTransaction.description),
            referenceNote: updatedTransaction.referenceNote ? DataEncryption.decrypt(updatedTransaction.referenceNote) : null
        };
  }

  async countUserTransactions(userId: string): Promise<number> {
    const [row] = await db.select({ total: count(transactions.id) }).from(transactions).where(eq(transactions.userId, userId));
    return Number(row?.total || 0);
  }

  /** True when a transaction was removed; false when it does not exist or is not the user's. */
  async deleteTransaction(id: number, userId: string): Promise<boolean> {
    const deleted = await db
      .delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .returning({ id: transactions.id });

    // Deleting the transaction a repeat rule came from also stops the rule.
    if (deleted.length > 0) {
      await db
        .update(recurringTransactions)
        .set({ isActive: false })
        .where(and(eq(recurringTransactions.sourceTransactionId, id), eq(recurringTransactions.userId, userId)));
    }
    return deleted.length > 0;
  }

  /** Deactivates one of the user's recurring rules; false when it is not theirs. */
  async stopRecurringRule(ruleId: number, userId: string): Promise<boolean> {
    const stopped = await db
      .update(recurringTransactions)
      .set({ isActive: false })
      .where(and(eq(recurringTransactions.id, ruleId), eq(recurringTransactions.userId, userId)))
      .returning({ id: recurringTransactions.id });
    return stopped.length > 0;
  }

  /**
   * After an edit: un-ticking "recurring" stops the rule; changing the amount, text,
   * category, type, frequency or end date updates what future repeats will look like.
   */
  private async syncRecurringRule(updated: Transaction, patch: Partial<InsertTransaction>): Promise<void> {
    try {
      if (patch.isRecurring === false || updated.isRecurring === false) {
        await db
          .update(recurringTransactions)
          .set({ isActive: false })
          .where(and(eq(recurringTransactions.sourceTransactionId, updated.id), eq(recurringTransactions.userId, updated.userId)));
        return;
      }

      if (patch.isRecurring === true && isRecurrenceFrequency(updated.recurringFrequency)) {
        const [existingRule] = await db
          .select({ id: recurringTransactions.id })
          .from(recurringTransactions)
          .where(and(eq(recurringTransactions.sourceTransactionId, updated.id), eq(recurringTransactions.userId, updated.userId)));
        if (!existingRule) {
          await db.insert(recurringTransactions).values({
            userId: updated.userId,
            categoryId: updated.categoryId,
            description: patch.description ?? DataEncryption.decryptDescription(updated.description),
            amount: updated.amount,
            type: updated.type,
            frequency: updated.recurringFrequency,
            startDate: updated.date,
            endDate: updated.recurringEndDate,
            isActive: true,
            lastProcessed: updated.date,
            sourceTransactionId: updated.id,
          });
          return;
        }
        // A stopped rule is switched back on when the person ticks recurring again.
        await db.update(recurringTransactions).set({ isActive: true }).where(eq(recurringTransactions.id, existingRule.id));
      }

      const changes: Partial<typeof recurringTransactions.$inferInsert> = {};
      if (patch.amount !== undefined) changes.amount = patch.amount;
      if (patch.description !== undefined && patch.description !== DataEncryption.UNREADABLE) changes.description = patch.description;
      if (patch.categoryId !== undefined) changes.categoryId = patch.categoryId;
      if (patch.type !== undefined) changes.type = patch.type;
      if (patch.recurringFrequency) changes.frequency = patch.recurringFrequency;
      if (patch.recurringEndDate !== undefined) changes.endDate = patch.recurringEndDate;

      if (Object.keys(changes).length > 0) {
        await db
          .update(recurringTransactions)
          .set(changes)
          .where(and(eq(recurringTransactions.sourceTransactionId, updated.id), eq(recurringTransactions.userId, updated.userId)));
      }
    } catch (error) {
      // The edit itself already succeeded; a rule that could not be synced must not undo it.
      log.error('Could not sync the recurring rule:', error instanceof Error ? error.message : error);
    }
  }

  async clearUserTransactions(userId: string): Promise<void> {
    await db
      .delete(transactions)
      .where(eq(transactions.userId, userId));
  }

  // Budget operations
  async createBudget(budget: InsertBudget): Promise<Budget> {
    const [newBudget] = await db
      .insert(budgets)
      .values(budget)
      .returning();
    return newBudget;
  }

  async getUserBudgets(userId: string, timeZone?: string): Promise<(Budget & { categoryName?: string | null; categoryIcon?: string | null; categoryColor?: string | null; spent?: number; remaining?: number; percentage?: number })[]> {
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

    const zone = timeZone ? resolveTimeZone(timeZone) : await this.getUserTimeZone(userId);

    // Calculate actual spending for each budget
    const budgetsWithSpending = await Promise.all(
      budgetData.map(async (budget) => {
        // The budget covers whole calendar days in the person's zone, first and last day included.
        const period = calendarDaysRange(budget.startDate, budget.endDate, zone);
        // Calculate total spending for this category within the budget period
        const spendingResult = budget.categoryId ? await db
          .select({
            totalSpent: sql`COALESCE(SUM(ABS(CAST(${transactions.amount} AS DECIMAL))), 0)`
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              eq(transactions.categoryId, budget.categoryId),
              eq(transactions.type, 'expense'),
              gte(transactions.date, period.start),
              lte(transactions.date, period.end)
            )
          ) : [{ totalSpent: 0 }];

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
    // SECURITY FIX: Verify ownership before allowing update
    const existingBudget = await db
      .select()
      .from(budgets)
      .where(eq(budgets.id, id))
      .limit(1);

    if (!existingBudget.length || existingBudget[0].userId !== budget.userId) {
      throw new Error("Budget not found or unauthorized access");
    }

    const [updatedBudget] = await db
      .update(budgets)
      .set(budget)
      .where(and(eq(budgets.id, id), eq(budgets.userId, budget.userId!)))
      .returning();
    return updatedBudget;
  }

  async deleteBudget(id: number, userId: string): Promise<boolean> {
    const deleted = await db
      .delete(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
      .returning({ id: budgets.id });
    return deleted.length > 0;
  }

  async getBudget(id: number): Promise<Budget | undefined> {
    const result = await db
      .select()
      .from(budgets)
      .where(eq(budgets.id, id))
      .limit(1);

    return result[0];
  }

  async clearUserBudgets(userId: string): Promise<void> {
    await db
      .delete(budgets)
      .where(eq(budgets.userId, userId));
  }

  // Goal operations
  async createGoal(goal: InsertGoal): Promise<Goal> {
    const [newGoal] = await db
      .insert(goals)
      .values(goal)
      .returning();
    return newGoal;
  }

  async getUserGoals(userId: string): Promise<Goal[]> {
    return await db
      .select()
      .from(goals)
      .where(eq(goals.userId, userId))
      .orderBy(desc(goals.createdAt));
  }

  async getGoal(id: number, userId: string): Promise<Goal | undefined> {
    const result = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, userId)))
      .limit(1);

    return result[0];
  }

  async updateGoal(id: number, userId: string, goal: Partial<InsertGoal>): Promise<Goal> {
    // SECURITY FIX: Verify ownership before allowing update
    const existingGoal = await db
      .select()
      .from(goals)
      .where(eq(goals.id, id))
      .limit(1);

    if (!existingGoal.length || existingGoal[0].userId !== userId) {
      throw new Error("Goal not found or unauthorized access");
    }

    const [updatedGoal] = await db
      .update(goals)
      .set(goal)
      .where(and(eq(goals.id, id), eq(goals.userId, userId)))
      .returning();
    return updatedGoal;
  }

  async deleteGoal(id: number, userId: string): Promise<boolean> {
    const deleted = await db
      .delete(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, userId)))
      .returning({ id: goals.id });
    return deleted.length > 0;
  }

  async clearUserGoals(userId: string): Promise<void> {
    await db
      .delete(goals)
      .where(eq(goals.userId, userId));
  }

  // Category operations
  async getCategories(userId?: string): Promise<Category[]> {
    if (userId) {
      // Return both predefined categories (userId is NULL) and user-specific categories
      return await db.select().from(categories).where(
        or(
          isNull(categories.userId),
          eq(categories.userId, userId)
        )
      );
    }
    return await db.select().from(categories);
  }

  async getCategory(categoryId: number): Promise<Category | undefined> {
    if (!categoryId) return undefined;
    const [category] = await db.select().from(categories).where(eq(categories.id, categoryId)).limit(1);
    return category;
  }

  async createCategory(category: { userId: string; name: string; icon: string; color: string; type: string }): Promise<Category> {
    const [newCategory] = await db
      .insert(categories)
      .values({
        userId: category.userId,
        name: category.name,
        icon: category.icon,
        color: category.color,
        type: category.type as "income" | "expense",
      })
      .returning();

    return newCategory;
  }

  async updateCategory(categoryId: number, userId: string, updateData: { name: string; icon: string; color: string; type: 'income' | 'expense' }) {
    // SECURITY: Verify category ownership before allowing updates
    const existingCategory = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
      .limit(1);

    if (existingCategory.length === 0) {
      throw new Error("Category not found or access denied");
    }

    const [category] = await db
      .update(categories)
      .set(updateData)
      .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
      .returning();

    if (!category) {
      throw new Error("Category not found");
    }

    return category;
  }

  async deleteCategory(categoryId: number, userId: string) {
    // SECURITY: First verify the category belongs to the user
    const userCategory = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
      .limit(1);

    if (userCategory.length === 0) {
      throw new Error("Category not found or access denied");
    }

    // Check if category is in use by any transactions (only user's transactions)
    const transactionsUsingCategory = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(and(
        eq(transactions.categoryId, categoryId),
        eq(transactions.userId, userId)
      ));

    if (transactionsUsingCategory[0].count > 0) {
      throw new Error("Cannot delete category that is in use by transactions");
    }

    const [deletedCategory] = await db
      .delete(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
      .returning();

    if (!deletedCategory) {
      throw new Error("Category not found");
    }

    return deletedCategory;
  }

  // Analytics
  async getUserFinancialSummary(userId: string, startDate: Date, endDate: Date) {
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

    // Postgres returns decimal(12,2) sums as strings ("1420.50"); converting via
    // cents keeps every downstream total exact (no binary-float drift).
    const totalIncomeInCents = parseAmountToCents(incomeResult[0]?.total);
    const totalExpensesInCents = parseAmountToCents(expenseResult[0]?.total);
    const incomeTransactionCount = Number(incomeResult[0]?.count || 0);
    const expenseTransactionCount = Number(expenseResult[0]?.count || 0);
    const netBalanceInCents = totalIncomeInCents - totalExpensesInCents;

    const transactionsByCategory = categoryResults.map(result => {
      const amountInCents = parseAmountToCents(result.amount);
      return {
        categoryName: result.categoryName || UNCATEGORIZED,
        amount: centsToNumber(amountInCents),
        amountInCents,
        type: result.type,
      };
    });

    // Money invariant (blueprint 07 §18). This is the authoritative place where every
    // money summary is built, so a silent wrong-number bug is caught exactly once, here.
    // It reports and continues: a failed invariant must not turn a readable summary into
    // an error page for the user.
    for (const violation of checkSummary({
      totalIncomeInCents,
      totalExpensesInCents,
      netBalanceInCents,
      categories: transactionsByCategory,
    })) {
      reportInvariant(violation.code, {
        expected: violation.expected,
        actual: violation.actual,
        where: 'storage.getUserFinancialSummary',
      });
    }

    return {
      totalIncomeInCents,
      totalExpensesInCents,
      netBalanceInCents,
      totalIncome: centsToNumber(totalIncomeInCents),
      totalExpenses: centsToNumber(totalExpensesInCents),
      netBalance: centsToNumber(netBalanceInCents),
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

  async getUserExpenseReminders(userId: string): Promise<ExpenseReminder[]> {
    const results = await db
      .select()
      .from(expenseReminders)
      .where(eq(expenseReminders.userId, userId))
      .orderBy(expenseReminders.dueDate);
    return results;
  }

  async getUpcomingExpenseReminders(userId: string, daysBefore: number = 7): Promise<ExpenseReminder[]> {
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

  async getUserRecurringTransactions(userId: string): Promise<RecurringRuleWithCategory[]> {
    const results = await db
      .select({
        id: recurringTransactions.id,
        userId: recurringTransactions.userId,
        categoryId: recurringTransactions.categoryId,
        description: recurringTransactions.description,
        amount: recurringTransactions.amount,
        type: recurringTransactions.type,
        frequency: recurringTransactions.frequency,
        startDate: recurringTransactions.startDate,
        endDate: recurringTransactions.endDate,
        isActive: recurringTransactions.isActive,
        lastProcessed: recurringTransactions.lastProcessed,
        createdAt: recurringTransactions.createdAt,
        sourceTransactionId: recurringTransactions.sourceTransactionId,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
      })
      .from(recurringTransactions)
      .leftJoin(categories, eq(recurringTransactions.categoryId, categories.id))
      .where(
        and(
          eq(recurringTransactions.userId, userId),
          eq(recurringTransactions.isActive, true)
        )
      )
      .orderBy(desc(recurringTransactions.createdAt));

    return results;
  }

  async getUpcomingTransactionReminders(userId: string, daysAhead: number = 7): Promise<Array<{
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
        title: DataEncryption.decryptDescription(transaction.description), // Decrypt the description
        description: `${transaction.type === 'expense' ? 'Payment' : 'Income'} scheduled`,
        amount: transaction.amount, // Amount is not encrypted, so use as-is
        dueDate: transaction.date,
        type: transaction.type as 'income' | 'expense',
        categoryName: transaction.categoryName || 'Uncategorized',
        isRecurring: transaction.isRecurring || false,
        source: 'future_transaction'
      });
    });

    // Get active recurring transactions from main transactions table
    const activeRecurringTransactions = await db
      .select({
        id: transactions.id,
        description: transactions.description,
        amount: transactions.amount,
        type: transactions.type,
        recurringFrequency: transactions.recurringFrequency,
        date: transactions.date,
        recurringEndDate: transactions.recurringEndDate,
        categoryName: categories.name,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.isRecurring, true),
          or(
            isNull(transactions.recurringEndDate),
            gte(transactions.recurringEndDate, now)
          )
        )
      );

    // Calculate next occurrences for recurring transactions
    log.info(`Found ${activeRecurringTransactions.length} active recurring transactions for user ${userId}`);
    activeRecurringTransactions.forEach(recurring => {
      log.info(`Processing recurring transaction: ${recurring.id}, date: ${recurring.date}, frequency: ${recurring.recurringFrequency}`);

      const nextOccurrence = this.calculateNextOccurrence(
        recurring.date,
        recurring.recurringFrequency || 'monthly',
        recurring.recurringEndDate
      );

      log.info(`Next occurrence calculated: ${nextOccurrence}, within window: ${nextOccurrence && nextOccurrence <= futureDate && nextOccurrence >= now}`);

      if (nextOccurrence && nextOccurrence <= futureDate && nextOccurrence >= now) {
        const reminder = {
          id: `recurring_${recurring.id}`,
          title: DataEncryption.decryptDescription(recurring.description), // Decrypt the description
          description: recurring.recurringFrequency || 'monthly', // Just send the frequency, let client translate
          amount: recurring.amount, // Amount is not encrypted, so use as-is
          dueDate: nextOccurrence,
          type: recurring.type as 'income' | 'expense',
          categoryName: recurring.categoryName || 'Uncategorized',
          isRecurring: true,
          source: 'recurring_transaction' as 'future_transaction' | 'recurring_transaction'
        };
        log.info(`Adding reminder: ${JSON.stringify(reminder)}`);
        reminders.push(reminder);
      }
    });

    return reminders.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  private calculateNextOccurrence(lastDate: Date, frequency: string, endDate: Date | null): Date | null {
    const now = new Date();
    now.setHours(0, 0,0, 0); // Reset to start of day for accurate comparison

    const next = new Date(lastDate);
    next.setHours(0, 0, 0, 0); // Reset to start of day for accurate comparison

    log.info(`Calculating next occurrence: lastDate=${lastDate.toISOString()}, frequency=${frequency}, now=${now.toISOString()}`);

    // For recurring transactions, we always need the NEXT occurrence, not today
    // If the transaction date is today, we need to calculate the next recurring date
    if (next.getTime() === now.getTime()) {
      log.info(`Transaction date is today, calculating next occurrence for frequency: ${frequency}`);
      // Move to next occurrence immediately
      switch (frequency.toLowerCase()) {
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
          log.info(`Unknown frequency: ${frequency}, returning null`);
          return null;
      }
      log.info(`Next occurrence for today's transaction: ${next.toISOString()}`);
    } else if (next > now) {
      log.info(`Transaction date is in future, using: ${next.toISOString()}`);
      if (endDate && next > endDate) {
        log.info(`Date exceeds end date, returning null`);
        return null;
      }
      return next;
    }

    // Keep adding periods until we find a future date
    while (next <= now) {
      switch (frequency.toLowerCase()) {
        case 'weekly':
          next.setDate(next.getDate() + 7);
          log.info(`Added 7 days: ${next.toISOString()}`);
          break;
        case 'monthly':
          next.setMonth(next.getMonth() + 1);
          log.info(`Added 1 month: ${next.toISOString()}`);
          break;
        case 'yearly':
          next.setFullYear(next.getFullYear() + 1);
          log.info(`Added 1 year: ${next.toISOString()}`);
          break;
        default:
          log.info(`Unknown frequency: ${frequency}, returning null`);
          return null;
      }
    }

    if (endDate && next > endDate) {
      log.info(`Final date ${next.toISOString()} exceeds end date ${endDate.toISOString()}, returning null`);
      return null;
    }

    log.info(`Calculated next occurrence: ${next.toISOString()}`);
    return next;
  }

  async updateExpenseReminder(id: number, reminder: Partial<InsertExpenseReminder>): Promise<ExpenseReminder> {
    // SECURITY FIX: Verify ownership before allowing update
    const existingReminder = await db
      .select()
      .from(expenseReminders)
      .where(eq(expenseReminders.id, id))
      .limit(1);

    if (!existingReminder.length || existingReminder[0].userId !== reminder.userId) {
      throw new Error("Expense reminder not found or unauthorized access");
    }

    const [result] = await db
      .update(expenseReminders)
      .set({ ...reminder, updatedAt: new Date() })
      .where(and(eq(expenseReminders.id, id), eq(expenseReminders.userId, reminder.userId!)))
      .returning();
    return result;
  }

  async deleteExpenseReminder(id: number, userId: string): Promise<void> {
    await db
      .delete(expenseReminders)
      .where(and(eq(expenseReminders.id, id), eq(expenseReminders.userId, userId)));
  }

  async markExpenseReminderCompleted(id: number, userId: string): Promise<void> {
    const [reminder] = await db
      .select()
      .from(expenseReminders)
      .where(and(eq(expenseReminders.id, id), eq(expenseReminders.userId, userId)));

    if (!reminder) return;

    // A repeating bill is not finished when it is paid: it moves to its next due date
    // (until its end date) and is reminded about again.
    if (reminder.isRecurring && isRecurrenceFrequency(reminder.recurringFrequency)) {
      let step = 1;
      let nextDue = occurrenceAt(reminder.dueDate, reminder.recurringFrequency, step);
      while (nextDue <= new Date() && step < 1000) {
        step++;
        nextDue = occurrenceAt(reminder.dueDate, reminder.recurringFrequency, step);
      }
      const withinEnd = !reminder.recurringEndDate || nextDue <= reminder.recurringEndDate;
      if (withinEnd) {
        // Compare-and-set on the old due date: a second click finds it already moved.
        await db
          .update(expenseReminders)
          .set({ dueDate: nextDue, isCompleted: false, lastReminded: null, updatedAt: new Date() })
          .where(and(eq(expenseReminders.id, id), eq(expenseReminders.userId, userId), eq(expenseReminders.dueDate, reminder.dueDate)));
        return;
      }
    }

    await db
      .update(expenseReminders)
      .set({ isCompleted: true, updatedAt: new Date() })
      .where(and(eq(expenseReminders.id, id), eq(expenseReminders.userId, userId)));
  }

  async clearUserExpenseReminders(userId: string): Promise<void> {
    await db
      .delete(expenseReminders)
      .where(eq(expenseReminders.userId, userId));
  }

  // Backup settings operations
  async getUserBackupSettings(userId: string): Promise<BackupSettings | undefined> {
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

  async updateBackupSettings(userId: string, settings: Partial<InsertBackupSettings>): Promise<BackupSettings> {
    const result = await db
      .update(backupSettings)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(backupSettings.userId, userId))
      .returning();

    return result[0];
  }

  async getUsersWithActiveBackups(): Promise<Array<{ userId: string }>> {
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

  async getUsersWithOverdueBackups(): Promise<Array<{ userId: string }>> {
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

  async updateUserProfile(userId: string, profileData: { firstName: string; lastName: string; email: string; phone?: string | null; website?: string | null }): Promise<void> {
    const updateData: any = {
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      email: profileData.email,
      phone: profileData.phone || null,
      website: profileData.website || null,
      updatedAt: new Date()
    };

    const result = await db.update(users).set(updateData).where(eq(users.id, userId));

    // Verify the update was successful
    if (!result) {
      throw new Error('Failed to update user profile in database');
    }
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    await db.update(users).set({ 
      password: hashedPassword,
      updatedAt: new Date()
    }).where(eq(users.id, userId));
  }

  async getUserSettings(userId: string): Promise<any> {
    const user = await this.getUser(userId);
    return user?.settings ? JSON.parse(user.settings) : null;
  }

  async updateUserSettings(userId: string, settings: any): Promise<void> {
    await db.update(users).set({ settings: JSON.stringify(settings) }).where(eq(users.id, userId));
  }

  // Admin methods for user management with encryption support
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.createdAt);
  }

  async updateUser(userId: string, userData: Partial<User>): Promise<User> {
    try {
      // Clean userData to only include valid user fields
      const validFields = {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl,
        phone: userData.phone,
        website: userData.website,
        plan: userData.plan,
        billingInterval: userData.billingInterval,
        currency: userData.currency,
        stripeCustomerId: userData.stripeCustomerId,
        stripeSubscriptionId: userData.stripeSubscriptionId,
        settings: userData.settings,
        // The AI switch and the MercadoPago subscription id must be persistable, otherwise
        // the toggle answers 200 and changes nothing.
        aiEnabled: userData.aiEnabled,
        emailNotifications: userData.emailNotifications,
        timezone: userData.timezone,
        language: userData.language,
        mpPreapprovalId: userData.mpPreapprovalId,
        updatedAt: new Date(),
      };

      // Remove undefined values
      const cleanData = Object.fromEntries(
        Object.entries(validFields).filter(([_, value]) => value !== undefined)
      );

      const [updatedUser] = await db
        .update(users)
        .set(cleanData)
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) {
        throw new Error('User not found');
      }

      return updatedUser;
    } catch (error: any) {
      log.error('Failed to update user in database:', error);
      throw new Error('Failed to update user profile in database');
    }
  }

  async deleteUserCompletely(userId: string): Promise<void> {
    log.info(`Starting complete deletion of user: ${userId}`);

    try {
      // Check if user exists first
      const existingUser = await this.getUser(userId);
      if (!existingUser) {
        throw new Error(`User ${userId} not found`);
      }

      // Everything below runs in one transaction (the parameter deliberately shadows the
      // module-level `db`), so a failure part-way leaves the account untouched.
      await (db as any).transaction(async (db: any) => {
      // Goals the person created take everything inside them along: other members' rows
      // reference the goal, so they must go before the goal (and before the user).
      const createdGoalIds: number[] = (
        await db.select({ id: collaborativeGoals.id }).from(collaborativeGoals).where(eq(collaborativeGoals.createdBy, userId))
      ).map((row: { id: number }) => row.id);
      if (createdGoalIds.length > 0) {
        await db.delete(goalMessages).where(inArray(goalMessages.goalId, createdGoalIds));
        await db.delete(milestoneAchievements).where(inArray(milestoneAchievements.goalId, createdGoalIds));
        await db.delete(challengeActivities).where(inArray(challengeActivities.goalId, createdGoalIds));
        await db.delete(goalContributions).where(inArray(goalContributions.goalId, createdGoalIds));
        await db.delete(collaborativeGoalParticipants).where(inArray(collaborativeGoalParticipants.goalId, createdGoalIds));
      }
      // Tables that point at the user and used to block the deletion for anyone who had used AI
      await db.delete(merchantLearning).where(eq(merchantLearning.userId, userId));
      await db.delete(aiUsage).where(eq(aiUsage.userId, userId));
      await db.delete(aiUserOverrides).where(eq(aiUserOverrides.userId, userId));
      // Chat the person wrote in other people's goals, before their participation goes
      await db.delete(goalMessages).where(eq(goalMessages.userId, userId));

      // Delete all user transactions first
      const deletedTransactions = await db.delete(transactions).where(eq(transactions.userId, userId)).execute();
      log.info(`Deleted transactions for user: ${userId}`);

      // Budgets reference categories, so they must be deleted BEFORE categories
      const deletedBudgets = await db.delete(budgets).where(eq(budgets.userId, userId)).execute();
      log.info(`Deleted budgets for user: ${userId}`);

      // Delete all user categories
      const deletedCategories = await db.delete(categories).where(eq(categories.userId, userId)).execute();
      log.info(`Deleted categories for user: ${userId}`);

      // Delete all user goals
      const deletedGoals = await db.delete(goals).where(eq(goals.userId, userId)).execute();
      log.info(`Deleted goals for user: ${userId}`);

      // Delete all expense reminders
      const deletedExpenseReminders = await db.delete(expenseReminders).where(eq(expenseReminders.userId, userId)).execute();
      log.info(`Deleted expense reminders for user: ${userId}`);

      // Delete all collaborative goal participants
      const deletedCollaborativeGoalParticipants = await db.delete(collaborativeGoalParticipants).where(eq(collaborativeGoalParticipants.userId, userId)).execute();
      log.info(`Deleted collaborative goal participants for user: ${userId}`);

      // Delete all goal contributions
      const deletedGoalContributions = await db.delete(goalContributions).where(eq(goalContributions.userId, userId)).execute();
      log.info(`Deleted goal contributions for user: ${userId}`);

      // Delete all challenge activities
      const deletedChallengeActivities = await db.delete(challengeActivities).where(eq(challengeActivities.userId, userId)).execute();
      log.info(`Deleted challenge activities for user: ${userId}`);

       // Delete all milestone achievements
      const deletedMilestoneAchievements = await db.delete(milestoneAchievements).where(eq(milestoneAchievements.userId, userId)).execute();
      log.info(`Deleted milestone achievements for user: ${userId}`);

      // Delete all financial mascots
      const deletedFinancialMascots = await db.delete(financialMascots).where(eq(financialMascots.userId, userId)).execute();
      log.info(`Deleted financial mascots for user: ${userId}`);

      // Delete all friendships
      const deletedFriendships = await db.delete(friendships).where(or(eq(friendships.requesterId, userId), eq(friendships.recipientId, userId))).execute();
      log.info(`Deleted friendships for user: ${userId}`);

      // Delete all collaborative goals created by the user
      const deletedCollaborativeGoals = await db.delete(collaborativeGoals).where(eq(collaborativeGoals.createdBy, userId)).execute();
      log.info(`Deleted collaborative goals for user: ${userId}`);

      // Delete all redeem codes associated with the user
      const deletedRedeemCodes = await db.delete(redeemCodes).where(eq(redeemCodes.userId, userId)).execute();
      log.info(`Deleted redeem codes for user: ${userId}`);

      // Remaining user-owned data (each of these has a FK to users without CASCADE)
      await db.delete(goalMessages).where(eq(goalMessages.userId, userId)).execute();
      await db.delete(courseProgress).where(eq(courseProgress.userId, userId)).execute();
      await db.delete(userAchievements).where(eq(userAchievements.userId, userId)).execute();
      await db.delete(learningStats).where(eq(learningStats.userId, userId)).execute();
      await db.delete(backupSettings).where(eq(backupSettings.userId, userId)).execute();
      await db.delete(importLogs).where(eq(importLogs.userId, userId)).execute();
      await db.delete(aiCache).where(eq(aiCache.userId, userId)).execute();
      await db.delete(paymentFailures).where(eq(paymentFailures.userId, userId)).execute();
      await db.delete(recurringTransactions).where(eq(recurringTransactions.userId, userId)).execute();

      // Finally delete the user record
      const deletedUser = await db.delete(users).where(eq(users.id, userId)).execute();
      log.info(`Deleted user record: ${userId}`);
      });

      log.info(`Successfully completed deletion of user: ${userId}`);

    } catch (error: any) {
      log.error(`Error deleting user ${userId}:`, error);
      throw new Error(`Failed to delete user ${userId}: ${error.message}`);
    }
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
        // List price from the one price list, in US dollars and per month. This is an
        // estimate, not a ledger: yearly subscribers are counted at the monthly rate and
        // Peruvian subscribers (soles) at the dollar rate.
        stats.totalRevenue += count * PLAN_PRICES.standard.usd.monthly;
      } else if (stat.plan === 'premium') {
        stats.premiumUsers = count;
        stats.totalRevenue += count * PLAN_PRICES.premium.usd.monthly;
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

    return friends.map(f => ({ ...f.friendship, friend: friendUser(f.friend) }));
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

    return requests.map(r => ({ ...r.friendship, requester: friendUser(r.requester) }));
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
    // 10 characters from a 32-letter alphabet (50 bits) out of a CSPRNG; Math.random is guessable.
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.randomBytes(10);
    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
  }

  /** Joins only when the invite code matches (compared in constant time). */
  async joinCollaborativeGoalWithCode(goalId: number, userId: string, joinCode: string, personalTarget?: number): Promise<CollaborativeGoalParticipant> {
    const [goal] = await db.select({ joinCode: collaborativeGoals.joinCode }).from(collaborativeGoals).where(eq(collaborativeGoals.id, goalId));
    const expected = Buffer.from(String(goal?.joinCode ?? '').toUpperCase());
    const given = Buffer.from(String(joinCode ?? '').trim().toUpperCase());
    if (!goal || expected.length === 0 || expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
      throw new Error('Invalid invitation code');
    }
    return this.joinCollaborativeGoal(goalId, userId, personalTarget);
  }

  async getUserCollaborativeGoals(userId: string): Promise<Array<CollaborativeGoal & { participants: Array<CollaborativeGoalParticipant & { user: User }>, creator: User }>> {
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

    // Get participants for each goal with user data
    const result = [];
    for (const { goal, creator } of goals) {
      const participantsWithUsers = await db
        .select({
          participant: collaborativeGoalParticipants,
          user: users,
        })
        .from(collaborativeGoalParticipants)
        .innerJoin(users, eq(collaborativeGoalParticipants.userId, users.id))
        .where(
          and(
            eq(collaborativeGoalParticipants.goalId, goal.id),
            eq(collaborativeGoalParticipants.status, "active")
          )
        );

      const participants = participantsWithUsers.map(({ participant, user }) => ({
        ...participant,
        user: publicUser(user),
      }));

      result.push({ ...goal, participants, creator: publicUser(creator) });
    }

    return result;
  }

  /**
   * Minimal, non-member view of a collaborative goal so an invite link can
   * render a "Join" action instead of a 404.
   */
  async getCollaborativeGoalPreview(goalId: number): Promise<(CollaborativeGoal & { creator: User; participantCount: number }) | undefined> {
    const [row] = await db
      .select({ goal: collaborativeGoals, creator: users })
      .from(collaborativeGoals)
      .innerJoin(users, eq(collaborativeGoals.createdBy, users.id))
      .where(eq(collaborativeGoals.id, goalId));

    if (!row) return undefined;

    const participants = await db
      .select({ id: collaborativeGoalParticipants.id })
      .from(collaborativeGoalParticipants)
      .where(
        and(
          eq(collaborativeGoalParticipants.goalId, goalId),
          eq(collaborativeGoalParticipants.status, 'active')
        )
      );

    // The invite code is the secret that lets someone in, so a non-member never sees it.
    const { joinCode: _hidden, ...goalWithoutCode } = row.goal;
    return { ...goalWithoutCode, joinCode: '', creator: publicUser(row.creator), participantCount: participants.length };
  }

  async getGoalParticipant(goalId: number, userId: string): Promise<CollaborativeGoalParticipant | undefined> {
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

    return participant;
  }

  async getGoalParticipants(goalId: number): Promise<Array<CollaborativeGoalParticipant & { user: User }>> {
    const participantsWithUsers = await db
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

    return participantsWithUsers.map(({ participant, user }) => ({
      ...participant,
      user: publicUser(user),
    }));
  }

  async getCollaborativeGoal(goalId: number, userId: string): Promise<(CollaborativeGoal & { participants: Array<CollaborativeGoalParticipant & { user: User }>, creator: User, contributions: Array<GoalContribution & { user: User }>, activities: ChallengeActivity[] }) | undefined> {
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

    // Get contributions with user data
    const contributions = await this.getGoalContributions(goalId);

    // Get activities
    const activities = await db
      .select()
      .from(challengeActivities)
      .where(eq(challengeActivities.goalId, goalId))
      .orderBy(desc(challengeActivities.createdAt));

    return {
      ...goalWithCreator.goal,
      creator: publicUser(goalWithCreator.creator),
      participants: participants.map(p => ({ ...p.participant, user: publicUser(p.user) })),
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
    await db.delete(goalMessages).where(eq(goalMessages.goalId, goalId));
    await db.delete(milestoneAchievements).where(eq(milestoneAchievements.goalId, goalId));
    await db.delete(challengeActivities).where(eq(challengeActivities.goalId, goalId));
    await db.delete(goalContributions).where(eq(goalContributions.goalId, goalId));
    await db.delete(collaborativeGoalParticipants).where(eq(collaborativeGoalParticipants.goalId, goalId));
    await db.delete(collaborativeGoals).where(eq(collaborativeGoals.id, goalId));
  }

  async clearUserCollaborativeGoals(userId: string): Promise<void> {
    // Get all collaborative goals created by user
    const userGoals = await db
      .select({ id: collaborativeGoals.id })
      .from(collaborativeGoals)
      .where(eq(collaborativeGoals.createdBy, userId));

    // Delete all related data for each goal
    for (const goal of userGoals) {
      await db.delete(milestoneAchievements).where(eq(milestoneAchievements.goalId, goal.id));
      await db.delete(challengeActivities).where(eq(challengeActivities.goalId, goal.id));
      await db.delete(goalContributions).where(eq(goalContributions.goalId, goal.id));
      await db.delete(collaborativeGoalParticipants).where(eq(collaborativeGoalParticipants.goalId, goal.id));
    }

    // Delete the goals themselves
    await db.delete(collaborativeGoals).where(eq(collaborativeGoals.createdBy, userId));

    // Also remove user as participant from other goals
    await db.delete(collaborativeGoalParticipants).where(eq(collaborativeGoalParticipants.userId, userId));
    await db.delete(goalContributions).where(eq(goalContributions.userId, userId));
    await db.delete(challengeActivities).where(eq(challengeActivities.userId, userId));
    await db.delete(milestoneAchievements).where(eq(milestoneAchievements.userId, userId));

    // Remove friendships
    await db.delete(friendships).where(
      or(
        eq(friendships.requesterId, userId),
        eq(friendships.recipientId, userId)
      )
    );
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

    return contributions.map(c => ({ ...c.contribution, user: publicUser(c.user) }));
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

    return activities.map(a => ({ ...a.activity, user: publicUser(a.user) }));
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
    // Percentage milestones are stored with userId = null because they belong to
    // the whole group. Include those for every goal the user takes part in,
    // otherwise GET /api/achievements would always return an empty list.
    const participations = await db
      .select({ goalId: collaborativeGoalParticipants.goalId })
      .from(collaborativeGoalParticipants)
      .where(eq(collaborativeGoalParticipants.userId, userId));

    const goalIds = participations.map((p) => p.goalId);

    return await db
      .select()
      .from(milestoneAchievements)
      .where(
        goalIds.length > 0
          ? or(
              eq(milestoneAchievements.userId, userId),
              inArray(milestoneAchievements.goalId, goalIds)
            )
          : eq(milestoneAchievements.userId, userId)
      )
      .orderBy(desc(milestoneAchievements.achievedAt));
  }

  // Financial Mascot operations
  async getUserMascot(userId: string): Promise<FinancialMascot | undefined> {
    const [mascot] = await db
      .select()
      .from(financialMascots)
      .where(eq(financialMascots.userId, userId))
      .orderBy(desc(financialMascots.createdAt))
      .limit(1);
    return mascot;
  }

  async createMascot(mascot: InsertFinancialMascot): Promise<FinancialMascot> {
    const [newMascot] = await db
      .insert(financialMascots)
      .values({
        ...mascot,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastGenerated: new Date()
      })
      .returning();
    return newMascot;
  }

  async updateMascot(userId: string, updates: Partial<InsertFinancialMascot>): Promise<FinancialMascot> {
    const [updatedMascot] = await db
      .update(financialMascots)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(financialMascots.userId, userId))
      .returning();
    return updatedMascot;
  }

  async toggleMascot(userId: string, enabled: boolean): Promise<FinancialMascot> {
    const [updatedMascot] = await db
      .update(financialMascots)
      .set({
        isEnabled: enabled,
        updatedAt: new Date()
      })
      .where(eq(financialMascots.userId, userId))
      .returning();
    return updatedMascot;
  }

  // Redeem code operations
  async getRedeemCode(code: string): Promise<RedeemCode | undefined> {
    const [redeemCode] = await db
      .select()
      .from(redeemCodes)
      .where(eq(redeemCodes.code, code.toUpperCase()));
    return redeemCode;
  }

  async redeemCode(code: string, userId: string): Promise<RedeemCode> {
    const [redeemedCode] = await db
      .update(redeemCodes)
      .set({
        redeemed: true,
        userId,
        redeemedAt: new Date()
      })
      .where(
        and(
          eq(redeemCodes.code, code.toUpperCase()),
          eq(redeemCodes.redeemed, false)
        )
      )
      .returning();

    if (!redeemedCode) {
      throw new Error("Code not found or already redeemed");
    }

    return redeemedCode;
  }

  async redeemMultipleCodes(codes: string[], userId: string): Promise<{ validCodes: RedeemCode[], invalidCodes: string[] }> {
    const validCodes: RedeemCode[] = [];
    const invalidCodes: string[] = [];

    for (const code of codes) {
      try {
        // Check if code exists and is not redeemed
        const redeemCode = await this.getRedeemCode(code);
        if (!redeemCode || redeemCode.redeemed) {
          invalidCodes.push(code);
          continue;
        }

        // Redeem the code
        const redeemedCode = await this.redeemCode(code, userId);
        validCodes.push(redeemedCode);
      } catch (error) {
        invalidCodes.push(code);
      }
    }

    return { validCodes, invalidCodes };
  }

  async getUserRedeemedCodes(userId: string): Promise<RedeemCode[]> {
    const userCodes = await db
      .select()
      .from(redeemCodes)
      .where(
        and(
          eq(redeemCodes.userId, userId),
          eq(redeemCodes.redeemed, true)
        )
      )
      .orderBy(redeemCodes.redeemedAt);
    return userCodes;
  }

  // Import log operations
  async createImportLog(importLog: InsertImportLog): Promise<ImportLog> {
    const [result] = await db.insert(importLogs).values(importLog).returning();
    return result;
  }

  async getUserImportLogs(userId: string, limit: number = 10): Promise<ImportLog[]> {
    const results = await db
      .select()
      .from(importLogs)
      .where(eq(importLogs.userId, userId))
      .orderBy(desc(importLogs.importedAt))
      .limit(limit);
    return results;
  }

  async getImportLogById(id: number): Promise<ImportLog | null> {
    const results = await db
      .select()
      .from(importLogs)
      .where(eq(importLogs.id, id))
      .limit(1);
    return results[0] || null;
  }

  // AI Cache operations for unified cache system
  async getAICacheEntry(userId: string, functionKey: string, inputHash: string): Promise<AiCache | null> {
    const results = await db
      .select()
      .from(aiCache)
      .where(and(
        eq(aiCache.userId, userId),
        eq(aiCache.functionKey, functionKey),
        eq(aiCache.inputHash, inputHash)
      ))
      .limit(1);
    
    if (results.length === 0) {
      return null;
    }
    
    // Update hit count and last accessed
    await db
      .update(aiCache)
      .set({ 
        hitCount: sql`${aiCache.hitCount} + 1`,
        lastAccessed: new Date()
      })
      .where(eq(aiCache.id, results[0].id));
    
    return results[0];
  }

  async setAICacheEntry(userId: string, functionKey: string, inputHash: string, input: any, output: any, month?: string, isError: boolean = false, ttlHours?: number): Promise<void> {
    const now = new Date();
    
    // Calculate expiration time based on TTL or default function TTL
    let expiresAt: Date | undefined;
    if (ttlHours) {
      expiresAt = new Date(now.getTime() + (ttlHours * 60 * 60 * 1000));
    } else {
      // Default TTL configurations for different AI functions (in hours)
      const defaultTTL: Record<string, number> = {
        'financial-tips': 168, // 7 days
        'daily-recommendations': 24, // 1 day
        'contextual-tips': 72, // 3 days
        'expense-predictions': 48, // 2 days
        'financial-health-score': 24, // 1 day
        'spending-insights': 72, // 3 days
        'trend-predictions': 48, // 2 days
      };
      
      const defaultHours = defaultTTL[functionKey] || 24; // Default to 24 hours
      expiresAt = new Date(now.getTime() + (defaultHours * 60 * 60 * 1000));
    }
    
    await db
      .insert(aiCache)
      .values({
        userId,
        functionKey,
        inputHash,
        inputJson: input,
        outputJson: output,
        month,
        isError,
        hitCount: 0,
        lastAccessed: now,
        expiresAt,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoNothing();
  }

  // Get most recent AI cache entry for a user and function
  async getRecentAICacheEntry(userId: string, functionKey: string): Promise<any> {
    const entry = await db
      .select()
      .from(aiCache)
      .where(
        and(
          eq(aiCache.userId, userId),
          eq(aiCache.functionKey, functionKey),
          eq(aiCache.isError, false),
          gt(aiCache.expiresAt, new Date())
        )
      )
      .orderBy(desc(aiCache.lastAccessed))
      .limit(1);

    return entry[0] || null;
  }

  // Get all AI cache entries (admin function)
  async getAllAICacheEntries(): Promise<any[]> {
    const entries = await db
      .select()
      .from(aiCache)
      .orderBy(desc(aiCache.lastAccessed));

    return entries;
  }

  // Removed: Contextual Financial Tips operations - using unified ai_cache system

  // Removed: Legacy cache methods - using unified ai_cache system

  // Payment failure operations for grace period handling
  async createPaymentFailure(failure: InsertPaymentFailure): Promise<PaymentFailure> {
    // The unique index on stripe_invoice_id is the real guard: a repeated delivery of the
    // same invoice cannot add a second row even if two requests race each other.
    const [result] = await db
      .insert(paymentFailures)
      .values(failure)
      .onConflictDoNothing()
      .returning();
    if (result) return result;

    const existing = failure.stripeInvoiceId
      ? await this.getPaymentFailureByInvoice(failure.stripeInvoiceId)
      : null;
    if (existing) return existing;
    throw new Error('Payment failure could not be recorded');
  }

  async getPaymentFailureByInvoice(stripeInvoiceId: string): Promise<PaymentFailure | null> {
    const [result] = await db
      .select()
      .from(paymentFailures)
      .where(eq(paymentFailures.stripeInvoiceId, stripeInvoiceId))
      .limit(1);
    return result ?? null;
  }

  async updatePaymentFailureAttempt(
    failureId: number,
    attemptCount: number,
    failureReason?: string | null,
  ): Promise<void> {
    await db
      .update(paymentFailures)
      .set({ attemptCount, ...(failureReason ? { failureReason } : {}) })
      .where(eq(paymentFailures.id, failureId));
  }

  async getPaymentFailures(userId: string): Promise<PaymentFailure[]> {
    const results = await db
      .select()
      .from(paymentFailures)
      .where(eq(paymentFailures.userId, userId))
      .orderBy(desc(paymentFailures.failedAt));
    return results;
  }

  async updatePaymentFailureNotification(failureId: number, notificationSent: boolean): Promise<void> {
    await db
      .update(paymentFailures)
      .set({ notificationSent, lastNotified: new Date() })
      .where(eq(paymentFailures.id, failureId));
  }

  async resolvePaymentFailure(failureId: number): Promise<void> {
    await db
      .update(paymentFailures)
      .set({ resolved: true, resolvedAt: new Date() })
      .where(eq(paymentFailures.id, failureId));
  }

  async setUserGracePeriod(userId: string, graceExpiresAt: Date, failureCount: number): Promise<User> {
    const [result] = await db
      .update(users)
      .set({
        graceExpiresAt,
        gracePeriodActive: true,
        paymentFailureCount: failureCount
      })
      .where(eq(users.id, userId))
      .returning();
    return result;
  }

  async clearUserGracePeriod(userId: string): Promise<User> {
    const [result] = await db
      .update(users)
      .set({
        graceExpiresAt: null,
        gracePeriodActive: false,
        paymentFailureCount: 0
      })
      .where(eq(users.id, userId))
      .returning();
    return result;
  }

  // Gateway notification de-duplication. The insert is the claim: the composite primary
  // key rejects a second delivery of the same event, so no read-then-write race exists.
  //
  // The claim is a lease, not a tombstone. If the process dies between claiming an event and
  // finishing it, the row would otherwise make the gateway's retry look like a duplicate and
  // the event would be lost — for a cancellation or a refund that means a paid plan nobody is
  // paying for. So a delivery that cannot get the claim is answered "retry" by the routes,
  // never "duplicate": after the lease expires the retry takes the claim over and applies the
  // event. The lease only needs to be longer than a handler (they are database writes) and is
  // deliberately short so a crashed delivery is recovered within the gateway's first retries.
  async claimWebhookEvent(event: { source: string; key: string; type?: string | null }): Promise<boolean> {
    const CLAIM_LEASE_MS = 60 * 1000;
    const leaseExpiredBefore = new Date(Date.now() - CLAIM_LEASE_MS);

    const claimed = await db
      .insert(webhookEvents)
      .values({ source: event.source, eventKey: event.key, eventType: event.type ?? null })
      .onConflictDoUpdate({
        target: [webhookEvents.source, webhookEvents.eventKey],
        set: { receivedAt: new Date(), eventType: event.type ?? null },
        setWhere: lt(webhookEvents.receivedAt, leaseExpiredBefore),
      })
      .returning({ eventKey: webhookEvents.eventKey });
    return claimed.length > 0;
  }

  async releaseWebhookEvent(source: string, key: string): Promise<void> {
    await db
      .delete(webhookEvents)
      .where(and(eq(webhookEvents.source, source), eq(webhookEvents.eventKey, key)));
  }

  async pruneWebhookEvents(olderThan: Date): Promise<void> {
    await db.delete(webhookEvents).where(lt(webhookEvents.receivedAt, olderThan));
  }

  async getUsersInGracePeriod(): Promise<User[]> {
    const results = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.gracePeriodActive, true),
          gt(users.graceExpiresAt, new Date())
        )
      );
    return results;
  }

  async getUsersWithExpiredGrace(): Promise<User[]> {
    const results = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.gracePeriodActive, true),
          lte(users.graceExpiresAt, new Date())
        )
      );
    return results;
  }


  // Admin method to get comprehensive user payment information
  async getAdminUserPaymentDetails(): Promise<Array<User & { 
    paymentFailures: Array<{
      id: number;
      stripeInvoiceId: string | null;
      failureReason: string | null;
      attemptCount: number | null;
      failedAt: Date | null;
      notificationSent: boolean | null;
      resolved: boolean | null;
    }>;
    graceStatus: 'active' | 'expired' | 'none';
    daysUntilExpiry: number | null;
  }>> {
    // Get all users with their payment failure data
    const usersWithFailures = await db
      .select({
        // User fields
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        plan: users.plan,
        stripeCustomerId: users.stripeCustomerId,
        stripeSubscriptionId: users.stripeSubscriptionId,
        gracePeriodActive: users.gracePeriodActive,
        graceExpiresAt: users.graceExpiresAt,
        paymentFailureCount: users.paymentFailureCount,
        lastPaymentFailureNotified: users.lastPaymentFailureNotified,
        createdAt: users.createdAt,
        profileImageUrl: users.profileImageUrl,
        phone: users.phone,
        settings: users.settings,
        updatedAt: users.updatedAt,
        activatedAt: users.activatedAt,
        // Payment failure fields
        failureId: paymentFailures.id,
        stripeInvoiceId: paymentFailures.stripeInvoiceId,
        failureReason: paymentFailures.failureReason,
        attemptCount: paymentFailures.attemptCount,
        failedAt: paymentFailures.failedAt,
        notificationSent: paymentFailures.notificationSent,
        resolved: paymentFailures.resolved,
      })
      .from(users)
      .leftJoin(paymentFailures, eq(users.id, paymentFailures.userId))
      .orderBy(users.createdAt, paymentFailures.failedAt);

    // Group payment failures by user
    const userMap = new Map();
    
    for (const row of usersWithFailures) {
      const userId = row.id;
      
      if (!userMap.has(userId)) {
        const user = {
          id: row.id,
          email: row.email,
          firstName: row.firstName,
          lastName: row.lastName,
          plan: row.plan,
          stripeCustomerId: row.stripeCustomerId,
          stripeSubscriptionId: row.stripeSubscriptionId,
          gracePeriodActive: row.gracePeriodActive,
          graceExpiresAt: row.graceExpiresAt,
          paymentFailureCount: row.paymentFailureCount,
          lastPaymentFailureNotified: row.lastPaymentFailureNotified,
          createdAt: row.createdAt,
          profileImageUrl: row.profileImageUrl,
          phone: row.phone,
          settings: row.settings,
          updatedAt: row.updatedAt,
          activatedAt: row.activatedAt,
          paymentFailures: [],
          graceStatus: 'none' as 'active' | 'expired' | 'none',
          daysUntilExpiry: null as number | null,
        };

        // Calculate grace status
        if (row.gracePeriodActive && row.graceExpiresAt) {
          const now = new Date();
          const daysUntilExpiry = Math.ceil((row.graceExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          user.daysUntilExpiry = daysUntilExpiry;
          user.graceStatus = daysUntilExpiry > 0 ? 'active' : 'expired';
        }

        userMap.set(userId, user);
      }

      // Add payment failure if exists
      if (row.failureId) {
        const user = userMap.get(userId);
        user.paymentFailures.push({
          id: row.failureId,
          stripeInvoiceId: row.stripeInvoiceId,
          failureReason: row.failureReason,
          attemptCount: row.attemptCount,
          failedAt: row.failedAt,
          notificationSent: row.notificationSent,
          resolved: row.resolved,
        });
      }
    }

    return Array.from(userMap.values());
  }

  // Goal message methods
  async createGoalMessage(message: InsertGoalMessage): Promise<GoalMessage> {
    const [newMessage] = await db
      .insert(goalMessages)
      .values(message)
      .returning();

    return newMessage;
  }

  async getGoalMessages(goalId: number): Promise<Array<GoalMessage & { user: User }>> {
    const messages = await db
      .select({
        message: goalMessages,
        user: users,
      })
      .from(goalMessages)
      .innerJoin(users, eq(goalMessages.userId, users.id))
      .where(eq(goalMessages.goalId, goalId))
      .orderBy(goalMessages.createdAt);

    return messages.map(m => ({ ...m.message, user: publicUser(m.user) }));
  }

  /** Only the author can edit a message; the userId is part of the WHERE clause. */
  async updateGoalMessage(messageId: number, userId: string, updates: Partial<InsertGoalMessage>): Promise<GoalMessage | null> {
    const [updatedMessage] = await db
      .update(goalMessages)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(goalMessages.id, messageId), eq(goalMessages.userId, userId)))
      .returning();

    return updatedMessage || null;
  }

  /** The author or the goal's creator may delete a message. */
  async deleteGoalMessage(messageId: number, userId: string): Promise<boolean> {
    const [row] = await db
      .select({ authorId: goalMessages.userId, creatorId: collaborativeGoals.createdBy })
      .from(goalMessages)
      .innerJoin(collaborativeGoals, eq(goalMessages.goalId, collaborativeGoals.id))
      .where(eq(goalMessages.id, messageId));

    if (!row || (row.authorId !== userId && row.creatorId !== userId)) {
      return false;
    }

    const result = await db
      .delete(goalMessages)
      .where(eq(goalMessages.id, messageId))
      .returning();

    return result.length > 0;
  }

  // Course-related operations implementation
  async getUserCourseProgress(userId: string): Promise<CourseProgress[]> {
    return await db
      .select()
      .from(courseProgress)
      .where(eq(courseProgress.userId, userId))
      .orderBy(desc(courseProgress.updatedAt));
  }

  async updateCourseProgress(userId: string, progress: {
    moduleId: string;
    levelId: string;
    score: number;
    timeSpent: number;
    isCompleted: boolean;
    completedAt: Date | null;
  }): Promise<void> {
    const existing = await db
      .select()
      .from(courseProgress)
      .where(
        and(
          eq(courseProgress.userId, userId),
          eq(courseProgress.moduleId, progress.moduleId),
          eq(courseProgress.levelId, progress.levelId)
        )
      );

    if (existing.length > 0) {
      // Update existing progress
      await db
        .update(courseProgress)
        .set({
          score: progress.score,
          attempts: sql`${courseProgress.attempts} + 1`,
          bestScore: sql`GREATEST(${courseProgress.bestScore}, ${progress.score})`,
          timeSpent: sql`${courseProgress.timeSpent} + ${progress.timeSpent}`,
          isCompleted: progress.isCompleted,
          completedAt: progress.completedAt,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(courseProgress.userId, userId),
            eq(courseProgress.moduleId, progress.moduleId),
            eq(courseProgress.levelId, progress.levelId)
          )
        );
    } else {
      // Create new progress record
      await db
        .insert(courseProgress)
        .values({
          userId,
          moduleId: progress.moduleId,
          levelId: progress.levelId,
          score: progress.score,
          attempts: 1,
          bestScore: progress.score,
          timeSpent: progress.timeSpent,
          isCompleted: progress.isCompleted,
          completedAt: progress.completedAt
        });
    }
  }

  async getUserLearningStats(userId: string): Promise<LearningStats | null> {
    const [stats] = await db
      .select()
      .from(learningStats)
      .where(eq(learningStats.userId, userId));
    
    return stats || null;
  }

  async updateLearningStats(userId: string, updates: {
    xpGained: number;
    timeSpent: number;
    lessonCompleted: boolean;
  }): Promise<void> {
    const existing = await db
      .select()
      .from(learningStats)
      .where(eq(learningStats.userId, userId));

    const today = new Date();
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (existing.length > 0) {
      const stats = existing[0];
      const lastLearningDate = stats.lastLearningDate;
      const lastDateOnly = lastLearningDate ? new Date(lastLearningDate.getFullYear(), lastLearningDate.getMonth(), lastLearningDate.getDate()) : null;
      
      // Calculate streak
      let newStreak = stats.currentStreak || 0;
      if (lastDateOnly) {
        const daysDiff = Math.floor((todayDateOnly.getTime() - lastDateOnly.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff === 0) {
          // Same day, keep current streak
        } else if (daysDiff === 1) {
          // Consecutive day, increment streak
          newStreak = (stats.currentStreak || 0) + 1;
        } else {
          // Streak broken, reset to 1
          newStreak = 1;
        }
      } else {
        // First learning session
        newStreak = 1;
      }

      await db
        .update(learningStats)
        .set({
          totalXp: sql`${learningStats.totalXp} + ${updates.xpGained}`,
          currentStreak: newStreak,
          longestStreak: sql`GREATEST(${learningStats.longestStreak}, ${newStreak})`,
          lastLearningDate: today,
          totalLessonsCompleted: updates.lessonCompleted 
            ? sql`${learningStats.totalLessonsCompleted} + 1`
            : learningStats.totalLessonsCompleted,
          totalTimeSpent: sql`${learningStats.totalTimeSpent} + ${updates.timeSpent}`,
          updatedAt: today
        })
        .where(eq(learningStats.userId, userId));
    } else {
      // Create new stats record
      await db
        .insert(learningStats)
        .values({
          userId,
          totalXp: updates.xpGained,
          currentStreak: 1,
          longestStreak: 1,
          lastLearningDate: today,
          totalLessonsCompleted: updates.lessonCompleted ? 1 : 0,
          totalTimeSpent: updates.timeSpent,
          averageScore: "0.00"
        });
    }
  }

  async getUserCourseAchievements(userId: string): Promise<UserAchievement[]> {
    return await db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.userId, userId))
      .orderBy(desc(userAchievements.earnedAt));
  }

  async awardAchievement(userId: string, badgeId: string): Promise<UserAchievement> {
    const [achievement] = await db
      .insert(userAchievements)
      .values({
        userId,
        badgeId,
        notified: false
      })
      .returning();

    return achievement;
  }

  // =================== AI Usage Tracking Methods ===================

  /**
   * Record an AI API usage event
   */
  async recordAIUsage(usage: InsertAiUsage): Promise<AiUsage> {
    const [record] = await db
      .insert(aiUsage)
      .values(usage)
      .returning();
    return record;
  }

  /**
   * Get monthly AI usage for a user and function
   */
  async getMonthlyAIUsage(userId: string, functionName: string): Promise<{ requests: number; cost: number }> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const result = await db
      .select({
        requests: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        cost: sql<number>`CAST(COALESCE(SUM(CAST(${aiUsage.cost} AS DECIMAL)), 0) AS DECIMAL)`
      })
      .from(aiUsage)
      .where(
        and(
          eq(aiUsage.userId, userId),
          eq(aiUsage.functionName, functionName),
          gte(aiUsage.createdAt, startOfMonth),
          eq(aiUsage.status, 'success')
        )
      );

    return {
      requests: result[0]?.requests || 0,
      cost: parseFloat(result[0]?.cost?.toString() || '0')
    };
  }

  /**
   * Get daily AI usage for a user and function
   */
  async getDailyAIUsage(userId: string, functionName: string): Promise<{ requests: number; cost: number }> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const result = await db
      .select({
        requests: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        cost: sql<number>`CAST(COALESCE(SUM(CAST(${aiUsage.cost} AS DECIMAL)), 0) AS DECIMAL)`
      })
      .from(aiUsage)
      .where(
        and(
          eq(aiUsage.userId, userId),
          eq(aiUsage.functionName, functionName),
          gte(aiUsage.createdAt, startOfDay),
          eq(aiUsage.status, 'success')
        )
      );

    return {
      requests: result[0]?.requests || 0,
      cost: parseFloat(result[0]?.cost?.toString() || '0')
    };
  }

  /**
   * Get AI usage limits for a plan and function
   */
  async getAIUsageLimit(plan: string, functionName: string): Promise<AiUsageLimit> {
    const result = await db
      .select()
      .from(aiUsageLimits)
      .where(
        and(
          eq(aiUsageLimits.plan, plan),
          eq(aiUsageLimits.functionName, functionName),
          eq(aiUsageLimits.isActive, true)
        )
      )
      .limit(1);

    return result[0] || {
      id: 0,
      plan,
      functionName,
      monthlyRequestLimit: 0,
      monthlyCostLimit: '0.00',
      dailyRequestLimit: 0,
      dailyCostLimit: '0.00',
      maxTokensPerRequest: 0,
      cooldownSeconds: 0,
      isActive: true,
      resetDay: 1,
      description: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Get user-specific AI usage override
   */
  async getAIUserOverride(userId: string, functionName: string): Promise<AiUserOverride | null> {
    const result = await db
      .select()
      .from(aiUserOverrides)
      .where(
        and(
          eq(aiUserOverrides.userId, userId),
          eq(aiUserOverrides.functionName, functionName),
          or(
            isNull(aiUserOverrides.expiresAt),
            gt(aiUserOverrides.expiresAt, new Date())
          )
        )
      )
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get last AI request timestamp for cooldown checking
   */
  async getLastAIRequest(userId: string, functionName: string): Promise<Date | null> {
    const result = await db
      .select({ createdAt: aiUsage.createdAt })
      .from(aiUsage)
      .where(
        and(
          eq(aiUsage.userId, userId),
          eq(aiUsage.functionName, functionName)
        )
      )
      .orderBy(desc(aiUsage.createdAt))
      .limit(1);

    return result[0]?.createdAt || null;
  }

  /**
   * Get AI usage summary for admin analytics
   */
  async getAIUsageSummary(userId: string, timeframe: 'today' | 'month' | 'all' = 'month') {
    let timeCondition;
    
    if (timeframe === 'today') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      timeCondition = gte(aiUsage.createdAt, startOfDay);
    } else if (timeframe === 'month') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      timeCondition = gte(aiUsage.createdAt, startOfMonth);
    }

    const whereCondition = timeCondition 
      ? and(eq(aiUsage.userId, userId), timeCondition)
      : eq(aiUsage.userId, userId);

    // Get overall stats
    const totalStats = await db
      .select({
        totalRequests: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        totalCost: sql<number>`CAST(COALESCE(SUM(CAST(${aiUsage.cost} AS DECIMAL)), 0) AS DECIMAL)`,
        successfulRequests: sql<number>`CAST(COUNT(CASE WHEN ${aiUsage.status} = 'success' THEN 1 END) AS INTEGER)`,
        totalTokens: sql<number>`CAST(COALESCE(SUM(${aiUsage.tokensUsed}), 0) AS INTEGER)`
      })
      .from(aiUsage)
      .where(whereCondition);

    // Get function breakdown
    const functionStats = await db
      .select({
        functionName: aiUsage.functionName,
        requests: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        cost: sql<number>`CAST(COALESCE(SUM(CAST(${aiUsage.cost} AS DECIMAL)), 0) AS DECIMAL)`,
        avgExecutionTime: sql<number>`CAST(AVG(${aiUsage.executionTime}) AS INTEGER)`
      })
      .from(aiUsage)
      .where(whereCondition)
      .groupBy(aiUsage.functionName)
      .orderBy(desc(sql`COUNT(*)`));

    // Get model breakdown
    const modelStats = await db
      .select({
        model: aiUsage.model,
        requests: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        cost: sql<number>`CAST(COALESCE(SUM(CAST(${aiUsage.cost} AS DECIMAL)), 0) AS DECIMAL)`,
        totalTokens: sql<number>`CAST(COALESCE(SUM(${aiUsage.tokensUsed}), 0) AS INTEGER)`
      })
      .from(aiUsage)
      .where(whereCondition)
      .groupBy(aiUsage.model)
      .orderBy(desc(sql`COUNT(*)`));

    return {
      totalRequests: totalStats[0]?.totalRequests || 0,
      totalCost: parseFloat(totalStats[0]?.totalCost?.toString() || '0'),
      successfulRequests: totalStats[0]?.successfulRequests || 0,
      totalTokens: totalStats[0]?.totalTokens || 0,
      functionBreakdown: functionStats.map(stat => ({
        ...stat,
        cost: parseFloat(stat.cost?.toString() || '0')
      })),
      modelBreakdown: modelStats.map(stat => ({
        ...stat,
        cost: parseFloat(stat.cost?.toString() || '0')
      }))
    };
  }

  /**
   * Get global AI usage summary for admin analytics
   */
  async getGlobalAIUsageSummary(timeframe: 'today' | 'month' | 'all' = 'month') {
    let timeCondition;
    
    if (timeframe === 'today') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      timeCondition = gte(aiUsage.createdAt, startOfDay);
    } else if (timeframe === 'month') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      timeCondition = gte(aiUsage.createdAt, startOfMonth);
    }

    const whereCondition = timeCondition ? timeCondition : undefined;

    // Get overall stats
    const totalStats = await db
      .select({
        totalRequests: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        totalCost: sql<number>`CAST(COALESCE(SUM(CAST(${aiUsage.cost} AS DECIMAL)), 0) AS DECIMAL)`,
        successfulRequests: sql<number>`CAST(COUNT(CASE WHEN ${aiUsage.status} = 'success' THEN 1 END) AS INTEGER)`,
        totalTokens: sql<number>`CAST(COALESCE(SUM(${aiUsage.tokensUsed}), 0) AS INTEGER)`
      })
      .from(aiUsage)
      .where(whereCondition);

    return {
      totalRequests: totalStats[0]?.totalRequests || 0,
      totalCost: parseFloat(totalStats[0]?.totalCost?.toString() || '0'),
      successfulRequests: totalStats[0]?.successfulRequests || 0,
      totalTokens: totalStats[0]?.totalTokens || 0,
    };
  }

  /**
   * Get all AI usage records for admin analytics
   */
  async getAllAIUsage(limit: number = 1000, offset: number = 0): Promise<AiUsage[]> {
    return await db
      .select()
      .from(aiUsage)
      .orderBy(desc(aiUsage.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Get AI usage statistics by function for admin
   */
  async getAIUsageByFunction(): Promise<Array<{
    functionName: string;
    totalRequests: number;
    totalCost: number;
    uniqueUsers: number;
    avgCostPerRequest: number;
    errorRate: number;
  }>> {
    const stats = await db
      .select({
        functionName: aiUsage.functionName,
        totalRequests: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        totalCost: sql<number>`CAST(COALESCE(SUM(CAST(${aiUsage.cost} AS DECIMAL)), 0) AS DECIMAL)`,
        uniqueUsers: sql<number>`CAST(COUNT(DISTINCT ${aiUsage.userId}) AS INTEGER)`,
        successRequests: sql<number>`CAST(COUNT(CASE WHEN ${aiUsage.status} = 'success' THEN 1 END) AS INTEGER)`,
        errorRequests: sql<number>`CAST(COUNT(CASE WHEN ${aiUsage.status} = 'error' THEN 1 END) AS INTEGER)`
      })
      .from(aiUsage)
      .groupBy(aiUsage.functionName)
      .orderBy(desc(sql`COUNT(*)`));

    return stats.map(stat => ({
      functionName: stat.functionName,
      totalRequests: stat.totalRequests,
      totalCost: parseFloat(stat.totalCost?.toString() || '0'),
      uniqueUsers: stat.uniqueUsers,
      avgCostPerRequest: stat.totalRequests > 0 
        ? parseFloat(stat.totalCost?.toString() || '0') / stat.totalRequests 
        : 0,
      errorRate: stat.totalRequests > 0 
        ? (stat.errorRequests / stat.totalRequests) * 100 
        : 0
    }));
  }

  /**
   * Get AI usage statistics by user for admin
   */
  async getAIUsageByUser(): Promise<Array<{
    userId: string;
    userEmail: string;
    userPlan: string;
    totalRequests: number;
    totalCost: number;
    uniqueFunctions: number;
    lastUsed: Date | null;
  }>> {
    const stats = await db
      .select({
        userId: aiUsage.userId,
        userEmail: users.email,
        userPlan: users.plan,
        totalRequests: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        totalCost: sql<number>`CAST(COALESCE(SUM(CAST(${aiUsage.cost} AS DECIMAL)), 0) AS DECIMAL)`,
        uniqueFunctions: sql<number>`CAST(COUNT(DISTINCT ${aiUsage.functionName}) AS INTEGER)`,
        lastUsed: sql<Date>`MAX(${aiUsage.createdAt})`
      })
      .from(aiUsage)
      .leftJoin(users, eq(aiUsage.userId, users.id))
      .groupBy(aiUsage.userId, users.email, users.plan)
      .orderBy(desc(sql`COUNT(*)`));

    return stats.map(stat => ({
      userId: stat.userId,
      userEmail: stat.userEmail || 'Unknown',
      userPlan: stat.userPlan || 'free',
      totalRequests: stat.totalRequests,
      totalCost: parseFloat(stat.totalCost?.toString() || '0'),
      uniqueFunctions: stat.uniqueFunctions,
      lastUsed: stat.lastUsed
    }));
  }

  /**
   * Per-function AI usage for one person since `from`, with today's share (the daily safety net).
   *
   * Only `success` rows count: a call the customer did not benefit from must not eat their
   * allowance. Weighting lives in shared/aiQuota; storage only counts rows.
   */
  async getAIQuotaUsage(
    userId: string,
    from: Date,
    todayFrom: Date,
  ): Promise<Array<{ functionName: string; calls: number; todayCalls: number; cost: number }>> {
    const rows = await db
      .select({
        functionName: aiUsage.functionName,
        calls: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        todayCalls: sql<number>`CAST(COUNT(CASE WHEN ${aiUsage.createdAt} >= ${todayFrom} THEN 1 END) AS INTEGER)`,
        cost: sql<number>`CAST(COALESCE(SUM(CAST(${aiUsage.cost} AS DECIMAL)), 0) AS DECIMAL)`
      })
      .from(aiUsage)
      .where(
        and(
          eq(aiUsage.userId, userId),
          gte(aiUsage.createdAt, from),
          eq(aiUsage.status, 'success')
        )
      )
      .groupBy(aiUsage.functionName);

    return rows.map((row) => ({
      functionName: row.functionName,
      calls: Number(row.calls) || 0,
      todayCalls: Number(row.todayCalls) || 0,
      cost: parseFloat(row.cost?.toString() || '0')
    }));
  }

  /**
   * The same counts grouped per person, for the admin quota screen. Aggregation (weighting,
   * per-plan totals) happens in the route, so this stays a plain read.
   */
  async getAIQuotaUsageByUser(from: Date): Promise<Array<{
    userId: string;
    email: string | null;
    plan: string;
    functionName: string;
    calls: number;
    cost: number;
  }>> {
    const rows = await db
      .select({
        userId: aiUsage.userId,
        email: users.email,
        plan: users.plan,
        functionName: aiUsage.functionName,
        calls: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        cost: sql<number>`CAST(COALESCE(SUM(CAST(${aiUsage.cost} AS DECIMAL)), 0) AS DECIMAL)`
      })
      .from(aiUsage)
      .leftJoin(users, eq(aiUsage.userId, users.id))
      .where(
        and(
          gte(aiUsage.createdAt, from),
          eq(aiUsage.status, 'success')
        )
      )
      .groupBy(aiUsage.userId, users.email, users.plan, aiUsage.functionName);

    return rows.map((row) => ({
      userId: row.userId,
      email: row.email ?? null,
      plan: row.plan || 'free',
      functionName: row.functionName,
      calls: Number(row.calls) || 0,
      cost: parseFloat(row.cost?.toString() || '0')
    }));
  }

  /**
   * Create or update AI usage limit
   */
  async setAIUsageLimit(limit: InsertAiUsageLimit): Promise<AiUsageLimit> {
    const existing = await db
      .select()
      .from(aiUsageLimits)
      .where(
        and(
          eq(aiUsageLimits.plan, limit.plan),
          eq(aiUsageLimits.functionName, limit.functionName)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(aiUsageLimits)
        .set({ ...limit, updatedAt: new Date() })
        .where(
          and(
            eq(aiUsageLimits.plan, limit.plan),
            eq(aiUsageLimits.functionName, limit.functionName)
          )
        )
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(aiUsageLimits)
        .values(limit)
        .returning();
      return created;
    }
  }

  /**
   * Create or update user AI override
   */
  async setAIUserOverride(override: InsertAiUserOverride): Promise<AiUserOverride> {
    const existing = await db
      .select()
      .from(aiUserOverrides)
      .where(
        and(
          eq(aiUserOverrides.userId, override.userId),
          eq(aiUserOverrides.functionName, override.functionName)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(aiUserOverrides)
        .set({ ...override, updatedAt: new Date() })
        .where(
          and(
            eq(aiUserOverrides.userId, override.userId),
            eq(aiUserOverrides.functionName, override.functionName)
          )
        )
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(aiUserOverrides)
        .values(override)
        .returning();
      return created;
    }
  }

  /**
   * Delete user AI override
   */
  async deleteAIUserOverride(userId: string, functionName: string): Promise<void> {
    await db
      .delete(aiUserOverrides)
      .where(
        and(
          eq(aiUserOverrides.userId, userId),
          eq(aiUserOverrides.functionName, functionName)
        )
      );
  }

  /**
   * Get all AI usage limits
   */
  async getAllAIUsageLimits(): Promise<AiUsageLimit[]> {
    return await db
      .select()
      .from(aiUsageLimits)
      .orderBy(aiUsageLimits.plan, aiUsageLimits.functionName);
  }

  /**
   * Get all AI user overrides
   */
  async getAllAIUserOverrides(): Promise<AiUserOverride[]> {
    return await db
      .select()
      .from(aiUserOverrides)
      .orderBy(aiUserOverrides.userId, aiUserOverrides.functionName);
  }

  /**
   * Check if user can make AI request based on limits
   */
  async canUseAIFunction(userId: string, functionName: string, plan: string): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    try {
      // Check user override (blocking)
      const override = await this.getAIUserOverride(userId, functionName);
      if (override?.isBlocked) {
        return {
          allowed: false,
          reason: override.reason || 'Function blocked for user'
        };
      }

      // Get plan limits
      const limits = await this.getAIUsageLimit(plan, functionName);
      
      // If no limits configured, allow unlimited
      if (!limits.monthlyRequestLimit && !limits.dailyRequestLimit) {
        return { allowed: true };
      }

      // Check daily limit
      const dailyLimit = limits.dailyRequestLimit || 0;
      if (dailyLimit > 0) {
        const dailyUsage = await this.getDailyAIUsage(userId, functionName);
        if (dailyUsage.requests >= dailyLimit) {
          return {
            allowed: false,
            reason: `Daily limit exceeded (${dailyUsage.requests}/${dailyLimit})`
          };
        }
      }

      // Check monthly limit
      if (limits.monthlyRequestLimit > 0) {
        const monthlyUsage = await this.getMonthlyAIUsage(userId, functionName);
        if (monthlyUsage.requests >= limits.monthlyRequestLimit) {
          return {
            allowed: false,
            reason: `Monthly limit exceeded (${monthlyUsage.requests}/${limits.monthlyRequestLimit})`
          };
        }
      }

      return { allowed: true };

    } catch (error) {
      log.error('Error checking AI function access:', error);
      return { allowed: true }; // Allow on error
    }
  }

  /**
   * Calculate OpenAI cost based on model and tokens
   */
  calculateOpenAICost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing = {
      'gpt-4o': { input: 0.005, output: 0.015 },
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 }
    } as const;

    const modelPricing = pricing[model as keyof typeof pricing] || pricing['gpt-4o'];
    
    return ((promptTokens / 1000) * modelPricing.input) + 
           ((completionTokens / 1000) * modelPricing.output);
  }


}

export const storage = new DatabaseStorage();