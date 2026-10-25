/**
 * The server's single logging entry point.
 *
 * Route and service files used to call `console.log` directly, which meant:
 * - debug chatter could not be turned off without editing dozens of files;
 * - every new call site could pick a different level (or none);
 * - nothing stopped a prompt, a token or a card fragment from being printed.
 *
 * Rules for callers:
 * - `log.debug` for development tracing (silent in production unless LOG_LEVEL=debug);
 * - `log.info` for operational milestones ("plan activated", "job finished");
 * - `log.warn` / `log.error` for things a human may need to act on;
 * - never pass secrets, prompts, receipts or personal data — metadata only.
 *
 * Output stays plain `console.*` on purpose: pm2 already timestamps and rotates it,
 * and existing log-based checks keep working.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;

type Level = keyof typeof LEVELS;

function threshold(): number {
  const configured = String(process.env.LOG_LEVEL || '').trim().toLowerCase();
  if (configured in LEVELS) return LEVELS[configured as Level];
  // Production keeps the same visibility it had before (info and above);
  // anywhere else debug is useful and free.
  return process.env.NODE_ENV === 'production' ? LEVELS.info : LEVELS.debug;
}

function emit(level: Level, args: unknown[]): void {
  if (LEVELS[level] < threshold()) return;
  if (level === 'error') console.error(...args);
  else if (level === 'warn') console.warn(...args);
  else console.log(...args);
}

export const log = {
  debug: (...args: unknown[]): void => emit('debug', args),
  info: (...args: unknown[]): void => emit('info', args),
  warn: (...args: unknown[]): void => emit('warn', args),
  error: (...args: unknown[]): void => emit('error', args),
};
