#!/usr/bin/env bash
# The gate. Run this before claiming a change is done.
#
#   ./verify.sh              every "gate" step in .devkit/profile.sh
#   ./verify.sh --all        also the "slow" steps (builds, end-to-end suites)
#   ./verify.sh --only tests one step by name
#   ./verify.sh --list       show the steps and exit
#
# Output is deliberately short: a passing step prints one line, a failing step prints its
# last lines and stops. A gate nobody can read is a gate nobody runs.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE" || exit 1

# Every runner below must run once and exit, never open a watcher.
export CI=1
export PLAYWRIGHT_HTML_OPEN=never

STEP_TIMEOUT="${DEVKIT_STEP_TIMEOUT:-900}"
RUN_SLOW=0
ONLY=""
FILTER_TAG="gate"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --all) RUN_SLOW=1; shift ;;
    --only) ONLY="${2:-}"; shift 2 ;;
    --list) LIST_ONLY=1; shift ;;
    -h|--help) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "verify: unknown argument $1" >&2; exit 2 ;;
  esac
done

[ "$RUN_SLOW" = "1" ] && FILTER_TAG=""

if [ ! -f .devkit/profile.sh ]; then
  echo "verify: .devkit/profile.sh is missing." >&2
  echo "        Recreate it with: /opt/devkit/bin/devkit-detect \"$HERE\" > .devkit/profile.sh" >&2
  exit 2
fi
# shellcheck disable=SC1091
. .devkit/profile.sh

if [ "${#DEVKIT_STEPS[@]}" -eq 0 ]; then
  echo "verify: ${DEVKIT_APP_NAME:-this app} has no steps configured in .devkit/profile.sh."
  echo "        That is not a pass — add the app's own commands."
  exit 2
fi

if [ "${LIST_ONLY:-0}" = "1" ]; then
  for step in "${DEVKIT_STEPS[@]}"; do
    printf '  %-12s %-8s %s\n' "${step%%|*}" "$(echo "$step" | cut -d'|' -f3)" "$(echo "$step" | cut -d'|' -f2)"
  done
  exit 0
fi

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

passed=()
failed=()
skipped=()
started_all=$(date +%s)

for step in "${DEVKIT_STEPS[@]}"; do
  name="${step%%|*}"
  rest="${step#*|}"
  cmd="${rest%|*}"
  tag="${rest##*|}"

  if [ -n "$ONLY" ] && [ "$name" != "$ONLY" ]; then continue; fi
  if [ -z "$ONLY" ] && [ -n "$FILTER_TAG" ] && [ "$tag" != "$FILTER_TAG" ]; then
    skipped+=("$name")
    continue
  fi

  printf '%-12s ' "$name"
  log="$tmpdir/$name.log"
  started=$(date +%s)

  # A step that cannot finish must not hold the gate forever.
  if command -v timeout >/dev/null 2>&1; then
    timeout "$STEP_TIMEOUT" bash -c "$cmd" >"$log" 2>&1
  else
    bash -c "$cmd" >"$log" 2>&1
  fi
  code=$?
  took=$(( $(date +%s) - started ))

  if [ "$code" -eq 0 ]; then
    echo "ok (${took}s)"
    passed+=("$name")
  elif [ "$code" -eq 124 ]; then
    echo "TIMEOUT after ${STEP_TIMEOUT}s"
    tail -n 20 "$log" | sed 's/^/    /'
    failed+=("$name")
    break
  else
    echo "FAILED (${took}s, exit $code)"
    tail -n 40 "$log" | sed 's/^/    /'
    failed+=("$name")
    break
  fi
done

echo
if [ "${#failed[@]}" -gt 0 ]; then
  echo "VERIFY FAILED — ${failed[*]}  (${#passed[@]} passed, first failure shown above)"
  echo "Fix the first failure and re-run. Nothing is done yet."
  echo "Definition of done: .devkit/DONE.md"
  exit 1
fi

echo "VERIFY OK — ${#passed[@]} step(s) in $(( $(date +%s) - started_all ))s: ${passed[*]}"
if [ "${#skipped[@]}" -gt 0 ]; then
  echo "Not run (slow): ${skipped[*]} — before shipping, run ./verify.sh --all"
fi
echo
echo "One step left that no script can do: the reviewer pass in .devkit/DONE.md."
