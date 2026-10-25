import { log } from './logger';
import { and, eq, isNull, lt } from "drizzle-orm";
import { db } from "./db";
import { recurringTransactions, transactions, users } from "../shared/schema";
import { DataEncryption } from "./encryption";
import { dueOccurrences, isRecurrenceFrequency } from "../shared/recurrence";
import { withJobRun } from "./errorGuard/jobs.js";
import { notifyDataChange } from "./realtime";

export interface RecurringRunResult {
  rulesChecked: number;
  transactionsCreated: number;
}

/**
 * Creates the transactions that recurring rules owe by `now`.
 *
 * Safe to run any number of times: each rule is first "claimed" by moving `last_processed`
 * forward with a compare-and-set, so two overlapping runs (or two server processes) cannot
 * both create the same occurrence. If inserting fails after the claim, the claim is put back.
 */
export async function processRecurringTransactions(now: Date = new Date()): Promise<RecurringRunResult> {
  const rules = await db
    .select({
      rule: recurringTransactions,
      plan: users.plan,
    })
    .from(recurringTransactions)
    .innerJoin(users, eq(recurringTransactions.userId, users.id))
    .where(eq(recurringTransactions.isActive, true));

  let created = 0;
  const touchedUsers = new Set<string>();

  for (const { rule, plan } of rules) {
    // Recurring transactions are a paid feature; a downgraded account stops repeating.
    if (plan === "free") continue;
    if (!isRecurrenceFrequency(rule.frequency)) continue;

    const due = dueOccurrences({
      start: rule.startDate,
      frequency: rule.frequency,
      lastProcessed: rule.lastProcessed ?? rule.startDate,
      endDate: rule.endDate,
      now,
    });
    if (due.length === 0) continue;

    const previous = rule.lastProcessed;
    const newest = due[due.length - 1];

    const claimed = await db
      .update(recurringTransactions)
      .set({ lastProcessed: newest })
      .where(
        and(
          eq(recurringTransactions.id, rule.id),
          previous ? eq(recurringTransactions.lastProcessed, previous) : isNull(recurringTransactions.lastProcessed)
        )
      )
      .returning({ id: recurringTransactions.id });

    if (claimed.length === 0) continue; // another run took it

    try {
      await db.insert(transactions).values(
        due.map((date) => ({
          userId: rule.userId,
          categoryId: rule.categoryId,
          amount: rule.amount,
          description: DataEncryption.encryptDescription(rule.description),
          type: rule.type,
          date,
          isRecurring: true,
          recurringFrequency: rule.frequency,
          recurringEndDate: rule.endDate,
          parentTransactionId: rule.sourceTransactionId,
        }))
      );
      created += due.length;
      touchedUsers.add(rule.userId);
    } catch (error) {
      log.error(
        `[recurring] could not create transactions for rule ${rule.id}:`,
        error instanceof Error ? error.message : error
      );
      // Put the claim back so the next run retries.
      await db
        .update(recurringTransactions)
        .set({ lastProcessed: previous })
        .where(eq(recurringTransactions.id, rule.id))
        .catch(() => undefined);
    }
  }

  touchedUsers.forEach((userId) => {
    try {
      notifyDataChange(userId, "transaction");
    } catch {
      /* the page refreshes on its next load anyway */
    }
  });

  // Rules whose end date has passed are retired so the query above stays small.
  await db
    .update(recurringTransactions)
    .set({ isActive: false })
    .where(and(eq(recurringTransactions.isActive, true), lt(recurringTransactions.endDate, now)))
    .catch(() => undefined);

  return { rulesChecked: rules.length, transactionsCreated: created };
}

const HOUR_MS = 60 * 60 * 1000;

/** Hourly check (cheap when nothing is due) and one pass shortly after boot. */
export function startRecurringScheduler(): void {
  const run = () => void withJobRun("recurring-processor", async () => {
    const result = await processRecurringTransactions();
    if (result.transactionsCreated > 0) {
      log.info(`[recurring] created ${result.transactionsCreated} transaction(s) from ${result.rulesChecked} rule(s)`);
    }
  });

  setTimeout(run, 30_000);
  setInterval(run, HOUR_MS);
}
