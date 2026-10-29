# devkit — this app

The loop is described in the machine-wide rule (`~/Documents/Cline/Rules/devkit.md`) and in
`~/.claude/CLAUDE.md`. This file only records what is specific to this app.

- **The gate is `./verify.sh`** (app root). Its steps live in `.devkit/profile.sh`; edit that,
  never the runner.
- **Definition of done:** `.devkit/DONE.md` — five questions, all five or it is not done.
- **Reviewer pass:** `.devkit/prompts/reviewer.md`, after the gate is green.
- **Read `.devkit/lessons.md` before editing.** Add a line when something surprises you.
- **A change bigger than one file** starts as a plan in `.devkit/plans/`.

Do not weaken a step to get a green gate. If a step is wrong, fix the step and say why in
`lessons.md`.
