#!/usr/bin/env node
/**
 * Pushes EXPO_PUBLIC_* from .env → Vercel **Production** (used by `vercel deploy --prod`).
 * Preview on recent Vercel requires a per–git-branch target; set those in the dashboard if needed.
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = join(root, ".env");
const vercelProject = join(root, ".vercel", "project.json");

if (!existsSync(vercelProject)) {
  console.error("Missing .vercel/project.json — run:\n  vercel link");
  process.exit(1);
}
if (!existsSync(envFile)) {
  console.error("Missing .env");
  process.exit(1);
}

function parseEnv(content) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

async function main() {
  const parsed = parseEnv(readFileSync(envFile, "utf8"));
  const keys = Object.keys(parsed).filter((k) => k.startsWith("EXPO_PUBLIC_"));
  if (keys.length === 0) {
    console.error("No EXPO_PUBLIC_* in .env");
    process.exit(1);
  }

  const target = "production";

  for (const key of keys) {
    const value = parsed[key];
    if (!value) {
      console.warn(`Skip empty: ${key}`);
      continue;
    }
    const payload = value.endsWith("\n") ? value : `${value}\n`;
    const r = spawnSync(
      "vercel",
      ["env", "add", key, target, "--yes", "--force", "--sensitive"],
      {
        cwd: root,
        input: payload,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      }
    );
    if (r.status !== 0) {
      const err = [r.stderr, r.stdout].filter(Boolean).join("\n").trim();
      console.error(`Failed ${key} → ${target}\n${err || "(no output)"}`);
      process.exit(r.status ?? 1);
    }
    console.log(`Set ${key} → ${target}`);
    await sleep(400);
  }

  console.log("Done. Run: npm run deploy");
}

main();
