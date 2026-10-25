# How to write to the owner of this repo

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
