#!/usr/bin/env bash
# Build PocketRisu on Termux for smoke testing.
# Usage (from PocketRisu repo root): bash scripts/termux/build.sh
set -euo pipefail

if [ ! -f package.json ] || [ ! -d server/node ]; then
    echo "Run from the PocketRisu repo root."
    exit 1
fi

echo "[1/5] Installing Termux packages..."
pkg install -y nodejs-lts python make clang pkg-config tar curl

echo "[2/5] Enabling pnpm via corepack..."
corepack enable
corepack install --global pnpm@10

echo "[3/5] Termux wake lock (best effort)..."
termux-wake-lock 2>/dev/null || true

# Workaround for Termux nodejs-lts: its gyp config references android_ndk_path
# without defining it, so native module builds (better-sqlite3 etc.) fail with
# "Undefined variable android_ndk_path". Defining it as empty is harmless
# because we are not cross-compiling against the Android NDK.
export GYP_DEFINES="android_ndk_path=''"

echo "[4/5] Installing dependencies..."
pnpm install --frozen-lockfile

echo "[5/5] Building (may take a while)..."
NODE_OPTIONS="--max-old-space-size=2048" pnpm build

cat <<'EOF'

Build OK. Start the server with:
  node server/node/server.cjs

Then open this address in the phone's own browser:
  http://localhost:6001
EOF
