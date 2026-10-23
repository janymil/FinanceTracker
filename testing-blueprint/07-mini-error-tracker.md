# 07 — Kaptia Watch: a small, AI-assisted error tracker

> Status: **BLUEPRINT / DESIGN ONLY** — no code written, no schema migrated.
> Companion to `00-testing-strategy.md` … `06-observability-and-deploy.md`.
> Decision owner: Jan. This document exists so the decision can be made on paper.

---

## 0. Decision gate — read this before building anything

Build it **only if all four are true**. Otherwise close this file.

| Gate | Threshold | Why |
|---|---|---|
| Error volume | ≥ 5 real errors/day, or any money-path incident in the last 90 days | Below that, Sentry free + one email is enough |
| You will open it | You will look at one screen ≥ 3×/week | A tool nobody opens is worse than no tool |
| Two disciplines will be respected | Aggregation before write **and** server-side scrubbing | Without them you ship a second broken system (see §6, §7) |
| External uptime ping accepted | Some free third-party monitor | Self-hosted monitoring cannot see its own death (§11) |

**Explicit non-goal:** this is not a Sentry competitor. It is a decision tool for one person
who needs to answer three questions: *is it broken now*, *what exactly*, *was money involved*.

---

## 1. Goals and non-goals

### v1 goals

1. Capture errors from the Express server and the React client into our own Neon database.
2. Group them into issues deterministically (fingerprint), with counts, first/last seen, release.
3. One screen with three panels answering the three questions.
4. Email on *new* issue — not on every event — with a one-paragraph explanation already inside.
5. AI analysis for new fingerprints only: cause hypothesis, likely file, severity, missing test.
6. Money-path errors are treated as critical, always, without configuration.
7. Never degrade the app: an error storm must not slow normal requests (§6).

### Explicit non-goals (v1)

Session replay, DOM recording, APM/tracing, performance budgets, mobile SDKs, multi-project,
team roles, public status page, log search, arbitrary event querying, Sentry-compatible
ingestion protocol, historical backfill.

Replay is the single most expensive feature to build and the most dangerous for a finance
app. The breadcrumb trail gives most of the debugging value for a fraction of the cost.

---

## 2. Architecture

```
 browser                      express                      neon postgres
┌──────────────┐   POST    ┌──────────────────┐   flush    ┌─────────────────┐
│ error boundary│─────────▶│  /api/telemetry  │──────────▶│ error_groups    │
│ window.onerror│  batched │  ├─ scrub (2nd)  │  60 s or   │ error_events    │
│ fetch wrapper │ sendBeacon│  ├─ fingerprint  │  200 rows  │ error_rollups   │
└──────────────┘           │  ├─ token bucket │            └────────┬────────┘
                            │  └─ ring buffer  │                     │
 server error middleware ──▶│                  │                     │
                            └──────────────────┘                     │
                                     │ failure: circuit breaker      │ new group
                                     ▼                               ▼
                            JSONL file on disk            email (SendGrid) + AI triage
```

**The one architectural rule:** telemetry is a **separate failure domain**. Nothing in the
request path may await it, and any telemetry failure is swallowed and counted.

---

## 3. Data model

Three tables. Deliberately small.

### `error_groups` — what you look at

| Column | Type | Notes |
|---|---|---|
| `id` | serial pk | |
| `fingerprint` | varchar(64) **unique** | see §4 |
| `fingerprint_version` | smallint | bump when normalisation changes |
| `title` | text | normalised message, ≤ 300 chars |
| `error_name` | varchar(100) | `TypeError`, `HttpError`, … |
| `route` | varchar(200) | route *pattern*, never a concrete URL |
| `source` | varchar(10) | `server` \| `client` |
| `severity` | varchar(20) | `critical` \| `error` \| `noise` |
| `is_money_path` | boolean | §9.3 |
| `environment` | varchar(20) | `development` \| `production` |
| `first_release` / `last_release` | varchar(40) | git sha |
| `first_seen_at` / `last_seen_at` | timestamptz | |
| `total_events` | integer | maintained by rollups, not by counting rows |
| `users_affected` | integer | distinct user hashes, approximate |
| `status` | varchar(20) | `open` \| `resolved` \| `ignored` (default `open`) |
| `ai_summary` | text | plain-English analysis (§9) |
| `ai_severity` / `ai_confidence` | varchar / numeric | independent of `severity` |
| `ai_suspect_file` | varchar(300) | best guess, e.g. `shared/calculations.ts` |
| `ai_analysed_at` | timestamptz | null = not analysed yet |

