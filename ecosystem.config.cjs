/**
 * Production process definition for this machine.
 *
 * `pm2 start ecosystem.config.cjs` — kept in the repo so the start command, the bind address
 * and the shutdown grace period are reviewable instead of living in a shell history.
 *
 * HOST=127.0.0.1 is deliberate: Caddy on this host is the only intended way in. The app used to
 * bind every interface, which left it reachable on the host's own address whenever a firewall
 * rule changed. Do not raise this to 0.0.0.0 here.
 */
module.exports = {
  apps: [
    {
      name: "kaptia",
      cwd: "/var/www/kaptia",
      script: "npm",
      args: "start",
      // `npm start` already sets NODE_ENV=production; the explicit value stops
      // `pm2 restart --update-env` from inheriting a development shell.
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
      },
      // The server finishes in-flight work and returns pooled connections on SIGTERM; pm2's
      // 1.6 s default would cut that short (see the note above the shutdown handler).
      kill_timeout: 12000,
      // A ceiling on the process, not on the host. The app keeps per-user state in memory
      // (rate-limit buckets, QR upload sessions, live-update streams, the AI concurrency
      // counter). Without a limit, a leak ends as the kernel's OOM killer — which also takes
      // whatever else it finds — instead of a clean restart of this one process.
      max_memory_restart: "700M",
      autorestart: true,
      max_restarts: 20,
      restart_delay: 2000,
    },
  ],
};
