/** Format check before calling auth APIs (avoids server validation errors for obvious typos). */
export function isValidEmail(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/** Login field: explicit email vs handle (no `@` = username rules). */
export function classifyLoginIdentifier(raw: string): 'email' | 'username' | 'invalid_email' {
  const t = raw.trim();
  if (!t) return 'username';
  if (t.includes('@')) {
    return isValidEmail(t) ? 'email' : 'invalid_email';
  }
  return 'username';
}

const USERNAME_MIN_LEN = 3;
const USERNAME_MAX_LEN = 30;

const NAME_MAX_LEN = 60;

/** Full name: non-empty, no leading/trailing whitespace, reasonable length. */
export function validateName(raw: string): string | null {
  const v = raw.trim();
  if (!v) return 'Please enter your full name.';
  if (v.length < 2) return 'Name must be at least 2 characters.';
  if (v.length > NAME_MAX_LEN) return `Name must be at most ${NAME_MAX_LEN} characters.`;
  if (/[0-9]/.test(v)) return 'Name should not contain numbers.';
  return null;
}

/** Client-side username rules (aligned with public.handle-style IDs). */
export function validateUsername(raw: string): string | null {
  const u = raw.trim().toLowerCase();
  if (!u) return null;
  if (u.length < USERNAME_MIN_LEN) {
    return `Username must be at least ${USERNAME_MIN_LEN} characters.`;
  }
  if (u.length > USERNAME_MAX_LEN) {
    return `Username must be at most ${USERNAME_MAX_LEN} characters.`;
  }
  if (!/^[a-z0-9_]+$/.test(u)) {
    return 'Use only lowercase letters, numbers, and underscores (no spaces).';
  }
  return null;
}

/** Maps Supabase profile update errors to a short user-facing message. */
export function describeProfileUsernameError(err: {
  message?: string;
  code?: string | number;
  details?: string;
}): string {
  const code = String(err.code ?? '');
  const blob = `${err.details ?? ''} ${err.message ?? ''}`.toLowerCase();
  if (code === '42501' || blob.includes('row-level security')) {
    return 'Could not save your profile. Try again in a moment.';
  }
  if (blob.includes('username') || blob.includes('users_username') || blob.includes('key (username)')) {
    return 'That username is already taken. Pick another one.';
  }
  if (code === '23505') {
    return 'This username already exists. Pick a different one.';
  }
  return err.message || 'Could not save your profile.';
}
