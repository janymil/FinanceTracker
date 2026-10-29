# devkit — the loop every change goes through

Applies to every app under `/var/www`. The per-app commands live in `.devkit/profile.sh` and
the gate is `./verify.sh` in the app root. If a folder has no `.devkit/`, say so instead of
inventing a substitute gate.

## 1. Before editing

- Read `.devkit/lessons.md` and `.devkit/DONE.md`. An older lesson beats your instinct.
- A change bigger than one file starts with a plan in `.devkit/plans/<date>-<slug>.md` from
  the template: goal, out of scope, files, the risk, how it is proven. Agree it first.
- Look up where the code lives before reading folders — the map, not a walk.

## 2. While building

- One concern per change. If a second concern appears, stop and split it out.
- Every new path gets a test that fails without the change. No test, not done.
- Never weaken a check, a guard or a test to make something pass. If the gate itself is
  wrong, fix the gate in the same change and write one line in `lessons.md` saying why.

## 3. Before saying it is done

- Run `./verify.sh` in the app root. Not a partial command, not a remembered pass.
- Then re-read your own diff as a reviewer, not as the author, and answer the five
  questions in `.devkit/DONE.md` (prompt: `.devkit/prompts/reviewer.md`).
  A different conclusion means the work is not finished.
- Report four lines: what changed, what proved it, the risk, and what was not done.

## 4. What never happens

- Never claim a command passed unless it ran in this session.
- Never edit `.devkit/profile.sh` to skip a failing step.
- Never read, print or copy a real `.env` file, a key or a secret (see the secrets rule).
- Never rewrite a file the app owns (`verify.sh`, `.devkit/*`) with a template "to be safe".
