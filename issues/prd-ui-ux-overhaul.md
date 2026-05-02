# PRD: SuperReps UI/UX Overhaul

## Problem Statement

SuperReps currently has a fragmented user experience that creates friction at every key moment. Casual users are overwhelmed by advanced analytics shown before they have any data. The workout logging flow requires too many taps (modal per set, no pre-filled values). AI coaching is buried behind a button that users must remember to tap. Progress data is split across two separate screens (Home and Progress tab) creating duplication and confusion. The Profile screen has no structure — it mixes a social feed, analytics charts, and settings into one endless scroll. Users have no way to share their workouts in a visually compelling format. There is no body weight tracking, no exercise catalog with visual references, no training calendar, and no conversational way to build routines with AI.

## Solution

A complete restructuring of the app's information architecture and interaction patterns around three principles:

1. **Progressive disclosure** — simple surface for all users, advanced intelligence available on demand
2. **P0 is workout logging** — every navigation and layout decision serves getting users into a workout faster with less friction
3. **AI as a coach, not a feature** — intelligence surfaces automatically at the right moments (rest timer, profile header, workout completion) rather than requiring the user to seek it out

The result is a 4-tab app (Home, Workouts, AI Build, Profile) where the workout logging experience is inline and instant, AI coaching appears during rest time and on the profile, and all analytics live in a structured 5-tab Profile screen.

---

## User Stories

### Navigation & Home

1. As a returning user, I want the app to open on the Home screen so that I can immediately see my training readiness and start a workout.
2. As a user, I want the Home screen to greet me with a time-appropriate message so that the app feels personal.
3. As a user, I want to see an AI readiness assessment on the Home screen so that I know whether I should train hard, go light, or rest today.
4. As a user with a scheduled routine, I want to see it on the Home screen with a single Start button so that I can begin my session in one tap.
5. As a user without a scheduled routine, I want to see a Start a Workout CTA on the Home screen so that I can begin an empty session quickly.
6. As a user, I want to see a mini weekly heatmap on the Home screen so that I can see at a glance how consistent I've been this week.
7. As a user, I want to see my top personal records on the Home screen so that I feel motivated by my progress.
8. As a user, I want 4 bottom navigation tabs (Home, Workouts, AI Build, Profile) so that the app is easy to navigate.

### Workouts Tab

9. As a new user with no saved routines, I want to see guidance cards (Quick Start, Build with AI, Import) so that I know how to get started.
10. As a returning user with saved routines, I want to see my routine list immediately when I open the Workouts tab so that I can start training without extra navigation.
11. As a returning user, I want utility actions (import, build with AI) collapsed into a small icon row so that they don't compete with my routine list.
12. As a user, I want each routine card to show a prominent Start button so that I can begin a session in one tap.
13. As a user, I want routine cards to show muscle groups, estimated duration, and exercise count so that I can choose the right routine for today.

### Active Workout — Set Logging

14. As a user logging a set, I want weight and reps fields to be inline on the set row so that I never need to open a modal.
15. As a user, I want weight and reps pre-filled with my last logged values for that exercise so that I only need to adjust if something changed.
16. As a user who hasn't logged that exercise before, I want the fields pre-filled with the routine's default values so that I have a starting point.
17. As a user, I want to mark a set complete by tapping the checkmark inline so that the happy path is a single tap.
18. As an advanced user, I want to log RPE by tapping a "+" expander on the set row so that I can track effort without cluttering the default view.
19. As a user, I want completed sets to visually change (green background) so that I can see at a glance how many sets I've done.
20. As a user, I want a progress bar showing completed sets out of total sets so that I know how far through the workout I am.

### Active Workout — Exercise Detail

21. As a user, I want to tap an exercise name to open a bottom sheet so that I can reference how to perform it without leaving the workout screen.
22. As a user, I want the exercise bottom sheet to show an animated GIF of the movement so that I can see the correct form.
23. As a user, I want the bottom sheet to show target muscles, equipment, and 3 key form cues so that I have everything I need in one glance.
24. As a beginner, I want the exercise reference to be accessible in under 2 taps during an active workout so that I never lose my place.

### Active Workout — AI Coaching

