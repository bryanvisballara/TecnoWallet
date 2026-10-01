#!/usr/bin/env bash
# Sync apps/mobile/android from app.config.js / plugins (clean regen).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
export ANDROID_HOME="${ANDROID_HOME:-${HOME}/Library/Android/sdk}"

cd "$ROOT/apps/mobile"
# Do not use --clean here unless native config/plugins changed; it wipes local.properties.
corepack yarn expo prebuild --platform android

STYLES="$ROOT/apps/mobile/android/app/src/main/res/values/styles.xml"
if [[ -f "$STYLES" ]]; then
  perl -0pi -e 's/\s*<item name="android:windowSplashScreenBehavior">icon_preferred<\/item>\s*//g' "$STYLES"
fi

LOCAL_PROPS="$ROOT/apps/mobile/android/local.properties"
if [[ -d "$ANDROID_HOME" ]]; then
  printf 'sdk.dir=%s\n' "$ANDROID_HOME" >"$LOCAL_PROPS"
  echo "Wrote $LOCAL_PROPS"
else
  echo "Note: set sdk.dir in android/local.properties after installing the SDK."
fi

echo "Done. Run: bash $ROOT/scripts/dev-android.sh"
