# Secrets policy — what protects what

Written for this repo (`/var/www/kaptia`, Node + Vite + Postgres, deployed as a
long-running process from `dist/`). Read this before handing the box to an AI agent.

## The one rule

An ignore file is a **request**, not a control. If an agent can run shell commands
as the user that owns `.env`, it can read `.env` — no matter what patterns you add.

## Verified facts about the current setup (Cline 4.1.25)

| Mechanism | Blocks the agent? | Notes |
| --- | --- | --- |
| `.clineignore` | **No** | Not implemented. The literal string `.clineignore` does not occur in `dist/extension.js`; only a legacy `clineignore_error` telemetry enum is left. Creating the file does nothing. |
| `.claude/settings.json` → `permissions.deny` | Best effort | The 4.1.25 bundle does contain this schema (and the host does read project settings), but on 2026-10-25 a `Read(...)` deny rule was **not** applied to `read_files` in a live session - it needs at least a task/window reload. Treat as advisory until you have proven otherwise on your build. |
| `sandbox.filesystem.denyRead` | **Yes, once installed** | Enforced by the OS filesystem layer (bubblewrap on Linux), so it covers `cat`/`grep` too, not just the file tools. Needs `bubblewrap` installed; `failIfUnavailable: true` makes it fail closed instead of silently running unsandboxed. |
| `.gitignore` | No | Protects git only. Already covers `.env`, `.env.*` (except `.env.example`), `*.pem`, `*.key`, `service-account*.json`, `gcp-*.json`. |
| `.clinerules/*.md` | Advisory | Injected into every prompt (`.clinerules/secrets.md`). Followed probabilistically, bypassed by any `cat`/`grep`/`git show`. |
| Auto-approve "off" | Partly | Every tool call needs a click, so a human sees `cat .env` before it runs. Keep auto-approve disabled for shell commands. |
| `chmod 600` as `root` | No | The agent here runs as root, and root bypasses file permissions. Only helps once the app runs as its own user **and** the agent does not. |
| Container / VM without the secret | **Yes** | The only structural answer: the secret is not in the filesystem the agent can see. |

## The Claude Code answer (and how to get it in Cline)

Claude Code "just works" because its harness checks a deny list **before** every tool
call — not because of any ignore file:

```json
{ "permissions": { "deny": ["Read(./.env)", "Read(./.env.*)"] } }
```

Cline 4.1.25 accepts the same `.claude/settings.json` (the bundle ships the whole Claude
Code settings schema, `sandbox.filesystem.denyRead` included), and this repo now has that
file. Two caveats:

1. **Reload before trusting it.** On 2026-10-25 a `Read(...)` deny was not honoured by a
   session that had started before the file existed. Test it yourself: add a rule for a
   harmless file, try to read it, remove the rule.
2. **`Read()` denials gate the file tools only.** `cat .env` is stopped by the filesystem
   sandbox, which on Linux needs bubblewrap (not installed on this box):

```bash
apt-get install -y bubblewrap        # 0.9.0 is in noble-updates
# then in .claude/settings.json set: "sandbox": { "enabled": true }
```

`"failIfUnavailable": true` makes the agent refuse to run commands when the sandbox cannot
start, instead of silently running them unsandboxed.

## Layering, strongest first

1. **Never put the secret where the agent lives.** Inject at process start:
   ```bash
   # Doppler / Infisical
   doppler run -- npm start
   # 1Password: .env.op holds op://vault/item/field references, not values
   op run --env-file=.env.op -- npm run dev
   # sops + age: ciphertext in git, key only in the operator's 1Password
   sops exec-env secrets.enc.yaml 'npm start'
   ```
   The agent can read the *ciphertext* or the `op://` pointer; both are useless.
2. **Run the app and the agent as different unix users.** Production env lives in
   `/etc/kaptia/app.env`, mode `600`, owner `kaptia`. The agent's user is never in
   group `kaptia` and has no `sudo`/`NOPASSWD` entry. Then `read_files`,
   `run_commands` and `search_codebase` all hit `EACCES`.
3. **Docker secrets / systemd credentials** if the app is containerised:
   `docker run --env-file /root/app.env` or `--secret`, or
   `LoadCredential=env:/etc/kaptia/app.env` + `$CREDENTIALS_DIRECTORY`.
4. **Keep only test-mode credentials on dev machines.** Stripe `sk_test_*`,
   MercadoPago test users, a Clerk dev instance, a Neon branch database. A leaked
   test key costs nothing; that is what `.env.example` documents.
5. **Guardrails against accidents:** `.clinerules/secrets.md`, `.gitignore`,
   and a `gitleaks` pre-commit hook:
   ```bash
   git config core.hooksPath .githooks   # or: pre-commit install
   gitleaks protect --staged --redact
   ```

## Rotate before you build a process

Anything an agent has already read is exposed. Treat these as burnt and rotate,
in this order of urgency: `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `GROQ_API_KEY`,
`MISTRAL_API_KEY`, `AI_PROCESSOR_API_KEY`, `PDF_API_KEY`, `CLERK_SECRET_KEY`,
`STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`, `MERCADOPAGO_ACCESS_TOKEN`,
`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`, the Google service account,
`EMAIL_PASS`/`ZOHO_APP_PASSWORD`, `ADMIN_PASSWORD`, `SESSION_SECRET`.

**Never rotate `ENCRYPTION_KEY` casually**: every encrypted column was written with
it, and a new key makes that data unreadable (`server/encryption.ts`,
`server/encryptionDiagnostics.ts`). Rotating it means decrypt-with-old →
re-encrypt-with-new, on purpose, with a backup. The recovery side of this — where the
copies live, what to do when one is lost, and how to prove a restore is readable — is
`docs/recovery-runbook.md`.

## Housekeeping specific to this checkout

- Delete the plaintext duplicates that widen the blast radius:
  `.env.bak-20261025-053818`, `.env.stripe-sandbox`, `client/.env`,
  `client/.env.local`. Only `.env` should exist (plus `.env.example`).
  Vite only inlines `VITE_*`, so the server secrets copied into `client/.env`
  are dead weight — another file to leak.
- `.env` was never committed to git (verified), so no history rewrite is needed.
- `.env.example` is tracked and contains dummies only; keep it that way:
  ```bash
  # before every commit: no real value may appear in the example
  grep -c . .env.example   # exists, and review the diff
  ```
