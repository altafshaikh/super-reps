-- Seed 100 exercises for SuperReps
-- Run after schema.sql in Supabase SQL Editor

INSERT INTO exercises (name, slug, category, muscle_groups, equipment, instructions) VALUES

-- CHEST
('Barbell Bench Press',     'barbell_bench_press',     'Chest',     ARRAY['chest','triceps','shoulders'], ARRAY['barbell'], 'Lie on bench, grip slightly wider than shoulder-width, lower bar to chest, press up.'),
('Dumbbell Bench Press',    'dumbbell_bench_press',    'Chest',     ARRAY['chest','triceps','shoulders'], ARRAY['dumbbells'], 'Lie on bench, dumbbells at chest level, press up and together.'),
('Incline Barbell Press',   'incline_barbell_press',   'Chest',     ARRAY['chest','shoulders'],           ARRAY['barbell'], 'Set bench to 30-45°, press barbell from upper chest.'),
('Incline Dumbbell Press',  'incline_dumbbell_press',  'Chest',     ARRAY['chest','shoulders'],           ARRAY['dumbbells'], 'Set bench to 30-45°, press dumbbells from upper chest.'),
('Decline Bench Press',     'decline_bench_press',     'Chest',     ARRAY['chest','triceps'],             ARRAY['barbell'], 'Decline bench, press barbell targeting lower chest.'),
('Cable Fly',               'cable_fly',               'Chest',     ARRAY['chest'],                       ARRAY['cables'], 'Stand between cables, bring handles together in arc motion.'),
('Dumbbell Fly',            'dumbbell_fly',            'Chest',     ARRAY['chest'],                       ARRAY['dumbbells'], 'Lie on bench, arms slightly bent, lower dumbbells in arc, bring back.'),
('Push-Up',                 'push_up',                 'Chest',     ARRAY['chest','triceps','shoulders'], ARRAY['bodyweight'], 'Hands shoulder-width, lower chest to floor, push back up.'),
('Wide Push-Up',            'wide_push_up',            'Chest',     ARRAY['chest'],                       ARRAY['bodyweight'], 'Hands wider than shoulder-width push-up variation.'),
('Chest Dip',               'chest_dip',               'Chest',     ARRAY['chest','triceps'],             ARRAY['bodyweight'], 'Lean forward on dips to target chest more than triceps.'),

-- BACK
('Barbell Deadlift',        'barbell_deadlift',        'Back',      ARRAY['back','glutes','hamstrings'],  ARRAY['barbell'], 'Hinge at hips, grip bar, drive hips forward lifting bar to standing.'),
('Romanian Deadlift',       'romanian_deadlift',       'Back',      ARRAY['hamstrings','glutes','back'],  ARRAY['barbell'], 'Hinge at hips keeping bar close to legs, feel hamstring stretch.'),
('Barbell Row',             'barbell_row',             'Back',      ARRAY['back','biceps'],               ARRAY['barbell'], 'Hinge to 45°, pull bar to lower chest, squeeze lats.'),
('Dumbbell Row',            'dumbbell_row',            'Back',      ARRAY['back','biceps'],               ARRAY['dumbbells'], 'One hand on bench, pull dumbbell to hip, elbow past torso.'),
('Pull-Up',                 'pull_up',                 'Back',      ARRAY['back','biceps'],               ARRAY['pullup_bar'], 'Overhand grip, pull chin over bar from dead hang.'),
('Chin-Up',                 'chin_up',                 'Back',      ARRAY['back','biceps'],               ARRAY['pullup_bar'], 'Underhand grip chin-up, more biceps involvement.'),
('Lat Pulldown',            'lat_pulldown',            'Back',      ARRAY['back','biceps'],               ARRAY['cables'], 'Wide overhand grip, pull bar to upper chest, lean slightly back.'),
('Cable Row',               'cable_row',               'Back',      ARRAY['back','biceps'],               ARRAY['cables'], 'Sit at cable row, pull handle to lower chest, keep torso upright.'),
('T-Bar Row',               't_bar_row',               'Back',      ARRAY['back','biceps'],               ARRAY['barbell'], 'Straddle T-bar, row to chest keeping back flat.'),
('Face Pull',               'face_pull',               'Back',      ARRAY['shoulders','back'],            ARRAY['cables'], 'Cable at head height, pull to face with external rotation.'),

