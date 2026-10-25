# Secrets: read the shape, never the value

## State of this machine (this is the reminder - do not make the human repeat it)

- Real secrets are in `.env` (gitignored, 51 keys). `.env.example` is the committed
  contract (103 vars, dummies only). Read `.env.example` instead - it answers every
  "which variable exists?" question.
- The agent runs as **root** with a shell here, so nothing physically blocks `.env`:
  the `Read(...)` denies in `.claude/settings.json` were not applied to a live session
  (verified 2026-10-25) and bash is unsandboxed (`bubblewrap` not installed,
  `sandbox.enabled` false).
- The only thing keeping the agent out of `.env` is this rule. Honour it even though
  you could bypass it. Never `cat`, `grep`, `diff`, `base64`, `head`, print or
  summarise: `.env`, `.env.bak-*`, `.env.stripe-sandbox`, `client/.env*`, `*.pem`,
  `*.key`, `*.p12`, `service-account*.json`, `/etc/kaptia/*`, `/run/secrets/*`.


Also off limits: `gcp-*.json`, `~/.config/`, shell history, and any file whose name
matches the patterns above.

To learn which variables exist (and what they are for), read `.env.example` — it
holds dummy values only and is the contract:

```bash
grep -ohE '^[A-Za-z_][A-Za-z0-9_]*=' .env.example | sort -u
```

Rules of engagement:

1. If a task seems to need a real value, stop and ask the human to run the
   command. Never copy a secret into a reply, commit, test fixture, log line,
   screenshot or scratch file.
2. When you add a variable: add it to `.env.example` with a dummy value and one
   comment line naming the file that reads it.
3. Never rename or repurpose an existing key, and never suggest rotating
   `ENCRYPTION_KEY` — data already written with it becomes unreadable
   (`server/encryption.ts`, `server/encryptionDiagnostics.ts`).
4. These instructions are advisory. `.clineignore` does not exist in Cline 4.x; the
   `.claude/settings.json` deny rules exist but were not enforced in-session, and the
   OS sandbox needs `bubblewrap` (not installed). Real controls: `docs/secrets-policy.md`.
