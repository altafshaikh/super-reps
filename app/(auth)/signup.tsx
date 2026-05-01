import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, StyleSheet, StatusBar,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants';
import { isValidEmail, validateUsername, validateName, describeProfileUsernameError } from '@/lib/validation';

const PASSWORD_MIN_LEN = 8;
const PASSWORD_MAX_LEN = 72;

function validatePassword(value: string): string | null {
  if (value.length < PASSWORD_MIN_LEN) return `Password must be at least ${PASSWORD_MIN_LEN} characters.`;
  if (value.length > PASSWORD_MAX_LEN) return `Password must be at most ${PASSWORD_MAX_LEN} characters.`;
  if (/\s/.test(value)) return 'Password cannot contain spaces.';
  if (!/[a-zA-Z]/.test(value)) return 'Password must include at least one letter.';
  if (!/[0-9]/.test(value)) return 'Password must include at least one number.';
  return null;
}

function profileErrorMessage(err: { message?: string; code?: string | number; details?: string }): string {
  const code = String(err.code ?? '');
  const blob = `${err.details ?? ''} ${err.message ?? ''}`.toLowerCase();
  if (code === '42501' || blob.includes('row-level security')) {
    return 'Could not save your profile. Please try again.';
  }
  if (code === '23505' && blob.includes('email')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  return describeProfileUsernameError(err);
}

async function syncSignupProfile(
  userId: string,
  cleanEmail: string,
  cleanUsername: string,
  cleanName: string,
  session: Session,
): Promise<{ error: { message?: string; code?: string | number; details?: string } | null }> {
  const { error: setErr } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (setErr) return { error: setErr };

  const profilePayload = {
    id: userId,
    email: cleanEmail,
    username: cleanUsername,
    name: cleanName,
    plan: 'free' as const,
  };

  const delays = [0, 200, 500, 1000, 2000] as const;
  let lastError: { message?: string; code?: string | number; details?: string } | null = null;

  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await new Promise((r) => setTimeout(r, delays[i]));
    await supabase.auth.getSession();

    const { data: existing } = await supabase
      .from('users')
      .select('id, username, email, name')
      .eq('id', userId)
      .maybeSingle();

    if (existing) {
      if (existing.username === cleanUsername && existing.name === cleanName) return { error: null };
      const { error: uErr } = await supabase
        .from('users')
        .update({ username: cleanUsername, email: cleanEmail, name: cleanName })
        .eq('id', userId);
      if (!uErr) return { error: null };
      const isRls = String(uErr.code) === '42501' || (uErr.message ?? '').toLowerCase().includes('row-level security');
      if (!isRls) return { error: uErr };
      lastError = uErr;
      continue;
    }

    const { error: upErr } = await supabase.from('users').upsert(profilePayload, { onConflict: 'id' });
    if (!upErr) return { error: null };
    const isRls = String(upErr.code) === '42501' || (upErr.message ?? '').toLowerCase().includes('row-level security');
    if (!isRls) return { error: upErr };
    lastError = upErr;
  }

  return { error: lastError ?? { message: 'Profile sync failed. Please try again.', code: '42501' } };
}

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ name: '', username: '', email: '', password: '', form: '' });

  const clearFieldError = (field: keyof typeof errors) =>
    setErrors((e) => ({ ...e, [field]: '', form: '' }));

  const handleSignup = async () => {
    const cleanName = name.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    setErrors({ name: '', username: '', email: '', password: '', form: '' });

    if (!cleanName || !cleanUsername || !cleanEmail || !password) {
      setErrors((e) => ({ ...e, form: 'Please fill in all fields.' }));
      return;
    }

    const nameErr = validateName(cleanName);
    if (nameErr) { setErrors((e) => ({ ...e, name: nameErr })); return; }

    const usernameErr = validateUsername(cleanUsername);
    if (usernameErr) { setErrors((e) => ({ ...e, username: usernameErr })); return; }

    if (!isValidEmail(cleanEmail)) {
      setErrors((e) => ({ ...e, email: 'Enter a valid email address (e.g. you@example.com).' }));
      return;
    }

    const passwordErr = validatePassword(password);
    if (passwordErr) { setErrors((e) => ({ ...e, password: passwordErr })); return; }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { data: { username: cleanUsername, name: cleanName } },
    });

    if (error) {
      setLoading(false);
      const msg = error.message ?? 'Sign up failed.';
      const lower = msg.toLowerCase();
      if (lower.includes('username')) { setErrors((e) => ({ ...e, username: msg })); return; }
      if (lower.includes('password') || lower.includes('weak') || lower.includes('leaked')) {
        setErrors((e) => ({ ...e, password: msg })); return;
      }
      if (lower.includes('email') || lower.includes('already registered')) {
        setErrors((e) => ({ ...e, email: msg })); return;
      }
      setErrors((e) => ({ ...e, form: msg }));
      return;
    }

    if (!data.user) {
      setLoading(false);
      setErrors((e) => ({ ...e, form: 'Could not create account. Please try again.' }));
      return;
    }

    let session = data.session ?? null;
    if (!session) {
      const { data: sessData } = await supabase.auth.getSession();
      session = sessData.session;
    }
    if (!session) {
      setLoading(false);
      setErrors((e) => ({ ...e, form: 'Account created but could not sign in automatically. Please sign in.' }));
      return;
    }

    const { error: profileError } = await syncSignupProfile(
      data.user.id, cleanEmail, cleanUsername, cleanName, session,
    );

    if (profileError) {
      await supabase.auth.signOut();
      setLoading(false);
      const msg = profileErrorMessage(profileError);
      if (msg.toLowerCase().includes('username')) {
        setErrors((e) => ({ ...e, username: msg }));
      } else {
        setErrors((e) => ({ ...e, form: msg }));
      }
      return;
    }

    setLoading(false);
    router.replace('/(auth)/onboarding/goal');
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.container}>
          <View style={s.logoBlock}>
            <Text style={s.appName}>SuperReps</Text>
            <Text style={s.tagline}>Create your account</Text>
          </View>

          <View style={s.form}>
            {!!errors.form && <Text style={s.formError}>{errors.form}</Text>}

            <View>
              <Text style={s.fieldLabel}>Full Name</Text>
              <TextInput
                testID="signup-name"
                style={[s.input, errors.name ? s.inputError : null]}
                placeholder="Jane Smith"
                placeholderTextColor={COLORS.ink3}
                value={name}
                onChangeText={(t) => { setName(t); clearFieldError('name'); }}
                autoCapitalize="words"
                autoCorrect={false}
                autoComplete="name"
                textContentType="name"
              />
              {!!errors.name && <Text style={s.fieldError}>{errors.name}</Text>}
            </View>

            <View>
              <Text style={s.fieldLabel}>Username</Text>
              <TextInput
                testID="signup-username"
                style={[s.input, errors.username ? s.inputError : null]}
                placeholder="lifter42"
                placeholderTextColor={COLORS.ink3}
                value={username}
                onChangeText={(t) => { setUsername(t); clearFieldError('username'); }}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
              />
              {!!errors.username && <Text style={s.fieldError}>{errors.username}</Text>}
            </View>

            <View>
              <Text style={s.fieldLabel}>Email</Text>
              <TextInput
                testID="signup-email"
                style={[s.input, errors.email ? s.inputError : null]}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.ink3}
                value={email}
                onChangeText={(t) => { setEmail(t); clearFieldError('email'); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
              />
              {!!errors.email && <Text style={s.fieldError}>{errors.email}</Text>}
            </View>

            <View>
              <Text style={s.fieldLabel}>Password</Text>
              <TextInput
                testID="signup-password"
                style={[s.input, errors.password ? s.inputError : null]}
                placeholder="8+ chars, letter & number"
                placeholderTextColor={COLORS.ink3}
                value={password}
                onChangeText={(t) => { setPassword(t); clearFieldError('password'); }}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
              />
              {!!errors.password && <Text style={s.fieldError}>{errors.password}</Text>}
            </View>

            <TouchableOpacity
              testID="signup-submit"
              style={s.primaryBtn}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={COLORS.bg} />
                : <Text style={s.primaryBtnText}>Create Account</Text>}
            </TouchableOpacity>
          </View>

          <View style={s.footer}>
            <Text style={{ color: COLORS.ink3 }}>Already have an account? </Text>
            <Link href="/(auth)/login">
              <Text style={{ color: COLORS.blue, fontWeight: '600' }}>Sign in</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1 },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 },
  logoBlock: { marginBottom: 40, alignItems: 'center' },
  appName: { fontSize: 40, fontWeight: '900', color: COLORS.ink, letterSpacing: -0.5 },
  tagline: { color: COLORS.ink3, marginTop: 6, fontSize: 15 },
  form: { gap: 16 },
  formError: { color: COLORS.red, fontSize: 14, lineHeight: 20, marginBottom: 4 },
  fieldError: { color: COLORS.red, fontSize: 13, marginTop: 6, lineHeight: 18 },
  fieldLabel: { color: COLORS.ink2, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: COLORS.surface, borderWidth: 0.5, borderColor: COLORS.borderMid,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: COLORS.ink,
  },
  inputError: { borderColor: COLORS.red, borderWidth: 1 },
  primaryBtn: {
    backgroundColor: COLORS.ink, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  primaryBtnText: { color: COLORS.bg, fontWeight: '700', fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
});
