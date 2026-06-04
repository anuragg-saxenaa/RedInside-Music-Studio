#!/bin/bash
# Build + install the macOS desktop app (Tauri) WITHOUT the Clerk login screen.
#
# THE GOTCHA: Vite env priority is .env.local > .env.production. If .env.local
# (which holds VITE_CLERK_PUBLISHABLE_KEY for web dev) is present during the
# desktop build, the Clerk key leaks in → CLERK_ON=true → login screen appears
# (and loops, because Google OAuth is blocked in the embedded webview).
#
# This script moves .env.local aside for the build, then restores it. Always use
# this instead of running `npm run tauri:build` directly for desktop.
set -e
cd "$(dirname "$0")/.."

export PATH="/opt/homebrew/bin:$PATH"
. "$HOME/.cargo/env" 2>/dev/null || true

API_BASE="https://redinside-music-studio-production.up.railway.app"
DESKTOP_TOKEN="5aae34f9855442a8a3e3fce79c820d15918666fbf471dfff"

echo "==> Quitting running app…"
osascript -e 'quit app "RedInside Studio"' 2>/dev/null || true
sleep 1

echo "==> Moving .env.local aside (prevents Clerk key leak)…"
MOVED=0
if [ -f .env.local ]; then mv .env.local /tmp/ris-env.local.bak && MOVED=1; fi

cat > .env.production <<EOF
VITE_API_BASE_URL=${API_BASE}
VITE_DESKTOP_TOKEN=${DESKTOP_TOKEN}
VITE_TAURI=1
VITE_CLERK_PUBLISHABLE_KEY=
VITE_DESKTOP_USER_NAME=Anurag Saxena
VITE_DESKTOP_USER_EMAIL=anuragsaxena.ai@gmail.com
EOF

echo "==> Building web bundle…"
npm run build

# Sanity: a real key looks like pk_live_<20+ chars>. The bare substring pk_live_
# exists in Clerk's SDK and is NOT a leak.
if grep -oq "pk_live_[A-Za-z0-9]\{15,\}" dist/assets/index-*.js 2>/dev/null; then
  echo "⚠️  A real Clerk key is baked into the bundle — login WILL appear. Aborting."
  rm -f .env.production; [ "$MOVED" = 1 ] && mv /tmp/ris-env.local.bak .env.local
  exit 1
fi
echo "✓ No real Clerk key in bundle"

echo "==> Building Tauri app…"
npm run tauri:build

rm -f .env.production
[ "$MOVED" = 1 ] && mv /tmp/ris-env.local.bak .env.local && echo "✓ Restored .env.local"

echo "==> Installing to /Applications…"
rm -rf "/Applications/RedInside Studio.app"
cp -R "src-tauri/target/release/bundle/macos/RedInside Studio.app" "/Applications/"
xattr -dr com.apple.quarantine "/Applications/RedInside Studio.app" 2>/dev/null || true

echo "✓ Desktop installed — no login screen."
