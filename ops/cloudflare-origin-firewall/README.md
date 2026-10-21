# Cloudflare-only origin firewall (80/443)

Visitors still use your normal URLs; this only blocks people who try to reach the
**server IP directly**, bypassing Cloudflare.

```
visitor/browser/app ──► Cloudflare edge ──► origin 162.35.25.125:443 ──► Caddy ──► app
        (any IP)          (WAF, cache)        allowed: Cloudflare IPs only
        direct 162.35.25.125:443  ───────────► DROPPED
```

## Why

Every site on this VPS is proxied by Cloudflare (all zones use Cloudflare nameservers).
Without this rule, anybody can hit `https://162.35.25.125` / `http://162.35.25.125:80` with
the right `Host:` header and skip Cloudflare's WAF, rate limiting and caching. With it, only
Cloudflare's edge can open a connection to 80/443.

## What keeps working

- All public hostnames (`kaptia.app`, `ai-processor.formatika.dev`,
  `pdf-processor.formatika.dev`, `pepstool.com`, …) for every client on the internet.
- Loopback, RFC1918 (`10/8`, `172.16/12`, `192.168/16`), link-local and Tailscale
  (`100.64/10`) sources — so Docker containers and local scripts that call a public
  hostname still work.
- SSH (22), the direct app port 3000, and all other ports are untouched.
- Caddy/Let's Encrypt renewals: ACME HTTP-01 requests arrive through Cloudflare, so they
  come from Cloudflare IPs and are allowed.
- TCP 80/443 **and UDP 443** (HTTP/3) are filtered, so the origin cannot be reached
  directly over QUIC either.

## Install / update

```bash
cd /var/www/kaptia/ops/cloudflare-origin-firewall
install -m 755 cf-origin-firewall.sh /usr/local/sbin/cf-origin-firewall.sh
install -m 644 cf-origin-firewall.service cf-origin-firewall-refresh.service \
               cf-origin-firewall-refresh.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now cf-origin-firewall.service
systemctl enable --now cf-origin-firewall-refresh.timer
```

## Checks

```bash
/usr/local/sbin/cf-origin-firewall.sh status     # chain + packet counters
curl -sS https://pdf-processor.formatika.dev/health
curl -sS https://ai-processor.formatika.dev/health
# direct-to-origin must fail / time out:
curl -sS -m 5 --resolve pdf-processor.formatika.dev:443:162.35.25.125 \
  https://pdf-processor.formatika.dev/health
```

## Rollback

```bash
/usr/local/sbin/cf-origin-firewall.sh remove
systemctl disable --now cf-origin-firewall.service cf-origin-firewall-refresh.timer
```

## Notes

- Cloudflare's ranges are fetched from `https://www.cloudflare.com/ips-v4` /
  `ips-v6` on every apply, with a built-in fallback. The monthly timer refreshes them.
- If you ever add a domain that is **DNS-only** (grey cloud) on Cloudflare, or hosted
  elsewhere and pointed straight at this IP, its HTTP(S) traffic will be dropped. Put it
  behind Cloudflare (orange cloud) or add an exception to the `PRIVATE4`/range list in the
  script.
- This complements, not replaces, Cloudflare-side controls (rate limiting, WAF, Access).
