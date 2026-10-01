#!/usr/bin/env bash
# Regenerate android/ if needed, set SDK path, install debug build on device/emulator.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
unset CI
export CI=false
export ANDROID_HOME="${ANDROID_HOME:-${HOME}/Library/Android/sdk}"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

if [[ ! -d "$ANDROID_HOME" ]]; then
  echo "Android SDK not found at $ANDROID_HOME"
  echo "Install Android Studio or set ANDROID_HOME to your SDK path."
  exit 1
fi

LOCAL_PROPS="$ROOT/apps/mobile/android/local.properties"
mkdir -p "$(dirname "$LOCAL_PROPS")"
if [[ ! -f "$LOCAL_PROPS" ]] || ! grep -q '^sdk.dir=' "$LOCAL_PROPS" 2>/dev/null; then
  printf 'sdk.dir=%s\n' "$ANDROID_HOME" >"$LOCAL_PROPS"
fi

cd "$ROOT/apps/mobile"
if [[ ! -f android/app/build.gradle ]]; then
  echo "Running expo prebuild --platform android …"
  corepack yarn expo prebuild --platform android
fi

DEVICE_NAME=""
if command -v adb >/dev/null 2>&1; then
  DEVICE_LINE="$(adb devices -l | awk 'NR>1 && $2=="device" { print; exit }')"
  if [[ -n "$DEVICE_LINE" ]]; then
    adb reverse tcp:8081 tcp:8081 2>/dev/null || true
    DEVICE_NAME="$(sed -n 's/.*model:\([^ ]*\).*/\1/p' <<<"$DEVICE_LINE")"
  fi
fi

cd "$ROOT"
if [[ -n "$DEVICE_NAME" ]]; then
  exec corepack yarn workspace tecnowallet-mobile android --device "$DEVICE_NAME"
fi
exec corepack yarn workspace tecnowallet-mobile android