25. As a user who has just completed a set, I want an AI coaching message to appear alongside the rest timer so that I use my rest time productively.
26. As a user, I want AI motivational tips to rotate during rest time so that the coaching feels fresh across sessions.
27. As a user, I want AI messages to be pre-generated at workout start so that there is zero latency when the rest timer begins.
28. As a user, I want the AI to detect notable events mid-workout (weight decrease, third set of an exercise, halfway point) and generate a live contextual coaching message so that I receive relevant advice.
29. As a user, I want exercise-specific warnings (e.g. "Your reps dropped on set 3 last 3 sessions — consider reducing weight") to appear inline under the exercise header so that I see them in context.
30. As a user, I want the AI to have context about my routine, time of day, past performance, and current session state so that its advice is personalised.

### Post-Workout Completion Screen

31. As a user who finishes a workout, I want to see a celebration screen showing duration, volume, and PR count so that I feel rewarded.
32. As a user, I want to see each new PR listed individually on the completion screen so that I can celebrate specific achievements.
33. As a user, I want to see a one-line AI insight about my session on the completion screen so that I get immediate feedback.
34. As a user, I want a Share Workout button on the completion screen so that I can share my session without navigating away.

### Workout Sharing

35. As a user sharing a workout, I want to see 5 swipeable image slides so that I can choose the most compelling visual to share.
36. As a user, I want slide 1 to show a 2D human body diagram with trained muscles highlighted plus session stats (duration, volume, PRs) so that my audience can see what I worked.
37. As a user, I want slide 2 to show a fun weight comparison (e.g. "You lifted the equivalent of 2 pickup trucks") so that non-gym people can appreciate my effort.
38. As a user, I want slide 3 to show a rep count visualisation so that I can show total work done.
39. As a user, I want slide 4 to show my best set of the session so that I can highlight a peak moment.
40. As a user, I want slide 5 to show the full workout details (exercises, sets, weights) so that I can share a complete log.
41. As a user, I want to share directly to Instagram so that I can post to my Stories.
42. As a user, I want to share directly to Twitter so that I can post to my feed.
43. As a user, I want to copy my workout as formatted text so that I can paste it anywhere.
44. As a user, I want all shareable images generated on-device so that sharing works without an internet connection.

### AI Build Tab

45. As a user, I want to open the AI Build tab and see 4 suggestion chips so that I know how to start the conversation.
46. As a user, I want to type freely to describe what routine I want so that I'm not limited to pre-set options.
47. As a user, I want the AI to ask clarifying questions about my goals, available days, and equipment so that the routine is tailored to me.
48. As a user, I want the AI to have access to my past session history, muscle distribution, and PRs so that its suggestions are based on my actual training.
49. As a user, I want to see a Save Routine button appear inline in the chat after the AI generates a routine so that I can save it in one tap.
50. As a user, I want the saved routine to appear immediately in my Workouts tab so that I can start it right away.
51. As a user, I want the AI to be able to analyse my training data and surface insights without necessarily building a routine so that I can use it as a general coach.

### Profile — Header & AI Review

52. As a user, I want the Profile header to show my avatar, display name, handle, streak, session count, and routine count so that I can see my identity and key stats at a glance.
53. As a user, I want the AI Weekly Review card to be always visible in the Profile header so that I see my coaching status every time I open Profile.
54. As a user, I want the AI Review to show status pills (Volume, PRs, Recovery, Consistency) with colour indicators (green/amber/red) so that I can assess my week in one second.
55. As a user, I want the AI Review to show a one-line summary by default and expand to full analysis on tap so that I get the key insight without reading a wall of text.

### Profile — Workouts Tab

56. As a user, I want to see my past workout sessions as social-style cards in the Workouts tab so that I have a feed of my training history.
57. As a user, I want each session card to show the routine name, date, duration, volume, reps, and PR count so that I can recall the session at a glance.
58. As a user, I want each session card to show a preview of the exercises performed so that I can see what I trained.
59. As a user, I want to share, delete, copy, or save a session as a routine from a menu on each card so that I can manage my history.
60. As a user, I want to edit a past workout session so that I can correct mistakes in logged weights, reps, or exercises after the fact.
61. As a user editing a past session, I want the same inline set row interface used during live logging so that editing feels familiar.
62. As a user, I want to add, remove, or reorder exercises in a past session so that I can fix incomplete logs.
63. As a user, I want edited sessions to immediately recalculate volume, PRs, and muscle distribution so that my stats stay accurate.

