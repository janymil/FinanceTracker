/**
 * This module used to pre-generate insights and tips in the background after a person added
 * transactions. It is gone on purpose:
 *
 *  - the results were thrown away, and the cache keys it used (no language, category ids
 *    instead of names) could never match what the routes later ask for, so the work could not
 *    speed anything up;
 *  - it still cost real money on every burst of transactions and counted against each person's
 *    AI usage allowance;
 *  - it ignored the account's AI off-switch.
 *
 * AI now runs only when a person opens a feature, behind `aiGuard`, and is cached by that request.
 * `batchProcessor.scheduleUser` stays as a harmless no-op so existing callers do not change.
 */
import { graceProcessor } from './graceProcessor';

export function scheduleBatchProcessing(_userId: string): void {
  // intentionally empty: see the comment above
}

export const batchProcessor = {
  scheduleUser: scheduleBatchProcessing,
};

// Grace period processor for payment failure handling (unrelated to AI).
graceProcessor.start();
