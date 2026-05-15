#!/usr/bin/env bash
# Generate a self-signed HTTPS certificate for PocketRisu so secure-context Web APIs
# (clipboard, crypto.subtle, etc.) work when accessed via Tailscale IP from a PC browser.
# Usage (from PocketRisu repo root): bash scripts/termux/setup-https.sh
set -euo pipefail

if [ ! -f server/node/ssl/server.conf ]; then
    echo "Run from the PocketRisu repo root."
    exit 1
fi

# Auto-detect Tailscale IP if `ip` is available and the interface is visible.
TS_IP=""
if command -v ip >/dev/null 2>&1; then
    TS_IP=$(ip -4 addr 2>/dev/null | grep -oP '(?<=inet\s)100\.\d+\.\d+\.\d+' | head -1)
fi

# Fall back to manual entry
if [ -z "$TS_IP" ]; then
    echo "Could not auto-detect a Tailscale IP."
    echo "Open the Tailscale Android app and copy this device's IP (100.x.x.x)."
    read -r -p "Tailscale IP: " TS_IP
fi

if [ -z "$TS_IP" ]; then
    echo "No IP provided. Aborting."
    exit 1
fi

if ! echo "$TS_IP" | grep -qE '^100\.[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "Warning: '$TS_IP' does not look like a Tailscale IP (expected 100.x.x.x). Continuing anyway."
fi

echo "Using Tailscale IP: $TS_IP"

cd server/node/ssl

# Idempotent SAN patching: remove any prior IP.N (N>=2), insert IP.2 = $TS_IP
sed -i '/^IP\.[2-9] = /d' server.conf
sed -i "/^IP\.1 = 127\.0\.0\.1$/a IP.2 = $TS_IP" server.conf

if ! command -v openssl >/dev/null 2>&1; then
    pkg install -y openssl
fi

bash "Generate Certificate.sh"

cat <<EOF

Done.

Restart the PocketRisu server (Ctrl+C and rerun 'node server/node/server.cjs'),
then access from your PC:
  https://${TS_IP}:6001

Your browser will warn once because the certificate is self-signed.
Click 'Advanced' -> 'Proceed to ...' to enter secure context.
After acceptance, clipboard / crypto / other secure-context APIs will work.
EOF
