import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, StyleSheet, StatusBar,
} from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getEmailRedirectUrl } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import { classifyLoginIdentifier, validateUsername, isValidEmail } from '@/lib/validation';
import { COLORS } from '@/constants';

type LoginErrors = { identifier: string; password: string; form: string };

function mapSignInError(raw: string): LoginErrors {
  const empty: LoginErrors = { identifier: '', password: '', form: '' };
  const lower = raw.toLowerCase();

  if (
    lower.includes('email not confirmed')
    || lower.includes('email address not confirmed')
    || lower.includes('not verified')
  ) {
    return { ...empty, form: 'Confirm your email before signing in. Check your inbox for the link.' };
  }
  if (
    lower.includes('invalid login credentials')
    || lower.includes('invalid credentials')
    || lower.includes('wrong password')
    || lower.includes('incorrect password')
  ) {
    return { ...empty, form: 'Invalid email, username, or password.' };
  }
  if (
    lower.includes('too many requests')
    || lower.includes('too many')
    || lower.includes('rate limit')
    || lower.includes('429')
  ) {
    return { ...empty, form: 'Too many sign-in attempts. Wait a minute and try again.' };
  }
  if (lower.includes('network') || lower.includes('fetch failed') || lower.includes('failed to fetch')) {
    return { ...empty, form: 'Network error. Check your connection and try again.' };
  }
  if (lower.includes('email') && (lower.includes('invalid') || lower.includes('format'))) {
    return { ...empty, identifier: raw || 'Enter a valid email address.' };
  }
  return { ...empty, form: raw || 'Could not sign in. Try again.' };
}

