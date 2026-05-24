# SuperReps

## UI Check — Required After Every Edit Session

After finishing **all** code edits for any request that touches files under `app/`, run the UI check before reporting done:

### Step 1 — Run the screenshot script

Pass every `app/` file you changed:

```bash
node scripts/ui-check.mjs app/(tabs)/ai.tsx app/(tabs)/profile.tsx
```

Screenshots are saved to `test-results/ui-check/<slug>.png`.

### Step 2 — Inspect screenshots

Use the `Read` tool on each PNG (it supports images). Check for:
- Layout breaks or overflow at 390px mobile width
- Clipped or missing UI elements
- Broken spacing, wrong colours, misaligned components
- Anything that looks unfinished or visually off

### Step 3 — Auto-fix loop

If a visual issue is found:
1. Fix the code
2. Re-run the screenshot script
3. Re-inspect

Repeat up to **3 attempts**. If the issue is still present after 3 attempts, stop and report it to the user with the screenshot path.

### Skip the UI check when:
- No `app/` files were changed (e.g., only `lib/`, `stores/`, `scripts/`, `supabase/`)
- You were asked explicitly to skip it

### File → route mapping

Defined in `scripts/ui-check.mjs`. Dynamic routes (`app/routines/[id].tsx`, `app/workout/active.tsx`, etc.) are skipped — they require runtime data that isn't available in the screenshot environment.

## Imported Claude Cowork project instructions

I need your help to build an application which has unlimited features like heavy app for fitness but with AI first approach.

Easy. Simple. Minimillist appraoch.
