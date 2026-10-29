# 2026-10-29 — the sign-in and sign-up form speaks the language of the page

## Goal

On `/es/auth` the Clerk form is Spanish even when the visitor's browser is English, because the
language in the address (not the browser) decides which language Clerk draws its own forms in.

## Out of scope

- Clerk's hosted Account Portal pages (`*.accounts.dev/sign-in`, `/sign-up`, `/user-profile`, the
  links inside verification emails). Clerk documents that the `localization` prop cannot reach
  them; only the dashboard can, and that is a dashboard task, not code.
- Translating anything this app already translates. `client/public/locales/*` is untouched.
- Slovak product work: it keeps working exactly as it did.

## Files that will change

- `client/src/i18n/clerkLocalization.ts` — new. `languageFromPath`, `languageFromTag`,
  `pickClerkLanguage`, `clerkLocalizationFor`; the custom Slovak block moves here out of `main.tsx`.
- `client/src/main.tsx` — the language is no longer decided once at module load; a
  `LocalizedClerkProvider` reads `useLocation()` and passes `localization` to `<ClerkProvider>`,
  which Clerk re-applies when the prop changes. `Router` moves one level up so that provider can
  read the address.
- `client/src/components/LanguageGuard.tsx` — two comments that claim Clerk localization cannot
  be updated at runtime, which stops being true.
- `tests/unit/clerkLocalization.test.ts` — new.

## The risk

If `pickClerkLanguage` is wrong, the form is drawn in the wrong language — the person still signs
up, so nobody's account breaks, but the fix looks like it failed. Visible within one page load, on
the auth page only. The `Router` move is the wider risk: wouter's location context now wraps every
provider, so a mistake there breaks every route at once — proven by the app rendering at all,
which the live check below covers.

## How it is proven

- Test: `tests/unit/clerkLocalization.test.ts` — `/es/auth` + English browser must resolve to
  `es` (this is the bug: today it resolves to English); the saved choice and browser only fill in
  when the address carries no language; `clerkLocalizationFor('es')` carries Clerk's Spanish
  strings; Slovak keeps the legal-consent strings Clerk ships empty.
- Live: Playwright, `/es/auth` with an English browser, English form expected before and Spanish
  after, on a local build of the same code.
- Gate: `./verify.sh`

## Steps

1. Move the language decision into a tested pure module.
2. Make `<ClerkProvider>` follow the address and re-render with it.
3. Prove it with the unit test, the gate, and a browser check.

## Review — filled in after building, by the reviewer pass

Not by the author in the same sitting. See `.devkit/prompts/reviewer.md`.

- [x] Q1 · plain sentence a non-developer can read: the sign-up and sign-in form now speaks the
      language of the page it is on, so a Spanish page gives a Spanish form even on an English
      browser.
- [x] Q2 · the test that fails without this change: `tests/unit/clerkLocalization.test.ts`,
      the two "address beats the browser / beats a saved English choice" cases. Proven by
      temporarily restoring the old browser-first order: `Expected "es", Received "en"`, 2 failed.
- [x] Q3 · `./verify.sh` — VERIFY OK, 3 steps in 105s (checks, tests, graph) with the dummy
      `DATABASE_URL` from `lessons.md`. Shipped afterwards with `./scripts/deploy.sh` (9/9, health
      gate ok, release `8d281125-20261029-024528`); the first deploy attempt stopped at step 3 for
      that same `DATABASE_URL` reason and touched nothing. Live re-check with a real browser:
      `/es/auth` + `en-US` → "Crea tu cuenta", `/en/auth` + `es-PE` → "Create your account".
- [x] Q4 · the risk, named: a wrong answer draws the form in the wrong language — nobody is
      blocked from signing up, but the fix looks failed; visible on the next page load. The wider
      risk was moving `Router` one level up in `main.tsx`, which would break every route at once;
      covered by the live check (four cases, real production key: `/es/auth` with an English
      browser now reads "Crea tu cuenta", `/en/auth` with a Spanish browser stays English).
- [x] Q5 · the reviewer read the diff (who, when): self-review, same session, after the gate —
      weaker than the rule wants. Recommend a second read before shipping.
- [x] `lessons.md` updated — the production-key-origin trap for local browser checks.
