# 2026-10-30 — the statement upload screen stops promising things we do not do

## Goal

Every sentence on the PDF-statement consent screen is true, and the answer is
recorded so we can prove who accepted which version of the text.

## Out of scope

- New AI features or new OCR providers.
- Building a user-facing security audit log (the false claim is removed instead —
  a real audit trail is its own change).
- The progress stream (separate plan: `2026-10-30-statement-progress-live.md`).

## Files that will change

- `client/public/locales/{es-pe,en-us,sk-sk}/translation.json` — the `export.pdf_security.*`
  block: AES-256-CBC → the scheme we write, "all data" → the fields we actually encrypt,
  "never stored" → "deleted when it finishes", the AI-retention promise → what we control,
  Stripe-only PCI claim → Stripe + MercadoPago, TLS 1.3 → "1.2 or newer", image providers
  given the OpenAI fallback it actually uses, audit-log claim → the import history that exists.
- `client/src/components/PDFSecurityModal.tsx` — render the provider/standard lines from the
  corrected keys; no structural change.
- `client/src/pages/export.tsx` — ask the server whether this person already accepted the
  current version instead of trusting component state.
- `server/routes/importRoutes.ts` — `GET /api/import/statement-consent` and
  `POST /api/import/statement-consent`.
- `server/storage.ts` — `recordStatementConsent()` (a dedicated method: `updateUser` has a
  whitelist that silently drops unknown fields, and a dropped consent write is a lie in itself).
- `shared/statementConsent.ts` (new) — the version constant and the "already accepted?" rule,
  shared by both sides so client and server cannot drift.
- `shared/textSanitizer.ts` (new) + `lib/pdfProcessor.ts` — the redaction the modal describes:
  IBAN, card numbers with separators, all-caps holder names and national ids are caught;
  ordinary merchant names stop being destroyed.
- `shared/schema.ts`, `migrations/0009_users_statement_consent.sql`,
  `migrations/meta/_journal.json` — two nullable columns on `users`.

## The risk

- Over-redaction cuts the merchant name the parser needs → wrong transaction descriptions.
  If this is wrong, the person sees "[NAME_REDACTED]" rows in the preview and stops trusting
  the import. Caught by the preview, but it costs an import.
- Adding `NOT NULL` columns to `users` would fail on a populated table — both are nullable.
- A migration not listed in the journal applies nothing and fails later as `42703` (lesson
  2026-10-29). The journal entry ships in the same change.
- Copy change on a consent screen: someone who accepted the old text is not distinguishable
  from someone who accepted the new one unless the version is stored — hence the version column
  ships in the same change, before the new text goes live.

## How it is proven

- Test `tests/unit/statementSanitizer.test.ts`: uppercase holder name, IBAN with and without
  spaces, card with spaces and with dashes, Slovak birth number → redacted; `Tesco Stores`,
  `Kaufland Slovakia`, `UBER TRIP` → unchanged. Fails on the current regexes.
- Test `tests/unit/statementConsentRoute.test.ts`: consent is only "accepted" for the current
  version, is written server-side with the server's clock, and a body-supplied timestamp is
  ignored.
- Gate: `./verify.sh`

## Steps

1. `shared/statementConsent.ts` + migration + schema + storage method.
2. Sanitizer extracted to `shared/`, hardened, wired back into `lib/pdfProcessor.ts`.
3. Consent endpoints; `export.tsx` reads the answer from the server.
4. Rewrite the `export.pdf_security.*` copy in three locales.
5. Tests, then `./verify.sh`.

## Review — filled in after building, by the reviewer pass

- [x] Q1 · plain sentence a non-developer can read: the screen you accept before uploading a
      statement now only promises what the app really does, and your answer is remembered.
- [x] Q2 · the test that fails without this change: `tests/unit/statementSanitizer.test.ts` — 12
      cases taken from real statement lines (uppercase holder, grouped IBAN, spaced card, Slovak
      birth number kept/removed, `Tesco Stores` preserved). Every one of them fails on the old
      patterns.
- [x] Q3 · `./verify.sh` — `checks` passes; `tests` 1299 pass, 9 files fail to collect for a
      missing `DATABASE_URL` in this shell (pre-existing, same reason as the 2026-10-29 lesson).
- [x] Q4 · the risk, named: over-redaction is the dangerous direction — a pattern that eats
      `Kaufland Slovakia` gives the categoriser a nameless row, so the merchant rule was removed
      and the holder name is now matched from the account instead of guessed. Everyone is asked
      to accept the corrected screen once more, which is intended: the old answer was to a text
      that was not true. `statement_consent_*` are nullable, so the migration cannot fail on a
      populated table.
- [ ] Q5 · the reviewer read the diff (who, when): the second pass was the same session as the
      first — a real reviewer pass by someone else is still owed on the copy specifically.
- [x] `lessons.md` updated — yes, three lines.

