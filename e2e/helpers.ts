/** True when the app is pointed at a real Supabase project (not bundle placeholders). */
export function hasRealSupabase(): boolean {
  const u = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  return u.length > 0 && !u.includes('placeholder-not-configured');
}

export function e2eCredentials(): { email: string; password: string } | null {
  const email = process.env.E2E_TEST_EMAIL?.trim();
  const password = process.env.E2E_TEST_PASSWORD ?? '';
  if (!email || !password) return null;
  return { email, password };
}

/** Opt-in: creates a real Supabase user; requires email confirmation disabled (or auto-confirm) so signup returns a session. */
export function e2eSignupOnboardingEnabled(): boolean {
  const v = process.env.E2E_SIGNUP_ONBOARDING?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}
