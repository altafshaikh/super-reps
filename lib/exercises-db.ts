/**
 * Canonical exercise database for SuperReps.
 *
 * Every exercise has:
 *   - name        canonical display name (matches seed_exercises.sql)
 *   - slug        DB slug
 *   - aliases     misspellings, abbreviations, alternate names — used by AI routine builder
 *   - primary     primary muscle group(s)
 *   - secondary   secondary / synergist muscles
 *   - equipment   required equipment
 *   - type        tracking mode (drives which columns show in the set row)
 *
 * findExercise(query) — call this whenever the AI or a user types an exercise
 * name and you need to resolve it to the canonical entry. Handles typos,
 * abbreviations and partial matches.
 */

export type ExerciseType =
  | 'weight_reps'          // barbell/dumbbell lifts    → KG | REPS
  | 'bodyweight_reps'      // pull-ups, push-ups        → REPS only
  | 'bodyweight_weighted'  // weighted pull-up/dip      → +KG | REPS
  | 'duration'             // plank, wall sit, warm-up  → TIME
  | 'distance_duration'    // cycling, running, walking → KM | TIME
  | 'weight_duration';     // farmer carry, sled push   → KG | TIME

export type MuscleGroup =
  | 'chest' | 'back' | 'lats' | 'traps' | 'shoulders'
  | 'biceps' | 'triceps' | 'forearms'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves'
  | 'core' | 'full_body' | 'cardio';

export interface ExerciseEntry {
  name: string;
  slug: string;
  aliases: string[];
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  equipment: string[];
  type: ExerciseType;
}

// ─── CHEST ───────────────────────────────────────────────────────────────────