### Profile — Statistics Tab

60. As a user, I want a period toggle (1M / 3M / All) at the top of the Statistics tab that controls all charts simultaneously so that I don't have to set the period per chart.
61. As a user, I want a metric ribbon showing total sessions, total volume, and average duration for the selected period so that I get a snapshot before reading the charts.
62. As a user, I want a single bar chart switchable between Duration, Volume, and Reps by week so that I can compare my activity over time without visual clutter.
63. As a user, I want a Muscle Distribution section showing sets per muscle group as horizontal bars so that I can see if my training is balanced.
64. As a user, I want a Lift Progression section with a horizontal exercise selector and a line chart showing max weight per week so that I can track strength gains on specific lifts.
65. As a user, I want the AI Weekly Review in the Statistics tab so that analysis is contextualised alongside the charts.
66. As a user, I want the charts to use only bar charts, line charts, and heatmaps so that the visual language is consistent and readable throughout the app.

### Profile — Measures Tab

67. As a user, I want a quick log input at the top of the Measures tab pre-filled with yesterday's weight so that logging my weight takes under 3 seconds.
68. As a user, I want a line chart showing my body weight trend over time so that I can see my progress visually.
69. As a user, I want a chronological history list of my weight entries so that I can review and verify past logs.
70. As a user, I want start weight, current weight, lowest weight, and change displayed as stats so that I understand my trend at a glance.

### Profile — Exercises Tab

71. As a user, I want to browse the full exercise catalog from the Exercises tab so that I can discover new movements.
72. As a user, I want each exercise to show an animated GIF, name, equipment type, and primary muscle group so that I can immediately identify the movement.
73. As a user, I want to search exercises by name so that I can find a specific movement quickly.
74. As a user, I want to filter exercises by muscle group so that I can browse movements for a specific body part.
75. As a user, I want exercise images to load from Supabase Storage (imported from free-exercise-db) so that the catalog works reliably without third-party API dependency.

### Profile — Calendar Tab

76. As a user, I want to see a monthly calendar view showing which days I trained vs rested so that I have a visual overview of my consistency.
77. As a user, I want to see my current week streak and rest day count displayed above the calendar so that I know my current consistency stats.
78. As a user, I want to navigate between months so that I can review past training history.
79. As a user, I want to see a list of sessions for the current week below the calendar so that I can quickly recall what I trained each day.

### Settings

80. As a user, I want a Profile settings screen with fields for Name, Bio, Gender, and Date of Birth so that I can personalise my account.
81. As a user, I want an Account Settings screen with options to change my username, email, and password so that I can manage my credentials.
82. As a user, I want a Preferences section with a Units toggle (kg / lbs) so that weights display in my preferred unit throughout the app.
83. As a user, I want a Rest Timer Default preference so that the rest timer starts at my preferred duration for every session.
84. As a user, I want Import / Export Data in Preferences so that I can back up or migrate my workout history.
85. As a user, I want a Danger Zone section with Sign Out and Delete Account so that I can manage my account lifecycle.

---

## Implementation Decisions

### Modules to Build / Modify

**1. Inline Set Row Component**
Replace the current set logging modal with an inline row component. Each row contains: set number, weight input (pre-filled), reps input (pre-filled), checkmark button, and an RPE expander. Pre-fill logic checks the user's last logged set for that exercise, falling back to routine defaults.

**2. Exercise Detail Bottom Sheet**
A reusable bottom sheet component that accepts an exercise ID and renders: animated GIF from Supabase Storage, exercise name, target muscles, equipment, and up to 3 form cues. Used in both the active workout screen and the Exercises catalog tab.

**3. AI Workout Coaching Service**
A service with two modes:
- **Pre-generation:** called at workout start, receives routine + user profile + recent session history, returns a queue of 5–8 motivational/tip messages
- **Trigger-based:** called on events (set completion with weight drop, 3rd set of exercise, session halfway point), receives current session state, returns a single contextual message
Messages are stored in workout store and consumed by the rest timer overlay and exercise inline card.

