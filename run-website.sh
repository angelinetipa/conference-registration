#!/bin/bash
# Starts the conference portal and opens it in your browser.
set -e
cd "$(dirname "$0")"
PROJECT="$(pwd)"
export PATH="$PROJECT/.tools/node/bin:$PATH"

echo "Stopping old servers..."
for port in 3000 3001 3002 8080; do
  lsof -ti:$port 2>/dev/null | xargs kill -9 2>/dev/null || true
done
pkill -f "next start" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
sleep 2

PORT=3000
if lsof -ti:$PORT >/dev/null 2>&1; then
  echo "Port 3000 busy — using 3002 instead."
  PORT=3002
fi

if [ ! -x "$PROJECT/.tools/node/bin/npm" ]; then
  echo "First-time setup: downloading Node.js..."
  bash "$PROJECT/start.sh" &
  exit 0
fi

if [ ! -d "node_modules/next" ]; then
  echo "Installing packages..."
  npm install
fi

if [ ! -f "prisma/dev.db" ]; then
  npx prisma db push
  node prisma/seed.mjs
fi

# Fix broken Next.js cache (causes 500 errors)
if [ ! -f ".next/BUILD_ID" ]; then
  echo "Building website (first time, ~1 min)..."
  npm run build
fi

echo "Starting server on port $PORT..."
npm start -- -H 127.0.0.1 -p $PORT > /tmp/conference-portal.log 2>&1 &
sleep 4

if ! curl -sf -o /dev/null "http://127.0.0.1:$PORT/login"; then
  echo "Repairing build..."
  rm -rf .next
  npm run build
  lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
  sleep 1
  npm start -- -H 127.0.0.1 -p $PORT > /tmp/conference-portal.log 2>&1 &
  sleep 4
fi

URL="http://localhost:$PORT"
echo ""
echo "=============================================="
echo "  WEBSITE IS RUNNING"
echo "  $URL"
echo "=============================================="
echo "  Admin:  admin@conference.local / admin12345"
echo "  User:   participant@conference.local / user12345"
echo "  Stop:   press Ctrl+C or close Terminal"
echo "=============================================="
echo ""

open "$URL" 2>/dev/null || true
tail -f /tmp/conference-portal.log
