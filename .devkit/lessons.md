# Lessons — this app

One line per surprise, newest first. Cheaper than rediscovering the same trap next month.

Format: `YYYY-MM-DD — what happened — what to do next time`

Delete a lesson only when the thing that caused it no longer exists.

---

- 2026-10-30 — `EventSource` cannot send an `Authorization` header. The progress stream for a
  statement import sat behind `isAuthenticated`, so the browser asked unauthenticated, got 401
  and the bar stayed at 0% for the whole import while the upload carried on — which reads as "it
  is broken". An SSE route needs its own way in: a short-lived ticket bound to one account and one
  session, plus a replay buffer, because the page always connects *after* the first events fire.

- 2026-10-30 — the server tsconfig has no `downlevelIteration`, so `for (const [key, value] of
  someMap)` fails `npm run check` with TS2802 while `Map.forEach` is fine. Same class of trap as
  the `page.route` narrowing: the editor is happy, the gate is not.

- 2026-10-30 — a security warning is only worth its patterns. The ones in `pdfProcessor` said they
  removed names, cards and IBANs and were measured against real statement lines: `JUAN PEREZ`
  survived because it is uppercase, `SK68 1100 0000 0026 1234 5678` survived because of the
  spaces, and `Tesco Stores` did *not* survive. Test redaction against the format a bank prints,
  both directions, before putting it on a consent screen.

- 2026-10-29 — A hand-written `migrations/NNNN_*.sql` is invisible to the migrator until it is
  listed in `migrations/meta/_journal.json`: `db:migrate` prints "already up to date" and applies
  nothing, so the new column never reaches the database and the failure surfaces later as
  `42703 column ... does not exist` from the integration tests. Add the journal entry (idx, when,
  tag, breakpoints) in the same commit, then `npm run db:migrate:test`.
  Related: `tests/integration` runs against a REAL database (`DATABASE_URL_TEST`), so the dummy
  `DATABASE_URL` used to make `./verify.sh` start is not inert — a schema change needs the test
  database migrated or the gate goes red for a true reason.

- 2026-10-29 — Slovak "súhlas" (consent) contains the substring "hlas" (voice), so a test that
  asserts `/hlas/i` on Slovak copy passes on text that says nothing about voice. It did: the
  "voice note is disclosed" check was green against the *old* policy. Anchor Slavic stems on the
  longer form (`hlasov`) and prove any new locale assertion by running it against
  `git show HEAD:<file>` before trusting the green.

- 2026-10-29 — A `.env.example` variable is not a dependency: `ZOHO_APP_PASSWORD` sits in the
  contract with a comment saying no code reads it, so a privacy notice that names Zoho would be
  inventing a recipient. Grep the code, not the env file, before naming a provider in legal
  copy. (`Bunny` and `Turnstile` appear nowhere at all.)

  `page.route` callback is narrowed by tsc to `never`/`false` at the assertion site, so reading
  `captured.operationNumber` fails `npm run check` with "Property does not exist on type 'never'".
  Capture request bodies in an object (`const captured = { claim: null as any }`) instead of a
  reassigned `let`, and the assertions type-check.

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

- 2026-10-29 — `scripts/deploy.sh` stops at step 3/9 with the same `DATABASE_URL must be set`, and it
  stops *before* replacing `dist` or reloading pm2, so a failed deploy is harmless but proves nothing
  about the release. Pass the dummy to it too; the reload uses `env -i`, so the dummy cannot reach
  production. Its backup prune sorted `dist.backup-*` with `ls -dt` (see the 2026-10-29 entry above)
  and could delete the copy it had just made — it now sorts by the timestamp in the name.

- 2026-10-30 — "Invalid billing data" on a boleta with no DNI was **not** a validator bug. The
  production process started `Thu Oct 29 19:57:53` (`ps -eo pid,lstart,args | grep dist/index.js`)
  while `dist/index.js` had been rebuilt at `23:16`, and both dist backups still carried
  `documentType: z.enum(["dni", "ruc"])` — so the new three-card checkout sent `none` to a server
  that had never heard of it. A 400 that the source cannot reproduce deserves this check first:
  compare the process start time with the build's mtime, and grep the *running* bundle for the
  enum, before changing a rule that is already correct.
