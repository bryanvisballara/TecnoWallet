#!/usr/bin/env bash
# Ensures API dist exists before starting (Render may skip/mismatch Build Command).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ ! -f apps/api/dist/main.js ]]; then
  echo "dist/main.js missing — building api..."
  YARN_PRODUCTION=false yarn workspace api build
fi
yarn workspace api start:prod
