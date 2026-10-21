/**
 * TEMP audit harness: exercises the real storage layer end-to-end.
 * Creates two throwaway users, runs the app's actual workflows, asserts the
 * outcomes, then deletes everything.
 */
import 'dotenv/config';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run the flow audit against production: it creates and deletes test users.');
  process.exit(1);
}

import { storage } from '../server/storage';

const stamp = Date.now();
const A = `audit_a_${stamp}`;
const B = `audit_b_${stamp}`;
const results: Array<{ name: string; ok: boolean; detail?: string }> = [];

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function step(name: string, fn: () => Promise<string | void>) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail || '' });
  } catch (error: any) {
    results.push({ name, ok: false, detail: error?.message?.slice(0, 200) || String(error) });
  }
}

const ctx: any = {};

try {
  // ---------- Users ----------
  await step('users.create + read', async () => {
    await storage.upsertUser({ id: A, email: `audit_a_${stamp}@example.com`, firstName: 'Audit', lastName: 'Alpha', plan: 'premium' });
    await storage.upsertUser({ id: B, email: `audit_b_${stamp}@example.com`, firstName: 'Audit', lastName: 'Beta', plan: 'standard' });
    const a = await storage.getUser(A);
    assert(a?.email === `audit_a_${stamp}@example.com`, 'user A not readable');
    return a?.plan;
  });

  await step('users.updatePlan', async () => {
    const updated = await storage.updateUserPlan(A, 'standard');
    assert(updated.plan === 'standard', `plan not updated (${updated.plan})`);
    return updated.plan;
  });

  // ---------- Categories ----------
  await step('categories.create + list', async () => {
    ctx.groceries = await storage.createCategory({ userId: A, name: 'Audit Groceries', icon: 'utensils', color: '#10B981', type: 'expense' });
    ctx.salary = await storage.createCategory({ userId: A, name: 'Audit Salary', icon: 'wallet', color: '#3B82F6', type: 'income' });
    const list = await storage.getCategories(A);
    assert(list.some((c) => c.id === ctx.groceries.id), 'created category missing from list');
    return `${list.length} categories`;
  });

  // ---------- Transactions ----------
  await step('transactions.create + list + decrypt', async () => {
    ctx.expense = await storage.createTransaction({
      userId: A, categoryId: ctx.groceries.id, amount: '100.50', description: 'Audit supermarket run',
      date: new Date('2026-10-03T10:00:00Z'), type: 'expense',
    } as any);
    ctx.income = await storage.createTransaction({
      userId: A, categoryId: ctx.salary.id, amount: '5000.00', description: 'Audit salary',
      date: new Date('2026-10-01T08:00:00Z'), type: 'income',
    } as any);
    const rows = await storage.getUserTransactions(A);
    assert(rows.length === 2, `expected 2 transactions, got ${rows.length}`);
    const expense = rows.find((r) => r.id === ctx.expense.id);
    assert(expense?.description === 'Audit supermarket run', `description not decrypted: ${expense?.description}`);
    assert(expense?.amount === '100.50', `amount changed: ${expense?.amount}`);
    return rows.map((r) => `${r.type}:${r.amount}`).join(', ');
  });

  await step('transactions.dateRange + category join', async () => {
    const rows = await storage.getTransactionsByDateRange(A, new Date('2026-10-01T00:00:00Z'), new Date('2026-10-31T23:59:59Z'));
    assert(rows.length === 2, `range query returned ${rows.length}`);
    assert(rows.every((r) => r.categoryName), 'categoryName not joined');
    return `${rows.length} in range`;
  });

  await step('transactions.update', async () => {
    const updated = await storage.updateTransaction(ctx.expense.id, { userId: A, amount: '120.75', description: 'Audit supermarket run (updated)' } as any);
    assert(updated.amount === '120.75', `amount not updated: ${updated.amount}`);
    const rows = await storage.getUserTransactions(A);
    const row = rows.find((r) => r.id === ctx.expense.id);
    assert(row?.description === 'Audit supermarket run (updated)', `description not updated: ${row?.description}`);
    return row?.amount;
  });

  // ---------- Financial summary ----------
  await step('analytics.financialSummary', async () => {
    const summary = await storage.getUserFinancialSummary(A, new Date('2026-10-01T00:00:00Z'), new Date('2026-10-31T23:59:59Z'));
    assert(summary.totalIncome === 5000, `income=${summary.totalIncome}`);
    assert(summary.totalExpenses === 120.75, `expenses=${summary.totalExpenses}`);
    assert(summary.netBalance === 4879.25, `net=${summary.netBalance}`);
    assert(summary.transactionsByCategory.length >= 2, 'no category breakdown');
    return `net=${summary.netBalance}`;
  });

  // ---------- Budgets ----------
  await step('budgets.create + spent math', async () => {
    ctx.budget = await storage.createBudget({
      userId: A, categoryId: ctx.groceries.id, amount: '500.00',
      startDate: new Date('2026-10-01T00:00:00Z'), endDate: new Date('2026-10-31T23:59:59Z'), period: 'monthly',
    } as any);
    const budgets = await storage.getUserBudgets(A);
    const budget = budgets.find((b) => b.id === ctx.budget.id);
    assert(budget, 'budget not listed');
    assert(Math.abs((budget!.spent ?? 0) - 120.75) < 0.01, `spent=${budget!.spent}`);
    assert(Math.abs((budget!.remaining ?? 0) - 379.25) < 0.01, `remaining=${budget!.remaining}`);
    assert(Math.abs((budget!.percentage ?? 0) - 24.15) < 0.2, `percentage=${budget!.percentage}`);
    return `spent=${budget!.spent} remaining=${budget!.remaining}`;
  });

  await step('budgets.update + delete', async () => {
    const updated = await storage.updateBudget(ctx.budget.id, { userId: A, amount: '650.00' } as any);
    assert(parseFloat(updated.amount) === 650, `amount=${updated.amount}`);
    await storage.deleteBudget(ctx.budget.id, A);
    const after = await storage.getUserBudgets(A);
    assert(!after.some((b) => b.id === ctx.budget.id), 'budget still listed');
  });

  // ---------- Personal goals ----------
  await step('goals.create + update + delete', async () => {
    const goal = await storage.createGoal({
      userId: A, name: 'Audit goal', targetAmount: '1000.00', currentAmount: '0.00', category: 'savings',
      targetDate: new Date('2027-01-01T00:00:00Z'),
    } as any);
    const list = await storage.getUserGoals(A);
    assert(list.some((g) => g.id === goal.id), 'goal not listed');
    const updated = await storage.updateGoal(goal.id, A, { currentAmount: '250.00' } as any);
    assert(parseFloat(updated.currentAmount) === 250, `currentAmount=${updated.currentAmount}`);
    await storage.deleteGoal(goal.id, A);
    const after = await storage.getUserGoals(A);
    assert(!after.some((g) => g.id === goal.id), 'goal still listed');
    return `id=${goal.id}`;
  });

  // ---------- Expense reminders ----------
  await step('reminders.create + upcoming + complete + delete', async () => {
    const dueDate = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    const reminder = await storage.createExpenseReminder({
      userId: A, title: 'Audit electricity bill', amount: '50.00', dueDate, categoryId: ctx.groceries.id,
    } as any);
    const upcoming = await storage.getUpcomingExpenseReminders(A, 7);
    assert(upcoming.some((r) => r.id === reminder.id), 'reminder missing from upcoming feed');
    await storage.markExpenseReminderCompleted(reminder.id, A);
    const afterComplete = await storage.getUpcomingExpenseReminders(A, 7);
    assert(!afterComplete.some((r) => r.id === reminder.id), 'completed reminder still upcoming');
    await storage.deleteExpenseReminder(reminder.id, A);
    return `due ${dueDate.toISOString().slice(0, 10)}`;
  });

  // ---------- Collaborative goals ----------
  await step('collaborative.create + join', async () => {
    ctx.shared = await storage.createCollaborativeGoal({
      createdBy: A, name: 'Audit shared goal', description: 'audit', targetAmount: '1000.00',
      currentAmount: '0.00', category: 'savings', challengeType: 'collaborative',
      targetDate: new Date(Date.now() + 60 * 24 * 3600 * 1000),
    } as any);
    const asCreator = await storage.getCollaborativeGoal(ctx.shared.id, A);
    assert(asCreator, 'creator cannot read the goal');
    assert(asCreator!.participants.some((p) => p.userId === A), 'creator not registered as participant');
    await storage.joinCollaborativeGoal(ctx.shared.id, B);
    const participant = await storage.getGoalParticipant(ctx.shared.id, B);
    assert(participant?.status === 'active', `participant status=${participant?.status}`);
    return `goal ${ctx.shared.id} with ${asCreator!.participants.length} participant(s)`;
  });

  await step('collaborative.preview for non-member', async () => {
    const preview = await storage.getCollaborativeGoalPreview(ctx.shared.id);
    assert(preview && preview.name === 'Audit shared goal', 'preview missing');
    assert(preview!.participantCount >= 2, `participantCount=${preview!.participantCount}`);
    const full = await storage.getCollaborativeGoal(ctx.shared.id, 'user_who_is_not_a_member');
    assert(full === undefined, 'non-member can read the full goal');
    return `participants=${preview!.participantCount}`;
  });

  await step('collaborative.contribution updates progress', async () => {
    await storage.addGoalContribution({ goalId: ctx.shared.id, userId: B, amount: '250.00', description: 'audit contribution' } as any);
    const goal = await storage.getCollaborativeGoal(ctx.shared.id, A);
    assert(parseFloat(goal!.currentAmount) === 250, `goal currentAmount=${goal!.currentAmount}`);
    const b = await storage.getGoalParticipant(ctx.shared.id, B);
    assert(parseFloat(b!.currentContribution || '0') === 250, `participant contribution=${b!.currentContribution}`);
    const contributions = await storage.getGoalContributions(ctx.shared.id);
    assert(contributions.length === 1 && contributions[0].user?.id === B, 'contribution list wrong');
    const activities = await storage.getGoalActivities(ctx.shared.id);
    assert(activities.some((a) => a.activityType === 'contribution'), 'no contribution activity');
    return `progress=${goal!.currentAmount}`;
  });

  await step('collaborative.milestones + achievements', async () => {
    const milestones = await storage.checkAndCreateMilestones(ctx.shared.id);
    const achievements = await storage.getUserAchievements(B);
    assert(achievements.length >= 1, `no achievements recorded (milestones=${milestones.length})`);
    return `${achievements.length} achievement(s)`;
  });

  await step('collaborative.leave', async () => {
    await storage.leaveCollaborativeGoal(ctx.shared.id, B);
    const after = await storage.getGoalParticipant(ctx.shared.id, B);
    assert(!after || after.status !== 'active', `participant still active (${after?.status})`);
    return after ? `status=${after.status}` : 'removed';
  });

  // ---------- Friends ----------
  await step('friends.request + accept + list', async () => {
    const request = await storage.sendFriendRequest(A, `audit_b_${stamp}@example.com`);
    const pending = await storage.getPendingFriendRequests(B);
    assert(pending.some((p) => p.id === request.id), 'request not visible to recipient');
    await storage.acceptFriendRequest(request.id, B);
    const friendsOfA = await storage.getUserFriends(A);
    assert(friendsOfA.some((f) => f.friend?.id === B), `friends list=${friendsOfA.length}`);
    return `${friendsOfA.length} friend(s)`;
  });

  // ---------- Courses / learning ----------
  await step('courses.progress + stats + achievement', async () => {
    await storage.updateCourseProgress(A, { moduleId: 'budgeting', levelId: 'level-1', score: 80, timeSpent: 120, isCompleted: true, completedAt: new Date() });
    const progress = await storage.getUserCourseProgress(A);
    assert(progress.length >= 1, 'course progress not stored');
    await storage.updateLearningStats(A, { xpGained: 50, timeSpent: 120, lessonCompleted: true });
    const stats = await storage.getUserLearningStats(A);
    assert(stats, 'learning stats not created');
    await storage.awardAchievement(A, 'audit_badge');
    const achievements = await storage.getUserCourseAchievements(A);
    assert(achievements.some((a) => a.badgeId === 'audit_badge'), 'course achievement not awarded');
    return `${progress.length} progress row(s), xp=${(stats as any)?.totalXp ?? '?'}`;
  });

  // ---------- Mascot ----------
  await step('mascot.create + toggle', async () => {
    const mascot = await storage.createMascot({
      userId: A, imageUrl: 'https://example.com/audit-mascot.png', healthScore: 80, mood: 'good',
      generationPrompt: 'audit mascot', isEnabled: true,
    } as any);
    assert(mascot.userId === A, 'mascot not stored');
    const toggled = await storage.toggleMascot(A, false);
    assert(toggled.isEnabled === false, `isEnabled=${toggled.isEnabled}`);
    return `mascot ${mascot.id}`;
  });

  // ---------- Backup settings ----------
  await step('backup.settings create + update', async () => {
    await storage.createBackupSettings({ userId: A, enabled: true, frequency: 'daily' } as any);
    const updated = await storage.updateBackupSettings(A, { frequency: 'weekly' } as any);
    assert(updated.frequency === 'weekly', `frequency=${updated.frequency}`);
    const read = await storage.getUserBackupSettings(A);
    assert(read?.frequency === 'weekly', 'settings not persisted');
    return read?.frequency || '';
  });

  // ---------- Import logs ----------
  await step('imports.log create + list', async () => {
    await storage.createImportLog({ userId: A, fileName: 'audit.csv', summary: { imported: 2, skipped: 0 }, type: 'csv', status: 'success' } as any);
    const logs = await storage.getUserImportLogs(A, 5);
    assert(logs.length >= 1, 'import log not stored');
    return `${logs.length} log(s)`;
  });

  // ---------- AI cache ----------
  await step('ai.cache set + get', async () => {
    await storage.setAICacheEntry(A, 'audit-fn', 'hash-1', { input: 1 }, { output: 'cached' });
    const entry = await storage.getAICacheEntry(A, 'audit-fn', 'hash-1');
    assert(entry, 'cache entry not stored');
    return 'cached value round-trip';
  });

  // ---------- Payments / grace period ----------
  await step('payments.failure + grace period', async () => {
    const failure = await storage.createPaymentFailure({
      userId: A, stripeInvoiceId: `in_audit_${stamp}`, reason: 'card_declined',
      graceExpiresAt: new Date(Date.now() + 3 * 24 * 3600 * 1000), failureCount: 1,
    } as any);
    const failures = await storage.getPaymentFailures(A);
    assert(failures.some((f) => f.id === failure.id), 'payment failure not stored');
    await storage.setUserGracePeriod(A, new Date(Date.now() + 3 * 24 * 3600 * 1000), 1);
    const inGrace = await storage.getUsersInGracePeriod();
    assert(inGrace.some((u) => u.id === A), 'user missing from grace list');
    await storage.resolvePaymentFailure(failure.id);
    await storage.clearUserGracePeriod(A);
    const after = await storage.getUsersInGracePeriod();
    assert(!after.some((u) => u.id === A), 'user still in grace after clearing');
    return 'grace lifecycle ok';
  });
} finally {
  // ---------- Cleanup (always runs) ----------
  await step('cleanup.deleteUsersCompletely', async () => {
    const problems: string[] = [];
    for (const id of [A, B]) {
      try {
        await storage.deleteUserCompletely(id);
      } catch (error: any) {
        problems.push(`${id}: ${error?.message?.slice(0, 120)}`);
      }
    }
    const remaining = [];
    for (const id of [A, B]) {
      if (await storage.getUser(id)) remaining.push(id);
    }
    assert(remaining.length === 0, `users still present: ${remaining.join(', ')} | errors: ${problems.join(' | ') || 'none'}`);
    return 'both users removed';
  });

  console.log('\n=== FLOW AUDIT ===');
  for (const result of results) {
    console.log(`${result.ok ? 'PASS' : 'FAIL'}: ${result.name}${result.detail ? ` -> ${result.detail}` : ''}`);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} steps passed`);
  process.exit(failed === 0 ? 0 : 1);
}



