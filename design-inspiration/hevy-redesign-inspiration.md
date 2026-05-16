# Hevy App Redesign — Design Inspiration

> Source: [Behance — Hevy App Redesign Concept](https://www.behance.net/gallery/185566637/Hevy-App-Redesign-Concept) by Albert Zimtea & Hugo Díaz (Nov 2023)
> Supplementary: [Hevy App Features](https://www.hevyapp.com/features/) · [ScreensDesign Showcase](https://screensdesign.com/showcase/hevy-workout-tracker-gym-log) · [Hevy Workout Logger UX](https://www.hevyapp.com/use-cases/workout-logger/)

---

## 1. Overall Design Philosophy

- **Dark-first, minimal chrome** — dark backgrounds with high-contrast accent colours. Negative space is generous; every element earns its place.
- **Speed over completeness** — logging a set should take under 3 taps. Advanced settings (RPE, plate calculator, set types) are opt-in, never forced on screen.
- **Micro-interactions as feedback** — a satisfying animated checkmark bounce when a set is completed; haptic feedback on every significant action; branded loading states (app logo) instead of generic spinners.
- **Clean exercise cards with 3D model animations** showing proper form — replaces static images with looping demonstrations.
- **Social layer is secondary** — core UX is solo logging; social/leaderboard features are discoverable but not in the critical path.

---

## 2. Actual Screenshots — Detailed Visual Analysis

> Screenshots from real Hevy app (IMG_3919–3922) captured by Altaf

### IMG_3919 — Active Workout Logging (top of scroll)

**Header bar:**
- Left: dropdown chevron + "Log Workout" label (white, medium weight)
- Right: clock icon + blue **"Finish"** pill button (bright blue, rounded)

**Stats strip below header (4 items, grey text):**
- Duration · Volume · Sets · Body silhouette icons
- Values in white, labels in small muted text above them

**Exercise card — "Warm Up":**
- Circular avatar with exercise illustration (left-aligned)
- Exercise name in **bright blue** (not white) — acts as a link/tappable
- 3-dot overflow menu (right)
- Description text shown inline below name (grey, smaller)
- "Add notes here…" placeholder in muted grey
- Rest timer line: `🔵 Rest Timer: OFF` — icon + text, blue accent
- Set table headers: `SET | PREVIOUS | TIME | ✓`
  - TIME column = for time-based exercises (inline stopwatch with ▶ play button)
  - Row: `1 | 13:54 | ▶ 14:44 | ☐`
- "+ Add Set" full-width button (dark surface, muted text)

**Exercise card — "Cable Fly Crossovers":**
- Set table headers: `SET | PREVIOUS | ↔ KG | REPS | ✓`
  - PREVIOUS column shows `10kg × 15` format (prior session data)
  - KG column has ↔ icon (unit toggle)
  - Row 1: `1 | 10kg x 15 | 10 | 15 | ☐`
  - Row 2: `2 | 15kg x 12 | 15 | 12 | ☑` (blue checked box)

**Key takeaways from this screen:**
- ❌ No RPE column visible anywhere — confirmed opt-in only
- ✅ PREVIOUS column as its own dedicated column (not ghost text above input)
- ✅ Exercise name is blue/tappable — opens exercise detail
- ✅ Per-exercise rest timer label inline in card
- ✅ Notes field inline in card
- ✅ Different column sets for time-based vs weight-based exercises

---

### IMG_3920 — Active Workout (rest timer active)

**Header:** elapsed time changes from "Log Workout" to `36s` running clock

**Set row — completed:**
- Entire row background turns **green** when set is marked done
- Checkbox is green, text stays visible (not greyed out)
- Row 1 of Triceps Pushdown is green (completed)

**Rest timer — bottom persistent bar:**
- NOT a modal or sheet — a fixed bottom bar
- Large "**01:24**" countdown (very large, centered, white bold)
- Three buttons: `−15` | `+15` | `Skip` (blue pill)
- The bar is dark and sits above the tab bar
- Scrolling the workout view works normally — the rest timer stays fixed

**Key takeaways:**
- ✅ Rest timer is a bottom persistent bar, not a floating card or modal
- ✅ Completed set row turns entirely green
- ✅ −15 / +15 adjustment buttons (more useful than preset buttons)
- ✅ Elapsed workout timer replaces "Log Workout" in header

---

### IMG_3921 — Exercise Detail Screen ("Lateral Raise (Machine)")

**Layout:** Full-screen page (navigated to, not a bottom sheet)
- Back arrow ← top left
- Export/share icon top right
- Three tabs: **Summary** | History | How to

**Summary tab:**
- Large 3D rendered exercise model — full width, realistic anatomy
- Muscle activation shown in **red/orange highlight** on the model (shoulders lit up)
- Pause button overlay on animation
- Exercise name + "Primary: Shoulders" subtitle

**Progress section:**
- `0 kg (In progress)` — current session value
- `Last 3 months` dropdown
- Line chart with dotted trend line
- Three metric selector chips (horizontal): `Heaviest Weight` | `One Rep Max` | `Best Set Vol` (active chip in blue)

**Personal Records:**
- Gold trophy 🏆 icon + "Personal Records" heading
- List items: metric name (left) + value in blue (right)
  - Heaviest Weight · 20kg
  - Best 1RM · 30kg
  - Best Set Volume · 15kg × 45

**Key takeaways:**
- ✅ 3D animated exercise model with muscle activation highlighting
- ✅ History chart directly in exercise detail
- ✅ Three chart metric types selectable
- ✅ PR records shown contextually in the exercise view
- ✅ "How to" tab would contain coaching cues / form tips

---

### IMG_3922 — Workout / Routines Screen

**Tab bar (bottom, 3 tabs only):**
- Home (house icon)
- **Workout** (dumbbell icon — active, blue)
- Profile

**Screen header:** `Workout ↓` + `PRO` yellow pill badge (top right)

**Top CTA:** `+ Start Empty Workout` — full-width outlined button (dark background, white text + "+" icon)

**Routines section:**
- "Routines" heading + import/folder icon (right)
- Two action pills: `📋 New Routine` | `🔍 Explore`
- Routine **folder/group**: `Beginner Push/Pull/Legs (Gym Equipment) (4)` — collapsible with `▼` arrow + `…` menu

**Routine cards (inside folder):**
- Card title (bold): "Push"
- Subtitle (grey, smaller): exercise list preview — "Warm Up, Cable Fly Crossovers, Low Cable Fly Crossovers, Triceps Pushdown, Lateral Raise (Mac…"
- Full-width **"Start Routine"** blue button (same blue as everything else)
- Separator between cards

**Active workout persistent banner (bottom, above tab bar):**
- `^ Rest 00:40 · Triceps Pushdown` — up chevron to expand + exercise name
- Red trash/delete icon on right to cancel workout

**Key takeaways:**
- ✅ Only 3 tabs (Home, Workout, Profile) — very clean
- ✅ Routines live inside the Workout tab (not a separate tab)
- ✅ Folder grouping for routine collections
- ✅ Routine card preview shows exercise list as text (no icons)
- ✅ "Start Routine" button per card — direct launch
- ✅ Active workout banner persists globally across tabs
- ✅ "Start Empty Workout" prominent at the top
- ❌ No day-of-week / schedule shown here — routines are manually started

---

## 3. Colour System (confirmed from screenshots)

| Role | Observed Colour |
|------|----------------|
| Background | Near-black `~#0E0E0F` or `#111111` |
| Card / Exercise block | Very slightly lighter dark `~#1A1A1A` |
| Primary accent | Bright blue `~#0070FF` — exercise names, timers, CTAs, checkboxes, active tabs |
| Completed set row | Full green background `~#1A7A3A` on entire row |
| Active checkbox | Solid blue `~#0070FF` with white checkmark |
| Unchecked checkbox | Dark outline square |
| Text primary | White `#FFFFFF` |
| Text secondary / labels | Muted grey `~#8E8E93` |
| Column headers | Small caps, muted grey, slightly spaced |
| Exercise name | Bright blue (same as accent) — tappable |
| Destructive action | Red (delete/cancel workout icon) |
| PRO badge | Yellow pill `~#FFD700` text on dark |
| "Finish" button | Bright blue pill |
| "Start Routine" button | Bright blue full-width |
| "+ Add Set" / "+ Start Empty Workout" | Dark surface button, outlined or flat |

---

## 3. Home Screen

### What it shows
- **Today's workout card** — prominently featured, full-bleed card with routine name, muscle group tags, exercise count, estimated duration.
- **Streak counter** — gamified, shows current streak with flame icon.
- **Volume / consistency heatmap** — calendar-style grid of training days.
- **Quick stats** — sets this week, PRs this month, total volume.
- **Upcoming routine preview** — list of 2–3 exercises with muscle group tags.

### Design patterns
- Hero card uses a subtle gradient overlay on a dark background.
- Muscle group tags are pill chips with category colours (push = blue, pull = orange, legs = red).
- "Start Workout" CTA is a large, full-width button at the bottom of the hero card — unmissable.
- Rest day state: clearly shown as "Rest Day · Recovery is progress" with a different card style (no CTA, softer colours).
- Routine switcher accessible via a small "change" link or dropdown on the hero card.

### What SuperReps has ✅ / is missing ❌
- ✅ Streak counter
- ✅ Weekly heatmap
- ✅ Top PRs
- ❌ Day-of-week matching ("Today's Plan" shows wrong day)
- ❌ Rest day state
- ❌ Multiple routine switcher on home
- ❌ Muscle group tags on today's card (partially there, but not styled as chips)

---

## 4. Routine Scheduling

### Hevy's approach
- Routines have named days: users call them "Push Day", "Pull Day", "Leg Day" — not "Day 1", "Day 2".
- A schedule view lets users drag days onto Monday–Sunday slots.
- The home screen checks today's weekday and displays the matching routine day (or "Rest Day").
- Multiple routines can coexist; one is "active" at a time.

### What SuperReps has ✅ / is missing ❌
- ✅ `routine_days` table with `day_index` field
- ❌ Day-of-week matching logic on home screen
- ❌ Active routine concept
- ❌ User-editable day names (currently "Day 1", "Day 2")
- ❌ Schedule assignment UI (drag days to weekdays)

---

## 5. Workout Logging Screen

### Layout
- **Header**: workout title + elapsed timer (running clock, large). Pause and finish buttons top-right.
- **Progress bar**: thin strip below header showing "X / Y sets completed" — updates live.
- **Exercise cards**: stacked vertically, each card contains:
  - Exercise name (bold, large)
  - Muscle group subtitle (muted, small)
  - Set table (see below)
  - "+ Add Set" row at the bottom of the card
- **"Add Exercise" button**: sticky at the bottom of the scroll view.

### Set Table Row (confirmed from screenshots)

**Weight-based exercise columns:**
```
SET | PREVIOUS    | ↔ KG | REPS | ✓
 1  | 10kg x 15   |  10  |  15  | ☐
 2  | 15kg x 12   |  15  |  12  | ☑ (green)
```
- **PREVIOUS** is its own dedicated column showing `Xkg × Y` from last session — not ghost text, a real column
- **KG** column has ↔ icon (unit toggle per exercise)
- **REPS** column — plain number
- **Checkmark** column — solid checkbox, turns blue on tap, entire row turns green when complete
- **No RPE column** shown — confirmed opt-in only via settings
- Column headers in small all-caps muted grey

**Time-based exercise columns (e.g. Warm Up):**
```
SET | PREVIOUS | TIME        | ✓
 1  | 13:54    | ▶ 14:44    | ☐
```
- TIME column has an inline ▶ play button — starts a stopwatch for timed sets
- Different column set automatically based on exercise type

**Completed row:**
- Entire row background → solid green `~#1A7A3A`
- Checkbox → blue with white checkmark
- Text remains readable (white on green)
- Row is NOT greyed out or faded — full green highlight

### Set Types
- Long-press on the set number reveals a context menu (Normal, Warmup, Drop Set, Failure)
- Confirmed in Hevy feature list: "Workout Set Types" exist
- Not visible as a column in the default view — tucked behind interaction

### RPE — Opt-in Setting (confirmed)
- Settings → Workout Settings → RPE Tracking toggle
- When enabled, adds an additional RPE column to every set row
- Values: 6, 7, 7.5, 8, 8.5, 9, 9.5, 10
- Default: hidden entirely

### Pre-populated Sets from Routine
- When starting a routine, sets are pre-loaded from `sets_config`
- Table starts with planned rows already present
- PREVIOUS column shows prior session data for each slot
- User adds/removes from pre-populated baseline

### Rest Timer (confirmed from IMG_3920)
- **Fixed bottom bar** — NOT a modal, NOT a floating card, NOT inline
- Sits above the tab bar, full width
- Large centered countdown number ("**01:24**") dominates the bar
- Three control buttons: `−15` | `+15` | `Skip` (blue pill)
- Appears automatically on set completion, persists until dismissed or expired
- Workout scroll view works normally — timer bar stays fixed
- Per-exercise rest timer label shown inline in exercise card: `🔵 Rest Timer: 1min 0s`

### Coach / AI feedback
- Appears as an inline bubble below the exercise name (not a modal).
- Dismissable with a swipe.
- Only shown when there is something meaningful to say (not on every set).

### Live PR Notification
- When a set is marked complete and it's a new PR, a banner animates in from the top.
- Shows "🏆 New PR! Bench Press · 102.5kg × 8 reps".
- Auto-dismisses after 3 seconds.

### What SuperReps has ✅ / is missing ❌
- ✅ Set table with kg / reps / checkmark columns
- ✅ Previous weight shown (as ghost text above input — Hevy uses a dedicated PREVIOUS column instead)
- ✅ Rest timer with preset buttons
- ✅ Coach AI bubble
- ✅ Animated checkmark on set completion
- ✅ Swipe to delete sets
- ❌ **PREVIOUS as a dedicated column** (Hevy's approach is cleaner than ghost text above input)
- ❌ **RPE as opt-in setting** (SuperReps shows RPE column always — must hide by default)
- ❌ **Pre-populated sets from routine** (SuperReps starts empty, user must add all sets manually)
- ❌ **Completed row turns green** (SuperReps dims/fades completed rows)
- ❌ **Rest timer as fixed bottom bar** (SuperReps rest timer is inline/modal style)
- ❌ **−15 / +15 rest timer adjustment** (SuperReps has presets only)
- ❌ **Per-exercise rest timer label** shown inline in card (`Rest Timer: 1min 0s`)
- ❌ **Exercise name is blue/tappable** to open detail (SuperReps uses a separate info icon)
- ❌ **Set type picker** (long-press on set number)
- ❌ **Live PR notification banner**
- ❌ **Notes field inline** per exercise in the logging screen
- ❌ **Time-based exercise column** (for exercises like Warm Up, Plank)

---

## 6. Exercise Detail Screen (confirmed from IMG_3921)

- Tapping the (blue) exercise name navigates to a **full-screen page** (not a bottom sheet)
- Back arrow to return to workout

**Three tabs:**
1. **Summary** — 3D animated model + progress chart + PRs
2. **History** — past session log (dates, weights, sets)
3. **How to** — coaching cues / form instructions

**Summary tab layout:**
- Full-width 3D exercise model animation — muscles activated shown in red/orange
- Pause button overlay on animation
- Exercise name + "Primary: [Muscle]" subtitle
- Progress value + time range dropdown (`Last 3 months`)
- Line chart with dotted trend line
- Three selectable metric chips: `Heaviest Weight` | `One Rep Max` | `Best Set Vol`
- Personal Records section (🏆 icon):
  - Heaviest Weight
  - Best 1RM
  - Best Set Volume

### What SuperReps has ✅ / is missing ❌
- ✅ ExerciseDetailSheet exists (bottom sheet)
- ✅ PRs tracked (`personalBests` data)
- ❌ **Full-screen exercise page** (Hevy navigates away; SuperReps uses bottom sheet — different feel)
- ❌ **3D animated exercise model with muscle activation** highlighting
- ❌ **Three tabs** (Summary / History / How to)
- ❌ **History chart per exercise** in detail view
- ❌ **Multiple metric selectors** (Heaviest / 1RM / Best Set Volume chips)

---

## 7. Navigation (confirmed from IMG_3922)

- **3-tab bottom navigation only**: Home | Workout | Profile
- Routines live **inside the Workout tab** — not a separate tab
- Active tab icon uses bright blue accent
- **Active workout persistent banner** above tab bar (globally visible across all tabs):
  - Shows `^ Rest 00:40 · [Exercise Name]`
  - Up chevron expands back to the workout
  - Red trash icon to cancel/discard workout
- "Start Empty Workout" is prominent at the top of the Workout tab (not on Home)

### What SuperReps has ✅ / is missing ❌
- ✅ Tab bar exists
- ✅ Routines screen exists
- ❌ Active workout banner persistent across tabs (SuperReps has a banner on Home only)
- ❌ "Start Empty Workout" on Workout tab (SuperReps starts from Home)
- Note: SuperReps has more tabs than Hevy — consider whether to simplify

---

## 8. Progress / Analytics Screen

- **Volume chart**: bar chart showing weekly volume (total kg lifted) over last 8 weeks.
- **Muscle group breakdown**: radial or donut chart showing % of training per muscle group.
- **Consistency heatmap**: GitHub-style green-intensity calendar.
- **Exercise history**: tap any exercise to see its 1RM progression line chart.
- **PRs section**: personal records list with date achieved.
- **Monthly report card**: auto-generated summary ("You lifted X tonnes this month, up Y% from last month").

### What SuperReps has ✅ / is missing ❌
- ✅ Streak + heatmap on home
- ✅ PR list
- Unknown: full analytics screen

---

## 9. Micro-interactions & Animation Details

| Interaction | Animation |
|-------------|-----------|
| Mark set complete | Checkmark icon bounces in (spring animation), row fades to completion style |
| PR achieved | Gold banner slides down from top, bounces slightly, fades out |
| Rest timer end | Circular ring flashes + haptic burst |
| Exercise added | Card slides up from bottom into position |
| Set deleted (swipe) | Row slides right and collapses with spring |
| Workout finished | Full-screen confetti / celebration overlay with summary card |
| Tab switch | Content cross-fades, no slide |
| Bottom sheet open | Slides up with spring, background dims |

---

## 10. Typography (Inferred)

| Level | Style |
|-------|-------|
| Screen title | Bold, ~28–32pt |
| Section header | Semibold, ~18pt, letter-spaced |
| Body / set data | Medium, ~16pt |
| Ghost/previous values | Regular, ~13pt, 40% opacity |
| Labels / column headers | Semibold, ~11pt, ALL CAPS, 10% letter-spacing |
| Muted metadata | Regular, ~13pt, secondary colour |

Font family: likely SF Pro (system) or a geometric sans-serif like Inter.

---

## 11. Key UX Principles to Steal

1. **RPE is always opt-in** — never shown by default. Adding a column to every row clutters the most-used screen.
2. **Pre-populate sets from the routine** — never make the user start from zero. Load the plan, let them adjust.
3. **Set types via long-press** — keeps the row clean, advanced feature discoverable by power users.
4. **Rest timer is a floating card, not inline** — it overlays without replacing the workout view.
5. **Live PR notification** — instant positive feedback, auto-dismisses, doesn't interrupt the flow.
6. **Today's plan = actual today** — the home screen must match the current weekday to the user's schedule.
7. **Rest day is a first-class state** — don't show a workout card on rest days; show "Recovery is progress".
8. **Target reps label** — show the plan ("Target: 3×8–10") above the logging table as a silent guide.
9. **Set number pills** — colour-code set types on the set number itself, keeping columns minimal.
10. **Large touch targets** — 44px minimum on every interactive element in the logging screen.

---

## 12. What the Redesign Concept Adds Over Real Hevy

(Based on Albert Zimtea / Hugo Díaz's Nov 2023 concept — 18K views, 168 comments, highly regarded)

- More refined visual hierarchy — dark surface palette is more premium/editorial.
- Animated 3D exercise illustrations replacing static images.
- Streamlined onboarding with real-time validation (green checkmarks appear as you type).
- AI coaching integrated inline (not as a separate screen).
- Social comparison redesigned as a side-by-side "athlete duel" rather than a flat list.
- More expressive celebration moments for PRs and workout completion.
- Smoother transitions throughout — everything feels spring-based, not linear.
- Exercise cards feel more like "content" (magazine-style) rather than data tables.

---

## 14. New Screenshots — Light Mode Analysis

> Screenshots shared by Altaf (light mode, 4 screens — home/social skipped)

---

### Screen 1 — Active Workout (light mode, cardio + weight exercise)

**Theme:** Full light mode — white background, dark text, same layout as dark mode screenshots.

**Stats strip:** Duration `12s` · Volume `0 kg` · Sets `0` — confirms live-updating values.

**Exercise card — "Treadmill" (cardio, `distance_duration` type):**
- Exercise icon: treadmill machine illustration (circular avatar, left-aligned)
- Name in blue (tappable) · 3-dot menu (right)
- `Add notes here…` placeholder
- `Rest Timer: OFF` — inline, blue icon
- Columns: `SET | PREVIOUS | KM | TIME | ✓`
  - PREVIOUS: `1.2 km in 12:00` — shows distance + time from last session
  - KM column: `0.27`
  - TIME column: `04:00`
- No weight column, no reps column — **confirmed: exercise type fully drives column layout**

**Exercise card — "Lat Pulldown (Cable)" (weight_reps type):**
- Rest Timer: `55s` inline
- Columns: `SET | PREVIOUS | ↔ KG | REPS | ✓`
  - Row 1: `13.75kg × 10 | 13.75 | 10 | ✓`
  - Row 2: `13.75kg × 10 | 13.75 | 10 | ✓`
  - Row 3: `17.5kg × 8 | 17.5 | 8 | ○` (incomplete)
- Completed rows (1 & 2): **slightly greyed/dimmed in light mode** (not green — green is dark mode only)

**Key new takeaways:**
- ✅ Confirmed: cardio uses `KM | TIME`, PREVIOUS shows `1.2 km in 12:00` format
- ✅ Confirmed: different exercise types in the same workout work fine side by side
- ✅ Completed rows in light mode = dimmed grey (not green) — adapt per theme

---

### Screen 2 — Exercise 3-Dot Menu (bottom sheet)

**Triggered by:** tapping the `⋮` three-dot icon on any exercise card header.

**Sheet contents (4 actions + cancel):**

| Icon | Label | Style |
|------|-------|-------|
| ↕ arrows | Reorder Exercises | Normal |
| ↺ circular | Replace Exercise | Normal |
| + | Add To Superset | Normal |
| ✕ | Remove Exercise | **Red / destructive** |
| — | Cancel | Separate pill below sheet |

**Critical finding — Supersets are built DURING the workout, not in the routine builder:**
- "Add To Superset" lives here, in the active workout 3-dot menu
- User taps it on Exercise A, then selects Exercise B to pair with → they become a superset
- This is simpler than a routine-builder drag UI — no pre-planning required
- Implication: `superset_group_id` needs to be set on `active_exercises` (not just `routine_exercises`)

**Other findings:**
- "Replace Exercise" — swap an exercise mid-workout without losing set data for already-completed sets
- "Reorder Exercises" — drag-to-reorder the exercise list mid-workout
- "Remove Exercise" in red — consistent destructive action colour throughout

**What SuperReps has ✅ / is missing ❌:**
- ✅ Remove exercise (alert-based)
- ❌ **3-dot menu bottom sheet** with all 4 actions
- ❌ **Add To Superset** from active workout
- ❌ **Replace Exercise** mid-workout
- ❌ **Reorder Exercises** mid-workout (drag reorder)

---

### Screen 4 — Exercise Detail "How To" Tab

**Tab:** `Summary | History | How to` — "How to" is active (blue underline)

**Layout:**
- Full-screen page (← back, `•••` top right)
- Large 3D realistic illustration — full machine + person performing the movement, high quality render
- Exercise name bold below image: `Lat Pulldown (Cable)`
- **Numbered coaching cues** (5 steps):
  1. Adjust the knee pad on the machine to be right against your thighs.
  2. Select a weight you can lift for at least ten smooth reps.
  3. Grab the bar with your hands slightly wider than shoulder-width apart. Your palms should face forward.
  4. Sit down and secure your legs underneath the pad.
  5. With your arms extended, bring your shoulders back and down.

**Design pattern:**
- Steps are **numbered list**, not bullet points — implies sequence/order
- Each step is 1–2 sentences, plain English, no jargon
- No video — just the static 3D render + text steps
- The 3D render is the same one from the Summary tab (muscle activation overlay there, neutral pose here)

**What SuperReps has ✅ / is missing ❌:**
- ✅ `instructions` field exists on the exercises table
- ✅ `form_cues` array field exists (from enrichment migration)
- ❌ **Numbered step display** in exercise detail (currently plain text if shown at all)
- ❌ **3D exercise illustration** (no assets yet)
- ❌ "How to" as its own tab in exercise detail

---

## 15. Supersets in Routines

### What Hevy does
- Exercises in a routine can be **grouped as a superset** — two or more exercises performed back-to-back with no rest between them, rest only after the final exercise in the group.
- **In the routine builder:** a "link" icon between two adjacent exercise cards joins them into a superset group. The pair is visually connected with a bracket or vertical line on the left edge.
- **In the active workout:** superset exercises are shown as a grouped block. After completing a set in exercise A, the screen **auto-scrolls** to exercise B ("Smart Superset Scrolling" setting). Rest timer only starts after both are done.
- **Visual indicator:** a small chain-link or "SS" tag on each exercise in the group. The exercise cards in the group share a left-border accent colour or bracket.
- **Logging:** each exercise in the superset logs its own sets independently (Set 1A, Set 1B). The row structure is the same (PREVIOUS | KG | REPS | ✓).

### UX patterns to steal
- Superset grouping is a **routine-level property**, not set at logging time — you design the superset in the routine builder, and it carries through automatically to the workout.
- The group is visually obvious — bracket + accent border on the card left edge, "Superset" label above the group.
- Rest timer behaviour changes: **no rest between paired exercises, full rest after the group** completes.
- Auto-scroll to the next exercise in a superset is a setting (Smart Superset Scrolling) so power users can turn it off.
- Users can **unlink** a superset group without deleting the exercises.

### What SuperReps has ✅ / is missing ❌
- ❌ Superset grouping in routine builder
- ❌ Superset visual indicator in active workout (linked card group)
- ❌ Rest timer skipping between superset exercises
- ❌ Auto-scroll to next exercise in superset
- ❌ DB support for exercise grouping order (exercises are individual, no group_id)

### DB change needed
Add a `superset_group_id` (nullable UUID) to `routine_exercises` — exercises sharing the same `superset_group_id` are treated as a superset. No new table needed.

---

## 15. No-Weight Activities (Cardio / Bodyweight)

### The problem
Not all exercises use weight + reps. Activities like cycling, walking, running, rowing, and bodyweight holds (plank, wall sit) need different tracking units. Forcing "0 kg × reps" on a cycling exercise is confusing and meaningless.

### Hevy's exercise types (confirmed from features + screenshots)
Hevy supports multiple exercise tracking modes based on `type`:

| Exercise Type | Columns shown in set row | Examples |
|--------------|--------------------------|----------|
| **Weight + Reps** (default) | KG \| REPS | Bench Press, Squat, Curl |
| **Bodyweight + Reps** | REPS (no weight column) | Pull-up, Push-up, Dip |
| **Bodyweight + Weight + Reps** | +KG \| REPS | Weighted Pull-up (vest weight) |
| **Duration** | TIME (inline stopwatch) | Plank, Wall Sit, Warm Up |
| **Distance + Duration** | KM \| TIME | Cycling, Running, Walking, Rowing |
| **Weight + Duration** | KG \| TIME | Farmer's carry |

### Column behaviour per type
- **Duration only** (Plank, Warm Up): TIME column with inline ▶ play/pause button. Confirmed in IMG_3919 (Warm Up card shows TIME column, no weight/reps).
- **Distance + Duration** (Cycling, Walking): shows `KM` (or `MI`) + `TIME`. No weight column.
- **Bodyweight**: no weight input — reps only. Bodyweight is implicit.
- The app detects which columns to show based on `exercise.type` — same `InlineSetRow` component, different columns rendered.

### UX patterns to steal
- Exercise type drives the column layout — not a user setting per set, it's a property of the exercise definition.
- For cardio (cycling/walking), show **distance + time** — no weight, no reps.
- For bodyweight, show **reps only** — cleaner and less confusing than "0 kg × 10".
- The "+ Add Set" button and checkmark pattern remain identical regardless of type — consistency.
- In the routine builder, setting target for cardio = "Target: 30 min" or "Target: 5 km" instead of "3×8".

### What SuperReps has ✅ / is missing ❌
- ✅ `exercises` table likely has a `type` or `category` field
- ❌ **Column layout driven by exercise type** — currently always shows KG + REPS for everything
- ❌ **Duration-based set logging** (inline stopwatch per set)
- ❌ **Distance-based set logging** (km/mi column)
- ❌ **Bodyweight-only mode** (no weight column for pull-ups, push-ups)
- ❌ Routine builder targets for cardio ("30 min" not "3×8")

### DB change needed
`exercises.type` should be an enum: `weight_reps` | `bodyweight_reps` | `bodyweight_weighted_reps` | `duration` | `distance_duration` | `weight_duration`. The `active_sets` table needs nullable columns for `distance_km` and `duration_seconds` alongside existing `weight_kg` and `reps`.

---

## 13. Open Questions for SuperReps

- [ ] Do we want RPE at all, or remove it entirely for simplicity?
- [ ] Pre-populate sets from routine — does the DB `sets_config` field have enough data to drive this?
- [ ] Set types (warmup/drop/failure) — keep in DB but surface via long-press rather than a column?
- [ ] Rest timer positioning — floating card vs current inline?
- [ ] Live PR notification — has the infra to detect PRs (yes, `personalBests` is already tracked)?
- [ ] Routine schedule — add a `routine_schedules` table mapping day_index → weekday, or store directly on `routine_days`?
- [ ] Exercise 3D animations — do we have assets or use a third-party source (ExerciseDB has GIFs)?
- [ ] Workout completion celebration — confetti? summary card? both?
- [ ] Supersets — add `superset_group_id` to `routine_exercises`, or use `order_index` pairing? When do we build the superset UI in the routine builder?
- [ ] No-weight activities — which exercise types do we support at launch? At minimum: `weight_reps`, `bodyweight_reps`, `duration`. Cardio (`distance_duration`) can be phase 2?
- [ ] `active_sets` table — add `distance_km` + `duration_seconds` columns for non-weight exercises, or keep as nullable on existing table?

---

## 16. Exercise Library — Muscle-Wise Reference

> Canonical source: `lib/exercises-db.ts` (includes aliases + fuzzy resolver)
> Hevy muscle group taxonomy: Chest · Shoulders · Biceps · Triceps · Upper Back · Lower Back · Lats · Forearms · Abdominals · Neck · Olympic · Quadriceps · Hamstrings · Glutes · Traps · Calves

Legend: `W` = weight+reps · `BW` = bodyweight reps · `D` = duration · `DD` = distance+duration · `WD` = weight+duration

---

### Chest
| Exercise | Type | Equipment |
|----------|------|-----------|
| Barbell Bench Press | W | barbell |
| Dumbbell Bench Press | W | dumbbells |
| Incline Barbell Press | W | barbell |
| Incline Dumbbell Press | W | dumbbells |
| Decline Bench Press | W | barbell |
| Close Grip Bench Press | W | barbell |
| Floor Press | W | barbell |
| Smith Machine Bench | W | machine |
| Machine Chest Press | W | machine |
| Cable Fly | W | cables |
| Dumbbell Fly | W | dumbbells |
| Incline Dumbbell Fly | W | dumbbells |
| Pec Deck | W | machine |
| Landmine Press | W | barbell |
| Push-Up | BW | bodyweight |
| Wide Push-Up | BW | bodyweight |
| Chest Dip | BW | bodyweight |

---

### Back
| Exercise | Type | Equipment |
|----------|------|-----------|
| Barbell Deadlift | W | barbell |
| Romanian Deadlift | W | barbell |
| Sumo Deadlift | W | barbell |
| Rack Pull | W | barbell |
| Barbell Row | W | barbell |
| Pendlay Row | W | barbell |
| Meadows Row | W | barbell |
| T-Bar Row | W | barbell |
| Dumbbell Row | W | dumbbells |
| Chest-Supported Row | W | dumbbells |
| Cable Row | W | cables |
| Straight Arm Pulldown | W | cables |
| Machine Row | W | machine |
| Lat Pulldown | W | cables |
| Lat Pulldown (Band) | W | bands |
| Assisted Pull-Up | W | machine |
| Band Row | W | bands |
| Pull-Up | BW | pullup_bar |
| Chin-Up | BW | pullup_bar |
| Face Pull | W | cables |
| Shrug | W | barbell |

---

### Shoulders
| Exercise | Type | Equipment |
|----------|------|-----------|
| Overhead Press | W | barbell |
| Dumbbell Shoulder Press | W | dumbbells |
| Arnold Press | W | dumbbells |
| Machine Shoulder Press | W | machine |
| Lateral Raise | W | dumbbells |
| Cable Lateral Raise | W | cables |
| Front Raise | W | dumbbells |
| Upright Row | W | barbell |
| Reverse Fly | W | dumbbells |
| Cable Rear Delt Fly | W | cables |
| Band Pull Apart | W | bands |
| Handstand Push-Up | BW | bodyweight |

---

### Biceps
| Exercise | Type | Equipment |
|----------|------|-----------|
| Barbell Curl | W | barbell |
| Dumbbell Curl | W | dumbbells |
| Hammer Curl | W | dumbbells |
| Preacher Curl | W | barbell |
| Concentration Curl | W | dumbbells |
| Incline Dumbbell Curl | W | dumbbells |
| Cable Curl | W | cables |
| Reverse Curl | W | barbell |
| Plate Curl | W | barbell |
| Band Curl | W | bands |

---

### Triceps
| Exercise | Type | Equipment |
|----------|------|-----------|
| Tricep Pushdown | W | cables |
| Skull Crusher | W | barbell |
| Dumbbell Skull Crusher | W | dumbbells |
| Overhead Tricep Extension | W | dumbbells |
| Cable Overhead Extension | W | cables |
| Close Grip Bench Press | W | barbell |
| Band Tricep Extension | W | bands |
| Tricep Dip | BW | bodyweight |
| Diamond Push-Up | BW | bodyweight |

---

### Quadriceps
| Exercise | Type | Equipment |
|----------|------|-----------|
| Barbell Squat | W | barbell |
| Front Squat | W | barbell |
| Sumo Squat | W | barbell |
| Goblet Squat | W | dumbbells |
| Hack Squat | W | machine |
| Leg Press | W | machine |
| Smith Machine Squat | W | machine |
| Bulgarian Split Squat | W | dumbbells |
| Lunge | W | dumbbells |
| Walking Lunge | W | dumbbells |
| Reverse Lunge | W | dumbbells |
| Step Up | W | dumbbells |
| Leg Extension | W | machine |
| Band Squat | W | bands |
| Overhead Squat | W | barbell |
| Thrusters | W | barbell |

---

### Hamstrings
| Exercise | Type | Equipment |
|----------|------|-----------|
| Romanian Deadlift | W | barbell |
| Stiff Leg Deadlift | W | barbell |
| Leg Curl | W | machine |

---

### Glutes
| Exercise | Type | Equipment |
|----------|------|-----------|
| Hip Thrust | W | barbell |
| Glute Bridge | BW | bodyweight |
| Single Leg Glute Bridge | BW | bodyweight |
| Cable Kickback | W | cables |
| Kettlebell Swing | W | kettlebells |

---

### Calves
| Exercise | Type | Equipment |
|----------|------|-----------|
| Standing Calf Raise | W | machine |
| Seated Calf Raise | W | machine |
| Donkey Calf Raise | BW | bodyweight |

---

### Core / Abdominals
| Exercise | Type | Equipment |
|----------|------|-----------|
| Plank | D | bodyweight |
| Side Plank | D | bodyweight |
| Ab Crunch | BW | bodyweight |
| Sit-Up | BW | bodyweight |
| Decline Crunch | BW | bodyweight |
| Hanging Leg Raise | BW | pullup_bar |
| Leg Raise | BW | bodyweight |
| Flutter Kick | BW | bodyweight |
| Ab Wheel Rollout | BW | bodyweight |
| Dragon Flag | BW | bodyweight |
| Cable Crunch | W | cables |
| Russian Twist | W | dumbbells |
| Pallof Press | W | cables |
| Front Lever Raise | BW | pullup_bar |

---

### Forearms / Traps
| Exercise | Type | Equipment |
|----------|------|-----------|
| Wrist Curl | W | barbell |
| Reverse Curl | W | barbell |
| Farmer Carry | WD | dumbbells |
| Shrug | W | barbell |

---

### Full Body / Olympic
| Exercise | Type | Equipment |
|----------|------|-----------|
| Power Clean | W | barbell |
| Clean and Jerk | W | barbell |
| Clean and Press | W | barbell |
| Snatch | W | barbell |
| Overhead Squat | W | barbell |
| Thrusters | W | barbell |
| Kettlebell Swing | W | kettlebells |
| Turkish Get-Up | W | kettlebells |
| Muscle Up | BW | pullup_bar |
| Burpee | BW | bodyweight |

---

### Cardio / No-Weight Activities
| Exercise | Type | Equipment |
|----------|------|-----------|
| Running | DD | bodyweight |
| Walking | DD | bodyweight |
| Cycling | DD | cardio_machine |
| Rowing | DD | cardio_machine |
| Swimming | DD | bodyweight |
| Elliptical | DD | cardio_machine |
| Stair Climber | D | cardio_machine |
| Jump Rope | D | bodyweight |
| Warm Up | D | bodyweight |

---

### Additional Hevy Exercises (not yet in seed, worth adding)
> From hevyapp.com/exercises — exercises in Hevy's library not currently seeded in SuperReps

| Exercise | Muscle | Notes |
|----------|--------|-------|
| Sternum Pull-Up (Gironda) | Lats | Advanced pull-up variant |
| Kipping Pull-Up | Lats | CrossFit style |
| Scapular Pull-Up | Upper Back | Shoulder health |
| One-Arm Push-Up | Full Body | Advanced |
| Ring Dips | Triceps | Gymnastics rings |
| Bent Over Fly | Upper Back | = Reverse Fly seated |
| Chest-Supported Incline Row | Upper Back | Hevy uses this name |
| Cable Fly Crossovers | Chest | Hevy name for cable fly |
| Low Cable Fly Crossovers | Chest | Low pulley cable fly |
| Triceps Dip (Weighted) | Triceps | Dip with belt/dumbbell |
| Heel Taps | Abdominals | Oblique movement |
| Lateral Leg Raises | Glutes | Side-lying raise |
| Glute Kickback on Floor | Glutes | Bodyweight, on all fours |
| Skullcrusher (Barbell) | Triceps | Same as Skull Crusher |
| Sumo Squat (Barbell) | Quadriceps | Wide stance squat |
| Incline Push Ups | Chest | Hands elevated |
| Russian Twist (Weighted) | Abdominals | With plate/dumbbell |
| Hang Snatch | Full Body | Olympic variation |
| Clean Pull | Full Body | Pull portion of clean |
| Chest Dip (Weighted) | Chest | Dip with added weight |
| Triceps Extension (Barbell) | Triceps | Standing barbell extension |
| Behind the Back Wrist Curl | Forearms | Hevy specific |
| Split Squat (Dumbbell) | Quadriceps | = Bulgarian without elevation |
| Bench Press – Wide Grip | Chest | Wide grip variation |
| Frog Jumps | Full Body | Plyometric |
| Concentration Curl (DB) | Biceps | Already seeded |
