#!/usr/bin/env node
/**
 * Applies every `supabase/migration-*.sql` file over Postgres in alphabetical
 * order. Migrations are expected to be idempotent — use `CREATE TABLE IF NOT
 * EXISTS`, `DROP POLICY IF EXISTS … CREATE POLICY …`, `ALTER TABLE … ADD COLUMN
 * IF NOT EXISTS`, etc. so this script is safe to run multiple times.
 *
 * Distinct from `db-setup.mjs`:
 *   - `db:setup` applies schema.sql + seed_exercises.sql (fresh install)
 *   - `db:migrate` applies incremental migrations (run after `db:setup` and on
 *     every subsequent change)
 *
 * Requires DATABASE_URL in .env (Supabase → Settings → Database → URI).
 */
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

function splitUserInfo(userpass) {
  const pooler = userpass.match(/^postgres\.([a-z0-9-]+):(.+)$/i);
  if (pooler) {
    return { user: `postgres.${pooler[1]}`, password: pooler[2] };
  }
  const colon = userpass.indexOf(":");
  if (colon === -1) return null;
  return { user: userpass.slice(0, colon), password: userpass.slice(colon + 1) };
}

function encodePostgresConnectionUrl(raw) {
  const trimmed = raw.trim();
  const proto = trimmed.match(/^(postgres(?:ql)?):\/\//i);
  if (!proto) return trimmed;
  const rest = trimmed.slice(proto[0].length);
  const at = rest.lastIndexOf("@");
  if (at === -1) return trimmed;
  const userpass = rest.slice(0, at);
  const hostAndPath = rest.slice(at + 1);
  const parts = splitUserInfo(userpass);
  if (!parts) return trimmed;
  const { user, password } = parts;
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${hostAndPath}`;
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");

if (!existsSync(envPath)) {
  console.error("Missing .env — copy .env.example to .env and add your keys.");
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!dbUrl || dbUrl.includes("your-") || dbUrl.includes("[YOUR-PASSWORD]")) {
  console.error("DATABASE_URL is not set or still has a placeholder. See db-setup.mjs for details.");
  process.exit(1);
}

const supabaseDir = join(root, "supabase");
const migrations = readdirSync(supabaseDir)
  .filter((f) => /^migration-.+\.sql$/i.test(f))
  .sort();

if (migrations.length === 0) {
  console.log("No migrations found in supabase/.");
  process.exit(0);
}

const sql = postgres(encodePostgresConnectionUrl(dbUrl), {
  max: 1,
  ssl: "require",
  connect_timeout: 60,
  idle_timeout: 2,
  fetch_types: false,
});

try {
  for (const name of migrations) {
    console.log(`Applying supabase/${name}…`);
    await sql.file(join(supabaseDir, name));
  }
} catch (err) {
  console.error(err?.message || err);
  process.exit(1);
} finally {
  await sql.end({ timeout: 10 });
}

console.log(`Done. Applied ${migrations.length} migration(s).`);
