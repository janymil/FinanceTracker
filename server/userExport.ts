/**
 * Everything the app holds about one person, for an access request.
 *
 * The export used to contain transactions, budgets and goals — about a third of what is stored.
 * Recurring payments, bill reminders, shared goals, course progress, import history, the AI usage
 * log (which carries an address) and the merchant-learning rows were all missing, so a person
 * asking "what do you have about me?" was given an incomplete answer.
 *
 * Every table is read through its own try/catch: one unreadable table must not turn a legal
 * obligation into a 500. Decryption happens through the storage methods that already do it.
 */
import { db } from './db';
import { eq, inArray, or } from 'drizzle-orm';
import {
  aiCache,
  aiUsage,
  aiUserOverrides,
  backupSettings,
  challengeActivities,
  collaborativeGoalParticipants,
  collaborativeGoals,
  courseProgress,
  financialMascots,
  friendships,
  goalContributions,
  goalMessages,
  importLogs,
  learningStats,
  merchantLearning,
  milestoneAchievements,
  paymentFailures,
  redeemCodes,
  userAchievements,
  users,
} from '../shared/schema';
import { storage } from './storage';
import { log } from './logger';

export interface UserDataExport {
  profile: Record<string, unknown> | null;
  [key: string]: unknown;
}

async function safe<T>(label: string, read: () => Promise<T[]>): Promise<T[]> {
  try {
    return await read();
  } catch (error) {
    log.warn(`[export] ${label} could not be read; the export continues without it`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export async function collectUserData(userId: string): Promise<UserDataExport> {
  const [user] = await safe('users', () => db.select().from(users).where(eq(users.id, userId)));

  const created = await safe('collaborativeGoals', () =>
    db.select().from(collaborativeGoals).where(eq(collaborativeGoals.createdBy, userId)),
  );
  const participation = await safe('collaborativeGoalParticipants', () =>
    db.select().from(collaborativeGoalParticipants).where(eq(collaborativeGoalParticipants.userId, userId)),
  );
  const goalIds = Array.from(
    new Set<number>([...created.map((g) => g.id), ...participation.map((p) => p.goalId)]),
  );
  const goalScoped = <T>(label: string, read: (ids: number[]) => Promise<T[]>) =>
    goalIds.length > 0 ? safe(label, () => read(goalIds)) : Promise.resolve([] as T[]);

  const [
    categories,
    transactions,
    budgets,
    goals,
    recurringTransactions,
    expenseReminders,
    contributionRows,
    messageRows,
    activityRows,
    achievementRows,
    friendRows,
    mascots,
    importHistory,
    aiUsageRows,
    aiPreferences,
    aiCacheRows,
    learning,
    codes,
    failures,
    backups,
  ] = await Promise.all([
    safe('categories', () => storage.getCategories(userId)),
    // Decrypted by storage, which is the only place that knows the cipher.
    safe('transactions', () => storage.getUserTransactions(userId)),
    safe('budgets', () => storage.getUserBudgets(userId)),
    safe('goals', () => storage.getUserGoals(userId)),
    safe('recurringTransactions', () => storage.getUserRecurringTransactions(userId)),
    safe('expenseReminders', () => storage.getUserExpenseReminders(userId)),
    goalScoped('goalContributions', (ids) =>
      db.select().from(goalContributions).where(inArray(goalContributions.goalId, ids)),
    ),
    goalScoped('goalMessages', (ids) => db.select().from(goalMessages).where(inArray(goalMessages.goalId, ids))),
    goalScoped('challengeActivities', (ids) =>
      db.select().from(challengeActivities).where(inArray(challengeActivities.goalId, ids)),
    ),
    goalScoped('milestoneAchievements', (ids) =>
      db.select().from(milestoneAchievements).where(inArray(milestoneAchievements.goalId, ids)),
    ),
    safe('friendships', () =>
      db
        .select()
        .from(friendships)
        .where(or(eq(friendships.requesterId, userId), eq(friendships.recipientId, userId))),
    ),
    safe('financialMascots', () => db.select().from(financialMascots).where(eq(financialMascots.userId, userId))),
    safe('importLogs', () => db.select().from(importLogs).where(eq(importLogs.userId, userId))),
    safe('aiUsage', () => db.select().from(aiUsage).where(eq(aiUsage.userId, userId))),
    safe('aiUserOverrides', () =>
      db.select().from(aiUserOverrides).where(eq(aiUserOverrides.userId, userId)),
    ),
    // The payloads are encrypted; metadata is enough for an access request and avoids handing
    // back a second copy of the whole history in clear text.
    safe('aiCache', () =>
      db
        .select({
          id: aiCache.id,
          functionKey: aiCache.functionKey,
          month: aiCache.month,
          createdAt: aiCache.createdAt,
          expiresAt: aiCache.expiresAt,
          isError: aiCache.isError,
        })
        .from(aiCache)
        .where(eq(aiCache.userId, userId)),
    ),
    safe('merchantLearning', () =>
      db.select().from(merchantLearning).where(eq(merchantLearning.userId, userId)),
    ),
    safe('redeemCodes', () => db.select().from(redeemCodes).where(eq(redeemCodes.userId, userId))),
    safe('paymentFailures', () => db.select().from(paymentFailures).where(eq(paymentFailures.userId, userId))),
    safe('backupSettings', () => db.select().from(backupSettings).where(eq(backupSettings.userId, userId))),
  ]);

  const course = {
    progress: await safe('courseProgress', () =>
      db.select().from(courseProgress).where(eq(courseProgress.userId, userId)),
    ),
    achievements: await safe('userAchievements', () =>
      db.select().from(userAchievements).where(eq(userAchievements.userId, userId)),
    ),
    learningStats: await safe('learningStats', () =>
      db.select().from(learningStats).where(eq(learningStats.userId, userId)),
    ),
  };

  // Billing identifiers are not personal data the person needs back, and a leaked export should
  // not carry a subscription id that could be used against the account.
  const profile = user
    ? {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone ?? null,
        plan: user.plan,
        currency: user.currency ?? null,
        timezone: user.timezone ?? null,
        language: user.language ?? null,
        createdAt: user.createdAt,
      }
    : null;

  return {
    profile,
    categories,
    transactions,
    recurringTransactions,
    budgets,
    expenseReminders,
    goals,
    collaborativeGoals: created,
    collaborativeGoalParticipation: participation,
    goalContributions: contributionRows,
    goalMessages: messageRows,
    challengeActivities: activityRows,
    milestoneAchievements: achievementRows,
    friendships: friendRows,
    financialMascots: mascots,
    course,
    importHistory,
    aiUsage: aiUsageRows,
    aiPreferences,
    aiCacheEntries: aiCacheRows,
    merchantLearning: learning,
    redeemCodes: codes,
    paymentFailures: failures,
    backupSettings: backups,
  };
}
