-- Migration: set exercise_type for duration-based and weight_duration exercises
-- that were imported from free-exercise-db without an exercise_type value.

UPDATE exercises SET exercise_type = 'duration'
WHERE slug IN ('dead_hang', 'plank', 'side_plank', 'jump_rope', 'stair_climber', 'warm_up', 'stretching')
  AND (exercise_type IS NULL OR exercise_type = '');

UPDATE exercises SET exercise_type = 'weight_duration'
WHERE slug IN ('weighted_dead_hang', 'farmer_carry')
  AND (exercise_type IS NULL OR exercise_type = '');

UPDATE exercises SET exercise_type = 'distance_duration'
WHERE slug IN ('cycling', 'walking', 'running', 'rowing', 'elliptical', 'swimming')
  AND (exercise_type IS NULL OR exercise_type = '');

UPDATE exercises SET exercise_type = 'bodyweight_reps'
WHERE slug IN ('pull_up', 'chin_up', 'push_up', 'dip', 'hanging_leg_raise', 'squat_bodyweight', 'ab_crunch', 'russian_twist')
  AND (exercise_type IS NULL OR exercise_type = '');
