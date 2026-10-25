# How to write to the owner of this repo

## Why this kept failing (read this first)

The owner had to ask twice. Both times the same mistake: the technical part was written
well and the closing note was written **last**, still in the technical voice, so it read
like a changelog. The rule was known and still broken, because nothing forced a check.

So the order below is not a style preference. Write the note **first**, before the
technical part exists to contaminate it.

## The two-step gate (do this on every reply that changed something)

**Step 1 — before writing anything else, write the closing note.** Three to five sentences.
It must pass all four of these:

1. Read only the note. Can the owner tell *what is different for them or their customers*?
2. Does every sentence survive after deleting all code, file names and command names?
3. Are there zero words from the banned list below?
4. Is there a clear "what they have to do" line — including "nothing"?

**Step 2 — only then write the technical part above it**, for the record. If a sentence in
the note needs a technical word to be true, that sentence belongs in the technical part
instead.

**Step 3 — before sending, read the note on its own, once.** If it sounds like a commit
message, rewrite it. Sending a long technical answer with a thin note at the bottom is the
exact failure this file exists to prevent.

### Banned in the closing note

File paths, function/variable/table names, endpoint paths, HTTP status codes, header
names, environment variable names, library and vendor names (Stripe, Clerk, Neon, Redis…),
and these words: middleware, endpoint, token, schema, refactor, commit, typecheck,
migration, webhook, idempotent, deploy, cache, index, query, database, API.

If the honest sentence needs "database", say "our records" or "customer records". If it
needs "webhook", say "the notice the payment provider sends us". Same fact, plain words.

## The rule they had to repeat (never make them repeat it again)

The owner is the product decision-maker, not a developer. They have asked, more than once:
write simply, no technical language, so I can understand it. Every closing note that leaked
file paths, function names, HTTP verbs or library names broke that rule. It is a
requirement, not a preference.

## The closing note ("resumen")

This is the part they read. Everything else is optional; this is not.

- 3 to 6 short sentences, plain words, normal grammar. No walls of bullets.
- Answer two questions only: **what is different now** for the product or the person using
  it, and **what they have to do** (if anything). If the answer to the second is "nothing",
  say so in one line.
- Never in the closing note: file paths, function or variable names, endpoint paths, status
  codes, library or vendor names, and words like middleware / endpoint / token / schema /
  refactor / commit / typecheck / migration. If a sentence only works with one of those, it
  belongs above the closing note, not in it.
- Do not open with "I've successfully...", do not repeat the plan, do not paste code.
- Technical detail goes **above** the closing note, and only when it changes a decision for
  them or when they asked for it.

Example of the right shape:

> Only the account that asked for the QR code can now read what the phone uploaded, and the
> receipt disappears from memory after an hour. The admin panel now accepts a personal
> Clerk login with a second factor instead of the one shared password. Nothing needs to be
> done today; to stop using the shared password, tell me who needs admin access.

The same content written wrongly: "Added `isAuthenticated` plus an owner check to
GET /api/mobile-upload/status/:sessionId and enforced SESSION_TTL_MS on read."

## Language

- Answer in the language of their last message: Spanish question, Spanish answer; English
  question, English answer. Never mix the two in one reply, and never translate the code,
  the UI strings or the docs into the other language.

## What "simple" does not mean

- It does not mean vague. Name the real consequence ("anyone who learned the password could
  delete any customer account"), never "there were some security issues".
- It does not mean long. One clear sentence beats five hedged ones.
- Decisions still get two plain options and what each one costs, not a lecture.
- Never hide a risk to keep the note short. Shorten the wording, not the warning.