Indexes: `(status, last_seen_at desc)`, `(is_money_path, last_seen_at desc)`, `(fingerprint)`.

### `error_events` — evidence (sampled)

| Column | Type | Notes |
|---|---|---|
| `id` | serial pk | |
| `group_id` | integer fk | |
| `occurred_at` | timestamptz | |
| `message` | text | scrubbed, ≤ 2 000 chars |
| `stack` | text | scrubbed, ≤ 16 000 chars |
| `component_stack` | text | React only, ≤ 4 000 chars |
| `breadcrumbs` | jsonb | max 20, scrubbed |
| `request_id` | varchar(40) | join key with server logs |
| `route` | varchar(200) | pattern |
| `release` | varchar(40) | git sha |
| `user_hash` | varchar(64) | HMAC of Clerk id (§7.4) |
| `context` | jsonb | **shape only**, never values |

Partitioned by month; retention 14 days (§7.5, M4).

### `error_rollups` — the reason this stays cheap

| Column | Type | Notes |
|---|---|---|
| `group_id` | integer | |
| `bucket_minute` | timestamptz | truncated to the minute |
| `event_count` | integer | exact, even when detail is sampled |
| `dropped_count` | integer | what the throttle threw away |

Primary key `(group_id, bucket_minute)`. Written once per flush; ~1 400 rows/day at 1 group/min.

---

## 4. Fingerprinting

Deterministic, versioned, computed **on the server** (the client may send a hint, never final).

```
fingerprint = sha256(
  version            // "kaptia-watch-v1"
  + source           // server | client
  + error_name       // e.g. TypeError
  + normalised_msg   // first line, normalised
  + first_app_frame  // innermost frame NOT in node_modules and NOT in vendor chunk
  + route_pattern
)
```

Normalisation of `normalised_msg`, applied in this exact order:

1. Replace UUIDs, hex ids, base64 blobs, long digit runs (≥ 6) with `<id>`.
2. Replace anything that looks like an amount (`\d+[.,]\d{2}`) with `<amount>`.
3. Strip quoted substrings (`'…'`, `"…"`, `` `…` ``).
4. Remove the query string from any URL, keep the path.
5. Collapse whitespace, truncate to 300 chars.

`first_app_frame` = `file:function`, with the column number dropped (columns shift on every
build and would create a new group per deploy).

**Why this matters more than it looks:** bad fingerprinting is what makes Sentry feel like
noise. Two rules keep it sane — drop columns from the frame, and normalise values out of the
message. If a group still splits, do *not* add heuristics; raise `fingerprint_version` and
document the change.

---

## 5. Ingest contract

### 5.1 Endpoint

`POST /api/telemetry/errors` — **unauthenticated** (a broken Clerk must not silence errors),
**heavily rate-limited**, **never** returns anything but `204`. It must work before any other
middleware that can fail.

Payload (client may batch up to 20 events per request):

```json
{
  "release": "ae9fc709",
  "environment": "production",
  "events": [
    {
      "occurredAt": "2026-10-23T04:12:33.120Z",
      "source": "client",
      "errorName": "TypeError",
      "message": "Cannot read properties of undefined (reading 'map')",
      "stack": "at calculateFinancialSummary (index-CP5f.js:1:23456)",
      "componentStack": "in ExpensesChart\nin ExpensesPage",
      "route": "/sk/expenses",
      "requestId": "req_01HZX…",
      "userHash": "9f2c…",
      "breadcrumbs": [
        { "t": "route", "to": "/sk/expenses" },
        { "t": "click", "target": "button[data-testid=save-expense]" },
        { "t": "http", "method": "POST", "route": "/api/transactions", "status": 500, "ms": 412 }
      ]
    }
  ]
}
```

