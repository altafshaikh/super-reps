# SuperReps — Setup Guide

## 1. Environment Variables

**Runtime (web + mobile):** only **`EXPO_PUBLIC_*`** — the app talks to Postgres **through Supabase’s API** (`lib/supabase.ts`) with the **anon** key. You do **not** need a Postgres `DATABASE_URL` in the app for inserts or queries.

**`DATABASE_URL`:** optional, **local dev / one-off scripts only** — used by `npm run db:setup` to run SQL files against Postgres. Keep it in your private `.env` on your machine; **do not** add it to Vercel (static export does not run `db-setup`; exposing a DB password in hosted env vars is unnecessary risk).

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
EXPO_PUBLIC_GROQ_API_KEY=gsk_...
```

### Get your keys:
- **Supabase**: https://supabase.com → new project → Settings → API
- **Groq**: https://console.groq.com → API Keys → Create new key (free tier, very fast)

## 2. Supabase Database Setup

Pick **one** of the following.

### Option A — SQL Editor (no DB password in the project)

In Supabase **SQL Editor**, run these two files **in order**:

1. `supabase/schema.sql` — creates all tables, RLS policies, indexes  
2. `supabase/seed_exercises.sql` — seeds 100 exercises  

Paste each file’s contents, run, then repeat for the second file.

### Option B — CLI from your machine

1. In Supabase go to **Settings → Database** and copy the **Connection string** (URI). Prefer **Transaction** pooler mode if shown (username looks like `postgres.yourprojectref`).  
2. Add it to `.env` as `DATABASE_URL=postgresql://…` using the **plain** password from Supabase (replace `[YOUR-PASSWORD]`). `npm run db:setup` percent-encodes user and password for the CLI, including pooler usernames and characters like `&`, `%`, and `+`.  
3. From the project root:

```bash
npm run db:setup
```

This runs both files using **postgres.js** in Postgres “simple query” mode (multiple statements per file). The Supabase CLI’s `db query -f` path uses prepared statements and errors on multi-statement files.

## 3. Run the App

```bash
npm install
npm start
```

`npm install` uses `legacy-peer-deps` (see `.npmrc`) so dependency resolution matches Expo’s peer setup.

Then press:
- `i` for iOS Simulator
- `a` for Android Emulator
- `w` for web browser
- Scan QR with **Expo Go** app on your phone

## 4. Share with Friends

Use [Expo Go](https://expo.dev/go) — friends scan your QR code directly. No app store needed.

For standalone builds later:
```bash
npx eas build --platform ios --profile preview
npx eas build --platform android --profile preview
```

## App Structure

```
app/
├── (auth)/           # Login, signup, onboarding
│   └── onboarding/   # Goal → Level → Equipment
├── (tabs)/           # Main tabs
│   ├── index.tsx     # Dashboard
│   ├── routines.tsx  # Routines list
│   ├── log.tsx       # Start workout
│   ├── progress.tsx  # Charts + PRs
│   └── profile.tsx   # Settings
├── routines/
│   ├── ai-builder.tsx # AI Routine Builder (Groq)
│   └── [id].tsx       # Routine detail
└── workout/
    ├── active.tsx     # Active workout logger
    └── complete.tsx   # Post-workout summary
```

## AI Models (Groq)
- **Routine Builder**: `llama-3.3-70b-versatile` — best quality for programme generation
- **In-workout Coach**: `llama-3.1-8b-instant` — fast real-time coaching

## 5. Deploy web (Vercel CLI)

Static export goes to **`dist/`** (see `vercel.json`). One-time link, sync env from local `.env`, then deploy:

```bash
vercel link
npm run sync:vercel-env
npm run deploy
```

`sync:vercel-env` pushes only **`EXPO_PUBLIC_*`** to Vercel **Production** (uses `--sensitive`). Preview envs often need a branch in the Vercel UI—set those there if you use Preview deployments. `DATABASE_URL` stays local for `npm run db:setup` only.

In **Supabase → Authentication → URL configuration**, add your production site URL when you have it.
