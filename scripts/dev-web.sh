#!/usr/bin/env bash
# Restart Expo web on :8081 with clean cache + file→reload sync for localhost.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
ulimit -n 65536 2>/dev/null || true

# Agents/CI often set CI=1 which changes Expo CLI behavior.
unset CI
export CI=false
export EXPO_NO_TELEMETRY=1

if PIDS="$(lsof -tiTCP:8081 -sTCP:LISTEN 2>/dev/null)"; then
  # shellcheck disable=SC2086
  kill $PIDS 2>/dev/null || true
  sleep 1
fi
pkill -f "expo start --web" 2>/dev/null || true
pkill -f "scripts/dev-web-sync.mjs" 2>/dev/null || true
sleep 1

# Stale static export is for Hostinger only — remove so it never shadows Metro.
rm -rf "$ROOT/apps/mobile/dist" 2>/dev/null || true

# lan binds 0.0.0.0 so both localhost and 127.0.0.1 work (Expo only allows lan|tunnel|localhost).
export EXPO_WEB_HOST="${EXPO_WEB_HOST:-127.0.0.1}"

cd "$ROOT"
node "$ROOT/scripts/dev-web-sync.mjs" &
SYNC_PID=$!
cleanup() {
  kill "$SYNC_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

exec corepack yarn workspace tecnowallet-mobile web --host lan --clear
