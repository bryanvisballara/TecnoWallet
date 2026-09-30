#!/usr/bin/env bash
# Force ExpoModulesJSI.xcframework rebuild on next Xcode archive (after patch-package changes).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APPLE="${ROOT}/node_modules/expo-modules-jsi/apple"
if [[ ! -d "$APPLE" ]]; then
  echo "expo-modules-jsi not installed; run yarn install first." >&2
  exit 1
fi
rm -rf "${APPLE}/.DerivedData" "${APPLE}/.generated" "${APPLE}/.build" "${APPLE}/.swiftpm"
find "${APPLE}/Products" -name '.build-hash' -delete 2>/dev/null || true
echo "ExpoModulesJSI iOS build cache cleared."
