# Kaptia monitoring (systemd timers)

This server **does not have cron installed** (`cron.service` does not exist; production checks
would silently never run). The timers below are the live configuration — the copies in this
folder are the source of truth so a rebuilt server can be restored.

| Timer | Runs | What it does |
|---|---|---|
| `kaptia-uptime.timer` | every 5 min | `scripts/uptime-check.ts`: API + database + public page; writes a `job_runs` row (visible in Admin → Watch) and e-mails `ERROR_GUARD_ALERT_EMAIL` on failure |
| `kaptia-health.timer` | hourly | `scripts/healthcheck.ts --deep --max-latency 3000`: catches "up but slow" |
| `kaptia-prune.timer` | daily 04:30 | `scripts/error-guard-prune.ts --days=30`: retention for error evidence |

## Install (on a fresh server)

```bash
sudo cp ops/kaptia-monitoring/*.service ops/kaptia-monitoring/*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now kaptia-uptime.timer kaptia-health.timer kaptia-prune.timer
systemctl list-timers 'kaptia*'
```

Logs: `/var/log/kaptia-uptime.log`, `/var/log/kaptia-health.log`, `/var/log/kaptia-prune.log`
(rotated weekly by `/etc/logrotate.d/kaptia`).

## Notes

- All services run with `NODE_ENV=production`, so the scripts use `DATABASE_URL_PROD` — the
  same database the app uses. Without it they would quietly check the development database.
- The scripts exit by themselves. A monitor that hangs would accumulate one process and one
  database connection per tick.
- E-mail is a nice-to-have here, not the alarm: `job_runs` is the durable channel because the
  mailer itself can be broken. `/api/health/deep` reports `checks.email.status` too.
