# SuperReps — Setup Guide

## 1. Environment Variables

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

In Supabase SQL Editor, run these two files **in order**:

1. `supabase/schema.sql` — creates all tables, RLS policies, indexes
2. `supabase/seed_exercises.sql` — seeds 100 exercises

## 3. Run the App

```bash
npm start
```

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