-- SHOULDERS
('Overhead Press',          'overhead_press',          'Shoulders', ARRAY['shoulders','triceps'],         ARRAY['barbell'], 'Standing or seated, press barbell from upper chest overhead.'),
('Dumbbell Shoulder Press', 'dumbbell_shoulder_press', 'Shoulders', ARRAY['shoulders','triceps'],         ARRAY['dumbbells'], 'Seated, press dumbbells from ear level overhead.'),
('Lateral Raise',           'lateral_raise',           'Shoulders', ARRAY['shoulders'],                   ARRAY['dumbbells'], 'Raise dumbbells to sides until parallel to floor, slight bend in elbows.'),
('Cable Lateral Raise',     'cable_lateral_raise',     'Shoulders', ARRAY['shoulders'],                   ARRAY['cables'], 'Cable at low pulley, raise arm to side.'),
('Front Raise',             'front_raise',             'Shoulders', ARRAY['shoulders'],                   ARRAY['dumbbells'], 'Raise dumbbells forward to shoulder height.'),
('Arnold Press',            'arnold_press',            'Shoulders', ARRAY['shoulders','triceps'],         ARRAY['dumbbells'], 'Rotate dumbbells during press movement from front to overhead.'),
('Upright Row',             'upright_row',             'Shoulders', ARRAY['shoulders','back'],            ARRAY['barbell'], 'Pull bar up along body to chin, elbows above hands.'),
('Reverse Fly',             'reverse_fly',             'Shoulders', ARRAY['shoulders','back'],            ARRAY['dumbbells'], 'Bent over, raise dumbbells to sides targeting rear delts.'),

-- BICEPS
('Barbell Curl',            'barbell_curl',            'Biceps',    ARRAY['biceps'],                      ARRAY['barbell'], 'Standing, curl bar from hips to shoulders, squeeze at top.'),
('Dumbbell Curl',           'dumbbell_curl',           'Biceps',    ARRAY['biceps'],                      ARRAY['dumbbells'], 'Alternate or simultaneous curl, supinate wrist at top.'),
('Hammer Curl',             'hammer_curl',             'Biceps',    ARRAY['biceps','forearms'],           ARRAY['dumbbells'], 'Neutral grip curl, thumbs facing up throughout.'),
('Preacher Curl',           'preacher_curl',           'Biceps',    ARRAY['biceps'],                      ARRAY['barbell'], 'Arm against preacher pad, full range curl.'),
('Concentration Curl',      'concentration_curl',      'Biceps',    ARRAY['biceps'],                      ARRAY['dumbbells'], 'Seated, elbow on inner thigh, strict single-arm curl.'),
('Cable Curl',              'cable_curl',              'Biceps',    ARRAY['biceps'],                      ARRAY['cables'], 'Low cable, curl bar or rope up.'),
('Incline Dumbbell Curl',   'incline_dumbbell_curl',   'Biceps',    ARRAY['biceps'],                      ARRAY['dumbbells'], 'On incline bench, arms hanging, stretch bicep at bottom.'),

-- TRICEPS
('Tricep Pushdown',         'tricep_pushdown',         'Triceps',   ARRAY['triceps'],                     ARRAY['cables'], 'High cable, push bar or rope down, elbows fixed at sides.'),
('Overhead Tricep Extension','overhead_tricep_ext',    'Triceps',   ARRAY['triceps'],                     ARRAY['dumbbells'], 'Dumbbell overhead, lower behind head, extend fully.'),
('Skull Crusher',           'skull_crusher',           'Triceps',   ARRAY['triceps'],                     ARRAY['barbell'], 'Lying, lower bar to forehead, extend arms.'),
('Close Grip Bench',        'close_grip_bench',        'Triceps',   ARRAY['triceps','chest'],             ARRAY['barbell'], 'Narrow grip bench press, elbows close to body.'),
('Diamond Push-Up',         'diamond_push_up',         'Triceps',   ARRAY['triceps','chest'],             ARRAY['bodyweight'], 'Hands forming diamond shape, push-up.'),
('Tricep Dip',              'tricep_dip',              'Triceps',   ARRAY['triceps'],                     ARRAY['bodyweight'], 'Upright torso dip to target triceps.'),
('Cable Overhead Extension','cable_overhead_ext',      'Triceps',   ARRAY['triceps'],                     ARRAY['cables'], 'Face away from cable, extend rope overhead.'),

