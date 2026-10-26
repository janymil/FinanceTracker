/**
 * Which build is actually running.
 *
 * `/api/health` answered "ok" with no way to tell *which* build was live. One night the build
 * finished at 00:30 while the process had been up since 20:35 — the fixes were on disk, the old
 * server was still serving, and both health checks looked fine. The identifier comes from
 * `APP_RELEASE` (set by `scripts/deploy.sh` in `ecosystem.config.cjs`'s environment) or from the
 * `.release` file the deploy writes next to the build. It is read once at start.
 */
import fs from 'node:fs';
import path from 'node:path';

export const PROCESS_STARTED_AT = new Date().toISOString();

function readRelease(): string {
  const fromEnv = String(process.env.APP_RELEASE || '').trim();
  if (fromEnv) return fromEnv;

  for (const candidate of ['.release', path.join('dist', '.release')]) {
    try {
      const stamp = fs.readFileSync(path.resolve(process.cwd(), candidate), 'utf8').trim();
      if (stamp) return stamp;
    } catch {
      // Not there: try the next place, then admit it is unknown.
    }
  }

  return 'unknown';
}

export const RELEASE_ID = readRelease();
