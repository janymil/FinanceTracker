# Moving Kaptia from pm2 into containers

Status: **decided, not started.** The owner wants containers ("the gold standard"); the reason it is
still on pm2 is scheduling, not preference. Nothing here has been executed.

## What is true today (verified 2026-10-27)

```
Cloudflare  →  Caddy (host, /etc/caddy/Caddyfile:96)
                 kaptia.app { reverse_proxy 127.0.0.1:5000 }
           →  pm2 process "kaptia" (user svc-kaptia, fork mode)
           →  node dist/index.js   (listening 127.0.0.1:5000)
```

No Kaptia container or image exists on the host. Docker here runs other sites plus one Postgres
container used by the tests (`kaptia-test-db`). The repo has never contained a Dockerfile.

## Why the move is right, in this repository's own history

Two incidents on this host would not have happened inside an image:

1. **Production served Node 24 while every green build certified Node 22.** The runtime was whatever
   the host had. An image pins the runtime, so "it passed in CI" and "it runs in production" are the
   same statement.
2. **The daily dump used `pg_dump` 16 against a PostgreSQL 17 server.** The client version came from
   the host's package manager. The fix was a hand-pinned binary path in a systemd drop-in. An image
   carries the client with the job.

Two more that matter for a money app:

3. **Rollback is currently a moved directory.** `deploy.sh` keeps `dist.backup-*` and swaps folders.
   With images, rollback is "start the previous tag" — no half-swapped tree, no stale asset guesswork.
4. **Isolation.** Seven other projects share this host's ports, its package manager and its global
   binaries. A container makes the app's world explicit and small.

## The traps, specific to this app

These are the reasons this is not a ten-minute change, and each one has a known answer.

| Trap | Answer |
|---|---|
| Caddy points at `127.0.0.1:5000`, which pm2 currently owns | Rehearse on `5051`; switch the Caddyfile line only when the health gate passes |
| `/api/health` reports `.release`, a file written by `deploy.sh` | Pass `RELEASE_ID` as an environment variable and teach `server/release.ts` to prefer it (small change), or mount the file |
| The build needs devDependencies (`vite`, `esbuild`) | Two stages: builder with `npm ci`, runtime with `npm ci --omit=dev` and only `dist/` |
| Five systemd timers run `tsx scripts/…` from `/var/www/kaptia` | Keep them host-side at first (they are infrastructure jobs: dump, prune, billing reconcile, health, uptime). Moving them is a second, separate change |
| `db-dump` needs `pg_dump` **matching the server major** | If it stays host-side it keeps the pinned 17 binary; if it moves, the image must carry the same client |
| Receipts and exports go to R2, not disk | No upload volume needed — but the local-disk fallback would need one, so decide that on purpose |
| `max_memory_restart: 700M` in pm2 | Becomes a container memory limit; without it, a leak now feeds the kernel OOM killer instead of restarting one process |
| Logs currently go through pm2 | `docker logs` with `json-file` rotation, or the container log grows until the disk is full |
| `/api/health/deep` is the deploy gate | The image needs its own healthcheck (the slim image has no `curl`; use `node -e "fetch(...)"`) |

## The order I would do it in

1. `Dockerfile` (multi-stage) + `.dockerignore` + `docker-compose.yml` with `env_file: .env`,
   `NODE_ENV=production`, `HOST=0.0.0.0`, `restart: unless-stopped`, memory limit, log rotation.
2. `RELEASE_ID` support in `server/release.ts`, so the health stamp survives containerisation.
3. Build and start on **5051** while pm2 keeps 5000. Run the full browser suite against 5051 and the
   readiness gate; the only expected difference is the release stamp.
4. Switch the Caddyfile upstream to the container, reload Caddy (no downtime on a single line).
5. `pm2 stop kaptia && pm2 delete kaptia` — the app is now exclusively the container. Keep the old
   `dist/` for a day.
6. Rewrite `deploy.sh` to: run the tests, `docker build` tagged with the release id, `compose up -d`,
   health gate, and keep the previous tag instead of `dist.backup-*`.
7. Re-point the host-side timers at nothing that the container also does, so no job runs twice.
8. Update `check:readiness` (`release-deployed` should compare the running **image tag**, not a file).

## Rollback while it is still fresh

Both are one command, and that is the point of doing it this way:

- Container bad → `docker compose up -d` with the previous image tag.
- Container path unusable → point Caddy back at `127.0.0.1:5000`, `pm2 start kaptia`. The old tree
  is untouched until step 5 is a day old.
