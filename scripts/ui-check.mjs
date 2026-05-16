#!/usr/bin/env node
/**
 * Maps changed app/ file paths → routes and captures mobile screenshots via Playwright.
 * Usage: node scripts/ui-check.mjs app/(tabs)/ai.tsx app/(tabs)/profile.tsx
 * Screenshots land in test-results/ui-check/<slug>.png
 */

import { execSync } from 'child_process';

const FILE_TO_ROUTE = {
  'app/(tabs)/index.tsx': '/',
  'app/(tabs)/ai.tsx': '/ai',
  'app/(tabs)/workouts.tsx': '/workouts',
  'app/(tabs)/profile.tsx': '/profile',
  'app/(tabs)/routines.tsx': '/routines',
  'app/(tabs)/_layout.tsx': '/', // layout change — screenshot home as representative
  'app/(auth)/login.tsx': '/login',
  'app/(auth)/signup.tsx': '/signup',
  'app/(auth)/onboarding/equipment.tsx': '/onboarding/equipment',
  'app/(auth)/onboarding/goal.tsx': '/onboarding/goal',
  'app/(auth)/onboarding/level.tsx': '/onboarding/level',
  'app/log.tsx': '/log',
  'app/profile/settings.tsx': '/profile/settings',
  'app/profile/import-export.tsx': '/profile/import-export',
  'app/routines/ai-builder.tsx': '/routines/ai-builder',
  'app/routines/import-hevy.tsx': '/routines/import-hevy',
  'app/routines/import-hevy-link.tsx': '/routines/import-hevy-link',
  // Dynamic routes omitted — require runtime IDs
};

const files = process.argv.slice(2);

if (files.length === 0) {
  console.log('Usage: node scripts/ui-check.mjs <file1> [file2 ...]');
  process.exit(0);
}

const routes = [
  ...new Set(
    files.flatMap((f) => {
      const normalized = f.replace(/^\.\//, '');
      const route = FILE_TO_ROUTE[normalized];
      if (!route) {
        console.log(`No route mapping for ${normalized} — skipping`);
      }
      return route ? [route] : [];
    }),
  ),
];

if (routes.length === 0) {
  console.log('No screenshottable routes found for the changed files.');
  process.exit(0);
}

console.log(`\nCapturing screenshots for: ${routes.join(', ')}\n`);

try {
  execSync(`npx playwright test e2e/ui-screenshot.spec.ts --project=chromium --reporter=line`, {
    stdio: 'inherit',
    env: { ...process.env, SCREENSHOT_ROUTES: routes.join(',') },
  });
} catch {
  // Non-zero exit just means some tests failed/skipped — screenshots may still exist
}

console.log('\nScreenshots saved to: test-results/ui-check/');