Hard caps, enforced server-side (the client is untrusted):

| Field | Cap | On overflow |
|---|---|---|
| events per request | 20 | reject extra |
| bytes per request | 128 KB | 413, no partial write |
| `message` | 2 000 chars | truncate |
| `stack` | 16 000 chars | truncate from the middle |
| `componentStack` | 4 000 chars | truncate |
| breadcrumbs | 20 | keep the newest |
| `context` | depth 3, 50 keys | drop deeper |

### 5.2 Breadcrumb vocabulary (closed set)

`route`, `click` (testid or aria-label only), `http` (method + **route pattern** + status + ms),
`ui` (form submitted, dialog opened), `release` (app boot). Anything else is dropped.

No free-text breadcrumbs. That single rule removes most PII leak paths before scrubbing even runs.

---

## 6. Backpressure — the part that decides whether this is safe

Order of operations for every event, all in memory:

```
scrub → fingerprint → token bucket → aggregate into rollup counter → maybe keep detail
                                                   │
                                    flush every 60 s or 200 groups
                                                   ▼
                                    single multi-row upsert (one transaction)
                                        │ failure
                                        ▼
                             circuit breaker → JSONL file → drop + counter
```

| Control | Value | Rationale |
|---|---|---|
| Ring buffer | 2 000 events | bounded; **drops** instead of blocking |
| Flush interval | 60 s | aggregation window = rollup bucket |
| Max groups per flush | 200 | one round trip, not 200 |
| Global token bucket | 120 events/min | protects Neon |
| Per fingerprint | 12 events/min | one hot loop cannot starve the rest |
| Per IP | 30 events/min | unauthenticated endpoint |
| Detail sampling | 100 % for the first 20 events per group per hour, then 1/50 | counts stay exact, storage does not |
| Circuit breaker | 3 consecutive failures or 5 in 30 s → open 60 s | stops hammering a dead DB |
| Statement timeout | 2 000 ms, telemetry only | cannot hold a connection hostage |
| Event size | 32 KB after scrubbing | serialisation safety |
| Kill switch | `TELEMETRY_ENABLED=0` read at runtime | 3am, no deploy |

**Non-negotiables**

1. The error handler **never awaits** a telemetry write.
2. Every telemetry path is wrapped: a throw inside it increments `telemetry_failures` and returns.
3. `/api/health` and `/api/health/deep` are excluded from telemetry entirely — otherwise the
   tracker can make the monitor report an outage that does not exist.
4. `dropped_count` is visible in the UI. Silent loss is the worst possible failure mode.

**Storm acceptance test** (must be in the test suite, not manual): 20 000 events in 60 s →
`p95 /api/health < 200 ms`, zero 5xx caused by telemetry, `dropped_count > 0`, at most 200
detail rows written, app still serving.

---

## 7. PII — three enforcement points, not one

Client-side scrubbing is **hygiene**, not enforcement. Anyone can POST to the endpoint with
`curl`, and cached bundles keep running old code. The server is the boundary.

| Point | Runs | Responsibility |
|---|---|---|
| 1. Capture (client) | before the event leaves the browser | drop values, keep shapes |
| 2. Ingest (server) | before fingerprint/write | re-scrub everything, enforce caps |
| 3. AI (server) | before the prompt | strip values, send stack + code only |

### 7.1 Capture rules (structured, not regex-first)

- `route` is always the **pattern** (`/api/transactions/:id`); the concrete URL is never stored.
- **No query strings, ever.** Not even redacted — omitted.
- **No request/response bodies.** Store `context` as shape only: `{ amount: "string", date: "string" }`.
- **Headers**: `Cookie`, `Authorization`, `x-api-key`, `x-clerk-*` are dropped, not redacted.
- Breadcrumbs use the closed vocabulary from §5.2.
- Existing `console.log` calls that print money (`transactionRoutes.ts`: raw financial summary,
  `groqClient.ts`: transcript prefix) must be **removed or reduced**, because any future
  console-breadcrumb integration would ship them.