const CHEST: ExerciseEntry[] = [
  {
    name: 'Barbell Bench Press',
    slug: 'barbell_bench_press',
    aliases: ['bench press', 'bench', 'flat bench', 'flat bench press', 'barbell bench', 'bp', 'benchpress', 'chest press barbell', 'flat barbell press'],
    primary: ['chest'],
    secondary: ['triceps', 'shoulders'],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Dumbbell Bench Press',
    slug: 'dumbbell_bench_press',
    aliases: ['db bench', 'dumbbell bench', 'db bench press', 'dumbell bench press', 'dumb bell bench', 'flat db press', 'dumbbell chest press'],
    primary: ['chest'],
    secondary: ['triceps', 'shoulders'],
    equipment: ['dumbbells'],
    type: 'weight_reps',
  },
  {
    name: 'Incline Barbell Press',
    slug: 'incline_barbell_press',
    aliases: ['incline bench', 'incline press', 'incline barbell bench', 'incline bb press', 'incline bench press', 'upper chest press barbell'],
    primary: ['chest'],
    secondary: ['shoulders', 'triceps'],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Incline Dumbbell Press',
    slug: 'incline_dumbbell_press',
    aliases: ['incline db press', 'incline dumbbell bench', 'incline dumbell press', 'incline db bench', 'incline dumb bell press', 'upper chest db press'],
    primary: ['chest'],
    secondary: ['shoulders', 'triceps'],
    equipment: ['dumbbells'],
    type: 'weight_reps',
  },
  {
    name: 'Decline Bench Press',
    slug: 'decline_bench_press',
    aliases: ['decline bench', 'decline press', 'decline barbell press', 'lower chest press', 'decline bb press'],
    primary: ['chest'],
    secondary: ['triceps'],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Cable Fly',
    slug: 'cable_fly',
    aliases: ['cable flye', 'cable flyes', 'cable flies', 'cable chest fly', 'low cable fly', 'high cable fly', 'cable crossover', 'chest cable fly', 'pec fly cable'],
    primary: ['chest'],
    secondary: [],
    equipment: ['cables'],
    type: 'weight_reps',
  },
  {
    name: 'Dumbbell Fly',
    slug: 'dumbbell_fly',
    aliases: ['db fly', 'dumbbell flye', 'db flye', 'dumbbell flies', 'dumbell fly', 'dumb bell fly', 'chest fly', 'flat fly', 'pec fly'],
    primary: ['chest'],
    secondary: [],
    equipment: ['dumbbells'],
    type: 'weight_reps',
  },
  {
    name: 'Incline Dumbbell Fly',
    slug: 'incline_dumbbell_fly',
    aliases: ['incline db fly', 'incline fly', 'incline flye', 'incline dumbbell flye', 'upper chest fly'],
    primary: ['chest'],
    secondary: ['shoulders'],
    equipment: ['dumbbells'],
    type: 'weight_reps',
  },
  {
    name: 'Push-Up',
    slug: 'push_up',
    aliases: ['pushup', 'push up', 'press up', 'pressup', 'standard push up', 'push ups', 'pushups'],
    primary: ['chest'],
    secondary: ['triceps', 'shoulders'],
    equipment: ['bodyweight'],
    type: 'bodyweight_reps',
  },
  {
    name: 'Wide Push-Up',
    slug: 'wide_push_up',
    aliases: ['wide pushup', 'wide grip push up', 'wide push ups', 'wide grip pushup'],
    primary: ['chest'],
    secondary: ['shoulders'],
    equipment: ['bodyweight'],
    type: 'bodyweight_reps',
  },
  {
    name: 'Chest Dip',
    slug: 'chest_dip',
    aliases: ['dip', 'dips', 'chest dips', 'parallel bar dip', 'parallel dip', 'tricep dip chest', 'leaning dip'],
    primary: ['chest'],
    secondary: ['triceps'],
    equipment: ['bodyweight'],
    type: 'bodyweight_reps',
  },
  {
    name: 'Pec Deck',
    slug: 'pec_deck',
    aliases: ['pec fly machine', 'machine fly', 'butterfly machine', 'chest machine fly', 'pec dec', 'pek deck', 'peck deck', 'chest butterfly'],
    primary: ['chest'],
    secondary: [],
    equipment: ['machine'],
    type: 'weight_reps',
  },
  {
    name: 'Machine Chest Press',
    slug: 'machine_chest_press',
    aliases: ['chest press machine', 'machine press', 'seated chest press', 'hammer strength chest', 'plate loaded chest press'],
    primary: ['chest'],
    secondary: ['triceps', 'shoulders'],
    equipment: ['machine'],
    type: 'weight_reps',
  },
  {
    name: 'Smith Machine Bench',
    slug: 'smith_machine_bench',
    aliases: ['smith bench', 'smith machine bench press', 'smith press', 'smith flat bench'],
    primary: ['chest'],
    secondary: ['triceps'],
    equipment: ['machine'],
    type: 'weight_reps',
  },
  {
    name: 'Close Grip Bench Press',
    slug: 'close_grip_bench',
    aliases: ['close grip bench', 'narrow grip bench', 'cgbp', 'close grip press', 'narrow grip bench press', 'close grip bb press', 'tricep bench press'],
    primary: ['triceps'],
    secondary: ['chest'],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Floor Press',
    slug: 'floor_press',
    aliases: ['barbell floor press', 'floor bench press', 'lying floor press'],
    primary: ['chest'],
    secondary: ['triceps'],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Landmine Press',
    slug: 'landmine_press',
    aliases: ['landmine chest press', 'angled barbell press', 'land mine press'],
    primary: ['chest'],
    secondary: ['shoulders', 'triceps'],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
];

// ─── BACK ─────────────────────────────────────────────────────────────────────

const BACK: ExerciseEntry[] = [
  {
    name: 'Barbell Deadlift',
    slug: 'barbell_deadlift',
    aliases: ['deadlift', 'dead lift', 'conventional deadlift', 'dl', 'barbell dl', 'bb deadlift', 'conventional dl'],
    primary: ['back', 'glutes', 'hamstrings'],
    secondary: ['traps', 'forearms'],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Romanian Deadlift',
    slug: 'romanian_deadlift',
    aliases: ['rdl', 'romanian dl', 'romanian dead lift', 'stiff leg rdl', 'straight leg deadlift', 'ro deadlift', 'rumanian deadlift'],
    primary: ['hamstrings', 'glutes'],
    secondary: ['back'],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Barbell Row',
    slug: 'barbell_row',
    aliases: ['bent over row', 'barbell bent over row', 'bb row', 'bent row', 'overhand row', 'pronated row', 'barbell back row', 'pendlay row style'],
    primary: ['back'],
    secondary: ['biceps'],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Dumbbell Row',
    slug: 'dumbbell_row',
    aliases: ['db row', 'one arm row', 'single arm row', 'one arm dumbbell row', '1 arm row', 'db bent over row', 'dumbell row', 'dumb bell row'],
    primary: ['back'],
    secondary: ['biceps'],
    equipment: ['dumbbells'],
    type: 'weight_reps',
  },
  {
    name: 'Pull-Up',
    slug: 'pull_up',
    aliases: ['pullup', 'pull up', 'overhand pullup', 'pronated pull up', 'wide grip pull up', 'pull ups', 'pullups', 'strict pull up'],
    primary: ['lats', 'back'],
    secondary: ['biceps'],
    equipment: ['pullup_bar'],
    type: 'bodyweight_reps',
  },
  {
    name: 'Chin-Up',
    slug: 'chin_up',
    aliases: ['chinup', 'chin up', 'supinated pull up', 'underhand pull up', 'underhand pullup', 'chin ups', 'chinups', 'reverse grip pull up'],
    primary: ['lats', 'back'],
    secondary: ['biceps'],
    equipment: ['pullup_bar'],
    type: 'bodyweight_reps',
  },
  {
    name: 'Lat Pulldown',
    slug: 'lat_pulldown',
    aliases: ['lat pull down', 'pulldown', 'pull down', 'cable pulldown', 'wide grip pulldown', 'lat pull', 'lats pulldown', 'latpulldown'],
    primary: ['lats'],
    secondary: ['back', 'biceps'],
    equipment: ['cables'],
    type: 'weight_reps',
  },
  {
    name: 'Cable Row',
    slug: 'cable_row',
    aliases: ['seated cable row', 'low cable row', 'cable seated row', 'seated row', 'close grip cable row', 'cable rowing', 'machine row cable'],
    primary: ['back'],
    secondary: ['biceps'],
    equipment: ['cables'],
    type: 'weight_reps',
  },
  {
    name: 'T-Bar Row',
    slug: 't_bar_row',
    aliases: ['t bar row', 'tbar row', 'landmine row', 't-bar', 'chest supported t bar', 'v grip row'],
    primary: ['back'],
    secondary: ['biceps'],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Face Pull',
    slug: 'face_pull',
    aliases: ['face pulls', 'cable face pull', 'rope face pull', 'rear delt face pull', 'face pull cable', 'face pull rope'],
    primary: ['shoulders', 'back'],
    secondary: ['traps'],
    equipment: ['cables'],
    type: 'weight_reps',
  },
  {
    name: 'Seated Cable Row',
    slug: 'seated_cable_row',
    aliases: ['seated row', 'cable seated row', 'low row', 'horizontal cable row'],
    primary: ['back'],
    secondary: ['biceps'],
    equipment: ['cables'],
    type: 'weight_reps',
  },
  {
    name: 'Chest-Supported Row',
    slug: 'chest_supported_row',
    aliases: ['chest supported dumbbell row', 'incline row', 'prone row', 'chest supported db row', 'meadows row style'],
    primary: ['back'],
    secondary: ['biceps'],
    equipment: ['dumbbells'],
    type: 'weight_reps',
  },
  {
    name: 'Pendlay Row',
    slug: 'pendlay_row',
    aliases: ['dead stop row', 'floor row', 'strict barbell row', 'explosive row'],
    primary: ['back'],
    secondary: ['biceps'],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Meadows Row',
    slug: 'meadows_row',
    aliases: ['meadow row', 'meadows', 'landmine single arm row'],
    primary: ['back'],
    secondary: ['biceps'],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Machine Row',
    slug: 'machine_row',
    aliases: ['row machine', 'hammer strength row', 'plate loaded row', 'seated machine row', 'chest supported machine row'],
    primary: ['back'],
    secondary: ['biceps'],
    equipment: ['machine'],
    type: 'weight_reps',
  },
  {
    name: 'Assisted Pull-Up',
    slug: 'assisted_pull_up',
    aliases: ['assisted pullup', 'machine pull up', 'pull up machine', 'band assisted pull up', 'assisted chin up'],
    primary: ['lats', 'back'],
    secondary: ['biceps'],
    equipment: ['machine'],
    type: 'weight_reps',
  },
  {
    name: 'Shrug',
    slug: 'shrug',
    aliases: ['barbell shrug', 'shoulder shrug', 'trap shrug', 'db shrug', 'dumbbell shrug', 'shrugs', 'traps shrug'],
    primary: ['traps'],
    secondary: [],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Rack Pull',
    slug: 'rack_pull',
    aliases: ['rack pulls', 'partial deadlift', 'rack deadlift', 'block pull'],
    primary: ['back', 'traps'],
    secondary: ['glutes'],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Straight Arm Pulldown',
    slug: 'straight_arm_pulldown',
    aliases: ['straight arm lat pulldown', 'cable pullover', 'stiff arm pulldown', 'lat pushdown', 'straight arm cable pulldown'],
    primary: ['lats'],
    secondary: ['back'],
    equipment: ['cables'],
    type: 'weight_reps',
  },
  {
    name: 'Band Row',
    slug: 'band_row',
    aliases: ['resistance band row', 'band pull row', 'elastic band row'],
    primary: ['back'],
    secondary: ['biceps'],
    equipment: ['bands'],
    type: 'weight_reps',
  },
  {
    name: 'Lat Pulldown (Band)',
    slug: 'lat_pulldown_band',
    aliases: ['band lat pulldown', 'band pulldown', 'resistance band lat pulldown'],
    primary: ['lats'],
    secondary: ['back'],
    equipment: ['bands'],
    type: 'weight_reps',
  },
];

// ─── SHOULDERS ────────────────────────────────────────────────────────────────

const SHOULDERS: ExerciseEntry[] = [
  {
    name: 'Overhead Press',
    slug: 'overhead_press',
    aliases: ['ohp', 'military press', 'standing press', 'barbell ohp', 'strict press', 'barbell overhead press', 'bb ohp', 'shoulder press barbell', 'press', 'over head press'],
    primary: ['shoulders'],
    secondary: ['triceps'],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Dumbbell Shoulder Press',
    slug: 'dumbbell_shoulder_press',
    aliases: ['db shoulder press', 'seated db press', 'dumbbell ohp', 'db ohp', 'db press shoulders', 'seated dumbbell press', 'dumbell shoulder press', 'dumb bell press'],
    primary: ['shoulders'],
    secondary: ['triceps'],
    equipment: ['dumbbells'],
    type: 'weight_reps',
  },
  {
    name: 'Arnold Press',
    slug: 'arnold_press',
    aliases: ['arnold dumbbell press', 'arnold db press', 'rotating shoulder press', 'rotation press', 'arnolds'],
    primary: ['shoulders'],
    secondary: ['triceps'],
    equipment: ['dumbbells'],
    type: 'weight_reps',
  },
  {
    name: 'Lateral Raise',
    slug: 'lateral_raise',
    aliases: ['side raise', 'side lateral raise', 'dumbbell lateral raise', 'db lateral raise', 'lat raise', 'shoulder side raise', 'lateral dumbbell raise', 'lateral raises'],
    primary: ['shoulders'],
    secondary: [],
    equipment: ['dumbbells'],
    type: 'weight_reps',
  },
  {
    name: 'Cable Lateral Raise',
    slug: 'cable_lateral_raise',
    aliases: ['cable side raise', 'cable lat raise', 'one arm cable lateral raise', 'single arm cable lateral raise'],
    primary: ['shoulders'],
    secondary: [],
    equipment: ['cables'],
    type: 'weight_reps',
  },
  {
    name: 'Front Raise',
    slug: 'front_raise',
    aliases: ['dumbbell front raise', 'db front raise', 'anterior raise', 'front delt raise', 'barbell front raise', 'plate front raise'],
    primary: ['shoulders'],
    secondary: [],
    equipment: ['dumbbells'],
    type: 'weight_reps',
  },
  {
    name: 'Upright Row',
    slug: 'upright_row',
    aliases: ['upright rows', 'barbell upright row', 'db upright row', 'cable upright row', 'trap upright row'],
    primary: ['shoulders', 'traps'],
    secondary: [],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Reverse Fly',
    slug: 'reverse_fly',
    aliases: ['rear delt fly', 'reverse dumbbell fly', 'bent over reverse fly', 'rear fly', 'posterior fly', 'reverse delt fly', 'reverse flye', 'bent over fly', 'rear delt raise'],
    primary: ['shoulders', 'back'],
    secondary: ['traps'],
    equipment: ['dumbbells'],
    type: 'weight_reps',
  },
  {
    name: 'Machine Shoulder Press',
    slug: 'machine_shoulder_press',
    aliases: ['shoulder press machine', 'seated machine press', 'hammer strength shoulder press', 'plate loaded shoulder press'],
    primary: ['shoulders'],
    secondary: ['triceps'],
    equipment: ['machine'],
    type: 'weight_reps',
  },
  {
    name: 'Band Pull Apart',
    slug: 'band_pull_apart',
    aliases: ['band pull aparts', 'resistance band pull apart', 'band rear delt', 'pull apart', 'bpa'],
    primary: ['shoulders', 'back'],
    secondary: ['traps'],
    equipment: ['bands'],
    type: 'weight_reps',
  },
  {
    name: 'Handstand Push-Up',
    slug: 'handstand_push_up',
    aliases: ['hspu', 'handstand pushup', 'handstand press', 'wall handstand push up', 'pike push up'],
    primary: ['shoulders'],
    secondary: ['triceps'],
    equipment: ['bodyweight'],
    type: 'bodyweight_reps',
  },
  {
    name: 'Cable Rear Delt Fly',
    slug: 'cable_rear_delt_fly',
    aliases: ['cable reverse fly', 'cable rear fly', 'cable face pull low', 'rear delt cable fly'],
    primary: ['shoulders'],
    secondary: ['back'],
    equipment: ['cables'],
    type: 'weight_reps',
  },
];

// ─── BICEPS ───────────────────────────────────────────────────────────────────

const BICEPS: ExerciseEntry[] = [
  {
    name: 'Barbell Curl',
    slug: 'barbell_curl',
    aliases: ['bb curl', 'straight bar curl', 'barbell bicep curl', 'bicep curl barbell', 'standing barbell curl', 'ez bar curl', 'ez curl'],
    primary: ['biceps'],
    secondary: ['forearms'],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Dumbbell Curl',
    slug: 'dumbbell_curl',
    aliases: ['db curl', 'bicep curl', 'alternate curl', 'alternating dumbbell curl', 'dumbbell bicep curl', 'dumbell curl', 'dumb bell curl', 'arm curl', 'curls'],
    primary: ['biceps'],
    secondary: [],
    equipment: ['dumbbells'],
    type: 'weight_reps',
  },
  {
    name: 'Hammer Curl',
    slug: 'hammer_curl',
    aliases: ['hammer curls', 'neutral grip curl', 'db hammer curl', 'dumbbell hammer curl', 'hammer bicep curl', 'cross body curl'],
    primary: ['biceps', 'forearms'],
    secondary: [],
    equipment: ['dumbbells'],
    type: 'weight_reps',
  },
  {
    name: 'Preacher Curl',
    slug: 'preacher_curl',
    aliases: ['preacher curls', 'scott curl', 'ez preacher curl', 'barbell preacher curl', 'db preacher curl', 'preacher bench curl'],
    primary: ['biceps'],
    secondary: [],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Concentration Curl',
    slug: 'concentration_curl',
    aliases: ['concentration curls', 'seated concentration curl', 'strict curl', 'spider curl', 'db concentration curl'],
    primary: ['biceps'],
    secondary: [],
    equipment: ['dumbbells'],
    type: 'weight_reps',
  },
  {
    name: 'Cable Curl',
    slug: 'cable_curl',
    aliases: ['cable bicep curl', 'low cable curl', 'cable bar curl', 'rope curl', 'cable rope curl', 'cable curls'],
    primary: ['biceps'],
    secondary: [],
    equipment: ['cables'],
    type: 'weight_reps',
  },
  {
    name: 'Incline Dumbbell Curl',
    slug: 'incline_dumbbell_curl',
    aliases: ['incline db curl', 'incline curl', 'incline bicep curl', 'incline seated curl'],
    primary: ['biceps'],
    secondary: [],
    equipment: ['dumbbells'],
    type: 'weight_reps',
  },
  {
    name: 'Reverse Curl',
    slug: 'reverse_curl',
    aliases: ['reverse barbell curl', 'overhand curl', 'pronated curl', 'reverse bicep curl', 'reverse grip curl'],
    primary: ['forearms', 'biceps'],
    secondary: [],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Band Curl',
    slug: 'band_curl',
    aliases: ['resistance band curl', 'band bicep curl', 'elastic band curl'],
    primary: ['biceps'],
    secondary: [],
    equipment: ['bands'],
    type: 'weight_reps',
  },
  {
    name: 'Plate Curl',
    slug: 'plate_curl',
    aliases: ['plate curls', 'weight plate curl', 'pinch curl'],
    primary: ['biceps', 'forearms'],
    secondary: [],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
];

// ─── TRICEPS ──────────────────────────────────────────────────────────────────

const TRICEPS: ExerciseEntry[] = [
  {
    name: 'Tricep Pushdown',
    slug: 'tricep_pushdown',
    aliases: ['triceps pushdown', 'cable pushdown', 'cable tricep pushdown', 'rope pushdown', 'tricep press down', 'pressdown', 'press down', 'tricep pulldown', 'cable rope pushdown', 'cable tricep extension'],
    primary: ['triceps'],
    secondary: [],
    equipment: ['cables'],
    type: 'weight_reps',
  },
  {
    name: 'Skull Crusher',
    slug: 'skull_crusher',
    aliases: ['skullcrusher', 'skull crushers', 'lying tricep extension', 'ez bar skull crusher', 'barbell skull crusher', 'French press lying', 'nose breaker', 'nosebreaker', 'EZ skull crusher'],
    primary: ['triceps'],
    secondary: [],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Overhead Tricep Extension',
    slug: 'overhead_tricep_ext',
    aliases: ['overhead tricep', 'French press', 'french press dumbbell', 'dumbbell overhead extension', 'overhead extension', 'tricep overhead press', 'one arm overhead extension', 'db tricep extension overhead'],
    primary: ['triceps'],
    secondary: [],
    equipment: ['dumbbells'],
    type: 'weight_reps',
  },
  {
    name: 'Tricep Dip',
    slug: 'tricep_dip',
    aliases: ['triceps dip', 'bench dip', 'tricep dips', 'chair dip', 'dips tricep', 'upright dip'],
    primary: ['triceps'],
    secondary: ['chest'],
    equipment: ['bodyweight'],
    type: 'bodyweight_reps',
  },
  {
    name: 'Diamond Push-Up',
    slug: 'diamond_push_up',
    aliases: ['diamond pushup', 'triangle push up', 'close grip push up', 'close hand push up', 'narrow push up', 'tricep push up'],
    primary: ['triceps'],
    secondary: ['chest'],
    equipment: ['bodyweight'],
    type: 'bodyweight_reps',
  },
  {
    name: 'Cable Overhead Extension',
    slug: 'cable_overhead_ext',
    aliases: ['cable tricep overhead', 'rope overhead extension', 'cable rope overhead', 'overhead cable tricep extension', 'high cable extension'],
    primary: ['triceps'],
    secondary: [],
    equipment: ['cables'],
    type: 'weight_reps',
  },
  {
    name: 'Band Tricep Extension',
    slug: 'band_tricep_ext',
    aliases: ['resistance band tricep extension', 'band tricep pushdown', 'band overhead tricep'],
    primary: ['triceps'],
    secondary: [],
    equipment: ['bands'],
    type: 'weight_reps',
  },
  {
    name: 'Dumbbell Skull Crusher',
    slug: 'dumbbell_skull_crusher',
    aliases: ['db skull crusher', 'dumbbell lying extension', 'db lying tricep extension', 'dumbbell skullcrusher'],
    primary: ['triceps'],
    secondary: [],
    equipment: ['dumbbells'],
    type: 'weight_reps',
  },
];

// ─── LEGS ─────────────────────────────────────────────────────────────────────

const LEGS: ExerciseEntry[] = [
  {
    name: 'Barbell Squat',
    slug: 'barbell_squat',
    aliases: ['squat', 'back squat', 'barbell back squat', 'low bar squat', 'high bar squat', 'bb squat', 'squats', 'bb back squat'],
    primary: ['quads', 'glutes'],
    secondary: ['hamstrings'],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Front Squat',
    slug: 'front_squat',
    aliases: ['front squats', 'barbell front squat', 'front rack squat', 'clean grip squat'],
    primary: ['quads'],
    secondary: ['core', 'glutes'],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Goblet Squat',
    slug: 'goblet_squat',
    aliases: ['goblet squats', 'dumbbell goblet squat', 'kettlebell goblet squat', 'kb goblet squat', 'db goblet squat', 'cup squat'],
    primary: ['quads', 'glutes'],
    secondary: ['core'],
    equipment: ['dumbbells'],
    type: 'weight_reps',
  },
  {
    name: 'Hack Squat',
    slug: 'hack_squat',
    aliases: ['hack squats', 'machine hack squat', 'sled squat', 'barbell hack squat'],
    primary: ['quads'],
    secondary: ['glutes'],
    equipment: ['machine'],
    type: 'weight_reps',
  },
  {
    name: 'Leg Press',
    slug: 'leg_press',
    aliases: ['leg press machine', '45 degree leg press', 'machine leg press', 'horizontal leg press', 'sled leg press'],
    primary: ['quads', 'glutes'],
    secondary: ['hamstrings'],
    equipment: ['machine'],
    type: 'weight_reps',
  },
  {
    name: 'Bulgarian Split Squat',
    slug: 'bulgarian_split_squat',
    aliases: ['bss', 'bulgarian squat', 'split squat', 'rear foot elevated split squat', 'rfess', 'single leg squat elevated', 'dumbbell bss', 'db bss'],
    primary: ['quads', 'glutes'],
    secondary: ['hamstrings'],
    equipment: ['dumbbells'],
    type: 'weight_reps',
  },
  {
    name: 'Lunge',
    slug: 'lunge',
    aliases: ['lunges', 'dumbbell lunge', 'barbell lunge', 'db lunges', 'forward lunge', 'stationary lunge', 'split lunge'],
    primary: ['quads', 'glutes'],
    secondary: ['hamstrings'],
    equipment: ['dumbbells'],
    type: 'weight_reps',
  },
  {
    name: 'Walking Lunge',
    slug: 'walking_lunge',
    aliases: ['walking lunges', 'travel lunge', 'db walking lunge', 'barbell walking lunge', 'continuous lunge'],
    primary: ['quads', 'glutes'],
    secondary: ['hamstrings'],
    equipment: ['dumbbells'],
    type: 'weight_reps',
  },
  {
    name: 'Reverse Lunge',
    slug: 'reverse_lunge',
    aliases: ['reverse lunges', 'backward lunge', 'step back lunge', 'db reverse lunge'],
    primary: ['quads', 'glutes'],
    secondary: ['hamstrings'],
    equipment: ['dumbbells'],
    type: 'weight_reps',
  },
  {
    name: 'Step Up',
    slug: 'step_up',
    aliases: ['step ups', 'box step up', 'dumbbell step up', 'db step up', 'bench step up'],
    primary: ['quads', 'glutes'],
    secondary: [],
    equipment: ['dumbbells'],
    type: 'weight_reps',
  },
  {
    name: 'Leg Extension',
    slug: 'leg_extension',
    aliases: ['leg extensions', 'quad extension', 'machine leg extension', 'knee extension', 'quads machine'],
    primary: ['quads'],
    secondary: [],
    equipment: ['machine'],
    type: 'weight_reps',
  },
  {
    name: 'Leg Curl',
    slug: 'leg_curl',
    aliases: ['lying leg curl', 'seated leg curl', 'hamstring curl', 'machine leg curl', 'ham curl', 'leg curls', 'hamstring machine'],
    primary: ['hamstrings'],
    secondary: [],
    equipment: ['machine'],
    type: 'weight_reps',
  },
  {
    name: 'Romanian Deadlift',
    slug: 'romanian_deadlift',
    aliases: ['rdl', 'stiff leg deadlift', 'sldl', 'straight leg dl', 'romanian dl'],
    primary: ['hamstrings', 'glutes'],
    secondary: ['back'],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Stiff Leg Deadlift',
    slug: 'stiff_leg_deadlift',
    aliases: ['stiff legged deadlift', 'sldl', 'straight leg deadlift', 'dumbbell rdl', 'db rdl'],
    primary: ['hamstrings', 'glutes'],
    secondary: ['back'],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Hip Thrust',
    slug: 'hip_thrust',
    aliases: ['hip thrusts', 'barbell hip thrust', 'glute thrust', 'weighted hip thrust', 'glute bridge barbell', 'bb hip thrust'],
    primary: ['glutes'],
    secondary: ['hamstrings'],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Glute Bridge',
    slug: 'glute_bridge',
    aliases: ['glute bridges', 'bodyweight glute bridge', 'floor glute bridge', 'bridge', 'hip bridge'],
    primary: ['glutes', 'hamstrings'],
    secondary: [],
    equipment: ['bodyweight'],
    type: 'bodyweight_reps',
  },
  {
    name: 'Single Leg Glute Bridge',
    slug: 'single_leg_glute_bridge',
    aliases: ['single leg bridge', 'one leg glute bridge', 'unilateral glute bridge'],
    primary: ['glutes'],
    secondary: ['hamstrings'],
    equipment: ['bodyweight'],
    type: 'bodyweight_reps',
  },
  {
    name: 'Cable Kickback',
    slug: 'cable_kickback',
    aliases: ['glute kickback', 'cable glute kickback', 'donkey kickback', 'standing cable kickback', 'kickback cable'],
    primary: ['glutes'],
    secondary: [],
    equipment: ['cables'],
    type: 'weight_reps',
  },
  {
    name: 'Sumo Deadlift',
    slug: 'sumo_deadlift',
    aliases: ['sumo dl', 'wide stance deadlift', 'sumo barbell deadlift'],
    primary: ['glutes', 'quads'],
    secondary: ['hamstrings', 'back'],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Sumo Squat',
    slug: 'sumo_squat',
    aliases: ['wide squat', 'sumo stance squat', 'plie squat', 'wide leg squat'],
    primary: ['quads', 'glutes'],
    secondary: ['hamstrings'],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Smith Machine Squat',
    slug: 'smith_machine_squat',
    aliases: ['smith squat', 'smith machine squats', 'guided squat'],
    primary: ['quads', 'glutes'],
    secondary: [],
    equipment: ['machine'],
    type: 'weight_reps',
  },
  {
    name: 'Band Squat',
    slug: 'band_squat',
    aliases: ['resistance band squat', 'banded squat', 'band squats'],
    primary: ['quads', 'glutes'],
    secondary: [],
    equipment: ['bands'],
    type: 'weight_reps',
  },
  // Calves
  {
    name: 'Standing Calf Raise',
    slug: 'standing_calf_raise',
    aliases: ['calf raise', 'calf raises', 'standing calf', 'barbell calf raise', 'machine calf raise', 'smith calf raise', 'calves raise'],
    primary: ['calves'],
    secondary: [],
    equipment: ['machine'],
    type: 'weight_reps',
  },
  {
    name: 'Seated Calf Raise',
    slug: 'seated_calf_raise',
    aliases: ['seated calves', 'seated calf', 'machine seated calf raise', 'soleus raise'],
    primary: ['calves'],
    secondary: [],
    equipment: ['machine'],
    type: 'weight_reps',
  },
  {
    name: 'Donkey Calf Raise',
    slug: 'donkey_calf_raise',
    aliases: ['donkey raises', 'bent over calf raise', 'donkey calf'],
    primary: ['calves'],
    secondary: [],
    equipment: ['bodyweight'],
    type: 'bodyweight_reps',
  },
];

// ─── CORE ─────────────────────────────────────────────────────────────────────

const CORE: ExerciseEntry[] = [
  {
    name: 'Plank',
    slug: 'plank',
    aliases: ['forearm plank', 'prone plank', 'planks', 'straight arm plank', 'push up plank', 'ab plank'],
    primary: ['core'],
    secondary: [],
    equipment: ['bodyweight'],
    type: 'duration',
  },
  {
    name: 'Side Plank',
    slug: 'side_plank',
    aliases: ['side planks', 'lateral plank', 'oblique plank'],
    primary: ['core'],
    secondary: [],
    equipment: ['bodyweight'],
    type: 'duration',
  },
  {
    name: 'Ab Crunch',
    slug: 'ab_crunch',
    aliases: ['crunch', 'crunches', 'ab crunches', 'sit up crunch', 'basic crunch', 'floor crunch', 'abdominal crunch'],
    primary: ['core'],
    secondary: [],
    equipment: ['bodyweight'],
    type: 'bodyweight_reps',
  },
  {
    name: 'Hanging Leg Raise',
    slug: 'hanging_leg_raise',
    aliases: ['leg raise', 'hanging knee raise', 'hanging raises', 'hlr', 'bar leg raise', 'dead hang leg raise'],
    primary: ['core'],
    secondary: [],
    equipment: ['pullup_bar'],
    type: 'bodyweight_reps',
  },
  {
    name: 'Cable Crunch',
    slug: 'cable_crunch',
    aliases: ['cable abs', 'rope crunch', 'kneeling cable crunch', 'cable ab crunch', 'cable core'],
    primary: ['core'],
    secondary: [],
    equipment: ['cables'],
    type: 'weight_reps',
  },
  {
    name: 'Russian Twist',
    slug: 'russian_twist',
    aliases: ['russian twists', 'weighted russian twist', 'seated twist', 'oblique twist', 'medicine ball twist', 'plate twist'],
    primary: ['core'],
    secondary: [],
    equipment: ['dumbbells'],
    type: 'weight_reps',
  },
  {
    name: 'Decline Crunch',
    slug: 'decline_crunch',
    aliases: ['decline sit up', 'decline ab crunch', 'weighted decline crunch'],
    primary: ['core'],
    secondary: [],
    equipment: ['bodyweight'],
    type: 'bodyweight_reps',
  },
  {
    name: 'Ab Wheel Rollout',
    slug: 'ab_wheel_rollout',
    aliases: ['ab wheel', 'ab roller', 'rollout', 'wheel rollout', 'ab rollout', 'ab wheel roll out'],
    primary: ['core'],
    secondary: [],
    equipment: ['bodyweight'],
    type: 'bodyweight_reps',
  },
  {
    name: 'Pallof Press',
    slug: 'pallof_press',
    aliases: ['pallof', 'anti rotation press', 'core press', 'cable anti rotation', 'anti-rotation pallof'],
    primary: ['core'],
    secondary: [],
    equipment: ['cables'],
    type: 'weight_reps',
  },
  {
    name: 'Dragon Flag',
    slug: 'dragon_flag',
    aliases: ['dragon flags', 'bench dragon flag', 'bodyweight dragon flag'],
    primary: ['core'],
    secondary: [],
    equipment: ['bodyweight'],
    type: 'bodyweight_reps',
  },
  {
    name: 'Sit-Up',
    slug: 'sit_up',
    aliases: ['sit ups', 'situp', 'situps', 'full sit up', 'ab sit up'],
    primary: ['core'],
    secondary: [],
    equipment: ['bodyweight'],
    type: 'bodyweight_reps',
  },
  {
    name: 'Leg Raise',
    slug: 'leg_raise',
    aliases: ['lying leg raise', 'floor leg raise', 'flat leg raise', 'lying raises', 'lower ab raise'],
    primary: ['core'],
    secondary: [],
    equipment: ['bodyweight'],
    type: 'bodyweight_reps',
  },
  {
    name: 'Flutter Kick',
    slug: 'flutter_kick',
    aliases: ['flutter kicks', 'scissors kick', 'lying flutter kick', 'scissor kicks'],
    primary: ['core'],
    secondary: [],
    equipment: ['bodyweight'],
    type: 'bodyweight_reps',
  },
  {
    name: 'Front Lever Raise',
    slug: 'front_lever_raise',
    aliases: ['front lever', 'gymnastic front lever', 'tuck front lever'],
    primary: ['core', 'back'],
    secondary: [],
    equipment: ['pullup_bar'],
    type: 'bodyweight_reps',
  },
];

// ─── FOREARMS ─────────────────────────────────────────────────────────────────

const FOREARMS: ExerciseEntry[] = [
  {
    name: 'Wrist Curl',
    slug: 'wrist_curl',
    aliases: ['wrist curls', 'barbell wrist curl', 'dumbbell wrist curl', 'forearm curl', 'wrist flexion'],
    primary: ['forearms'],
    secondary: [],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Farmer Carry',
    slug: 'farmer_carry',
    aliases: ['farmers walk', 'farmer walk', 'farmer carry', 'heavy carry', 'suitcase carry', 'loaded carry'],
    primary: ['forearms', 'traps'],
    secondary: ['core'],
    equipment: ['dumbbells'],
    type: 'weight_duration',
  },
];

// ─── FULL BODY / COMPOUND ─────────────────────────────────────────────────────

const FULL_BODY: ExerciseEntry[] = [
  {
    name: 'Power Clean',
    slug: 'power_clean',
    aliases: ['clean', 'olympic clean', 'barbell clean', 'hang clean', 'power cleans'],
    primary: ['full_body'],
    secondary: [],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Clean and Jerk',
    slug: 'clean_and_jerk',
    aliases: ['clean & jerk', 'clean jerk', 'olympic lift', 'c&j'],
    primary: ['full_body'],
    secondary: [],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Clean and Press',
    slug: 'clean_and_press',
    aliases: ['clean press', 'clean & press', 'continental clean', 'barbell clean press'],
    primary: ['full_body'],
    secondary: [],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Kettlebell Swing',
    slug: 'kettlebell_swing',
    aliases: ['kb swing', 'kettlebell swings', 'two hand swing', 'american swing', 'russian swing', 'kb swings'],
    primary: ['glutes', 'hamstrings'],
    secondary: ['back', 'core'],
    equipment: ['kettlebells'],
    type: 'weight_reps',
  },
  {
    name: 'Turkish Get-Up',
    slug: 'turkish_get_up',
    aliases: ['tgu', 'turkish getup', 'kb turkish get up', 'get up'],
    primary: ['full_body'],
    secondary: [],
    equipment: ['kettlebells'],
    type: 'weight_reps',
  },
  {
    name: 'Thrusters',
    slug: 'thrusters',
    aliases: ['thruster', 'barbell thruster', 'dumbbell thruster', 'db thruster', 'squat press', 'squat to press'],
    primary: ['quads', 'shoulders'],
    secondary: ['glutes', 'triceps'],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Burpee',
    slug: 'burpee',
    aliases: ['burpees', 'squat thrust', 'full body burpee', 'burpee jump'],
    primary: ['full_body'],
    secondary: [],
    equipment: ['bodyweight'],
    type: 'bodyweight_reps',
  },
  {
    name: 'Muscle Up',
    slug: 'muscle_up',
    aliases: ['muscle ups', 'bar muscle up', 'ring muscle up', 'muscle-up'],
    primary: ['back', 'chest', 'triceps'],
    secondary: [],
    equipment: ['pullup_bar'],
    type: 'bodyweight_reps',
  },
  {
    name: 'Overhead Squat',
    slug: 'overhead_squat',
    aliases: ['ohsquat', 'oh squat', 'overhead squat barbell', 'snatch squat'],
    primary: ['quads', 'shoulders'],
    secondary: ['core', 'glutes'],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
  {
    name: 'Snatch',
    slug: 'snatch',
    aliases: ['barbell snatch', 'power snatch', 'hang snatch', 'olympic snatch'],
    primary: ['full_body'],
    secondary: [],
    equipment: ['barbell'],
    type: 'weight_reps',
  },
];

// ─── CARDIO / NO-WEIGHT ACTIVITIES ───────────────────────────────────────────

const CARDIO: ExerciseEntry[] = [
  {
    name: 'Cycling',
    slug: 'cycling',
    aliases: ['bike', 'cycle', 'stationary bike', 'spin bike', 'spinning', 'indoor cycling', 'bicycle', 'road cycling', 'outdoor cycling', 'biking'],
    primary: ['cardio'],
    secondary: ['quads', 'glutes'],
    equipment: ['cardio_machine'],
    type: 'distance_duration',
  },
  {
    name: 'Walking',
    slug: 'walking',
    aliases: ['walk', 'treadmill walk', 'outdoor walk', 'brisk walk', 'incline walk', 'treadmill walking'],
    primary: ['cardio'],
    secondary: [],
    equipment: ['bodyweight'],
    type: 'distance_duration',
  },
  {
    name: 'Running',
    slug: 'running',
    aliases: ['run', 'jog', 'jogging', 'treadmill run', 'outdoor run', 'treadmill jog', 'sprint', 'sprinting'],
    primary: ['cardio'],
    secondary: [],
    equipment: ['bodyweight'],
    type: 'distance_duration',
  },
  {
    name: 'Rowing',
    slug: 'rowing',
    aliases: ['row', 'rowing machine', 'erg', 'ergometer', 'concept2', 'rowing erg', 'air rower', 'water rower'],
    primary: ['cardio'],
    secondary: ['back', 'core'],
    equipment: ['cardio_machine'],
    type: 'distance_duration',
  },
  {
    name: 'Jump Rope',
    slug: 'jump_rope',
    aliases: ['skipping', 'skip rope', 'skipping rope', 'jump skipping', 'double under', 'double unders'],
    primary: ['cardio'],
    secondary: ['calves'],
    equipment: ['bodyweight'],
    type: 'duration',
  },
  {
    name: 'Elliptical',
    slug: 'elliptical',
    aliases: ['elliptical machine', 'cross trainer', 'elliptic', 'elliptical trainer', 'x-trainer'],
    primary: ['cardio'],
    secondary: [],
    equipment: ['cardio_machine'],
    type: 'distance_duration',
  },
  {
    name: 'Stair Climber',
    slug: 'stair_climber',
    aliases: ['stairmaster', 'stairs', 'step machine', 'stair machine', 'stair mill', 'stepmill'],
    primary: ['cardio'],
    secondary: ['glutes', 'quads'],
    equipment: ['cardio_machine'],
    type: 'duration',
  },
  {
    name: 'Swimming',
    slug: 'swimming',
    aliases: ['swim', 'laps', 'pool swimming', 'freestyle swim', 'breaststroke', 'swimming laps'],
    primary: ['cardio'],
    secondary: ['back', 'shoulders'],
    equipment: ['bodyweight'],
    type: 'distance_duration',
  },
  {
    name: 'Warm Up',
    slug: 'warm_up',
    aliases: ['warmup', 'warm-up', 'general warm up', 'dynamic warm up', 'activation', 'warm up routine'],
    primary: ['full_body'],
    secondary: [],
    equipment: ['bodyweight'],
    type: 'duration',
  },
];

// ─── MASTER DATABASE ──────────────────────────────────────────────────────────

export const EXERCISES_DB: ExerciseEntry[] = [
  ...CHEST,
  ...BACK,
  ...SHOULDERS,
  ...BICEPS,
  ...TRICEPS,
  ...LEGS,
  ...CORE,
  ...FOREARMS,
  ...FULL_BODY,
  ...CARDIO,
];

export const EXERCISES_BY_MUSCLE: Record<MuscleGroup, ExerciseEntry[]> = {
  chest:      EXERCISES_DB.filter(e => e.primary.includes('chest')),
  back:       EXERCISES_DB.filter(e => e.primary.includes('back')),
  lats:       EXERCISES_DB.filter(e => e.primary.includes('lats')),
  traps:      EXERCISES_DB.filter(e => e.primary.includes('traps')),
  shoulders:  EXERCISES_DB.filter(e => e.primary.includes('shoulders')),
  biceps:     EXERCISES_DB.filter(e => e.primary.includes('biceps')),
  triceps:    EXERCISES_DB.filter(e => e.primary.includes('triceps')),
  forearms:   EXERCISES_DB.filter(e => e.primary.includes('forearms')),
  quads:      EXERCISES_DB.filter(e => e.primary.includes('quads')),
  hamstrings: EXERCISES_DB.filter(e => e.primary.includes('hamstrings')),
  glutes:     EXERCISES_DB.filter(e => e.primary.includes('glutes')),
  calves:     EXERCISES_DB.filter(e => e.primary.includes('calves')),
  core:       EXERCISES_DB.filter(e => e.primary.includes('core')),
  full_body:  EXERCISES_DB.filter(e => e.primary.includes('full_body')),
  cardio:     EXERCISES_DB.filter(e => e.primary.includes('cardio')),
};

// ─── FUZZY FINDER ─────────────────────────────────────────────────────────────

/**
 * Normalise a string for comparison: lowercase, strip punctuation, collapse spaces.
 */
function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Simple character-level overlap score — good enough for alias matching.
 * Returns a value 0–1 where 1 = identical.
 */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;
  // count matching chars using a sliding window approach
  let matches = 0;
  const used = new Array(longer.length).fill(false);
  for (let i = 0; i < shorter.length; i++) {
    for (let j = 0; j < longer.length; j++) {
      if (!used[j] && shorter[i] === longer[j]) {
        matches++;
        used[j] = true;
        break;
      }
    }
  }
  return matches / longer.length;
}

export interface FindResult {
  exercise: ExerciseEntry;
  score: number;        // 0–1, higher is better
  matchedOn: string;    // which field matched (name, slug, or alias)
}

/**
 * Find exercises matching a query string.
 *
 * Scoring priority:
 *   1. Exact normalised name match   → 1.0
 *   2. Exact normalised alias match  → 0.95
 *   3. Exact slug match              → 0.95
 *   4. Name starts with query        → 0.85
 *   5. Alias starts with query       → 0.80
 *   6. Name contains query           → 0.70
 *   7. Any alias contains query      → 0.65
 *   8. Similarity score ≥ 0.6       → proportional
 *
 * Returns top `limit` results (default 5) sorted by score desc.
 */
export function findExercise(query: string, limit = 5): FindResult[] {
  const q = normalise(query);
  if (!q) return [];

  const results: FindResult[] = [];

  for (const exercise of EXERCISES_DB) {
    const normName = normalise(exercise.name);
    const normSlug = normalise(exercise.slug.replace(/_/g, ' '));
    const normAliases = exercise.aliases.map(normalise);

    let score = 0;
    let matchedOn = '';

    if (normName === q) {
      score = 1.0; matchedOn = 'name';
    } else if (normAliases.includes(q)) {
      score = 0.95; matchedOn = 'alias';
    } else if (normSlug === q) {
      score = 0.95; matchedOn = 'slug';
    } else if (normName.startsWith(q)) {
      score = 0.85; matchedOn = 'name';
    } else if (normAliases.some(a => a.startsWith(q))) {
      score = 0.80; matchedOn = 'alias';
    } else if (normName.includes(q)) {
      score = 0.70; matchedOn = 'name';
    } else if (normAliases.some(a => a.includes(q))) {
      score = 0.65; matchedOn = 'alias';
    } else {
      // fallback: similarity on name and best alias
      const nameSim = similarity(q, normName);
      const bestAlias = Math.max(...normAliases.map(a => similarity(q, a)), 0);
      const best = Math.max(nameSim, bestAlias);
      if (best >= 0.6) {
        score = best * 0.6;
        matchedOn = nameSim >= bestAlias ? 'name~' : 'alias~';
      }
    }

    if (score > 0) results.push({ exercise, score, matchedOn });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * AI routine builder helper.
 *
 * Given a raw exercise name from AI output or user input, returns:
 *   - { exact: ExerciseEntry }   if confidence ≥ 0.9  → use it directly
 *   - { candidates: FindResult[] } if confidence 0.5–0.9 → ask user to confirm
 *   - { notFound: true }           if no match          → ask user to clarify
 *
 * Usage in AI routine generation:
 *   const result = resolveExercise("benchpress");
 *   if (result.exact) { use result.exact }
 *   else if (result.candidates) { show picker to user }
 *   else { ask user what exercise they meant }
 */
export function resolveExercise(raw: string):
  | { exact: ExerciseEntry }
  | { candidates: FindResult[] }
  | { notFound: true }
{
  const results = findExercise(raw, 5);
  if (!results.length) return { notFound: true };
  if (results[0].score >= 0.9) return { exact: results[0].exercise };
  if (results[0].score >= 0.5) return { candidates: results };
  return { notFound: true };
}
