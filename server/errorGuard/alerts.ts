/**
 * E-mail alerts (blueprint 07 §11).
 *
 * The screen is the interface; e-mail is the interruption. Rules that keep it useful:
 *  - only money/critical problems and invariants are worth an interruption;
 *  - one combined e-mail, at most one per 10 minutes and 8 per day;
 *  - the same problem never e-mails more than once per 6 hours;
 *  - no user data, no stack traces — title, route, count, and a link to the screen.
 *
 * Silent no-op when `ERROR_GUARD_ALERT_EMAIL` is unset or no transport is configured.
 */
import { isEmailConfigured, sendEmail } from '../emailService';
import type { GroupSnapshot } from './store';

const MIN_GAP_MS = Number(process.env.ERROR_GUARD_ALERT_MIN_GAP_MS) || 600_000;
const MAX_PER_DAY = Number(process.env.ERROR_GUARD_ALERT_MAX_PER_DAY) || 8;
const PER_GROUP_GAP_MS = Number(process.env.ERROR_GUARD_ALERT_GROUP_GAP_MS) || 6 * 3_600_000;

let lastSentAt = 0;
let sentToday = 0;
let counterDay = new Date().toISOString().slice(0, 10);
const perGroupSentAt = new Map<string, number>();

function recipients(): string[] {
  return (process.env.ERROR_GUARD_ALERT_EMAIL ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function watchUrl(): string {
  const base = (process.env.ERROR_GUARD_URL || process.env.APP_URL || 'https://kaptia.app').replace(/\/+$/, '');
  return `${base}/sk/admin-watch`;
}

function worthInterrupting(group: GroupSnapshot): boolean {
  return group.severity === 'critical' || group.kind === 'invariant' || group.kind === 'job';
}

function resetDailyCounter(now: number): void {
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== counterDay) {
    counterDay = today;
    sentToday = 0;
  }
}

/** Called after a successful flush with that batch. Never throws. */
export async function notifyCriticalProblems(groups: GroupSnapshot[], now = Date.now()): Promise<void> {
  try {
    const to = recipients();
    if (to.length === 0 || !isEmailConfigured()) return;

    resetDailyCounter(now);
    if (sentToday >= MAX_PER_DAY) return;
    if (now - lastSentAt < MIN_GAP_MS) return;

    const eligible = groups.filter(
      (group) => worthInterrupting(group) && now - (perGroupSentAt.get(group.id) ?? 0) >= PER_GROUP_GAP_MS,
    );
    if (eligible.length === 0) return;

    const lines = eligible.map((group) => {
      const money = group.moneyPath ? ' [touches money]' : '';
      const route = group.route ? ` in ${group.route}` : '';
      return `- ${group.title}${money}\n  ${group.count} occurrence(s),${route ? route.replace(' in', ' route') : ' no route'}${group.release ? `, release ${group.release}` : ''}`;
    });

    const text = [
      `Kaptia reported ${eligible.length} problem(s) that need attention:`,
      '',
      ...lines,
      '',
      `Open the screen: ${watchUrl()}`,
    ].join('\n');

    const html = `
      <p>Kaptia reported <strong>${eligible.length}</strong> problem(s) that need attention:</p>
      <ul>
        ${eligible
          .map(
            (group) =>
              `<li><strong>${escapeHtml(group.title)}</strong>${group.moneyPath ? ' — <em>touches money</em>' : ''}<br/>` +
              `${group.count} occurrence(s)${group.route ? ` · route ${escapeHtml(group.route)}` : ''}` +
              `${group.release ? ` · release ${escapeHtml(group.release)}` : ''}</li>`,
          )
          .join('')}
      </ul>
      <p><a href="${watchUrl()}">Open Kaptia Watch</a></p>
    `;

    const sent = await sendEmail({
      to: to.join(','),
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@kaptia.app',
      subject: `Kaptia Watch: ${eligible.length} problem(s) need attention`,
      text,
      html,
    });

    if (sent) {
      lastSentAt = now;
      sentToday += 1;
      for (const group of eligible) perGroupSentAt.set(group.id, now);
      // Keep the map bounded so a fingerprint bug cannot leak memory.
      if (perGroupSentAt.size > 500) perGroupSentAt.clear();
    }
  } catch (error) {
    // An alerting failure must never affect the app or the tracker.
    console.warn(
      '[errorGuard] alert e-mail failed:',
      error instanceof Error ? error.message.slice(0, 160) : 'unknown',
    );
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Test helper. */
export function resetAlertStateForTests(): void {
  lastSentAt = 0;
  sentToday = 0;
  counterDay = new Date().toISOString().slice(0, 10);
  perGroupSentAt.clear();
}
