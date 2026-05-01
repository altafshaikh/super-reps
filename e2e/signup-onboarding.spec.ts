import { test, expect } from '@playwright/test';
import { e2eSignupOnboardingEnabled, hasRealSupabase } from './helpers';

/**
 * Full path: sign up → onboarding (goal → level → equipment) → home.
 * Requires Supabase **Auth →** confirm signups disabled for the test project (or equivalent),
 * so `signUp` returns a session and the app can reach onboarding without email verification.
 */
test.describe('signup → onboarding → home', () => {
  test('new user completes all three onboarding steps', async ({ page }) => {
    test.skip(!hasRealSupabase(), 'Set EXPO_PUBLIC_SUPABASE_URL + anon key in .env');
    test.skip(
      !e2eSignupOnboardingEnabled(),
      'Set E2E_SIGNUP_ONBOARDING=1 to run (creates a real user in your Supabase project)',
    );

    const ts = Date.now();
    const username = `e2e_${ts}`;
    const email = `e2e.signup.${ts}@example.com`;
    const password = 'E2eSignupTest9';

    await page.goto('/signup');
    await page.getByTestId('signup-username').fill(username);
    await page.getByTestId('signup-email').fill(email);
    await page.getByTestId('signup-password').fill(password);
    await page.getByTestId('signup-submit').click();

    const verifyGate = page.getByText('Account created successfully');
    const step1 = page.getByText("What's your main goal?");
    await expect(verifyGate.or(step1)).toBeVisible({ timeout: 45_000 });
    test.skip(
      await verifyGate.isVisible(),
      'Supabase returned email-confirmation flow; disable confirm email for E2E or use a test project',
    );

    await expect(step1).toBeVisible();

    await page.getByText('Build Muscle', { exact: true }).click();
    await page.getByTestId('onboarding-goal-continue').click();

    await expect(page.getByText('Step 2 of 3')).toBeVisible({ timeout: 15_000 });
    await page.getByText('Beginner', { exact: true }).click();
    await page.getByTestId('onboarding-level-continue').click();

    await expect(page.getByText('Step 3 of 3')).toBeVisible({ timeout: 15_000 });
    await page.getByText('Barbell', { exact: true }).click();
    await page.getByTestId('onboarding-equipment-finish').click();

    await expect(page.getByText(/Ready to train\?|Good morning|Good afternoon|Good evening/)).toBeVisible({
      timeout: 45_000,
    });
    await expect(page.getByTestId('tab-index')).toBeVisible();
  });
});
