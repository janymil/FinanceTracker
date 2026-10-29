# devkit — one professional loop, every app

A small machine-wide kit that gives each app under `/var/www` the same four things: a gate
that either passes or does not, a written definition of done, a reviewer pass, and a place
for plans and lessons. It installs itself into new folders, so a repo created tomorrow is
covered without anyone remembering to do anything.

This folder is the **source of truth**. `/opt/devkit` is the installed copy; `install.sh`
syncs one to the other. Edit here, run `install.sh`, done.

## What it solves

The failure it exists to stop is the honest-sounding claim: "I fixed it, the tests passed"
when no test was run, or a check was quietly loosened to get a green result. A rule cannot
stop that. A command that exits non-zero can.

- **One gate.** `./verify.sh` in the app root runs the app's own checks in a fixed order and
  stops at the first failure with its last 40 lines. Nothing else counts as "verified".
- **One definition of done.** `.devkit/DONE.md`: five questions, all five or it is not done.
- **A real second pass.** `.devkit/prompts/reviewer.md` — the reviewer must not be the same
  sitting as the author, and gets exactly two verdicts to choose from.
- **Memory that survives.** `.devkit/plans/` for what will change, `.devkit/lessons.md` for
  what bit us.

## How the automatic part works

```
new folder appears in /var/www
        │
        ▼
systemd devkit-bootstrap.path   (PathModified=/var/www, fires on the parent's mtime)
        │
        ▼
devkit-bootstrap --all          (10s settle, then one locked run)
        │
        ├── is this an app?   package.json · .git · pyproject.toml · requirements.txt · go.mod · Cargo.toml
        ├── no  → nothing happens, one line in the journal
        └── yes → .devkit/ + verify.sh + .clinerules/devkit.md + memory block
                  files are chowned to the folder's owner, never to root
```

A clone creates the folder before `package.json` lands, so the trigger alone can arrive too
early — the **15-minute sweep** (`devkit-sweep.timer`) catches that case. Both paths run the
same idempotent script.

Safe to run constantly, because:

- an existing file is **never** overwritten (`--force` does it, deliberately, and loses edits),
- symlinks are skipped — `finanzerpro -> kaptia` is one app, not two,
- one `flock` per run, so a folder-per-second clone does not start ten installs,
- files land owned by the app's user, not root.

## Files it puts in an app

| Path | Owner | Purpose |
|---|---|---|
| `verify.sh` | the app | the gate runner; reads the profile, never edited |
| `.devkit/profile.sh` | the app | **the app's own steps** — this is the file to edit |
| `.devkit/DONE.md` | the app | definition of done, five questions |
| `.devkit/prompts/reviewer.md` | the app | the second-pass prompt |
| `.devkit/plans/TEMPLATE.md` | the app | plan template, copy per change |
| `.devkit/lessons.md` | the app | one line per surprise, newest first |
| `.devkit/.installed` | devkit | marker: kit version, stack, timestamp |
| `.clinerules/devkit.md` | the app | short pointer for the agent |
| `CLAUDE.md` / `AGENTS.md` | the app | a delimited block appended, only if the file exists |

## Editing the gate for one app

`verify.sh` runs whatever is listed in `.devkit/profile.sh`. Detection is a starting point,
not a decision — change it by hand:

```sh
DEVKIT_STEPS=(
  'checks|npm run check|gate'      # runs on every ./verify.sh
  'tests|./node_modules/.bin/vitest run|gate'
  'e2e|npx playwright test|slow'   # only with ./verify.sh --all
)
```

`CI=1` is exported for every step, so no runner can sit waiting for a watch-mode keypress.
Each step has a 900s timeout (`DEVKIT_STEP_TIMEOUT`), because a gate that hangs is worse than
one that fails.

## Commands

```sh
sudo ./install.sh                          # install or update, then backfill every app
sudo ./install.sh --uninstall              # remove the watcher (app folders are kept)
/opt/devkit/bin/devkit-bootstrap --status  # which apps have the kit, and when
/opt/devkit/bin/devkit-bootstrap /var/www/x  # by hand, for one folder
DEVKIT_SCAN_ROOT=/tmp/test /opt/devkit/bin/devkit-bootstrap --all   # rehearse somewhere else
tail -f /opt/devkit/state/journal.log      # what the watcher actually did
systemctl list-timers devkit-sweep.timer
```

## The one thing to get right

Do not let the gate become decorative. If a step is wrong, fix the step and write why in
`lessons.md`; if a step is skipped, say so in the report. The value of this kit is entirely in
the moment a green result is hard to fake.
