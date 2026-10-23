/**
 * Evidence retention (blueprint 07 §14): sampled stacks are useful for weeks, not forever.
 *
 *   npm run error-guard:prune            # 30 days
 *   npm run error-guard:prune -- --days=90
 *
 * Rollups are kept — they are tiny and they are what "has it got worse?" reads.
 */
import 'dotenv/config';
import { pruneOldEvents } from '../server/errorGuard/store.js';

const daysArg = process.argv.find((arg) => arg.startsWith('--days='));
const days = daysArg ? Number(daysArg.split('=')[1]) : 30;

async function main(): Promise<void> {
  if (!Number.isFinite(days) || days < 1) {
    console.error('Invalid --days value');
    process.exit(1);
    return;
  }
  const deleted = await pruneOldEvents(days);
  console.log(`[error-guard] pruned ${deleted} evidence row(s) older than ${days} day(s)`);
}

void main().catch((error) => {
  console.error('[error-guard] prune failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
