#!/usr/bin/env bash
#
# Cloudflare-only origin firewall for HTTP(S).
#
# Purpose: ports 80/443 (TCP) and 443 (UDP/HTTP3) on this VPS accept connections ONLY
# from Cloudflare's edge, plus loopback / RFC1918 / Tailscale so local and container
# traffic keeps working. Visitors are NOT affected: they still reach the sites through
# Cloudflare, which then connects to the origin from a Cloudflare IP. The only thing that
# stops working is hitting http(s)://162.35.25.125 directly, bypassing Cloudflare.
#
# Usage: cf-origin-firewall.sh apply|remove|status
#
set -euo pipefail

CHAIN4="CF_ORIGIN_HTTP"
CHAIN6="CF_ORIGIN_HTTP6"
CF4_URL="https://www.cloudflare.com/ips-v4"
CF6_URL="https://www.cloudflare.com/ips-v6"

# Used when the download fails (Cloudflare's published ranges).
CF4_FALLBACK="173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20 197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13 104.24.0.0/14 172.64.0.0/13 131.0.72.0/22"
CF6_FALLBACK="2400:cb00::/32 2606:4700::/32 2803:f800::/32 2405:b500::/32 2405:8100::/32 2a06:98c0::/29 2c0f:f248::/32"

# Loopback, private networks and Tailscale are always allowed.
PRIVATE4="127.0.0.0/8 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 100.64.0.0/10 169.254.0.0/16"
PRIVATE6="::1/128 fc00::/7 fe80::/10"

PORTS_TCP="80,443"
PORTS_UDP="443"

IPT="iptables -w 10"
IP6T="ip6tables -w 10"

# Serialize runs: systemd and manual invocations must never interleave iptables calls.
exec 9>/run/cf-origin-firewall.lock
flock -w 30 9

fetch_ranges() {
  local url="$1" fallback="$2" ranges
  ranges="$(curl -fsS --max-time 10 "$url" 2>/dev/null | grep -E '^[0-9a-fA-F:.]+/[0-9]+$' | tr '\n' ' ' || true)"
  if [[ -z "${ranges// /}" ]]; then
    echo "warning: could not fetch $url, using built-in ranges" >&2
    ranges="$fallback"
  fi
  echo "$ranges"
}

has_ipv6() {
  ip -6 addr show scope global 2>/dev/null | grep -q 'inet6'
}

build_chain() {
  local cmd="$1" chain="$2" private="$3" ranges="$4" src
  $cmd -nL "$chain" >/dev/null 2>&1 || $cmd -N "$chain"
  $cmd -F "$chain"
  for src in $private $ranges; do $cmd -A "$chain" -s "$src" -j RETURN; done
  $cmd -A "$chain" -j DROP
}

verify_chain() {
  local cmd="$1" chain="$2" expected="$3" actual last
  actual="$($cmd -S "$chain" | grep -c '^-A')"
  last="$($cmd -S "$chain" | tail -1)"
  if [[ "$actual" -ne "$expected" || "$last" != *"-j DROP"* ]]; then
    echo "error: $chain has $actual rules (expected $expected) or DROP is not last" >&2
    $cmd -S "$chain" >&2
    exit 1
  fi
}

hook() {
  local cmd="$1" chain="$2" spec proto ports
  for spec in "tcp $PORTS_TCP" "udp $PORTS_UDP"; do
    proto="${spec%% *}"
    ports="${spec##* }"
    if ! $cmd -C INPUT -p "$proto" -m multiport --dports "$ports" -j "$chain" 2>/dev/null; then
      $cmd -I INPUT 1 -p "$proto" -m multiport --dports "$ports" -j "$chain"
    fi
  done
}

unhook() {
  local cmd="$1" chain="$2" spec proto ports
  for spec in "tcp $PORTS_TCP" "udp $PORTS_UDP"; do
    proto="${spec%% *}"
    ports="${spec##* }"
    while $cmd -C INPUT -p "$proto" -m multiport --dports "$ports" -j "$chain" 2>/dev/null; do
      $cmd -D INPUT -p "$proto" -m multiport --dports "$ports" -j "$chain"
    done
  done
}

apply() {
  local ranges4 ranges6 expected
  ranges4="$(fetch_ranges "$CF4_URL" "$CF4_FALLBACK")"
  expected=$(( $(echo "$PRIVATE4 $ranges4" | wc -w) + 1 ))

  build_chain "$IPT" "$CHAIN4" "$PRIVATE4" "$ranges4"
  verify_chain "$IPT" "$CHAIN4" "$expected"
  hook "$IPT" "$CHAIN4"

  if has_ipv6; then
    ranges6="$(fetch_ranges "$CF6_URL" "$CF6_FALLBACK")"
    expected=$(( $(echo "$PRIVATE6 $ranges6" | wc -w) + 1 ))
    build_chain "$IP6T" "$CHAIN6" "$PRIVATE6" "$ranges6"
    verify_chain "$IP6T" "$CHAIN6" "$expected"
    hook "$IP6T" "$CHAIN6"
  fi

  echo "applied: HTTP(S)+HTTP3 accept Cloudflare + private sources only (${expected} IPv4 chain rules)"
}

remove() {
  unhook "$IPT" "$CHAIN4"
  $IPT -nL "$CHAIN4" >/dev/null 2>&1 && $IPT -F "$CHAIN4" && $IPT -X "$CHAIN4" || true
  if $IP6T -nL "$CHAIN6" >/dev/null 2>&1; then
    unhook "$IP6T" "$CHAIN6"
    $IP6T -F "$CHAIN6" && $IP6T -X "$CHAIN6" || true
  fi
  echo "removed: origin accepts HTTP(S)+HTTP3 from any source again"
}

status() {
  echo "--- INPUT hooks (IPv4):"
  $IPT -S INPUT 2>/dev/null | grep -- "$CHAIN4" || echo "not installed"
  echo "--- $CHAIN4:"
  $IPT -L "$CHAIN4" -n -v 2>/dev/null || echo "chain missing"
  if $IP6T -nL "$CHAIN6" >/dev/null 2>&1; then
    echo "--- $CHAIN6:"
    $IP6T -L "$CHAIN6" -n -v
  fi
}

case "${1:-apply}" in
  apply) apply ;;
  remove) remove ;;
  status) status ;;
  *) echo "usage: $0 apply|remove|status" >&2; exit 2 ;;
esac