### 7.2 What the scrubber must cover

Reuse `shared/piiScrubber.ts`, but extend it for this app:

| Category | Example that actually occurs |
|---|---|
| e-mail | `Failed to invite jana@example.com` |
| IBAN | `Invalid IBAN SK61 0000 …` |
| card PAN | `card 4111 1111 1111 1111` |
| phone | `+421 912 345 678` |
| tokens in text | `token=xyz`, `Bearer eyJ…`, `sk_live_…`, `pk_test_…` |
| Clerk ids | `user_2abc…` |
| amounts | zebra rule: keep in `error_events.context` shape, redact inside messages |

Adversarial rule: **write the leak tests from our own source code**, not from imagination.
Take the log lines that exist in the repo today and assert that serialising a scrubbed event
never contains a match.

### 7.3 Stack-trace messages carry data

`ZodError` prints received values, SQL errors echo parameters, `JSON.parse` prints a fragment.
So: truncate `message` to 500 chars *before* scrubbing, and run the scrubber on `message`,
`stack`, every breadcrumb field and `context` strings — not only the top-level message.

### 7.4 Identity

Store `HMAC-SHA256(userId, TELEMETRY_HASH_SECRET)` — never the raw Clerk id, never the e-mail.
`users_affected` counts distinct hashes. The secret lives in env and is rotatable (rotation
breaks correlation to the past; that is acceptable and documented).

### 7.5 Erasure and retention

- `deleteUserCompletely()` (already exists) must also delete `error_events` by `user_hash`.
- `error_events`: 14 days. `error_rollups`: 180 days. `error_groups`: until `resolved` + 90 days.
- Privacy policy: one paragraph — we store anonymised error diagnostics, pseudonymised user
  hash, 14-day detail retention. Even with no third party involved, this is processing.

**Leak canary (CI gate):** a test builds a fully populated event from a fixture that includes
an e-mail, IBAN, PAN, token and Clerk id, runs it through scrub, serialises it, and asserts
none of the forbidden patterns appear. If that test fails, nothing ships.

---

## 8. Making frontend stacks readable (without a symbolication pipeline)

Three cheap steps, in order. Stop as soon as the stack is good enough to act on.

1. **`keepNames: true`** in the esbuild/minify options. Function names survive minification;
   bundles grow ~10–15 %; stacks become `at calculateFinancialSummary (index.js:1:23456)` —
   enough to grep the repo. *Recommended default.*
2. **React error boundary** reports `componentStack`, which names the component tree even when
   the JS stack is minified. This is the difference between "a chart crashed" and "the whole
   page went white".
3. **On-demand symbolication**: source maps stored privately in R2, keyed by `release`; one
   function resolves `(file, line, col)` → `dashboard.tsx:214` when you open an issue.
   ~100 lines using the `source-map` package. Not a pipeline, no background job.

Rules: maps are **never** publicly served (source disclosure); a missing map degrades to step 1
instead of failing; symbolication results are cached per `(release, file, line)`.

Fallback of last resort: keep the already-wired Sentry client enabled **for the browser only**
(`VITE_SENTRY_DSN`, replay masked). Dual-send is a config flag, not a rewrite — and it is a
legitimate answer if step 3 never gets done.

---

## 9. The AI layer ("overwatch")

### 9.1 Where AI sits — and where it must never sit

| AI does | AI must never do |
|---|---|
| Explain a new group in plain language | Decide whether to alert |
| Point at the most likely file/function | Be in the request or error path |
| Suggest a missing test | Receive raw user values |
| Classify severity for triage | Write to the database or repo |
| Write the daily digest | Replace deterministic counting |

If the AI is down, rate-limited or hallucinating, **you still get every error and every alert**.
AI output is an annotation on a row, never a gate.

### 9.2 Trigger rules

| Trigger | Budget |
|---|---|
| New fingerprint, `critical` (money path) | immediate, always |
| New fingerprint, `error` | immediate, max 10/hour |
| Daily digest | 1×/day, 07:00 local |
| Existing group reopens after `resolved` | once |
| Everything else | never |