-- LEGS - QUADS
('Barbell Squat',           'barbell_squat',           'Legs',      ARRAY['quads','glutes','hamstrings'], ARRAY['barbell'], 'Bar on traps, squat to parallel or below, drive up.'),
('Front Squat',             'front_squat',             'Legs',      ARRAY['quads','core'],                ARRAY['barbell'], 'Bar in front rack, upright torso squat.'),
('Hack Squat',              'hack_squat',              'Legs',      ARRAY['quads'],                       ARRAY['cables'], 'Machine squat with emphasis on quads.'),
('Leg Press',               'leg_press',               'Legs',      ARRAY['quads','glutes'],              ARRAY['cables'], 'Seated press machine, vary foot position for emphasis.'),
('Bulgarian Split Squat',   'bulgarian_split_squat',   'Legs',      ARRAY['quads','glutes'],              ARRAY['dumbbells'], 'Rear foot elevated, deep single leg squat.'),
('Lunge',                   'lunge',                   'Legs',      ARRAY['quads','glutes'],              ARRAY['dumbbells'], 'Step forward, lower rear knee to floor, return.'),
('Leg Extension',           'leg_extension',           'Legs',      ARRAY['quads'],                       ARRAY['cables'], 'Machine, extend legs from bent to straight.'),
('Goblet Squat',            'goblet_squat',            'Legs',      ARRAY['quads','glutes'],              ARRAY['dumbbells'], 'Hold dumbbell at chest, squat deep with upright torso.'),

-- LEGS - HAMSTRINGS / GLUTES
('Leg Curl',                'leg_curl',                'Legs',      ARRAY['hamstrings'],                  ARRAY['cables'], 'Machine, curl leg from straight to bent.'),
('Stiff Leg Deadlift',      'stiff_leg_deadlift',      'Legs',      ARRAY['hamstrings','glutes'],         ARRAY['barbell'], 'Minimal knee bend deadlift, deep hamstring stretch.'),
('Glute Bridge',            'glute_bridge',            'Legs',      ARRAY['glutes','hamstrings'],         ARRAY['barbell'], 'Lying, drive hips up, barbell on hips.'),
('Hip Thrust',              'hip_thrust',              'Legs',      ARRAY['glutes'],                      ARRAY['barbell'], 'Upper back on bench, drive hips up with barbell.'),
('Cable Kickback',          'cable_kickback',          'Legs',      ARRAY['glutes'],                      ARRAY['cables'], 'On all fours or standing, kick leg back against cable.'),
('Walking Lunge',           'walking_lunge',           'Legs',      ARRAY['quads','glutes'],              ARRAY['dumbbells'], 'Continuous lunges stepping forward.'),
('Step Up',                 'step_up',                 'Legs',      ARRAY['quads','glutes'],              ARRAY['dumbbells'], 'Step onto bench, drive through heel.'),

-- CALVES
('Standing Calf Raise',     'standing_calf_raise',     'Legs',      ARRAY['calves'],                      ARRAY['cables'], 'On edge of step or machine, raise heels fully.'),
('Seated Calf Raise',       'seated_calf_raise',       'Legs',      ARRAY['calves'],                      ARRAY['cables'], 'Seated calf machine, toes on platform.'),
('Donkey Calf Raise',       'donkey_calf_raise',       'Legs',      ARRAY['calves'],                      ARRAY['bodyweight'], 'Bent over calf raises for deep stretch.'),

-- CORE
('Plank',                   'plank',                   'Core',      ARRAY['core'],                        ARRAY['bodyweight'], 'Hold prone position on forearms, keep body rigid.'),
('Ab Crunch',               'ab_crunch',               'Core',      ARRAY['core'],                        ARRAY['bodyweight'], 'Lie on back, curl torso to knees.'),
('Hanging Leg Raise',       'hanging_leg_raise',       'Core',      ARRAY['core'],                        ARRAY['pullup_bar'], 'Hang from bar, raise legs to parallel or higher.'),
('Cable Crunch',            'cable_crunch',            'Core',      ARRAY['core'],                        ARRAY['cables'], 'Kneel at cable, crunch down against resistance.'),
('Russian Twist',           'russian_twist',           'Core',      ARRAY['core'],                        ARRAY['dumbbells'], 'Seated, feet off floor, rotate torso side to side.'),
('Decline Crunch',          'decline_crunch',          'Core',      ARRAY['core'],                        ARRAY['bodyweight'], 'Crunch on decline bench for extra range.'),
('Dragon Flag',             'dragon_flag',             'Core',      ARRAY['core'],                        ARRAY['bodyweight'], 'Lie on bench, hold behind head, lower rigid body.'),
('Ab Wheel Rollout',        'ab_wheel_rollout',        'Core',      ARRAY['core'],                        ARRAY['bodyweight'], 'Kneel with ab wheel, roll out and return.'),
('Pallof Press',            'pallof_press',            'Core',      ARRAY['core'],                        ARRAY['cables'], 'Anti-rotation press from cable, resist twist.'),
('Side Plank',              'side_plank',              'Core',      ARRAY['core'],                        ARRAY['bodyweight'], 'Hold side position on forearm.'),

