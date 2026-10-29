# <YYYY-MM-DD> — <one line: what changes for the person using it>

## Goal

One sentence. If it needs two, it is two changes.

## Out of scope

The tempting neighbours that stay out, so this does not grow while it is being built.

## Files that will change

- `path` — why

## The risk

What breaks if this is wrong · who notices · how fast.

## How it is proven

- Test: which file, which case, and what it asserts.
- Gate: `./verify.sh`

## Steps

1.
2.
3.

## Review — filled in after building, by the reviewer pass

Not by the author in the same sitting. See `.devkit/prompts/reviewer.md`.

- [ ] Q1 · plain sentence a non-developer can read:
- [ ] Q2 · the test that fails without this change:
- [ ] Q3 · `./verify.sh` — result:
- [ ] Q4 · the risk, named:
- [ ] Q5 · the reviewer read the diff (who, when):
- [ ] `lessons.md` updated — only if something surprised us
