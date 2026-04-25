#!/usr/bin/env node
/**
 * Applies supabase/schema.sql then supabase/seed_exercises.sql over Postgres.
 * Uses postgres.js simple-query mode (multi-statement). Supabase CLI `db query -f`
 * uses prepared statements and rejects multiple commands (SQLSTATE 42601).
 *
 * Requires DATABASE_URL in .env (Supabase → Settings → Database → URI).
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

/**
 * Pooler URIs use `postgresql://postgres.<project_ref>:PASSWORD@...` (colon after ref).
 * Direct URIs use `postgresql://postgres:PASSWORD@...`.
 * Passwords with `&`, `%`, `+` must be percent-encoded or URL parsing fails.
 */
function splitUserInfo(userpass) {
  const pooler = userpass.match(/^postgres\.([a-z0-9-]+):(.+)$/i);
  if (pooler) {
    return { user: `postgres.${pooler[1]}`, password: pooler[2] };
  }
  const colon = userpass.indexOf(":");
  if (colon === -1) return null;
  return {
    user: userpass.slice(0, colon),
    password: userpass.slice(colon + 1),
  };
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
  console.error(`
DATABASE_URL is not set (or still has a placeholder).

Add one of these to .env (from Supabase → Settings → Database):
  • Connection string → URI (use the "Transaction" pooler if offered)
  • Paste the full postgresql://… string

Then run: npm run db:setup

Or apply SQL manually in the SQL Editor (see SETUP.md).
`);
  process.exit(1);
}

const dbUrlForCli = encodePostgresConnectionUrl(dbUrl);
const files = ["supabase/schema.sql", "supabase/seed_exercises.sql"];

const sql = postgres(dbUrlForCli, {
  max: 1,
  ssl: "require",
  connect_timeout: 60,
  idle_timeout: 2,
  fetch_types: false,
});

try {
  for (const rel of files) {
    const file = join(root, rel);
    if (!existsSync(file)) {
      console.error(`Missing ${rel}`);
      process.exit(1);
    }
    console.log(`Applying ${rel}…`);
    await sql.file(file);
  }
} catch (err) {
  console.error(err?.message || err);
  process.exit(1);
} finally {
  await sql.end({ timeout: 10 });
}

console.log("Database setup finished (schema + exercise seed).");
