import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, StyleSheet, StatusBar,
} from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { isValidEmail } from '@/lib/validation';
import { COLORS } from '@/constants';

type LoginErrors = { email: string; password: string; form: string };

/** Map Supabase Auth errors to inline fields (avoid generic alerts on web). */
function mapSignInError(raw: string): LoginErrors {
  const empty: LoginErrors = { email: '', password: '', form: '' };
  const lower = raw.toLowerCase();

  if (
    lower.includes('email not confirmed')
    || lower.includes('email address not confirmed')
    || lower.includes('not verified')
  ) {
    return {
      ...empty,
      form: 'Confirm your email before signing in. Check your inbox for the link.',
    };
  }

  if (
    lower.includes('invalid login credentials')
    || lower.includes('invalid credentials')
    || lower.includes('wrong password')
    || lower.includes('incorrect password')
  ) {
    return {
      ...empty,
      form: 'Invalid email or password.',
    };
  }

  if (
    lower.includes('too many requests')
    || lower.includes('too many')
    || lower.includes('rate limit')
    || lower.includes('429')
  ) {
    return {
      ...empty,
      form: 'Too many sign-in attempts. Wait a minute and try again.',
    };
  }

  if (lower.includes('network') || lower.includes('fetch failed') || lower.includes('failed to fetch')) {
    return {
      ...empty,
      form: 'Network error. Check your connection and try again.',
    };
  }

  if (lower.includes('email') && (lower.includes('invalid') || lower.includes('format'))) {
    return {
      ...empty,
      email: raw || 'Enter a valid email address.',
    };
  }

  return {
    ...empty,
    form: raw || 'Could not sign in. Try again.',
  };
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailConfirmedHint, setEmailConfirmedHint] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({
    email: '',
    password: '',
    form: '',
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (hash.includes('access_token') || hash.includes('type=signup')) {
      setEmailConfirmedHint(true);
    }
    void supabase.auth.getSession().then(() => {
      if (typeof window !== 'undefined' && window.location.hash) {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      }
    });
  }, []);

  const handleLogin = async () => {
    const cleanEmail = email.trim().toLowerCase();
    setErrors({ email: '', password: '', form: '' });

    if (!cleanEmail || !password) {
      setErrors({
        email: '',
        password: '',
        form: 'Please enter your email and password.',
      });
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setErrors({
        email: 'Enter a valid email address (e.g. you@example.com).',
        password: '',
        form: '',
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    setLoading(false);

    if (error) {
      setErrors(mapSignInError(error.message ?? ''));
    }
  };

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
            {emailConfirmedHint ? (
              <Text style={s.confirmBanner}>Email confirmed — you can sign in below.</Text>
            ) : null}
            {!!errors.form && <Text style={s.formError}>{errors.form}</Text>}
            <View>
              <Text style={s.fieldLabel}>Email</Text>
              <TextInput
                style={[s.input, errors.email ? s.inputError : null]}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.ink3}
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setErrors((e) => ({
                    ...e,
                    form: '',
                    ...(e.email ? { email: '' } : {}),
                  }));
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              {!!errors.email && <Text style={s.fieldError}>{errors.email}</Text>}
            </View>
            <View>
              <Text style={s.fieldLabel}>Password</Text>
              <TextInput
                style={[s.input, errors.password ? s.inputError : null]}
                placeholder="••••••••"
                placeholderTextColor={COLORS.ink3}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setErrors((e) => ({
                    ...e,
                    form: '',
                    ...(e.password ? { password: '' } : {}),
                  }));
                }}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
              />
              {!!errors.password && <Text style={s.fieldError}>{errors.password}</Text>}
            </View>
            <TouchableOpacity style={s.primaryBtn} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
              {loading ? <ActivityIndicator color={COLORS.bg} /> : (
                <Text style={s.primaryBtnText}>Sign In</Text>
              )}
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
  confirmBanner: {
    color: COLORS.green,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 4,
    textAlign: 'center',
  },
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
