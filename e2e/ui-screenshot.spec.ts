import { test, expect } from '@playwright/test';
import { e2eCredentials, hasRealSupabase } from './helpers';
import path from 'path';
import fs from 'fs';

// Routes that don't require a logged-in session
const PUBLIC_ROUTES = new Set(['/login', '/signup', '/onboarding/goal', '/onboarding/level', '/onboarding/equipment']);

const rawRoutes = (process.env.SCREENSHOT_ROUTES ?? '')
  .split(',')
  .map((r) => r.trim())
  .filter(Boolean);

test.use({ viewport: { width: 390, height: 844 } });

for (const route of rawRoutes) {
  const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
  const isPublic = PUBLIC_ROUTES.has(normalizedRoute);

  test(`screenshot: ${normalizedRoute}`, async ({ page }) => {
    const outDir = path.resolve('test-results/ui-check');
    fs.mkdirSync(outDir, { recursive: true });

    if (!isPublic) {
      if (!hasRealSupabase()) {
        console.log(`Skipping ${normalizedRoute}: no Supabase credentials`);
        return;
      }
      const creds = e2eCredentials();
      if (!creds) {
        console.log(`Skipping ${normalizedRoute}: no E2E_TEST_EMAIL / E2E_TEST_PASSWORD`);
        return;
      }

      await page.goto('/login');
      await page.getByTestId('login-identifier').fill(creds.email);
      await page.getByTestId('login-password').fill(creds.password);
      await page.getByTestId('login-submit').click();
      await expect(page.getByText(/Ready to train\?|Good morning|Good afternoon|Good evening/)).toBeVisible({
        timeout: 45_000,
      });
    }

    await page.goto(normalizedRoute);
    await page.waitForLoadState('networkidle');
    // Let animations settle
    await page.waitForTimeout(800);

    const slug = normalizedRoute.replace(/^\//, '').replace(/\//g, '__') || 'home';
    const screenshotPath = path.join(outDir, `${slug}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved: ${screenshotPath}`);
  });
}
