# Deploy live website (Neon + Vercel)

**Repo:** https://github.com/zeuswae/conference-registration

## Fastest — one double-click

1. In Neon: **Dashboard → Connect → Prisma** — copy the connection string.
2. Save it as `.neon.env` in the project folder:

   ```bash
   echo 'DATABASE_URL="postgresql://YOUR_STRING_HERE"' > /Users/shu/conference-registration/.neon.env
   ```

3. Double-click **`DEPLOY LIVE`** on your Desktop.

   - Signs in to GitHub + Vercel if needed (browser opens).
   - Pushes code to GitHub.
   - Deploys to Vercel with your Neon database.
   - Prints your **live URL** (e.g. `https://conference-registration.vercel.app`).

## Or — Terminal

```bash
cd /Users/shu/conference-registration
chmod +x scripts/deploy-now.sh
./scripts/deploy-now.sh
```

Paste your Neon connection string when asked.

## Manual (if script fails)

### 1. Push to GitHub

```bash
cd /Users/shu/conference-registration
gh auth login
git push origin main
```

### 2. Vercel

1. https://vercel.com/new → Sign in with GitHub  
2. Import **zeuswae/conference-registration**  
3. Environment variables:

| Name | Value |
|------|--------|
| `DATABASE_URL` | Neon Prisma connection string |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL (set after first deploy, then redeploy) |

4. **Deploy**

### Login on live site

- `admin@conference.local` / `admin12345`
