# Supabase Cloud Authentication & Multi-Device Sync Setup Guide

MTG Limited IQ uses Supabase for free, serverless authentication, administrative authorization, and offline-first cloud synchronization.

---

## 1. Create a Free Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and create an account.
2. Click **New project**, select your organization, and choose a project name (e.g. `mtg-limited-iq`).
3. Set a database password and choose your nearest region.
4. Wait ~2 minutes for the database to provision.

---

## 2. Run Database Migration Scripts

In your Supabase project dashboard, navigate to the **SQL Editor** tab (left sidebar icon with `>_`).

### A. Core Application Tables
1. Click **New query**.
2. Copy the content of [`supabase/schema.sql`](./schema.sql) and click **Run**.
3. **What this creates:**
   - `public.profiles`: User display names, avatars, and timestamps.
   - `public.user_stats`: XP, levels, quiz accuracy, and missed card telemetry.
   - `public.card_evaluations`: Individual card letter grades, notes, and pick priorities.
   - **Row-Level Security (RLS)**: Strictly isolates user evaluation records (`auth.uid() = user_id`).

### B. Admin & Telemetry Tables
1. Open a new query in the SQL Editor.
2. Copy the content of [`supabase/admin_schema.sql`](./admin_schema.sql) and click **Run**.
3. **What this creates:**
   - `public.app_admins`: Cryptographically protected administrator role records with `is_admin()` Security Definer RPC function.
   - `public.activity_logs`: Telemetry logs tracking feature engagement and system interaction volume.

### C. Universal 17Lands Telemetry Cache Table
1. Open a new query in the SQL Editor.
2. Copy the content of [`supabase/migrations/20260918000000_create_17lands_cache.sql`](./migrations/20260918000000_create_17lands_cache.sql) and click **Run**.
3. **What this creates:**
   - `public.seventeenlands_cache`: Central community cache for 17Lands Game-In-Hand win rates and ALSA pick telemetry to protect against external rate limits.

---

## 3. Configure Local Environment Variables

1. In your Supabase dashboard, go to **Project Settings** (gear icon) -> **API**.
2. Find:
   - **Project URL** (e.g., `https://irxgoelllogcyoiumxup.supabase.co`)
   - **Project API Keys** -> `anon` / `public` key (e.g., `sb_publishable_...`)
3. In your local project repository, create or update `.env`:
   ```bash
   cp .env.example .env
   ```
4. Configure `.env`:
   ```env
   VITE_SUPABASE_URL=https://irxgoelllogcyoiumxup.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_QNDNrOPhb_X_29OfIg_-_Q_OB7QJuhI
   VITE_GOOGLE_CLIENT_ID=887571958598-8apf1m4sv9mdva72ii8oqmh2vunt8e93.apps.googleusercontent.com
   ```
5. Restart your development server (`npm run dev`). The Navbar sync indicator will display `Synced ✓`!

---

## 4. Enable Authentication Providers

In the Supabase dashboard, navigate to **Authentication** -> **Providers**.

### A. Google OAuth & Google Identity Services (GSI)
To enable seamless Google Sign-In both locally on `localhost:5173` and in production:

1. **Google Cloud Console Settings**:
   - Navigate to [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
   - Under your OAuth 2.0 Web Client ID:
     - **Authorized JavaScript origins**:
       - `http://localhost:5173`
       - `http://localhost`
       - `https://mtg-limited-iq.com` (and your production domain)
     - **Authorized redirect URIs**:
       - `https://<your-project-id>.supabase.co/auth/v1/callback`
2. **Supabase Provider Settings**:
   - Go to Supabase Dashboard -> **Authentication** -> **Providers** -> **Google**.
   - Set **Client ID** and **Client Secret**.
   - Under **Authorized Client IDs**, paste your Web Client ID:
     `887571958598-8apf1m4sv9mdva72ii8oqmh2vunt8e93.apps.googleusercontent.com`
     *(Required for native Google Identity Services ID token verification via `signInWithIdToken`)*.
   - Toggle Google provider **ON** and click **Save**.
3. **Supabase Redirect URL Configuration**:
   - Go to Supabase Dashboard -> **Authentication** -> **URL Configuration**.
   - Under **Redirect URLs**, ensure the following are added:
     - `http://localhost:5173/**`
     - `http://localhost:5173`
     - `https://mtg-limited-iq.com/**`
     - `https://mtg-limited-iq.com`

### B. Localhost 1-Click Developer Access
When developing locally on `http://localhost:5173`, the LoginGate displays a dedicated:
- **`⚡ Dev Quick Login (Devon Byrd)`** button.
- Clicking this button bypasses external OAuth redirects and immediately authenticates you as `dbyrd1568@gmail.com` with full permanent administrative rights.

### C. Discord OAuth
1. Go to [Discord Developer Portal](https://discord.com/developers/applications).
2. Create an application, navigate to **OAuth2**, and add redirect URI:
   `https://<your-project-id>.supabase.co/auth/v1/callback`
3. Copy Client ID and Client Secret into Supabase -> **Authentication** -> **Providers** -> **Discord**.
4. Toggle Discord provider **ON** and save.

### D. Apple / Email & Password / Magic Link
- **Magic Link & Password**: Enabled by default in Supabase Auth.
- **Apple OAuth**: Add Service ID and Key with redirect URL `https://<your-project-id>.supabase.co/auth/v1/callback`.

---

## 5. Universal 17Lands Data Caching & Auto-Sync

To eliminate 17Lands API rate limiting when scaling to thousands of users, the platform employs a 3-tier caching model:

1. **Preloaded Memory Bundle**: Preloaded JSON telemetry for major formats (`HOB`, `DFT`, `FDN`, etc.) packaged directly with the app for frame-0 instant rendering.
2. **Cloudflare Worker Edge Cache**:
   - Proxies `/api/17lands/data/*` requests through Cloudflare's global edge (`caches.default`).
   - Stampede deduplication: concurrent requests for the same set share an in-flight fetch.
   - `stale-if-error`: serves cached telemetry if the upstream 17Lands server is unresponsive.
3. **Supabase Central Database Fallback**:
   - `seventeenlands_cache` table caches parsed datasets across all users.
4. **Automated Synchronization (GitHub Actions)**:
   - Daily cron workflow (`.github/workflows/sync-17lands.yml`) executes [`scripts/sync-17lands.ts`](../scripts/sync-17lands.ts).
   - **Active Set Calibration**:
     - Active format (`HOB`, `MBC`, upcoming `FRA`): Revalidated every 24 hours while on Arena.
     - Historical format (`DFT`, etc.): Revalidated every 7 days to detect Flashback draft runs.

---

## 6. Production Deployment (Cloudflare Pages)

1. Add environment variables in Cloudflare Pages / Workers Dashboard:
   - `VITE_SUPABASE_URL`: `https://irxgoelllogcyoiumxup.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: `sb_publishable_...`
   - `VITE_GOOGLE_CLIENT_ID`: `887571958598-8apf1m4sv9mdva72ii8oqmh2vunt8e93.apps.googleusercontent.com`
2. Deploy frontend:
   ```bash
   npm run build
   ```