export default function LoginScreen() {
  const signInBlockedMessage = useUserStore((s) => s.signInBlockedMessage);
  const clearSignInBlockedMessage = useUserStore((s) => s.clearSignInBlockedMessage);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({ identifier: '', password: '', form: '' });

  // Forgot password state
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotDone, setForgotDone] = useState(false);
  const [forgotError, setForgotError] = useState('');

  useEffect(() => {
    if (!signInBlockedMessage) return;
    setErrors((e) => ({ ...e, form: signInBlockedMessage }));
    clearSignInBlockedMessage();
  }, [signInBlockedMessage, clearSignInBlockedMessage]);

  const handleLogin = async () => {
    const raw = identifier.trim();
    setErrors({ identifier: '', password: '', form: '' });

    if (!raw || !password) {
      setErrors({ identifier: '', password: '', form: 'Please enter your email or username and password.' });
      return;
    }

    const kind = classifyLoginIdentifier(raw);
    if (kind === 'invalid_email') {
      setErrors({ identifier: 'Enter a valid email address (e.g. you@example.com).', password: '', form: '' });
      return;
    }

    let emailForSignIn: string;
    if (kind === 'email') {
      emailForSignIn = raw.toLowerCase();
    } else {
      const uErr = validateUsername(raw);
      if (uErr) {
        setErrors({ identifier: uErr, password: '', form: '' });
        return;
      }
      setLoading(true);
      const { data: resolved, error: rpcErr } = await supabase.rpc('login_identifier_to_email', {
        p_identifier: raw.toLowerCase(),
      });
      if (rpcErr) {
        setLoading(false);
        setErrors({
          identifier: '',
          password: '',
          form:
            rpcErr.message?.toLowerCase().includes('function') || rpcErr.code === '42883'
              ? 'Username sign-in is not set up yet. Use your email address instead.'
              : 'Could not look up that username. Try again or use your email.',
        });
        return;
      }
      if (!resolved || typeof resolved !== 'string') {
        setLoading(false);
        setErrors(mapSignInError('Invalid login credentials'));
        return;
      }
      emailForSignIn = resolved;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: emailForSignIn, password });
    setLoading(false);
    if (error) setErrors(mapSignInError(error.message ?? ''));
  };

  const handleForgotPassword = async () => {
    const cleanEmail = forgotEmail.trim().toLowerCase();
    setForgotError('');

    if (!cleanEmail) { setForgotError('Please enter your email address.'); return; }
    if (!isValidEmail(cleanEmail)) { setForgotError('Enter a valid email address.'); return; }

    setForgotLoading(true);
    const redirectTo = getEmailRedirectUrl();
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      ...(redirectTo ? { redirectTo } : {}),
    });
    setForgotLoading(false);

    if (error) {
      setForgotError(error.message ?? 'Could not send reset email. Try again.');
      return;
    }
    setForgotDone(true);
  };

  if (forgotMode) {
    return (
      <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.container}>
            <View style={s.logoBlock}>
              <Text style={s.appName}>SuperReps</Text>
              <Text style={s.tagline}>Reset your password</Text>
            </View>

            {forgotDone ? (
              <View style={s.form}>
                <Text style={s.successText}>
                  Check your inbox — we sent a password reset link to {forgotEmail.trim().toLowerCase()}.
                  The link expires in 1 hour.
                </Text>
                <TouchableOpacity
                  style={s.primaryBtn}
                  onPress={() => { setForgotMode(false); setForgotDone(false); setForgotEmail(''); }}
                  activeOpacity={0.85}
                >
                  <Text style={s.primaryBtnText}>Back to Sign In</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.form}>
                <Text style={s.forgotHint}>
                  Enter the email address on your account and we'll send you a reset link.
                </Text>
                {!!forgotError && <Text style={s.formError}>{forgotError}</Text>}
                <View>
                  <Text style={s.fieldLabel}>Email</Text>
                  <TextInput
                    style={[s.input, forgotError ? s.inputError : null]}
                    placeholder="you@example.com"
                    placeholderTextColor={COLORS.ink3}
                    value={forgotEmail}
                    onChangeText={(t) => { setForgotEmail(t); setForgotError(''); }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="emailAddress"
                    autoFocus
                  />
                </View>
                <TouchableOpacity
                  style={s.primaryBtn}
                  onPress={handleForgotPassword}
                  disabled={forgotLoading}
                  activeOpacity={0.85}
                >
                  {forgotLoading
                    ? <ActivityIndicator color={COLORS.bg} />
                    : <Text style={s.primaryBtnText}>Send Reset Link</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setForgotMode(false)} activeOpacity={0.7}>
                  <Text style={s.backLink}>Back to Sign In</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.container}>
          <View style={s.logoBlock}>
            <Text style={s.appName}>SuperReps</Text>
            <Text style={s.tagline}>AI-powered workout tracker</Text>
          </View>

          <View style={s.form}>
            {!!errors.form && <Text style={s.formError}>{errors.form}</Text>}
            <View>
              <Text style={s.fieldLabel}>Email or Username</Text>
              <TextInput
                testID="login-identifier"
                style={[s.input, errors.identifier ? s.inputError : null]}
                placeholder="you@example.com or lifter42"
                placeholderTextColor={COLORS.ink3}
                value={identifier}
                onChangeText={(t) => {
                  setIdentifier(t);
                  setErrors((e) => ({ ...e, form: '', ...(e.identifier ? { identifier: '' } : {}) }));
                }}
                keyboardType="default"
                autoCapitalize="none"
                autoComplete="username"
                textContentType="username"
              />
              {!!errors.identifier && <Text style={s.fieldError}>{errors.identifier}</Text>}
            </View>
            <View>
              <View style={s.passwordLabelRow}>
                <Text style={s.fieldLabel}>Password</Text>
                <TouchableOpacity onPress={() => setForgotMode(true)} activeOpacity={0.7}>
                  <Text style={s.forgotLink}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                testID="login-password"
                style={[s.input, errors.password ? s.inputError : null]}
                placeholder="••••••••"
                placeholderTextColor={COLORS.ink3}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setErrors((e) => ({ ...e, form: '', ...(e.password ? { password: '' } : {}) }));
                }}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
              />
              {!!errors.password && <Text style={s.fieldError}>{errors.password}</Text>}
            </View>
            <TouchableOpacity
              testID="login-submit"
              style={s.primaryBtn}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color={COLORS.bg} /> : <Text style={s.primaryBtnText}>Sign In</Text>}
            </TouchableOpacity>
          </View>

          <View style={s.footer}>
            <Text style={{ color: COLORS.ink3 }}>Don't have an account? </Text>
            <Link href="/(auth)/signup">
              <Text style={{ color: COLORS.blue, fontWeight: '600' }}>Sign up</Text>
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
  passwordLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  forgotLink: { color: COLORS.blue, fontSize: 13, fontWeight: '500' },
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
  forgotHint: { color: COLORS.ink2, fontSize: 14, lineHeight: 21, marginBottom: 4 },
  successText: { color: COLORS.green, fontSize: 15, lineHeight: 23, textAlign: 'center', marginBottom: 8 },
  backLink: { color: COLORS.blue, fontSize: 14, fontWeight: '500', textAlign: 'center', marginTop: 4 },
});