Hard caps: **50 analyses/day**, 8 000 input tokens, 700 output tokens, 15 s timeout,
3 retries with backoff, then mark `ai_analysed_at = null` and move on. Cost estimate at
`gpt-6-luna` pricing: well under €1/month at this cap.

### 9.3 Money-path detection (deterministic, before AI)

`is_money_path = true` when any of these match the stack file or the route:

```
shared/money.ts, shared/calculations.ts, shared/duplicateDetection.ts,
server/storage.ts (getUserFinancialSummary), server/routes/importRoutes.ts,
lib/pdfProcessor.ts, server/pdfProcessorClient.ts,
/api/financial-summary, /api/export-pdf, /api/import/*
```

Money-path groups are `severity: critical`, are **never** sampled away, are never throttled to
silence (only to counted), and always email immediately. This is the one rule Sentry cannot
give you, and the main reason this tool is worth building.

### 9.4 Prompt contract

**Input** (built server-side, after scrubbing):

```json
{
  "task": "analyse-error-group",
  "error": { "name": "TypeError", "message": "…", "stack": "…", "componentStack": "…" },
  "route": "/sk/expenses",
  "release": "ae9fc709",
  "previousRelease": "7a8b5394",
  "breadcrumbs": ["route /sk/expenses", "click save-expense", "POST /api/transactions 500"],
  "sourceExcerpts": [
    { "file": "shared/calculations.ts", "lines": "180-210", "code": "…≤120 lines…" }
  ],
  "recentCommits": ["ae9fc709 client: sync Sentry init"]
}
```

`sourceExcerpts` is what makes this better than a generic AI summary: the model gets the actual
code around the innermost app frame, chosen by the fingerprint's file, capped at 3 files /
120 lines each. No values from user data.

**Output** (validated with zod; reject and retry once on mismatch):

```json
{
  "plainSummary": "The expenses chart crashes when a month has no transactions …",
  "userImpact": "Anyone opening /sk/expenses on a month with no data sees a blank page.",
  "suspectFile": "client/src/components/trends-chart.tsx",
  "suspectFunction": "buildMonthlySeries",
  "causeHypothesis": "…",
  "severity": "critical | error | noise",
  "confidence": 0.0,
  "isLikelyRegression": true,
  "suggestedFix": "…≤5 sentences…",
  "missingTest": "a unit test for buildMonthlySeries with an empty month",
  "needsHumanDecision": false
}
```

Store the whole object; render `plainSummary` + `userImpact` + `suggestedFix` in the UI and the
email. `confidence < 0.5` or validation failure → show "AI could not analyse this" rather than
a confident wrong answer.

### 9.5 Guardrails

- The prompt is built from **scrubbed** fields only; the AI never sees `error_events.context` values.
- No tool access, no function calling, no code execution for this task — pure text in, JSON out.
- Log the exact prompt hash per analysis (audit: "what did we send?").
- AI output is never executed, never auto-committed, never used to auto-resolve a group.

---

## 10. The one screen

Route `/sk/admin/watch` (admin only, reuses the existing admin auth).

**Panel 1 — Right now** (last 60 min)
Big header: `Serving normally` / `3 new errors in 12 minutes`. Money-path issues are pinned on
top with a red badge. Empty state is explicit: "Nothing broken in the last hour."

**Panel 2 — New since last deploy**
Grouped by `first_release ≠ current release`. Each row: title, count, users affected, route,
AI one-liner. This is the regression list — the only panel you are expected to read daily.

**Panel 3 — Needs a decision**
Groups with `status = open` and no `ai_analysis`, sorted by `users_affected`, plus a
`noise` suggestion. Buttons: **Resolve**, **Ignore for 7 days**, **Ignore forever**,
**Copy AI summary**.

Footer, always visible: `dropped_count`, `telemetry_failures`, `last flush at`, current release.
If those numbers are not visible, the tool is lying to you by omission.

### Email (the actual interface)

One email per new group — max 3/day unless money-path:

