#!/usr/bin/env node
/**
 * Syncs all exercises from exercises-db.ts into Supabase.
 * Upserts by slug — safe to re-run at any time.
 *
 * Usage:
 *   node --env-file=.env scripts/sync-exercises.mjs
 *   node --env-file=.env scripts/sync-exercises.mjs --dry-run
 */

import { createClient } from '@supabase/supabase-js';

const DRY_RUN = process.argv.includes('--dry-run');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ── Exercise data (mirrored from lib/exercises-db.ts) ────────────────────────

const EXERCISES = [
  // ── CHEST ──────────────────────────────────────────────────────────────────
  { name: 'Barbell Bench Press',     slug: 'barbell_bench_press',     category: 'Chest',     muscle_groups: ['chest','triceps','shoulders'], equipment: ['barbell'],     exercise_type: 'weight_reps' },
  { name: 'Dumbbell Bench Press',    slug: 'dumbbell_bench_press',    category: 'Chest',     muscle_groups: ['chest','triceps','shoulders'], equipment: ['dumbbells'],    exercise_type: 'weight_reps' },
  { name: 'Incline Barbell Press',   slug: 'incline_barbell_press',   category: 'Chest',     muscle_groups: ['chest','shoulders','triceps'], equipment: ['barbell'],     exercise_type: 'weight_reps' },
  { name: 'Incline Dumbbell Press',  slug: 'incline_dumbbell_press',  category: 'Chest',     muscle_groups: ['chest','shoulders','triceps'], equipment: ['dumbbells'],    exercise_type: 'weight_reps' },
  { name: 'Decline Bench Press',     slug: 'decline_bench_press',     category: 'Chest',     muscle_groups: ['chest','triceps'],            equipment: ['barbell'],     exercise_type: 'weight_reps' },
  { name: 'Cable Fly',               slug: 'cable_fly',               category: 'Chest',     muscle_groups: ['chest'],                      equipment: ['cables'],      exercise_type: 'weight_reps' },
  { name: 'Dumbbell Fly',            slug: 'dumbbell_fly',            category: 'Chest',     muscle_groups: ['chest'],                      equipment: ['dumbbells'],    exercise_type: 'weight_reps' },
  { name: 'Incline Dumbbell Fly',    slug: 'incline_dumbbell_fly',    category: 'Chest',     muscle_groups: ['chest','shoulders'],           equipment: ['dumbbells'],    exercise_type: 'weight_reps' },
  { name: 'Push-Up',                 slug: 'push_up',                 category: 'Chest',     muscle_groups: ['chest','triceps','shoulders'], equipment: ['bodyweight'],   exercise_type: 'bodyweight_reps' },
  { name: 'Wide Push-Up',            slug: 'wide_push_up',            category: 'Chest',     muscle_groups: ['chest','shoulders'],           equipment: ['bodyweight'],   exercise_type: 'bodyweight_reps' },
  { name: 'Chest Dip',               slug: 'chest_dip',               category: 'Chest',     muscle_groups: ['chest','triceps'],            equipment: ['bodyweight'],   exercise_type: 'bodyweight_reps' },
  { name: 'Pec Deck',                slug: 'pec_deck',                category: 'Chest',     muscle_groups: ['chest'],                      equipment: ['machine'],     exercise_type: 'weight_reps' },
  { name: 'Machine Chest Press',     slug: 'machine_chest_press',     category: 'Chest',     muscle_groups: ['chest','triceps','shoulders'], equipment: ['machine'],     exercise_type: 'weight_reps' },
  { name: 'Smith Machine Bench',     slug: 'smith_machine_bench',     category: 'Chest',     muscle_groups: ['chest','triceps'],            equipment: ['machine'],     exercise_type: 'weight_reps' },
  { name: 'Close Grip Bench Press',  slug: 'close_grip_bench',        category: 'Chest',     muscle_groups: ['triceps','chest'],            equipment: ['barbell'],     exercise_type: 'weight_reps' },
  { name: 'Floor Press',             slug: 'floor_press',             category: 'Chest',     muscle_groups: ['chest','triceps'],            equipment: ['barbell'],     exercise_type: 'weight_reps' },
  { name: 'Landmine Press',          slug: 'landmine_press',          category: 'Chest',     muscle_groups: ['chest','shoulders','triceps'], equipment: ['barbell'],     exercise_type: 'weight_reps' },

  // ── BACK ───────────────────────────────────────────────────────────────────
  { name: 'Barbell Deadlift',              slug: 'barbell_deadlift',              category: 'Back', muscle_groups: ['back','glutes','hamstrings','traps','forearms'], equipment: ['barbell'],    exercise_type: 'weight_reps' },
  { name: 'Romanian Deadlift',             slug: 'romanian_deadlift',             category: 'Back', muscle_groups: ['hamstrings','glutes','back'],                   equipment: ['barbell'],    exercise_type: 'weight_reps' },
  { name: 'Barbell Row',                   slug: 'barbell_row',                   category: 'Back', muscle_groups: ['back','biceps'],                               equipment: ['barbell'],    exercise_type: 'weight_reps' },
  { name: 'Dumbbell Row',                  slug: 'dumbbell_row',                  category: 'Back', muscle_groups: ['back','biceps'],                               equipment: ['dumbbells'],   exercise_type: 'weight_reps' },
  { name: 'Pull-Up',                       slug: 'pull_up',                       category: 'Back', muscle_groups: ['lats','back','biceps'],                        equipment: ['pullup_bar'], exercise_type: 'bodyweight_reps' },
  { name: 'Chin-Up',                       slug: 'chin_up',                       category: 'Back', muscle_groups: ['lats','back','biceps'],                        equipment: ['pullup_bar'], exercise_type: 'bodyweight_reps' },
  { name: 'Lat Pulldown',                  slug: 'lat_pulldown',                  category: 'Back', muscle_groups: ['lats','back','biceps'],                        equipment: ['cables'],     exercise_type: 'weight_reps' },
  { name: 'Cable Row',                     slug: 'cable_row',                     category: 'Back', muscle_groups: ['back','biceps'],                               equipment: ['cables'],     exercise_type: 'weight_reps' },
  { name: 'T-Bar Row',                     slug: 't_bar_row',                     category: 'Back', muscle_groups: ['back','biceps'],                               equipment: ['barbell'],    exercise_type: 'weight_reps' },
  { name: 'Face Pull',                     slug: 'face_pull',                     category: 'Back', muscle_groups: ['shoulders','back','traps'],                    equipment: ['cables'],     exercise_type: 'weight_reps' },
  { name: 'Seated Cable Row',              slug: 'seated_cable_row',              category: 'Back', muscle_groups: ['back','biceps'],                               equipment: ['cables'],     exercise_type: 'weight_reps' },
  { name: 'Seated Cable Row (V-Grip)',     slug: 'seated_cable_row_v_grip',       category: 'Back', muscle_groups: ['back','biceps'],                               equipment: ['cables'],     exercise_type: 'weight_reps' },
  { name: 'Chest-Supported Row',           slug: 'chest_supported_row',           category: 'Back', muscle_groups: ['back','biceps'],                               equipment: ['dumbbells'],   exercise_type: 'weight_reps' },
  { name: 'Pendlay Row',                   slug: 'pendlay_row',                   category: 'Back', muscle_groups: ['back','biceps'],                               equipment: ['barbell'],    exercise_type: 'weight_reps' },
  { name: 'Meadows Row',                   slug: 'meadows_row',                   category: 'Back', muscle_groups: ['back','biceps'],                               equipment: ['barbell'],    exercise_type: 'weight_reps' },
  { name: 'Machine Row',                   slug: 'machine_row',                   category: 'Back', muscle_groups: ['back','biceps'],                               equipment: ['machine'],    exercise_type: 'weight_reps' },
  { name: 'Assisted Pull-Up',              slug: 'assisted_pull_up',              category: 'Back', muscle_groups: ['lats','back','biceps'],                        equipment: ['machine'],    exercise_type: 'weight_reps' },
  { name: 'Shrug',                         slug: 'shrug',                         category: 'Back', muscle_groups: ['traps'],                                       equipment: ['barbell'],    exercise_type: 'weight_reps' },
  { name: 'Rack Pull',                     slug: 'rack_pull',                     category: 'Back', muscle_groups: ['back','traps','glutes'],                       equipment: ['barbell'],    exercise_type: 'weight_reps' },
  { name: 'Straight Arm Pulldown',         slug: 'straight_arm_pulldown',         category: 'Back', muscle_groups: ['lats','back'],                                 equipment: ['cables'],     exercise_type: 'weight_reps' },
  { name: 'Band Row',                      slug: 'band_row',                      category: 'Back', muscle_groups: ['back','biceps'],                               equipment: ['bands'],      exercise_type: 'weight_reps' },
  { name: 'Lat Pulldown (Band)',           slug: 'lat_pulldown_band',             category: 'Back', muscle_groups: ['lats','back'],                                 equipment: ['bands'],      exercise_type: 'weight_reps' },
  { name: 'Rowing Machine',               slug: 'rowing_machine',                category: 'Back', muscle_groups: ['back','lats','glutes','hamstrings','traps'],    equipment: ['machine'],    exercise_type: 'duration' },
  { name: 'Straight-Arm Cable Row',       slug: 'straight_arm_cable_row',        category: 'Back', muscle_groups: ['back','traps','shoulders'],                    equipment: ['cables'],     exercise_type: 'weight_reps' },
  { name: 'Single-Arm Cable Row',         slug: 'single_arm_cable_row',          category: 'Back', muscle_groups: ['lats','back','biceps','core'],                 equipment: ['cables'],     exercise_type: 'weight_reps' },
  { name: 'High Row Machine',             slug: 'high_row_machine',              category: 'Back', muscle_groups: ['lats','back','biceps'],                        equipment: ['machine'],    exercise_type: 'weight_reps' },
  { name: 'Rear Delt Reverse Fly (Machine)', slug: 'rear_delt_machine',          category: 'Back', muscle_groups: ['back','shoulders'],                            equipment: ['machine'],    exercise_type: 'weight_reps' },
  { name: 'Back Extension',               slug: 'back_extension',                category: 'Back', muscle_groups: ['back','glutes','hamstrings'],                  equipment: ['machine'],    exercise_type: 'bodyweight_reps' },
  { name: 'Weighted Back Extension',      slug: 'weighted_back_extension',       category: 'Back', muscle_groups: ['back','glutes','hamstrings'],                  equipment: ['machine'],    exercise_type: 'weight_reps' },
  { name: 'Good Morning',                 slug: 'good_morning',                  category: 'Back', muscle_groups: ['back','hamstrings','glutes'],                  equipment: ['barbell'],    exercise_type: 'weight_reps' },
  { name: 'Superman',                     slug: 'superman',                      category: 'Back', muscle_groups: ['back','glutes'],                               equipment: ['bodyweight'],  exercise_type: 'bodyweight_reps' },
  { name: 'Inverted Row',                 slug: 'inverted_row',                  category: 'Back', muscle_groups: ['back','biceps'],                               equipment: ['pullup_bar'], exercise_type: 'bodyweight_reps' },
  { name: 'Seal Row',                     slug: 'seal_row',                      category: 'Back', muscle_groups: ['back','biceps'],                               equipment: ['barbell'],    exercise_type: 'weight_reps' },
  { name: 'Sumo Deadlift',               slug: 'sumo_deadlift',                 category: 'Back', muscle_groups: ['back','glutes','hamstrings','traps','forearms'], equipment: ['barbell'],   exercise_type: 'weight_reps' },
  { name: 'Trap Bar Deadlift',            slug: 'trap_bar_deadlift',             category: 'Back', muscle_groups: ['back','glutes','hamstrings','traps','forearms'], equipment: ['barbell'],   exercise_type: 'weight_reps' },
  { name: 'Single-Leg Romanian Deadlift', slug: 'single_leg_rdl',               category: 'Legs', muscle_groups: ['hamstrings','glutes','back'],                  equipment: ['dumbbells'],   exercise_type: 'weight_reps' },
  { name: 'Close Grip Lat Pulldown',      slug: 'close_grip_lat_pulldown',       category: 'Back', muscle_groups: ['lats','back','biceps'],                        equipment: ['cables'],     exercise_type: 'weight_reps' },
  { name: 'Single-Arm Lat Pulldown',      slug: 'single_arm_lat_pulldown',       category: 'Back', muscle_groups: ['lats','back','biceps'],                        equipment: ['cables'],     exercise_type: 'weight_reps' },
  { name: 'Renegade Row',                 slug: 'renegade_row',                  category: 'Back', muscle_groups: ['back','core','biceps','shoulders'],            equipment: ['dumbbells'],   exercise_type: 'weight_reps' },
  { name: 'Yates Row',                    slug: 'yates_row',                     category: 'Back', muscle_groups: ['back','biceps'],                               equipment: ['barbell'],    exercise_type: 'weight_reps' },
  { name: 'Neutral Grip Pull-Up',         slug: 'neutral_grip_pull_up',          category: 'Back', muscle_groups: ['lats','back','biceps'],                        equipment: ['pullup_bar'], exercise_type: 'bodyweight_reps' },
  { name: 'Jefferson Curl',               slug: 'jefferson_curl',                category: 'Back', muscle_groups: ['back','hamstrings'],                           equipment: ['barbell'],    exercise_type: 'weight_reps' },

  // ── SHOULDERS ──────────────────────────────────────────────────────────────
  { name: 'Overhead Press',          slug: 'overhead_press',          category: 'Shoulders', muscle_groups: ['shoulders','triceps'],          equipment: ['barbell'],   exercise_type: 'weight_reps' },
  { name: 'Dumbbell Shoulder Press', slug: 'dumbbell_shoulder_press', category: 'Shoulders', muscle_groups: ['shoulders','triceps'],          equipment: ['dumbbells'],  exercise_type: 'weight_reps' },
  { name: 'Arnold Press',            slug: 'arnold_press',            category: 'Shoulders', muscle_groups: ['shoulders','triceps'],          equipment: ['dumbbells'],  exercise_type: 'weight_reps' },
  { name: 'Lateral Raise',           slug: 'lateral_raise',           category: 'Shoulders', muscle_groups: ['shoulders'],                   equipment: ['dumbbells'],  exercise_type: 'weight_reps' },
  { name: 'Cable Lateral Raise',     slug: 'cable_lateral_raise',     category: 'Shoulders', muscle_groups: ['shoulders'],                   equipment: ['cables'],    exercise_type: 'weight_reps' },
  { name: 'Lateral Raise (Machine)', slug: 'lateral_raise_machine',   category: 'Shoulders', muscle_groups: ['shoulders'],                   equipment: ['machine'],   exercise_type: 'weight_reps' },
  { name: 'Front Raise',             slug: 'front_raise',             category: 'Shoulders', muscle_groups: ['shoulders'],                   equipment: ['dumbbells'],  exercise_type: 'weight_reps' },
  { name: 'Upright Row',             slug: 'upright_row',             category: 'Shoulders', muscle_groups: ['shoulders','traps'],           equipment: ['barbell'],   exercise_type: 'weight_reps' },
  { name: 'Reverse Fly',             slug: 'reverse_fly',             category: 'Shoulders', muscle_groups: ['shoulders','back','traps'],    equipment: ['dumbbells'],  exercise_type: 'weight_reps' },
  { name: 'Machine Shoulder Press',  slug: 'machine_shoulder_press',  category: 'Shoulders', muscle_groups: ['shoulders','triceps'],          equipment: ['machine'],   exercise_type: 'weight_reps' },
  { name: 'Band Pull Apart',         slug: 'band_pull_apart',         category: 'Shoulders', muscle_groups: ['shoulders','back','traps'],    equipment: ['bands'],     exercise_type: 'weight_reps' },
  { name: 'Handstand Push-Up',       slug: 'handstand_push_up',       category: 'Shoulders', muscle_groups: ['shoulders','triceps'],          equipment: ['bodyweight'], exercise_type: 'bodyweight_reps' },
  { name: 'Cable Rear Delt Fly',     slug: 'cable_rear_delt_fly',     category: 'Shoulders', muscle_groups: ['shoulders','back'],            equipment: ['cables'],    exercise_type: 'weight_reps' },

  // ── BICEPS ─────────────────────────────────────────────────────────────────
  { name: 'Barbell Curl',           slug: 'barbell_curl',           category: 'Arms', muscle_groups: ['biceps','forearms'],  equipment: ['barbell'],   exercise_type: 'weight_reps' },
  { name: 'Dumbbell Curl',          slug: 'dumbbell_curl',          category: 'Arms', muscle_groups: ['biceps'],             equipment: ['dumbbells'],  exercise_type: 'weight_reps' },
  { name: 'Hammer Curl',            slug: 'hammer_curl',            category: 'Arms', muscle_groups: ['biceps','forearms'],  equipment: ['dumbbells'],  exercise_type: 'weight_reps' },
  { name: 'Preacher Curl',          slug: 'preacher_curl',          category: 'Arms', muscle_groups: ['biceps'],             equipment: ['barbell'],   exercise_type: 'weight_reps' },
  { name: 'Concentration Curl',     slug: 'concentration_curl',     category: 'Arms', muscle_groups: ['biceps'],             equipment: ['dumbbells'],  exercise_type: 'weight_reps' },
  { name: 'Cable Curl',             slug: 'cable_curl',             category: 'Arms', muscle_groups: ['biceps'],             equipment: ['cables'],    exercise_type: 'weight_reps' },
  { name: 'Incline Dumbbell Curl',  slug: 'incline_dumbbell_curl',  category: 'Arms', muscle_groups: ['biceps'],             equipment: ['dumbbells'],  exercise_type: 'weight_reps' },
  { name: 'Reverse Curl',           slug: 'reverse_curl',           category: 'Arms', muscle_groups: ['forearms','biceps'],  equipment: ['barbell'],   exercise_type: 'weight_reps' },
  { name: 'Band Curl',              slug: 'band_curl',              category: 'Arms', muscle_groups: ['biceps'],             equipment: ['bands'],     exercise_type: 'weight_reps' },
  { name: 'Plate Curl',             slug: 'plate_curl',             category: 'Arms', muscle_groups: ['biceps','forearms'],  equipment: ['barbell'],   exercise_type: 'weight_reps' },

  // ── TRICEPS ────────────────────────────────────────────────────────────────
  { name: 'Tricep Pushdown',            slug: 'tricep_pushdown',       category: 'Arms', muscle_groups: ['triceps'],           equipment: ['cables'],     exercise_type: 'weight_reps' },
  { name: 'Skull Crusher',              slug: 'skull_crusher',         category: 'Arms', muscle_groups: ['triceps'],           equipment: ['barbell'],    exercise_type: 'weight_reps' },
  { name: 'Overhead Tricep Extension',  slug: 'overhead_tricep_ext',   category: 'Arms', muscle_groups: ['triceps'],           equipment: ['dumbbells'],   exercise_type: 'weight_reps' },
  { name: 'Tricep Dip',                 slug: 'tricep_dip',            category: 'Arms', muscle_groups: ['triceps','chest'],   equipment: ['bodyweight'],  exercise_type: 'bodyweight_reps' },
  { name: 'Seated Dip Machine',         slug: 'seated_dip_machine',    category: 'Arms', muscle_groups: ['triceps','chest','shoulders'], equipment: ['machine'], exercise_type: 'weight_reps' },
  { name: 'Diamond Push-Up',            slug: 'diamond_push_up',       category: 'Arms', muscle_groups: ['triceps','chest'],   equipment: ['bodyweight'],  exercise_type: 'bodyweight_reps' },
  { name: 'Cable Overhead Extension',   slug: 'cable_overhead_ext',    category: 'Arms', muscle_groups: ['triceps'],           equipment: ['cables'],     exercise_type: 'weight_reps' },
  { name: 'Band Tricep Extension',      slug: 'band_tricep_ext',       category: 'Arms', muscle_groups: ['triceps'],           equipment: ['bands'],      exercise_type: 'weight_reps' },
  { name: 'Dumbbell Skull Crusher',     slug: 'dumbbell_skull_crusher', category: 'Arms', muscle_groups: ['triceps'],          equipment: ['dumbbells'],   exercise_type: 'weight_reps' },

  // ── LEGS ───────────────────────────────────────────────────────────────────
  { name: 'Barbell Squat',            slug: 'barbell_squat',           category: 'Legs', muscle_groups: ['quads','glutes','hamstrings'],  equipment: ['barbell'],   exercise_type: 'weight_reps' },
  { name: 'Squat (Bodyweight)',        slug: 'squat_bodyweight',        category: 'Legs', muscle_groups: ['quads','glutes','hamstrings'],  equipment: ['bodyweight'], exercise_type: 'bodyweight_reps' },
  { name: 'Front Squat',              slug: 'front_squat',             category: 'Legs', muscle_groups: ['quads','core','glutes'],        equipment: ['barbell'],   exercise_type: 'weight_reps' },
  { name: 'Goblet Squat',             slug: 'goblet_squat',            category: 'Legs', muscle_groups: ['quads','glutes','core'],        equipment: ['dumbbells'],  exercise_type: 'weight_reps' },
  { name: 'Hack Squat',               slug: 'hack_squat',              category: 'Legs', muscle_groups: ['quads','glutes'],              equipment: ['machine'],   exercise_type: 'weight_reps' },
  { name: 'Leg Press',                slug: 'leg_press',               category: 'Legs', muscle_groups: ['quads','glutes','hamstrings'],  equipment: ['machine'],   exercise_type: 'weight_reps' },
  { name: 'Bulgarian Split Squat',    slug: 'bulgarian_split_squat',   category: 'Legs', muscle_groups: ['quads','glutes','hamstrings'],  equipment: ['dumbbells'],  exercise_type: 'weight_reps' },
  { name: 'Lunge',                    slug: 'lunge',                   category: 'Legs', muscle_groups: ['quads','glutes','hamstrings'],  equipment: ['dumbbells'],  exercise_type: 'weight_reps' },
  { name: 'Walking Lunge',            slug: 'walking_lunge',           category: 'Legs', muscle_groups: ['quads','glutes','hamstrings'],  equipment: ['dumbbells'],  exercise_type: 'weight_reps' },
  { name: 'Reverse Lunge',            slug: 'reverse_lunge',           category: 'Legs', muscle_groups: ['quads','glutes','hamstrings'],  equipment: ['dumbbells'],  exercise_type: 'weight_reps' },
  { name: 'Step Up',                  slug: 'step_up',                 category: 'Legs', muscle_groups: ['quads','glutes'],              equipment: ['dumbbells'],  exercise_type: 'weight_reps' },
  { name: 'Leg Extension',            slug: 'leg_extension',           category: 'Legs', muscle_groups: ['quads'],                       equipment: ['machine'],   exercise_type: 'weight_reps' },
  { name: 'Leg Curl',                 slug: 'leg_curl',                category: 'Legs', muscle_groups: ['hamstrings'],                  equipment: ['machine'],   exercise_type: 'weight_reps' },
  { name: 'Stiff Leg Deadlift',       slug: 'stiff_leg_deadlift',      category: 'Legs', muscle_groups: ['hamstrings','glutes','back'],   equipment: ['barbell'],   exercise_type: 'weight_reps' },
  { name: 'Hip Thrust',               slug: 'hip_thrust',              category: 'Legs', muscle_groups: ['glutes','hamstrings'],          equipment: ['barbell'],   exercise_type: 'weight_reps' },
  { name: 'Glute Bridge',             slug: 'glute_bridge',            category: 'Legs', muscle_groups: ['glutes','hamstrings'],          equipment: ['bodyweight'], exercise_type: 'bodyweight_reps' },
  { name: 'Single Leg Glute Bridge',  slug: 'single_leg_glute_bridge', category: 'Legs', muscle_groups: ['glutes','hamstrings'],          equipment: ['bodyweight'], exercise_type: 'bodyweight_reps' },
  { name: 'Cable Kickback',           slug: 'cable_kickback',          category: 'Legs', muscle_groups: ['glutes'],                      equipment: ['cables'],    exercise_type: 'weight_reps' },
  { name: 'Sumo Squat',              slug: 'sumo_squat',              category: 'Legs', muscle_groups: ['quads','glutes','hamstrings'],  equipment: ['barbell'],   exercise_type: 'weight_reps' },
  { name: 'Smith Machine Squat',      slug: 'smith_machine_squat',     category: 'Legs', muscle_groups: ['quads','glutes'],              equipment: ['machine'],   exercise_type: 'weight_reps' },
  { name: 'Band Squat',               slug: 'band_squat',              category: 'Legs', muscle_groups: ['quads','glutes'],              equipment: ['bands'],     exercise_type: 'weight_reps' },
  { name: 'Standing Calf Raise',      slug: 'standing_calf_raise',     category: 'Legs', muscle_groups: ['calves'],                      equipment: ['machine'],   exercise_type: 'weight_reps' },
  { name: 'Seated Calf Raise',        slug: 'seated_calf_raise',       category: 'Legs', muscle_groups: ['calves'],                      equipment: ['machine'],   exercise_type: 'weight_reps' },
  { name: 'Donkey Calf Raise',        slug: 'donkey_calf_raise',       category: 'Legs', muscle_groups: ['calves'],                      equipment: ['bodyweight'], exercise_type: 'bodyweight_reps' },

  // ── CORE ───────────────────────────────────────────────────────────────────
  { name: 'Plank',             slug: 'plank',             category: 'Core', muscle_groups: ['core'],          equipment: ['bodyweight'],  exercise_type: 'duration' },
  { name: 'Side Plank',        slug: 'side_plank',        category: 'Core', muscle_groups: ['core'],          equipment: ['bodyweight'],  exercise_type: 'duration' },
  { name: 'Ab Crunch',         slug: 'ab_crunch',         category: 'Core', muscle_groups: ['core'],          equipment: ['bodyweight'],  exercise_type: 'bodyweight_reps' },
  { name: 'Hanging Leg Raise', slug: 'hanging_leg_raise', category: 'Core', muscle_groups: ['core'],          equipment: ['pullup_bar'], exercise_type: 'bodyweight_reps' },
  { name: 'Cable Crunch',      slug: 'cable_crunch',      category: 'Core', muscle_groups: ['core'],          equipment: ['cables'],     exercise_type: 'weight_reps' },
  { name: 'Russian Twist',     slug: 'russian_twist',     category: 'Core', muscle_groups: ['core'],          equipment: ['dumbbells'],   exercise_type: 'weight_reps' },
  { name: 'Decline Crunch',    slug: 'decline_crunch',    category: 'Core', muscle_groups: ['core'],          equipment: ['bodyweight'],  exercise_type: 'bodyweight_reps' },
  { name: 'Ab Wheel Rollout',  slug: 'ab_wheel_rollout',  category: 'Core', muscle_groups: ['core'],          equipment: ['bodyweight'],  exercise_type: 'bodyweight_reps' },
  { name: 'Pallof Press',      slug: 'pallof_press',      category: 'Core', muscle_groups: ['core'],          equipment: ['cables'],     exercise_type: 'weight_reps' },
  { name: 'Dragon Flag',       slug: 'dragon_flag',       category: 'Core', muscle_groups: ['core'],          equipment: ['bodyweight'],  exercise_type: 'bodyweight_reps' },
  { name: 'Bird Dog',          slug: 'bird_dog',          category: 'Core', muscle_groups: ['core','back','glutes'], equipment: ['bodyweight'], exercise_type: 'bodyweight_reps' },
  { name: 'Sit-Up',            slug: 'sit_up',            category: 'Core', muscle_groups: ['core'],          equipment: ['bodyweight'],  exercise_type: 'bodyweight_reps' },
  { name: 'Leg Raise',         slug: 'leg_raise',         category: 'Core', muscle_groups: ['core'],          equipment: ['bodyweight'],  exercise_type: 'bodyweight_reps' },
  { name: 'Flutter Kick',      slug: 'flutter_kick',      category: 'Core', muscle_groups: ['core'],          equipment: ['bodyweight'],  exercise_type: 'bodyweight_reps' },
  { name: 'Front Lever Raise', slug: 'front_lever_raise', category: 'Core', muscle_groups: ['core','back'],   equipment: ['pullup_bar'], exercise_type: 'bodyweight_reps' },

  // ── FOREARMS ───────────────────────────────────────────────────────────────
  { name: 'Wrist Curl',                        slug: 'wrist_curl',                     category: 'Arms', muscle_groups: ['forearms'],          equipment: ['barbell'],   exercise_type: 'weight_reps' },
  { name: 'Reverse Wrist Curl',                slug: 'reverse_wrist_curl',             category: 'Arms', muscle_groups: ['forearms'],          equipment: ['barbell'],   exercise_type: 'weight_reps' },
  { name: 'Behind the Back Wrist Curl (Cable)', slug: 'behind_back_wrist_curl_cable',  category: 'Arms', muscle_groups: ['forearms','biceps'], equipment: ['cables'],    exercise_type: 'weight_reps' },
  { name: 'Farmer Carry',                      slug: 'farmer_carry',                   category: 'Full Body', muscle_groups: ['forearms','traps','core'], equipment: ['dumbbells'], exercise_type: 'weight_duration' },
  { name: 'Dead Hang',                         slug: 'dead_hang',                      category: 'Back', muscle_groups: ['forearms','lats','traps'], equipment: ['pullup_bar'], exercise_type: 'duration' },
  { name: 'Weighted Dead Hang',                slug: 'weighted_dead_hang',             category: 'Back', muscle_groups: ['forearms','lats','traps'], equipment: ['pullup_bar'], exercise_type: 'weight_duration' },

  // ── FULL BODY ──────────────────────────────────────────────────────────────
  { name: 'Power Clean',       slug: 'power_clean',      category: 'Full Body', muscle_groups: ['full_body'],                     equipment: ['barbell'],    exercise_type: 'weight_reps' },
  { name: 'Clean and Jerk',    slug: 'clean_and_jerk',   category: 'Full Body', muscle_groups: ['full_body'],                     equipment: ['barbell'],    exercise_type: 'weight_reps' },
  { name: 'Clean and Press',   slug: 'clean_and_press',  category: 'Full Body', muscle_groups: ['full_body'],                     equipment: ['barbell'],    exercise_type: 'weight_reps' },
  { name: 'Kettlebell Swing',  slug: 'kettlebell_swing', category: 'Full Body', muscle_groups: ['glutes','hamstrings','back','core'], equipment: ['kettlebells'], exercise_type: 'weight_reps' },
  { name: 'Turkish Get-Up',    slug: 'turkish_get_up',   category: 'Full Body', muscle_groups: ['full_body'],                     equipment: ['kettlebells'], exercise_type: 'weight_reps' },
  { name: 'Thrusters',         slug: 'thrusters',        category: 'Full Body', muscle_groups: ['quads','shoulders','glutes','triceps'], equipment: ['barbell'], exercise_type: 'weight_reps' },
  { name: 'Burpee',            slug: 'burpee',           category: 'Full Body', muscle_groups: ['full_body'],                     equipment: ['bodyweight'],  exercise_type: 'bodyweight_reps' },
  { name: 'Muscle-Up',         slug: 'muscle_up',        category: 'Full Body', muscle_groups: ['back','chest','triceps'],        equipment: ['pullup_bar'], exercise_type: 'bodyweight_reps' },
  { name: 'Overhead Squat',    slug: 'overhead_squat',   category: 'Full Body', muscle_groups: ['quads','shoulders','core','glutes'], equipment: ['barbell'], exercise_type: 'weight_reps' },
  { name: 'Snatch',            slug: 'snatch',           category: 'Full Body', muscle_groups: ['full_body'],                     equipment: ['barbell'],    exercise_type: 'weight_reps' },

  // ── CARDIO ─────────────────────────────────────────────────────────────────
  { name: 'Cycling',       slug: 'cycling',       category: 'Cardio', muscle_groups: ['cardio','quads','glutes'],  equipment: ['cardio_machine'], exercise_type: 'distance_duration' },
  { name: 'Treadmill',     slug: 'treadmill',     category: 'Cardio', muscle_groups: ['cardio'],                  equipment: ['cardio_machine'], exercise_type: 'distance_duration' },
  { name: 'Walking',       slug: 'walking',       category: 'Cardio', muscle_groups: ['cardio'],                  equipment: ['bodyweight'],     exercise_type: 'distance_duration' },
  { name: 'Running',       slug: 'running',       category: 'Cardio', muscle_groups: ['cardio'],                  equipment: ['bodyweight'],     exercise_type: 'distance_duration' },
  { name: 'Rowing',        slug: 'rowing',        category: 'Cardio', muscle_groups: ['cardio','back','core'],    equipment: ['cardio_machine'], exercise_type: 'distance_duration' },
  { name: 'Jump Rope',     slug: 'jump_rope',     category: 'Cardio', muscle_groups: ['cardio','calves'],         equipment: ['bodyweight'],     exercise_type: 'duration' },
  { name: 'Elliptical',    slug: 'elliptical',    category: 'Cardio', muscle_groups: ['cardio'],                  equipment: ['cardio_machine'], exercise_type: 'distance_duration' },
  { name: 'Stair Climber', slug: 'stair_climber', category: 'Cardio', muscle_groups: ['cardio','glutes','quads'], equipment: ['cardio_machine'], exercise_type: 'duration' },
  { name: 'Swimming',      slug: 'swimming',      category: 'Cardio', muscle_groups: ['cardio','back','shoulders'], equipment: ['bodyweight'],   exercise_type: 'distance_duration' },
  { name: 'Warm Up',       slug: 'warm_up',       category: 'Cardio', muscle_groups: ['full_body'],               equipment: ['bodyweight'],     exercise_type: 'duration' },
  { name: 'Stretching',    slug: 'stretching',    category: 'Cardio', muscle_groups: ['full_body'],               equipment: ['bodyweight'],     exercise_type: 'duration' },
];

// ── Upsert ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Syncing ${EXERCISES.length} exercises to Supabase…\n`);

  if (DRY_RUN) {
    EXERCISES.forEach(e => console.log(`  ${e.slug} (${e.exercise_type})`));
    console.log('\nDry run complete — no changes written.');
    return;
  }

  const CHUNK = 50;
  let upserted = 0;
  let failed = 0;

  for (let i = 0; i < EXERCISES.length; i += CHUNK) {
    const chunk = EXERCISES.slice(i, i + CHUNK);
    const { error } = await supabase
      .from('exercises')
      .upsert(chunk, { onConflict: 'slug', ignoreDuplicates: false });

    if (error) {
      console.error(`  ✗ Chunk ${i}–${i + chunk.length}: ${error.message}`);
      failed += chunk.length;
    } else {
      upserted += chunk.length;
    }

    const pct = Math.round(((i + chunk.length) / EXERCISES.length) * 100);
    process.stdout.write(`\r  Progress: ${Math.min(i + CHUNK, EXERCISES.length)}/${EXERCISES.length} (${pct}%)`);
  }

  console.log('\n');
  console.log(`  ✓ Upserted: ${upserted}`);
  if (failed > 0) console.log(`  ✗ Failed:   ${failed}`);
  console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });
