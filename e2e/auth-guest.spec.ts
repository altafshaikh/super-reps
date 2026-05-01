import { test, expect } from '@playwright/test';
import { hasRealSupabase } from './helpers';

test.describe('auth (guest / validation)', () => {
  test('unauthenticated root sends user to login', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('login-email')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Sign In')).toBeVisible();
  });

  test('login: empty fields shows form error', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-submit').click();
    await expect(page.getByText('Please enter your email and password.')).toBeVisible();
  });

  test('login: invalid email format', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-email').fill('not-an-email');
    await page.getByTestId('login-password').fill('password1');
    await page.getByTestId('login-submit').click();
    await expect(page.getByText(/valid email address/i)).toBeVisible();
  });

  test('signup: empty fields shows form error', async ({ page }) => {
    await page.goto('/signup');
    await page.getByTestId('signup-submit').click();
    await expect(page.getByText('Please fill in all fields.')).toBeVisible();
  });

  test('signup: weak password shows password error', async ({ page }) => {
    await page.goto('/signup');
    await page.getByTestId('signup-username').fill('e2euser_x');
    await page.getByTestId('signup-email').fill('e2e@example.com');
    await page.getByTestId('signup-password').fill('12345678');
    await page.getByTestId('signup-submit').click();
    await expect(page.getByText(/letter/i)).toBeVisible();
  });

  test('login: wrong password for unknown user', async ({ page }) => {
    test.skip(!hasRealSupabase(), 'Set EXPO_PUBLIC_SUPABASE_URL + anon key in .env for API-backed tests');

    await page.goto('/login');
    await page.getByTestId('login-email').fill('e2e-does-not-exist@example.com');
    await page.getByTestId('login-password').fill('WrongPass1');
    await page.getByTestId('login-submit').click();
    await expect(
      page.getByText(/invalid email or password|network error|could not sign in/i),
    ).toBeVisible({ timeout: 30_000 });
  });
});
