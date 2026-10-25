/**
 * Job-run records (blueprint 07 §17.3).
 *
 * "Did the cron run?" cannot be answered by an error tracker, because a job that never
 * started throws nothing. Wrap the call and the absence of a row becomes the alarm.
 *
 *   setInterval(() => { void withJobRun('grace-period', () => this.processGracePeriods()); }, ...)
 *
 * Never throws: these call sites are timers, and an unhandled rejection would take the
 * process down.
 */
import { reportSwallowed } from './report';
import { recordJobRun } from './store';
import { log } from '../logger';

export async function withJobRun(jobName: string, fn: () => Promise<unknown>): Promise<void> {
  const startedAt = new Date();

  try {
    await fn();
    await recordJobRun({
      jobName,
      status: 'ok',
      startedAt,
      durationMs: Date.now() - startedAt.getTime(),
    }).catch(() => undefined);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    reportSwallowed(error, { where: `job.${jobName}`, fallback: 'job aborted' });
    log.error(`[errorGuard] job ${jobName} failed:`, message.slice(0, 200));
    await recordJobRun({
      jobName,
      status: 'failed',
      errorCode: message.slice(0, 120),
      startedAt,
      durationMs: Date.now() - startedAt.getTime(),
    }).catch(() => undefined);
  }
}