**4. Rest Timer with Coaching Overlay**
Extend the existing rest timer component to display a coaching message (from the pre-generated queue) during the countdown. Message rotates on each new rest period. Styled as a subtle card below the timer ring.

**5. Home / Today Screen**
New screen replacing the current dashboard. Sections: AI readiness card (reads last session date + volume from user store), scheduled routine card (reads from routines store, shows Start CTA), weekly heatmap (7-day derived from session history), top 3 PRs strip.

**6. Adaptive Workouts Tab Layout**
Modify the Workouts screen to detect whether the user has saved routines. Zero routines: render 3 guidance cards. One or more routines: render compact icon row for utility actions + full routine list.

**7. Post-Workout Completion Screen**
New screen shown after `finishWorkout()`. Receives session summary (duration, volume, new PRs, AI insight). Contains share CTA that opens the Share Workout bottom sheet.

**8. Workout Share Bottom Sheet + Image Slide Renderer**
Bottom sheet with a horizontal swipeable carousel of 5 rendered Views. Each View is captured as a PNG using `react-native-view-shot`. Share targets: Instagram Stories (via `expo-sharing`), Twitter (via deep link), Copy Text (via `expo-clipboard`), native share sheet.

Slide definitions:
- **Muscle Map:** 2D human body SVG with muscle fill colours toggled by trained muscle groups. Session stats overlay.
- **Weight Comparison:** Total volume mapped to a real-world object comparison (lookup table: car, truck, elephant, etc.)
- **Rep Map:** Visual grid or count display of total reps
- **Best Set:** Largest single-set volume (weight × reps) of the session
- **Workout Details:** Exercise list with sets, weights, reps in card format

**9. Human Body SVG Component**
An SVG component with individual path elements per muscle group. Accepts a `trainedMuscles: string[]` prop and fills matching paths with the accent colour. Front and back views rendered side by side. Sourced from an open-source anatomical SVG (e.g. adapted from open body figure project).

**10. free-exercise-db Import Script**
A one-time migration script that reads the free-exercise-db JSON, uploads GIF assets to Supabase Storage, and upserts exercise records into the `exercises` table with an `image_url` column. Run via `npm run db:exercises`.

**11. Profile Horizontal Tab Navigator**
Replace the current Profile screen's single scroll with a sticky header + horizontal tab strip. Header (avatar, stats, AI Review card) is fixed. Tab strip (Workouts | Statistics | Measures | Exercises | Calendar) controls which content renders below.

**12. Statistics Tab**
New tab content component. Sections: period toggle (controls all charts), metric ribbon, activity bar chart with metric switcher, muscle distribution horizontal bars, lift progression (exercise selector + line chart + stat row), AI Weekly Review collapsible.

**13. Measures Tab**
New tab content component. Sections: weight log input with +/- stepper and Log button, line chart (body weight over time), stats strip (start/current/lowest/change), history list. New Supabase table: `body_weight_logs (id, user_id, weight_kg, logged_at)`.

**14. Calendar Tab**
New tab content component. Monthly grid showing trained vs rest days, month navigation, streak + rest count header, weekly session list below calendar.

**15. AI Build Tab**
New screen (chat interface). State: message history array, loading flag, generated routine object. On mount: render 4 suggestion chips. On send: call AI service with message + user context (goal, level, equipment, recent sessions, muscle distribution, PRs). On routine detected in response: render inline Save Routine card. On save: call existing routine creation flow.

**16. Edit Past Workout Screen**
A new screen reachable from the session card menu (replacing the current "coming soon" alert). Renders the same inline set row components used during live logging, pre-populated with the session's saved sets. Supports: editing weight/reps/RPE per set, adding sets, removing sets, adding exercises from the exercise catalog, removing exercises, and reordering exercises. On save: updates `workout_sets` and `workout_sessions` records in Supabase, then invalidates derived stats (volume, PRs, muscle distribution) for that session.

**17. Settings Screen Restructure**
Refactor the existing settings/profile routes into: Profile settings (name, bio, gender, DOB), Account settings (username, email, password), Preferences (units, rest timer default, import/export), Danger zone (sign out, delete account).

**17. Units Preference**
Add `units: 'kg' | 'lbs'` to the user profile. Update `formatWeight()` utility to respect units setting. All weight displays (set rows, charts, completion screen, PRs) read from this preference.