-- FULL BODY / COMPOUND
('Power Clean',             'power_clean',             'Full Body', ARRAY['full_body'],                   ARRAY['barbell'], 'Explosive pull, catch bar in front rack at parallel.'),
('Kettlebell Swing',        'kettlebell_swing',        'Full Body', ARRAY['glutes','hamstrings','back'],  ARRAY['kettlebells'], 'Hip hinge, swing kettlebell to chest height.'),
('Turkish Get-Up',          'turkish_get_up',          'Full Body', ARRAY['full_body'],                   ARRAY['kettlebells'], 'Rise from floor to standing with kettlebell overhead.'),
('Burpee',                  'burpee',                  'Full Body', ARRAY['full_body'],                   ARRAY['bodyweight'], 'Jump, drop to push-up, jump up with clap overhead.'),
('Thrusters',               'thrusters',               'Full Body', ARRAY['quads','shoulders'],           ARRAY['barbell'], 'Front squat into overhead press in one motion.'),
('Clean and Press',         'clean_and_press',         'Full Body', ARRAY['full_body'],                   ARRAY['barbell'], 'Clean bar then press overhead.'),

-- FOREARMS
('Wrist Curl',              'wrist_curl',              'Forearms',  ARRAY['forearms'],                    ARRAY['barbell'], 'Seated, wrists over knees, curl bar upward.'),
('Reverse Curl',            'reverse_curl',            'Forearms',  ARRAY['forearms','biceps'],           ARRAY['barbell'], 'Overhand grip curl for forearm and brachialis.'),
('Farmer Carry',            'farmer_carry',            'Forearms',  ARRAY['forearms','core','traps'],     ARRAY['dumbbells'], 'Walk with heavy dumbbells at sides.'),

-- BAND EXERCISES
('Band Pull Apart',         'band_pull_apart',         'Shoulders', ARRAY['shoulders','back'],            ARRAY['bands'], 'Hold band at chest, pull apart to work rear delts.'),
('Band Squat',              'band_squat',              'Legs',      ARRAY['quads','glutes'],              ARRAY['bands'], 'Stand on band, squat with band over shoulders.'),
('Band Row',                'band_row',                'Back',      ARRAY['back','biceps'],               ARRAY['bands'], 'Anchor band, row to hip.'),
('Band Curl',               'band_curl',               'Biceps',    ARRAY['biceps'],                      ARRAY['bands'], 'Stand on band, curl to shoulders.'),
('Band Tricep Extension',   'band_tricep_ext',         'Triceps',   ARRAY['triceps'],                     ARRAY['bands'], 'Anchor band overhead, extend tricep.'),

-- MACHINE EXERCISES
('Pec Deck',                'pec_deck',                'Chest',     ARRAY['chest'],                       ARRAY['cables'], 'Machine fly, squeeze chest at contraction.'),
('Smith Machine Squat',     'smith_machine_squat',     'Legs',      ARRAY['quads','glutes'],              ARRAY['cables'], 'Squat in guided Smith machine.'),
('Smith Machine Bench',     'smith_machine_bench',     'Chest',     ARRAY['chest','triceps'],             ARRAY['cables'], 'Bench press in Smith machine.'),
('Machine Chest Press',     'machine_chest_press',     'Chest',     ARRAY['chest','triceps'],             ARRAY['cables'], 'Seated chest press machine.'),
('Machine Shoulder Press',  'machine_shoulder_press',  'Shoulders', ARRAY['shoulders','triceps'],         ARRAY['cables'], 'Seated shoulder press machine.'),
('Machine Row',             'machine_row',             'Back',      ARRAY['back','biceps'],               ARRAY['cables'], 'Seated machine row.'),
('Assisted Pull-Up',        'assisted_pull_up',        'Back',      ARRAY['back','biceps'],               ARRAY['cables'], 'Machine-assisted pull-up for building strength.')

ON CONFLICT (slug) DO NOTHING;