```
[Kaptia] New error: Cannot read properties of undefined (reading 'map')
critical · money path · 14 events · 6 users · /sk/expenses · release ae9fc709

What happened: The expenses chart crashes when a month has no transactions …
Likely file:   client/src/components/trends-chart.tsx (buildMonthlySeries)
Missing test:  buildMonthlySeries with an empty month
Fix idea:      Guard the empty array before mapping …

Open: https://kaptia.app/sk/admin/watch?group=42
```

---

## 11. Alerting and the blind spot you cannot build away

Self-hosted monitoring cannot report its own death, and neither can Sentry. Split it:

| Layer | Tool | Notifies when |
|---|---|---|
| Liveness | **external** free uptime monitor → `/api/health` every 5 min | the app or the host is down |
| Deep health | external monitor → `/api/health/deep` every 15 min | DB round-trip breaks |
| Dead-man switch | `npm run healthcheck` cron pings an external heartbeat URL | cron/host silently stopped |
| Errors | **Kaptia Watch** (§10 email) | something *code-level* broke while the app is up |

Rule: the external monitor must not depend on our domain resolving. Use its own e-mail channel.

---

## 12. Milestones

Each milestone is independently shippable and has a stop/go gate.

### M1 — Capture and aggregate (≈2 days)

- [ ] Tables + migration; `TELEMETRY_ENABLED` flag (default off)
- [ ] Server middleware + capture in the existing error handler (fire-and-forget)
- [ ] Client: global handlers + error boundary + fetch wrapper, batched `sendBeacon`
- [ ] Scrubber wired at capture (client) and ingest (server)
- [ ] Rollup aggregation + 60 s flush + token buckets
- [ ] **Acceptance:** a thrown error in dev appears in a DB row within 5 s; storm test
      (20 000 events/60 s) keeps `p95 /api/health < 200 ms`, writes ≤ 200 detail rows, and
      shows `dropped_count > 0`.

### M2 — One screen + email (≈2 days)

- [ ] `/sk/admin/watch` with the three panels and the honesty footer
- [ ] Resolve / ignore actions
- [ ] One e-mail per new group, max 3/day
- [ ] **Acceptance:** a new error produces exactly **one** email; resolving a group removes it
      from panel 3 and it does not email again unless it reopens.

### M3 — AI triage (≈2 days)

- [ ] Deterministic money-path detection + critical pinning
- [ ] Prompt builder with `sourceExcerpts` (max 3 files / 120 lines)
- [ ] zod-validated output, caps (50/day, 8 k in / 700 out, 15 s)
- [ ] AI text rendered in UI + email; `confidence < 0.5` renders "could not analyse"
- [ ] **Acceptance:** replay fixtures (fake provider) pass in CI; a real analysis names a file
      that exists in the repo; killing the AI (bad key) still delivers every error and email.

### M4 — Readable stacks + hygiene (≈1–2 days)

- [ ] `keepNames: true`, verify component/function names survive the build
- [ ] Private source maps in R2 keyed by release; on-demand symbolication + cache
- [ ] Retention job (14 d events, 180 d rollups, resolved+90 d groups)
- [ ] Erasure hook in `deleteUserCompletely`
- [ ] Leak-canary test as a CI gate
- [ ] **Acceptance:** a minified client error opens as `dashboard.tsx:214`; deleting a user
      removes their telemetry; the canary fails if a token pattern is introduced.

Total: **~1 week of focused work**, ~2 weeks including review and the unpleasant edge cases.

---

## 13. Test plan (fits the existing harness)

| Layer | File | What it proves |
|---|---|---|
| Unit | `tests/unit/fingerprint.test.ts` | normalisation, column stripping, version bump, same error → same hash |
| Unit | `tests/unit/telemetryThrottle.test.ts` | token buckets, ring-buffer drop, circuit breaker open/close |
| Unit | `tests/unit/piiScrubber.leak.test.ts` | **canary**: no forbidden pattern survives |
| Unit | `tests/unit/aiTriage.test.ts` | prompt builder (no values), zod rejection, confidence fallback |
| Integration | `tests/integration/telemetryIngest.test.ts` | real DB: rollup upsert, caps, 204 only, retention query |
| Load | `tests/load/storm.test.ts` (opt-in, `RUN_LOAD_TESTS=1`) | the storm acceptance criterion |
| E2E | `tests/e2e/watch-screen.spec.ts` | error appears in panel 1; resolve removes it |
| Contract | `tests/ai/recorded/**` | replay real AI analyses, exactly like doc 02 |

