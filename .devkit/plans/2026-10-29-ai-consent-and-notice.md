# 2026-10-29 — nobody's data goes to an AI provider before they were asked

## Goal

A new account starts with AI off, is asked once, in the app, whether Kaptia may send receipts
and voice notes to AI providers, and the answer is recorded on the server; people who are
invited by e-mail are told where their address came from; and the retention table describes
the records we actually keep instead of six of nine.

## Out of scope

- Re-asking existing customers. Their current setting is their answer; the migration stamps it.
- Making the dialog a Clerk signup field. Clerk owns that form and cannot write our column.
- The nine bank registrations, the security document, the provider contracts — documents, not code.

## Files that will change

- `migrations/0008_users_ai_consent.sql` — new column, new default, backfill for existing rows.
- `shared/schema.ts` — the column, and the default that changes.
- `shared/aiConsent.ts` — the one rule: is there still a question to ask.
- `server/storage.ts` — make the answer persistable.
- `server/routes/authRoutes.ts` — record the answer with the server's clock.
- `client/src/components/AiConsentDialog.tsx` — the question itself.
- `client/src/components/AppLayout.tsx` — mount it where every signed-in page sees it.
- `server/emailService.ts` — the notice inside both invitation e-mails.
- `client/src/pages/privacy-policy.tsx` + three locales — three retention rows, and the dialog copy.
- `tests/unit/aiConsent.test.ts`, `tests/unit/profileUpdate.test.ts`, `tests/unit/peruLegalCopy.test.ts`.

## The risk

`ai_enabled` now defaults to false: if the migration lands but the client does not, every new
account gets "AI is switched off" and no way to turn it on except Profile — the feature looks
broken. Deploy order matters: migration + code together, and `scripts/deploy.sh` already
refuses to ship code whose columns are missing. Second risk: the dialog is a modal on first
render; a bug there blocks the whole app for new accounts, so it must fail open (render
nothing) rather than throw.

## How it is proven

- `tests/unit/aiConsent.test.ts` — null/undefined ask, a recorded date does not, `aiEnabled:
  true` alone is not an answer.
- `tests/unit/profileUpdate.test.ts` — `PUT /api/auth/user {aiEnabled}` stores the setting
  **and** the timestamp, and the timestamp comes from the server, not the body.
- `tests/unit/peruLegalCopy.test.ts` — the three retention rows exist in all three languages.
- Gate: `DATABASE_URL=… ./verify.sh --all`

## Steps

1. Migration, schema, storage, route.
2. Dialog, mount, copy in three languages.
3. Invitation notice, retention rows.
4. Tests, then the gate.

## Review — filled in after building, by the reviewer pass

- [x] Q1 · plain sentence a non-developer can read: a new account now starts with the AI features
      switched off and is asked once, in its own language, whether Kaptia may use them; someone
      invited by e-mail is told where their address came from and how to stop it; and the
      retention page lists the three records that outlive an account.
- [x] Q2 · the test that fails without this change: `tests/unit/profileUpdate.test.ts` (AI
      consent block) — without the server writing the timestamp, the answer is stored with no
      date and the dialog asks again; `tests/unit/aiConsent.test.ts` pins "an old `true` is not an
      answer"; `tests/unit/inviteNotice.test.ts` pins the notice in text and HTML;
      `tests/unit/peruLegalCopy.test.ts` pins the three retention rows in three languages.
- [x] Q3 · `./verify.sh` — result: `checks`, `tests` (113 files, integration included), `graph`,
      `build` all green, 123 s.
- [x] Q4 · the risk, named: the default flipped to `false`, so shipping the migration without the
      client leaves new accounts with "AI is switched off" and no prompt — the feature looks
      broken. The reverse (client first) is harmless. The dialog is a full-screen overlay on the
      first page a new customer sees, so it returns `null` on any doubt rather than throwing.
      Second risk: bank 6's notice promises "one email per invitation"; if a reminder is ever
      added, that sentence has to change with it.
- [ ] Q5 · the reviewer read the diff (who, when): **not done** — same-author pass. The honest
      gap, again.
- [x] `lessons.md` updated — the migration-journal trap and the real-database integration tests.

