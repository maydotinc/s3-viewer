#!/usr/bin/env bash
set -euo pipefail

if ! command -v portless >/dev/null 2>&1; then
   echo "Installing portless globally..."
   npm install -g portless
else
   echo "portless already installed ($(portless --version))"
fi

echo "Ensuring local CA is trusted..."
portless trust

echo "Starting portless proxy on :443 (HTTPS, sudo required for privileged port)..."
portless proxy stop >/dev/null 2>&1 || true
sudo portless proxy start --port 443 --https

echo
echo "Done. Run \`pnpm dev\` — apps will be available at:"
echo "  https://web.localhost"
echo "  https://landing.localhost"
echo "  https://api.localhost"
