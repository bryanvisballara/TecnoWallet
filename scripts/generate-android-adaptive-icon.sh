#!/usr/bin/env bash
# Android adaptive icons crop ~17% per edge; keep artwork in the center ~66% safe zone.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/apps/mobile/assets/images/app-icon.png"
OUT="$ROOT/apps/mobile/assets/images/android-adaptive-foreground.png"
TMP="$(mktemp -t tw-android-icon.XXXXXX.png)"
trap 'rm -f "$TMP"' EXIT

cp "$SRC" "$TMP"
sips -z 672 672 "$TMP" >/dev/null
sips -p 1024 1024 --padColor FFFFFF "$TMP" >/dev/null
cp "$TMP" "$OUT"
echo "Wrote $OUT (672px art on 1024 canvas). Run: yarn prebuild:android && yarn dev:android"
