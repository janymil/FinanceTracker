# Lessons — this app

One line per surprise, newest first. Cheaper than rediscovering the same trap next month.

Format: `YYYY-MM-DD — what happened — what to do next time`

Delete a lesson only when the thing that caused it no longer exists.

---

- 2026-10-29 — `scripts/deploy.sh` printed "rollback copy kept at dist.backup-<stamp>" and then its
  own prune step deleted that copy: it sorts `dist.backup-*` with `ls -dt` (folder mtime), and every
  `dist` folder carries the same mtime because Vite rewrites `dist/public` and never `dist` itself.
  After the 02:45 deploy the three surviving copies were all from Oct 27 and the fresh one was gone,
  so "undo is one command away" was false. Sort by the timestamp in the name
  (`ls -d dist.backup-* | sort -r`) before pruning.

- 2026-10-29 — A local browser check of a production build never reaches the Clerk form: a
  production publishable key is refused unless the page origin is exactly `https://kaptia.app`
  ("The Request HTTP Origin header must be equal to or a subdomain of the requesting URL"), so the
  page sits on "Cargando Kaptia…" behind a 400 and the check proves nothing. A port breaks it too:
  `https://kaptia.app:4321` is refused as well. Load it with
  `chromium.launch({ args: ['--host-resolver-rules=MAP kaptia.app:443 127.0.0.1:<port>'] })` against
  a local HTTPS server holding a self-signed `kaptia.app` certificate, and the real key works.


- 2026-10-28 — "Standard Anual: S/ 99.90" carried a **monthly** S/ 99.90 as its default price, and
  the interval check only logged a warning, so a yearly buyer would have been billed monthly for
  ever. A price is only correct when the **amount and the interval** match `shared/pricing.ts`;
  check both, and refuse the sale instead of warning. — Same week: checkout was reachable by an
  existing subscriber whenever the customer portal could not open, and `mode: subscription`
  creates a *second* subscription. Any route that can create a subscription needs an explicit
  "already paying → change, don't buy" guard in front of it.

- 2026-10-29 — `./verify.sh` failed on `tests` with `DATABASE_URL must be set` from `server/db.ts`,
  because unit tests import server modules and `vitest.config.ts` loads no env file at all. The gate
  only passes when `DATABASE_URL` is exported in the **process** environment (a dummy value is
  enough — unit tests need no real database). Run it as
  `DATABASE_URL=postgresql://ci:ci@127.0.0.1:5432/dummy ./verify.sh --all`, otherwise a red gate
  says nothing about your change.
