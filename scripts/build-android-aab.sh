#!/usr/bin/env bash
# Production Android App Bundle → HOST/tecnowallet-play.aab
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/apps/mobile"
ANDROID="$MOBILE/android"
CRED="$MOBILE/credentials/android"
export ANDROID_HOME="${ANDROID_HOME:-${HOME}/Library/Android/sdk}"
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

if [[ ! -f "$CRED/tecnowallet-upload.jks" ]]; then
  echo "Missing Play upload keystore: $CRED/tecnowallet-upload.jks"
  echo "See credentials/android/LEEME.txt"
  exit 1
fi

# storeFile is resolved from android/app/ — use absolute path.
KS_ABS="$CRED/tecnowallet-upload.jks"
write_keystore_props() {
  cat >"$ANDROID/keystore.properties" <<EOF
storeFile=${KS_ABS}
storePassword=$(grep '^storePassword=' "$CRED/keystore.properties" | cut -d= -f2-)
keyAlias=$(grep '^keyAlias=' "$CRED/keystore.properties" | cut -d= -f2-)
keyPassword=$(grep '^keyPassword=' "$CRED/keystore.properties" | cut -d= -f2-)
EOF
  chmod 600 "$ANDROID/keystore.properties"
}
write_keystore_props

cd "$MOBILE"
echo "Syncing android/ from app.config…"
corepack yarn expo prebuild --platform android

STYLES="$ANDROID/app/src/main/res/values/styles.xml"
if [[ -f "$STYLES" ]]; then
  perl -0pi -e 's/\s*<item name="android:windowSplashScreenBehavior">icon_preferred<\/item>\s*//g' "$STYLES"
fi

write_keystore_props

printf 'sdk.dir=%s\n' "$ANDROID_HOME" >"$ANDROID/local.properties"

cd "$ANDROID"
echo "Building release AAB (bundleRelease)…"
./gradlew bundleRelease --no-daemon

OUT="$ANDROID/app/build/outputs/bundle/release/app-release.aab"
DEST="$ROOT/HOST/tecnowallet-play.aab"
mkdir -p "$ROOT/HOST"
cp "$OUT" "$DEST"

SHA1=$(keytool -printcert -jarfile "$DEST" 2>/dev/null | awk -F': ' '/SHA1:/ {print $2; exit}')
VERSION="$(node -p "require('$MOBILE/app.json').expo.version")"
CODE="$(node -p "require('$MOBILE/app.json').expo.versionCode")"
echo ""
echo "Done: $DEST"
echo "versionName=$VERSION versionCode=$CODE"
echo "AAB SHA1: $SHA1"
echo "Play expects upload cert SHA1: 1D:31:41:D9:7E:DC:DB:B2:AA:BD:C2:11:54:55:75:48:AE:6A:A4:5C"
