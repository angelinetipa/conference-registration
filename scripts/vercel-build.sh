#!/bin/bash
set -e
cd "$(dirname "$0")/.."

# Strip accidental quotes from Vercel env vars
export DATABASE_URL="${DATABASE_URL//\"/}"
export AUTH_SECRET="${AUTH_SECRET//\"/}"

if [[ "${DATABASE_URL:-}" == postgresql* ]]; then
  echo "Using PostgreSQL (Neon)..."
  node scripts/prepare-schema.mjs
  npx prisma generate
  npx prisma db push --accept-data-loss
  node prisma/seed.mjs || echo "Seed skipped (non-fatal)"
else
  echo "WARNING: DATABASE_URL is not set to postgresql:// — skipping db push/seed."
  echo "Set DATABASE_URL in Vercel → Settings → Environment Variables (direct Neon URL, not pooler)."
  npx prisma generate
fi

npx next build
