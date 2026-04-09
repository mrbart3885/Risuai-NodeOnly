#!/usr/bin/env bash
set -euo pipefail

REPO="mrbart3885/Risuai-NodeOnly"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

info()  { printf '\033[1;34m[INFO]\033[0m  %s\n' "$*"; }
warn()  { printf '\033[1;33m[WARN]\033[0m  %s\n' "$*"; }
error() { printf '\033[1;31m[ERROR]\033[0m %s\n' "$*"; exit 1; }

# ── Check current version ─────────────────────────────────────────────────────

CURRENT=""
if [ -f .installed-version ]; then
    CURRENT=$(cat .installed-version)
fi

if [ -z "$CURRENT" ]; then
    # Fallback: read from package.json
    CURRENT="v$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "unknown")"
fi

info "Current version: $CURRENT"

# ── Fetch latest release ───────────────────────────────────────────────────────

info "Checking for updates..."
RELEASE_JSON=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null \
    || wget -qO- "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null) \
    || error "Failed to fetch release info."

LATEST=$(echo "$RELEASE_JSON" | grep -o '"tag_name":[[:space:]]*"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$LATEST" ] || error "Could not determine latest version."

if [ "$CURRENT" = "$LATEST" ]; then
    info "Already up to date ($CURRENT)."
    exit 0
fi

info "New version available: $LATEST"

# ── Confirm ────────────────────────────────────────────────────────────────────

printf "Update from %s to %s? [Y/n]: " "$CURRENT" "$LATEST"
read -r answer
[ "$answer" = "n" ] || [ "$answer" = "N" ] && { info "Aborted."; exit 0; }

# ── Backup save/ ───────────────────────────────────────────────────────────────

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

if [ -d save ]; then
    info "Backing up save/ ..."
    cp -r save "$TMP_DIR/_save_backup"
fi

# ── Download and extract ───────────────────────────────────────────────────────

TARBALL_URL="https://github.com/$REPO/archive/refs/tags/$LATEST.tar.gz"

info "Downloading $LATEST..."
if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$TARBALL_URL" -o "$TMP_DIR/release.tar.gz"
else
    wget -qO "$TMP_DIR/release.tar.gz" "$TARBALL_URL"
fi

info "Extracting..."
tar -xzf "$TMP_DIR/release.tar.gz" -C "$TMP_DIR"
EXTRACTED_DIR=$(ls -d "$TMP_DIR"/Risuai-NodeOnly-* 2>/dev/null | head -1)
[ -d "$EXTRACTED_DIR" ] || error "Extraction failed."

# ── Replace files (preserve save/) ─────────────────────────────────────────────

info "Updating files..."

# Remove old app files but keep save/ and backups/
find "$SCRIPT_DIR" -mindepth 1 -maxdepth 1 ! -name 'save' ! -name 'backups' ! -name '.installed-version' -exec rm -rf {} +

# Move new files in
mv "$EXTRACTED_DIR"/* "$EXTRACTED_DIR"/.[!.]* "$SCRIPT_DIR/" 2>/dev/null || true

# Restore save/
if [ -d "$TMP_DIR/_save_backup" ]; then
    rm -rf "$SCRIPT_DIR/save"
    mv "$TMP_DIR/_save_backup" "$SCRIPT_DIR/save"
fi

# ── Rebuild ────────────────────────────────────────────────────────────────────

info "Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

info "Building..."
NODE_OPTIONS="--max-old-space-size=4096" pnpm build

echo "$LATEST" > "$SCRIPT_DIR/.installed-version"

info "Update complete! $CURRENT → $LATEST"
echo ""
echo "  Restart the server to apply the update:"
echo "    pnpm runserver"
echo ""