Non-negotiable: the storm test and the leak canary are **CI gates**, not manual checks.
Everything else may be scheduled.

---

## 14. Ops

| Env var | Default | Meaning |
|---|---|---|
| `TELEMETRY_ENABLED` | `0` | master kill switch, read at runtime |
| `TELEMETRY_HASH_SECRET` | — | HMAC key for `user_hash`; required when enabled |
| `TELEMETRY_DAILY_AI_BUDGET` | `50` | analyses per day |
| `TELEMETRY_FLUSH_MS` | `60000` | aggregation window |
| `TELEMETRY_MAX_BUFFER` | `2000` | ring buffer size |

**Runbook — "is the tracker lying to me?"**

1. Footer shows `last flush at` older than 5 min → telemetry is stuck: check server logs for
   `[telemetry]`, then the circuit-breaker state.
2. `dropped_count` climbing → a storm is being absorbed correctly; read panel 1, don't panic.
3. `telemetry_failures > 0` with no groups → writes are failing: check Neon and the JSONL
   fallback on disk.
4. Turn it off with `TELEMETRY_ENABLED=0` (no restart) and rely on the external monitor until fixed.

---

## 15. Open decisions (answer before M1)

1. **Where does the screen live** — `/sk/admin/watch` inside Kaptia, or a separate tiny app?
   Inside is cheaper (auth, layout, i18n exist); separate is safer (an app crash doesn't take the
   console with it). Recommendation: inside + external monitor for the blind spot.
2. **Any customer-facing surface change** ("something went wrong, we're on it")? If yes, add a
   support code: show the user a short id, put it in the email.
3. **Which model** for triage — the existing router (`lib/aiProvider.ts`) or a dedicated one?
   Recommendation: reuse the router, pin the model per task, store provider + model per analysis.
4. **Dual-send to Sentry for the browser** from day one, or only if M4 stalls?
   Recommendation: keep Sentry wired with an empty DSN; enable only if on-demand symbolication
   is abandoned.

---

## 16. What we deliberately will not build

Replay (DOM recording), tracing/APM, a source-map *pipeline* (only on-demand symbolication),
log ingestion, arbitrary queries, charts, team roles, multi-tenant, Sentry-compatible ingestion,
mobile SDKs, alert-routing UI, public status page.

If any of these becomes necessary, that is the signal to pay a vendor — not to grow this tool.
**The failure mode of this project is scope creep, not complexity.**

---

## 17. Risk register (carried over from the brainstorm)

| Risk | Mitigation | Where |
|---|---|---|
| Error storm kills Neon / the app | aggregate → buffer → token bucket → breaker → JSONL; storm test as CI gate | §6, M1 |
| Minified frontend stacks are useless | `keepNames` → error boundary → on-demand symbolication; Sentry as last resort | §8, M4 |
| PII leaks via URLs / messages / breadcrumbs / AI prompt | 3 enforcement points, pattern-based capture, structured breadcrumbs, leak canary | §7, M3 |
| Silent data loss | `dropped_count` + `telemetry_failures` in the footer and the daily digest | §10, §14 |
| Self-monitoring blind spot | external uptime monitor + heartbeat cron | §11 |
| Fingerprint explosion (one bug → 300 groups) | normalisation rules + no column in the frame + explicit version bumps | §4 |
| The tool nobody opens | one screen, three panels, email-first interface; if it isn't opened in 2 weeks, delete it | §0, §10 |

**Kill criterion:** if after four weeks the tracker has not been opened voluntarily and has not
caught a single issue before a user reported it, remove it. That is a legitimate outcome and
cheaper than maintaining a second product.




