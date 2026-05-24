# SuperReps UI Redesign Session
**Date:** 2026-05-20

## What we did

Explored the current SuperReps codebase and designed a full app UI redesign using a **clean & minimal** design language.

## Design Direction

- Style: Clean & minimal (white/light surfaces, monochromatic, generous whitespace)
- Inspired by: Linear, Apple Fitness+, Notion
- Dropped: the current dark `#0F172A` slate theme with blue accents

## Screens Redesigned (interactive mockup built)

1. **Home** — greeting, 3-metric ribbon (streak / weekly sessions / volume), today's plan CTA, recent workouts, PRs
2. **Active Workout** — rest timer card prominent at top, set chips (filled = done), AI coach card with left-border accent
3. **AI Builder** — conversational chat UI (user bubble + AI bubble) instead of prompt box + output panel
4. **Progress** — column chart for weekly volume, horizontal bars for muscle focus, lift PRs delta table
5. **Profile** — centered avatar, goal/level/equipment pills, grouped settings list rows

## Key UX Changes from Current App

| Current | Redesigned |
|---|---|
| Dark `#0F172A` background | White / light system surfaces |
| Blue primary accent | Monochrome typographic hierarchy |
| Prompt box + streaming output (AI Builder) | Conversational chat thread |
| Rest timer buried in workout | Rest timer as top-of-screen card |
| Pie chart for muscle groups | Horizontal bar breakdown |
| Tab bar with 5 items (same) | Added active dot indicator |

## Prompt for Claude.ai UI Prototype

Use this prompt to regenerate the interactive prototype in a new Claude conversation:

```
Build an interactive mobile UI prototype for "SuperReps" — an AI-first fitness app.
Use a clean, minimal design language: white/light surfaces, monochrome typography,
generous whitespace, no gradients or heavy shadows. Think Linear, Apple Fitness+, Notion.

The app has 5 screens navigable via a bottom tab bar:

1. HOME
- Greeting with user name + date top left, avatar top right
- 3-metric ribbon: Day streak / This week / Total volume
- "Today's plan" card with workout name, muscle groups, session count, and a "Start workout" CTA button
- Recent workouts list (exercise name, day, duration, kg volume)
- Personal records list (lift name + weight, with a "PR" badge for new records)

2. ACTIVE WORKOUT (Log tab)
- Header: routine name + elapsed timer + "Finish" button
- Rest timer card at top: large countdown + preset chips (60s, 90s, 120s, 180s)
- Exercise list: each row has icon, name, set completion chips (filled = done, outlined = pending), last set weight × reps
- AI Coach card: subtle left-border accent, short coaching tip text
- "Add exercise" ghost button at bottom

3. AI BUILDER
- Conversational chat UI (not a prompt box + output panel)
- User message bubble (dark, right-aligned)
- AI response bubble (light surface, left-aligned) showing structured routine summary
- Quick template pills below chat
- Text input + send button
- "Save routine" primary + "Regenerate" secondary buttons

4. PROGRESS
- Period selector pills: 4W / 3M / All
- 3-metric ribbon: Sessions / Volume / Avg duration
- Weekly volume column chart (current week highlighted in dark, others in muted surface)
- Muscle focus horizontal bar chart (5 muscle groups)
- Lift PRs delta table (+kg gains over period)

5. PROFILE
- Centered avatar + name + email
- Goal / Level / Equipment pills
- Stats ribbon: Streak / Sessions / Routines
- Settings list rows: Goal, Experience, Equipment, Units (with chevrons)
- Secondary list: Notifications, Sign out (red)

Design rules:
- Light/white background, no dark mode
- Typography only: no color accents, use weight + size hierarchy
- Pill badges for status (blue for active/selected, green for PRs, gray for neutral)
- 0.5px borders on cards, border-radius-lg for cards
- Bottom tab bar with 5 icons: Home, Log, AI, Progress, Profile
- Active tab shows a small dot indicator below the label
- All screens must be interactive and switchable via tab bar clicks
- Phone frame with rounded corners (border-radius: 36px)
- Status bar at top showing time + battery
```

## Next Steps

- [ ] Pick a screen to generate actual React Native `.tsx` code
- [ ] Apply new color tokens / theme to `constants/index.ts`
- [ ] Consider light mode support in `app.json` (`userInterfaceStyle: "automatic"`)
- [ ] Update NativeWind config to use new design tokens
