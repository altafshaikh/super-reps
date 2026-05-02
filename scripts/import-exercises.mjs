#!/usr/bin/env node
/**
 * Imports exercises from free-exercise-db into Supabase.
 *
 * Source: https://github.com/yuhonas/free-exercise-db
 * - Fetches the full exercises.json (~800+ exercises)
 * - Maps muscle groups, equipment, category, instructions to our schema
 * - Uploads exercise images to Supabase Storage (exercise-images bucket)
 * - Upserts all exercise records via external_id (idempotent, safe to re-run)
 *
 * Prerequisites:
 *   1. Run supabase/migration-exercise-enrichment.sql first
 *   2. EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be in .env
 *
 * Usage:
 *   node --env-file=.env scripts/import-exercises.mjs
 *
 * Options:
 *   --dry-run       Print mapped records without writing to DB or Storage
 *   --limit=N       Only process first N exercises (useful for testing)
 *   --skip-images   Upsert exercise data only, skip image upload
 */

import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── CLI flags ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SKIP_IMAGES = args.includes('--skip-images');
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

// ── Environment ──────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(`
Missing environment variables.
Add to .env:
  EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=eyJ...  (from Supabase → Settings → API → service_role)
`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ── Source data ──────────────────────────────────────────────────────────────

const EXERCISES_JSON_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';

const IMAGE_BASE_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

// ── Mapping helpers ──────────────────────────────────────────────────────────

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

// free-exercise-db categories → our categories
const CATEGORY_MAP = {
  strength: 'Strength',
  stretching: 'Flexibility',
  plyometrics: 'Cardio',
  strongman: 'Strength',
  powerlifting: 'Strength',
  cardio: 'Cardio',
  'olympic weightlifting': 'Strength',
};

// free-exercise-db equipment → our equipment labels
const EQUIPMENT_MAP = {
  'body only': 'bodyweight',
  machine: 'machine',
  'other': 'other',
  'foam roll': 'foam_roller',
  'dumbbell': 'dumbbells',
  'cable': 'cables',
  'barbell': 'barbell',
  'bands': 'resistance_bands',
  'kettlebells': 'kettlebell',
  'medicine ball': 'medicine_ball',
  'exercise ball': 'exercise_ball',
  'e-z curl bar': 'ez_bar',
};

// free-exercise-db muscle names → our muscle_groups labels
const MUSCLE_MAP = {
  'abdominals': 'core',
  'abductors': 'abductors',
  'adductors': 'adductors',
  'biceps': 'biceps',
  'calves': 'calves',
  'chest': 'chest',
  'forearms': 'forearms',
  'glutes': 'glutes',
  'hamstrings': 'hamstrings',
  'lats': 'back',
  'lower back': 'back',
  'middle back': 'back',
  'traps': 'back',
  'neck': 'neck',
  'quadriceps': 'legs',
  'shoulders': 'shoulders',
  'triceps': 'triceps',
};

function mapMuscles(primary, secondary) {
  const all = [...(primary ?? []), ...(secondary ?? [])];
  const mapped = all.map(m => MUSCLE_MAP[m.toLowerCase()] ?? m.toLowerCase());
  return [...new Set(mapped)];
}

function mapEquipment(eq) {
  if (!eq || eq === 'other') return [];
  return [EQUIPMENT_MAP[eq.toLowerCase()] ?? eq.toLowerCase()];
}

function mapCategory(cat) {
  return CATEGORY_MAP[cat?.toLowerCase()] ?? 'Strength';
}

function mapFormCues(instructions) {
  if (!instructions?.length) return [];
  // First 3 instruction steps become form cues
  return instructions.slice(0, 3).map(s => s.trim()).filter(Boolean);
}

function mapExercise(ex) {
  const slug = slugify(ex.name);
  return {
    external_id: ex.id,
    name: ex.name,
    slug,
    category: mapCategory(ex.category),
    muscle_groups: mapMuscles(ex.primaryMuscles, ex.secondaryMuscles),
    equipment: mapEquipment(ex.equipment),
    instructions: (ex.instructions ?? []).join(' '),
    form_cues: mapFormCues(ex.instructions),
    level: ex.level ?? null,
    force: ex.force ?? null,
    mechanic: ex.mechanic ?? null,
    is_custom: false,
  };
}

// ── Image upload ─────────────────────────────────────────────────────────────

async function uploadImage(exerciseId, imagePath) {
  const url = `${IMAGE_BASE_URL}/${imagePath}`;
  let res;
  try {
    res = await fetch(url);
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const buffer = Buffer.from(await res.arrayBuffer());
  const ext = imagePath.endsWith('.gif') ? 'gif' : 'jpg';
  const storagePath = `${exerciseId}/image.${ext}`;

  const { error } = await supabase.storage
    .from('exercise-images')
    .upload(storagePath, buffer, {
      contentType: ext === 'gif' ? 'image/gif' : 'image/jpeg',
      upsert: true,
    });

  if (error) {
    console.warn(`  ⚠ Storage upload failed for ${exerciseId}: ${error.message}`);
    return null;
  }

  const { data } = supabase.storage
    .from('exercise-images')
    .getPublicUrl(storagePath);

  return data.publicUrl;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching exercises from free-exercise-db…');
  const res = await fetch(EXERCISES_JSON_URL);
  if (!res.ok) {
    console.error(`Failed to fetch exercises.json: ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  const exercises = await res.json();
  const batch = LIMIT < Infinity ? exercises.slice(0, LIMIT) : exercises;

  console.log(`Processing ${batch.length} exercises (dry-run: ${DRY_RUN}, skip-images: ${SKIP_IMAGES})\n`);

  let inserted = 0;
  let failed = 0;

  // Process in chunks to avoid rate limits
  const CHUNK = 20;
  for (let i = 0; i < batch.length; i += CHUNK) {
    const chunk = batch.slice(i, i + CHUNK);

    await Promise.all(chunk.map(async (ex) => {
      const mapped = mapExercise(ex);

      // Upload primary image
      if (!SKIP_IMAGES && !DRY_RUN && ex.images?.length) {
        const imageUrl = await uploadImage(ex.id, ex.images[0]);
        if (imageUrl) mapped.image_url = imageUrl;
        // Second image as gif_url slot (same format for now, GIF can replace later)
        if (ex.images.length > 1) {
          const img2 = await uploadImage(`${ex.id}_2`, ex.images[1]);
          if (img2) mapped.gif_url = img2;
        }
      } else if (SKIP_IMAGES && ex.images?.length) {
        // Store GitHub CDN URL directly — fast fallback, no upload
        mapped.image_url = `${IMAGE_BASE_URL}/${ex.images[0]}`;
        if (ex.images.length > 1) {
          mapped.gif_url = `${IMAGE_BASE_URL}/${ex.images[1]}`;
        }
      }

      if (DRY_RUN) {
        console.log(JSON.stringify(mapped, null, 2));
        inserted++;
        return;
      }

      const { error } = await supabase
        .from('exercises')
        .upsert(mapped, { onConflict: 'external_id', ignoreDuplicates: false });

      if (error) {
        // Slug collision with existing seed exercise — update by slug instead
        if (error.code === '23505' && error.message.includes('slug')) {
          const uniqueSlug = `${mapped.slug}_${ex.id.slice(-6).toLowerCase()}`;
          const { error: e2 } = await supabase
            .from('exercises')
            .upsert({ ...mapped, slug: uniqueSlug }, { onConflict: 'external_id' });
          if (e2) {
            console.warn(`  ✗ ${ex.name}: ${e2.message}`);
            failed++;
            return;
          }
        } else {
          console.warn(`  ✗ ${ex.name}: ${error.message}`);
          failed++;
          return;
        }
      }

      inserted++;
    }));

    const pct = Math.round(((i + chunk.length) / batch.length) * 100);
    process.stdout.write(`\r  Progress: ${Math.min(i + CHUNK, batch.length)}/${batch.length} (${pct}%)`);
  }

  console.log(`\n\nDone.`);
  console.log(`  ✓ Upserted: ${inserted}`);
  if (failed > 0) console.log(`  ✗ Failed:   ${failed}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
