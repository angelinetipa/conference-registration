#!/bin/bash
# Local server + temporary public HTTPS link (no Vercel account needed).
set -e
cd "$(dirname "$0")"
export PATH="$PWD/.tools/node/bin:$PATH"

# Start local server in background if not running
if ! curl -sf -o /dev/null http://127.0.0.1:3000/login 2>/dev/null; then
  ./run-website.sh &
  sleep 8
fi

CF="$PWD/.tools/cloudflared"
if [ ! -x "$CF" ]; then
  echo "Downloading cloudflared..."
  mkdir -p .tools
  curl -fsSL "https://github.com/cloudflare/cloudflared/releases/download/2025.2.0/cloudflared-darwin-arm64.tgz" -o /tmp/cf.tgz
  tar -xzf /tmp/cf.tgz -C .tools
fi

echo "Creating public link (keep this window open)..."
"$CF" tunnel --url http://127.0.0.1:3000 2>&1 | tee /tmp/cf-tunnel.log | while read -r line; do
  echo "$line"
  url=$(echo "$line" | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | head -1)
  if [ -n "$url" ]; then
    echo ""
    echo "=============================================="
    echo "  PUBLIC WEBSITE: $url"
    echo "=============================================="
    open "$url" 2>/dev/null || true
  fi
done
