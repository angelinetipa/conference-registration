#!/bin/bash
# One-click: seed Neon + deploy Vercel + open live site. Run on your Mac in Terminal.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"

if [[ -f "$ROOT/.tools/node/bin/node" ]]; then
  export PATH="$ROOT/.tools/node/bin:$PATH"
fi

source "$ROOT/.neon.env"
AUTH_SECRET="Oq6Wx9key3uOVrvr02LajtvJQkSQuGXgd7fRY+By6oE="

echo "=== 1/4 Database: push schema + demo users ==="
export DATABASE_URL
export AUTH_SECRET
# Prisma must not read local sqlite .env
env -i HOME="$HOME" PATH="$PATH" \
  DATABASE_URL="$DATABASE_URL" \
  AUTH_SECRET="$AUTH_SECRET" \
  npx prisma db push --accept-data-loss
env -i HOME="$HOME" PATH="$PATH" \
  DATABASE_URL="$DATABASE_URL" \
  AUTH_SECRET="$AUTH_SECRET" \
  node prisma/seed.mjs
echo "Demo users ready in Neon."

echo ""
echo "=== 2/4 Vercel login (browser opens if needed) ==="
npx vercel@latest login

echo ""
echo "=== 3/4 Link project + env vars ==="
npx vercel@latest link --yes 2>/dev/null || npx vercel@latest link

add_env() {
  local name="$1" val="$2"
  npx vercel@latest env rm "$name" production -y 2>/dev/null || true
  printf '%s' "$val" | npx vercel@latest env add "$name" production
}
add_env DATABASE_URL "$DATABASE_URL"
add_env AUTH_SECRET "$AUTH_SECRET"

echo ""
echo "=== 4/4 Production deploy ==="
DEPLOY_URL=$(npx vercel@latest --prod --yes 2>&1 | tee /dev/stderr | grep -oE 'https://[a-z0-9.-]+\.vercel\.app' | tail -1)
if [[ -z "${DEPLOY_URL:-}" ]]; then
  echo "Could not parse deploy URL. Check Vercel dashboard for the green deployment link."
  exit 1
fi

add_env NEXT_PUBLIC_APP_URL "$DEPLOY_URL"
npx vercel@latest --prod --yes >/dev/null

SEED_URL="${DEPLOY_URL}/api/setup/seed?key=${AUTH_SECRET}"
echo ""
echo "=== Done ==="
echo "Live site: $DEPLOY_URL"
echo "Bootstrap (if needed): $SEED_URL"
echo ""
echo "Demo logins:"
echo "  admin@conference.local / admin12345"
echo "  participant@conference.local / user12345"
open "$DEPLOY_URL/login" 2>/dev/null || true
