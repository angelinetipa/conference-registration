#!/bin/bash
# Push to GitHub + deploy to Vercel with Neon. Run once after signing up to Neon.
set -e
cd "$(dirname "$0")/.."
PROJECT="$(pwd)"
export PATH="$PROJECT/.tools/node/bin:$HOME/.local/bin:$PATH"

echo "=== Conference Portal — Deploy to live URL ==="

# 1. Neon connection string
if [ -f "$PROJECT/.neon.env" ]; then
  source "$PROJECT/.neon.env"
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo ""
  echo "Paste your Neon connection string (from console.neon.tech → Connect → Prisma):"
  read -r DATABASE_URL
fi

if [[ "$DATABASE_URL" != postgresql* ]]; then
  echo "Error: DATABASE_URL must start with postgresql://"
  exit 1
fi

AUTH_SECRET="${AUTH_SECRET:-$(openssl rand -base64 32 2>/dev/null || echo 'change-me-in-vercel-dashboard')}"

# 2. Push to GitHub
echo ""
echo "→ Pushing to GitHub..."
if ! gh auth status &>/dev/null; then
  echo "Sign in to GitHub:"
  gh auth login -h github.com -p https -w
fi
git add -A
git diff --cached --quiet || git commit -m "Deploy: production config"
git push origin main

# 3. Vercel CLI
if ! command -v vercel &>/dev/null; then
  npm install -g vercel@latest
fi
if ! vercel whoami &>/dev/null; then
  echo "Sign in to Vercel:"
  vercel login
fi

echo ""
echo "→ Deploying to Vercel..."
cd "$PROJECT"

vercel link --yes 2>/dev/null || vercel link

printf '%s' "$DATABASE_URL" | vercel env rm DATABASE_URL production -y 2>/dev/null || true
printf '%s' "$DATABASE_URL" | vercel env add DATABASE_URL production

printf '%s' "$AUTH_SECRET" | vercel env rm AUTH_SECRET production -y 2>/dev/null || true
printf '%s' "$AUTH_SECRET" | vercel env add AUTH_SECRET production

DEPLOY_URL=$(vercel --prod 2>&1 | tee /tmp/vercel-deploy.log | grep -oE 'https://[a-z0-9.-]+\.vercel\.app' | tail -1)

if [ -n "$DEPLOY_URL" ]; then
  printf '%s' "$DEPLOY_URL" | vercel env rm NEXT_PUBLIC_APP_URL production -y 2>/dev/null || true
  printf '%s' "$DEPLOY_URL" | vercel env add NEXT_PUBLIC_APP_URL production
  vercel --prod
fi

echo ""
echo "=============================================="
if [ -n "$DEPLOY_URL" ]; then
  echo "  LIVE WEBSITE: $DEPLOY_URL"
else
  echo "  Check deployment: https://vercel.com/dashboard"
  grep -i 'https://' /tmp/vercel-deploy.log | tail -3
fi
echo "  Admin: admin@conference.local / admin12345"
echo "=============================================="
