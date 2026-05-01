import { test, expect } from '@playwright/test';
import { e2eCredentials, hasRealSupabase } from './helpers';

test.describe('signed-in journey', () => {
  test.beforeEach(({ page }) => {
    page.on('dialog', (dialog) => void dialog.accept());
  });

  test('login → home → workouts tab → profile → settings → sign out', async ({ page }) => {
    test.skip(!hasRealSupabase(), 'Configure EXPO_PUBLIC_SUPABASE_* in .env');
    const creds = e2eCredentials();
    test.skip(!creds, 'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to a confirmed user with a public.users row');
    if (!creds) return;
    const { email, password } = creds;

    await page.goto('/login');
    await page.getByTestId('login-email').fill(email);
    await page.getByTestId('login-password').fill(password);
    await page.getByTestId('login-submit').click();

    await expect(page.getByText(/Ready to train\?|Good morning|Good afternoon|Good evening/)).toBeVisible({
      timeout: 45_000,
    });

    await page.getByTestId('tab-workouts').click();
    await expect(page.getByText('Workouts').first()).toBeVisible();

    await page.getByTestId('tab-profile').click();
    await expect(page.getByTestId('profile-open-settings')).toBeVisible();
    await page.getByTestId('profile-open-settings').click();
    await expect(page.getByText('Settings')).toBeVisible();

    await page.getByTestId('settings-sign-out').click();
    await expect(page.getByTestId('login-email')).toBeVisible({ timeout: 15_000 });
  });
});