**18. Chart Component Library (internal)**
Replace the existing SVG area charts and sparklines with two canonical chart components:
- `BarChart` — accepts `data: {label: string, value: number}[]`, renders uniform-width bars with labels
- `LineChart` — accepts `data: {label: string, value: number}[]`, renders connected dots with no gradient fill

Both accept a `width` prop and are self-contained. No third-party chart library — keep the existing SVG approach but with a clean, reusable interface.

### Schema Changes

- `exercises` table: add `image_url TEXT`, `gif_url TEXT`, `description TEXT`, `form_cues TEXT[]`
- New table: `body_weight_logs (id UUID, user_id UUID, weight_kg DECIMAL, logged_at TIMESTAMPTZ)`
- `users` table: add `bio TEXT`, `gender TEXT`, `dob DATE`, `units TEXT DEFAULT 'kg'`, `rest_timer_default INT DEFAULT 90`

### AI Service Contract

- Workout coaching pre-generation: input `{ routine, userProfile, recentSessions[7] }` → output `{ messages: string[] }`
- Workout coaching trigger: input `{ event, currentSession, exerciseHistory }` → output `{ message: string }`
- AI Build chat: input `{ messages[], userContext }` → output `{ reply: string, routine?: RoutineObject }`
- AI Weekly Review: input `{ sessions[], sets[], period }` → output `{ text: string }`

---

## Testing Decisions

### What Makes a Good Test
Tests should verify external behaviour — what the module produces given certain inputs — not implementation details like internal state shape or which sub-functions were called. A good test can survive a refactor of the internals while still passing.

### Modules to Test

**AI Coaching Service** — unit test the trigger detection logic: given a session state, does it correctly identify a weight drop, a 3rd set, or a halfway point and return the right event type? Test the message queue consumption order.

**Inline Set Row Pre-fill Logic** — unit test the pre-fill resolver: given an exercise ID, a session history, and a routine default, does it return the correct weight and reps? Cover: first-time exercise (no history), returning exercise, routine default fallback.

**formatWeight Utility** — unit test: given a weight in kg and a units preference, returns correct value and label in both kg and lbs.

**Workout PR Detection** — existing `workout-pr.ts` has prior art for this pattern. Extend to cover the completion screen PR derivation.

**Weight Comparison Lookup** — unit test: given a total volume in kg, returns the correct comparison object and label from the lookup table.

**BarChart and LineChart Components** — render tests: given a data array, renders the correct number of bars/points. Given an empty array, renders gracefully without crash.

**Body Weight Log Store** — unit test: log entry is appended, duplicate same-day entry replaces previous, trend calculation (start/current/lowest/change) is correct.

---

## Out of Scope

- Social features (likes, comments, following other users) — stubs remain in place
- Copy / duplicate session — remains "coming soon"
- Offline mode / local caching — all data continues to require Supabase connection
- Body measurements beyond weight (chest, waist, hips) — Measures tab is weight-only in this version
- Progress photos — V2 feature
- Wearable / Apple Health / Google Fit integration
- Push notifications / workout reminders
- Multiple AI model options in AI Build (locked to current Groq / Llama stack)
- Web version parity — this PRD targets the native iOS/Android experience

---

## Further Notes

- **free-exercise-db import** is a prerequisite for the Exercise Detail Bottom Sheet, the Exercises catalog tab, and the Muscle Map share slide. It should be the first task completed before any exercise-related UI work begins.
- **Human body SVG** is the hardest asset dependency. The muscle group names in the SVG paths must match the `muscle_groups` values in the `exercises` table exactly. Normalise both during the import script.
- **react-native-view-shot** must be tested on both iOS and Android early — image capture behaviour differs between platforms, especially for animated content.
- **Units preference (kg/lbs)** affects every weight display in the app. The `formatWeight()` utility must be the single source of truth — never format weights inline.
- The **4-tab navigation** eliminates the Progress tab. The `app/(tabs)/progress.tsx` file should be deleted and its data-fetching logic extracted into the Statistics tab component.
- **AI Review pre-generation cadence:** the Profile header AI Review should regenerate at most once per day (or on manual pull-to-refresh) to avoid excessive API calls. Cache the last result in the user store with a timestamp.
