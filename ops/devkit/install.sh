#!/usr/bin/env bash
# install.sh — put devkit on this machine once, so every app under /var/www gets it.
#
#   sudo ./install.sh              install or update (safe to re-run)
#   sudo ./install.sh --uninstall  remove the watcher and the machine-wide rules
#                                  (the .devkit folders inside the apps are left alone)
#
# What "install" does, in order:
#   1. copies this folder to /opt/devkit
#   2. writes the loop rules into Cline's global rules and into ~/.claude/CLAUDE.md,
#      so a brand-new workspace is already covered before any folder exists
#   3. installs the systemd path unit (new folder under /var/www -> install) and a
#      15-minute sweep as insurance
#   4. runs one sweep immediately, so the apps that already exist get the kit now
set -uo pipefail

SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${DEVKIT_ROOT:-/opt/devkit}"
MODE="install"
[ "${1:-}" = "--uninstall" ] && MODE="uninstall"

# The human who runs the agent tools, not necessarily root.
RUN_USER="${SUDO_USER:-$(id -un)}"
RUN_HOME="$(getent passwd "$RUN_USER" | cut -d: -f6)"
CLINE_RULES="$RUN_HOME/Documents/Cline/Rules"
CLAUDE_MEMORY="$RUN_HOME/.claude/CLAUDE.md"
UNIT_DIR="/etc/systemd/system"

say() { printf '%s\n' "$*"; }
die() { printf 'install: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" = "0" ] || die "run this with sudo (it writes to /opt, /etc/systemd and $RUN_HOME)"
[ -n "$RUN_HOME" ] || die "cannot resolve the home directory for $RUN_USER"

# --- uninstall ---------------------------------------------------------------

if [ "$MODE" = "uninstall" ]; then
  systemctl disable --now devkit-sweep.timer devkit-bootstrap.path 2>/dev/null
  rm -f "$UNIT_DIR/devkit-bootstrap.path" "$UNIT_DIR/devkit-bootstrap.service" \
        "$UNIT_DIR/devkit-sweep.timer" "$UNIT_DIR/devkit-sweep.service"
  systemctl daemon-reload
  rm -f "$CLINE_RULES/devkit.md"
  # Take the block back out of the shared memory file, leaving everything else untouched.
  python3 - "$CLAUDE_MEMORY" <<'PY' 2>/dev/null
import sys
start, end = '<!-- devkit:begin -->', '<!-- devkit:end -->'
path = sys.argv[1]
try:
    text = open(path).read()
except FileNotFoundError:
    sys.exit(0)
if start in text and end in text:
    pre, post = text.split(start)[0], text.split(end, 1)[1]
    open(path, 'w').write((pre.rstrip('\n') + '\n' + post.lstrip('\n')).rstrip('\n') + '\n')
PY
  say "Watcher removed. Left in place on purpose:"
  say "  $DEST                   (re-run install.sh to bring it back)"
  say "  every app's .devkit/    (the app's own notes, plans and gate)"
  exit 0
fi

# --- 1. the kit --------------------------------------------------------------

[ -d "$SOURCE/templates" ] || die "templates/ is missing — run install.sh from the repo folder"

mkdir -p "$DEST"
rsync -a --delete --exclude 'state/' "$SOURCE/" "$DEST/" || die "copy to $DEST failed"
chmod 755 "$DEST"/bin/* "$DEST"/templates/verify.sh "$DEST"/install.sh 2>/dev/null
mkdir -p "$DEST/state"
say "kit       $DEST ($(cat "$DEST/VERSION" 2>/dev/null || echo dev))"

# --- 2. machine-wide rules ---------------------------------------------------

mkdir -p "$CLINE_RULES"
install -m 644 "$DEST/rules/devkit-loop.md" "$CLINE_RULES/devkit.md"
say "cline     $CLINE_RULES/devkit.md"

# The same rules inside a delimited block, so a re-run replaces it instead of appending twice.
mkdir -p "$(dirname "$CLAUDE_MEMORY")"
python3 - "$CLAUDE_MEMORY" "$DEST/rules/devkit-loop.md" <<'PY' || die "could not update $CLAUDE_MEMORY"
import os, sys
path, block_path = sys.argv[1], sys.argv[2]
start, end = '<!-- devkit:begin -->', '<!-- devkit:end -->'
body = open(block_path).read().rstrip('\n')
try:
    text = open(path).read()
except FileNotFoundError:
    text = ''
if start in text and end in text:
    text = text.split(start)[0] + start + '\n' + body + '\n' + end + text.split(end, 1)[1]
else:
    sep = '\n\n' if text.strip() else ''
    text = text.rstrip('\n') + sep + start + '\n' + body + '\n' + end + '\n'
open(path, 'w').write(text)
PY
say "claude    $CLAUDE_MEMORY (devkit block)"

# --- 3. the watcher ----------------------------------------------------------

install -m 644 "$DEST/systemd/devkit-bootstrap.path"    "$UNIT_DIR/"
install -m 644 "$DEST/systemd/devkit-bootstrap.service" "$UNIT_DIR/"
install -m 644 "$DEST/systemd/devkit-sweep.service"     "$UNIT_DIR/"
install -m 644 "$DEST/systemd/devkit-sweep.timer"       "$UNIT_DIR/"
systemctl daemon-reload || die "systemctl daemon-reload failed"
systemctl enable --now devkit-bootstrap.path devkit-sweep.timer >/dev/null 2>&1 \
  || say "warning: could not enable the units — check 'systemctl status devkit-bootstrap.path'"
say "watcher   devkit-bootstrap.path (PathModified=/var/www) + 15-min sweep"

# --- 4. backfill the apps that already exist --------------------------------

DEVKIT_ROOT="$DEST" DEVKIT_TRIGGER=install "$DEST/bin/devkit-bootstrap" --all | tail -n 40

say ""
say "Done. A new folder under /var/www now gets the kit by itself."
say "Check any time:  $DEST/bin/devkit-bootstrap --status"
say "In any app:      ./verify.sh"
