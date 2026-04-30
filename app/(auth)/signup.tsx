import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, StyleSheet, StatusBar,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getEmailRedirectUrl, supabase } from '@/lib/supabase';
import { COLORS } from '@/constants';
import { isValidEmail, validateUsername, describeProfileUsernameError } from '@/lib/validation';

/** Supabase accepts long passwords; bcrypt truncates past ~72 bytes — cap avoids confusion. */
const PASSWORD_MIN_LEN = 8;
const PASSWORD_MAX_LEN = 72;

/** Length + complexity checks before signUp (matches common Supabase weak-password hints). */
function validatePassword(value: string): string | null {
  if (value.length < PASSWORD_MIN_LEN) {
    return `Password must be at least ${PASSWORD_MIN_LEN} characters.`;
  }
  if (value.length > PASSWORD_MAX_LEN) {
    return `Password must be at most ${PASSWORD_MAX_LEN} characters.`;
  }
  if (/\s/.test(value)) {
    return 'Password cannot contain spaces.';
  }
  if (!/[a-zA-Z]/.test(value)) {
    return 'Password must include at least one letter.';
  }
  if (!/[0-9]/.test(value)) {
    return 'Password must include at least one number.';
  }
  return null;
}

function profileErrorMessage(err: { message?: string; code?: string | number; details?: string }): string {
  const base = describeProfileUsernameError(err);
  const code = String(err.code ?? '');
  const blob = `${err.details ?? ''} ${err.message ?? ''}`.toLowerCase();
  if (code === '42501' || blob.includes('row-level security')) {
    return 'Could not save your profile. If you just signed up, open the confirmation link in your email, then sign in — or try again in a moment.';
  }
  if (code === '23505' && blob.includes('email')) {
    return 'This account or username already exists. Try signing in, or use a different username.';
  }
  return base;
}

const LOGIN_REDIRECT_MS = 4500;

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  /** Email confirmation required — show success + verify, then login (not a form error). */
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  const [redirectSeconds, setRedirectSeconds] = useState(0);
  const redirectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [errors, setErrors] = useState({
    username: '',
    email: '',
    form: '',
    password: '',
  });

  const clearErrors = () =>
    setErrors({ username: '', email: '', form: '', password: '' });

  const goToLogin = useCallback(() => {
    if (redirectTimerRef.current) {
      clearInterval(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
    router.replace('/(auth)/login');
  }, [router]);

  useEffect(() => {
    if (!verifyEmail) return;
    const deadline = Date.now() + LOGIN_REDIRECT_MS;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRedirectSeconds(left);
      if (left <= 0) {
        goToLogin();
      }
    };
    tick();
    redirectTimerRef.current = setInterval(tick, 500);
    return () => {
      if (redirectTimerRef.current) {
        clearInterval(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, [verifyEmail, goToLogin]);

  const handleSignup = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();
    clearErrors();
    if (!cleanEmail || !password || !cleanUsername) {
      setErrors({
        username: '',
        email: '',
        form: 'Please fill in all fields.',
        password: '',
      });
      return;
    }
    const usernameValidationError = validateUsername(username);
    if (usernameValidationError) {
      setErrors({
        username: usernameValidationError,
        email: '',
        form: '',
        password: '',
      });
      return;
    }
    if (!isValidEmail(cleanEmail)) {
      setErrors({
        username: '',
        email: 'Enter a valid email address (e.g. you@example.com).',
        form: '',
        password: '',
      });
      return;
    }
    const passwordValidationError = validatePassword(password);
    if (passwordValidationError) {
      setErrors({
        username: '',
        email: '',
        form: '',
        password: passwordValidationError,
      });
      return;
    }
    setLoading(true);
    const emailRedirectTo = getEmailRedirectUrl();
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      ...(emailRedirectTo ? { options: { emailRedirectTo } } : {}),
    });
    if (error) {
      setLoading(false);
      const msg = error.message ?? 'Sign up failed.';
      const lower = msg.toLowerCase();
      const onUsername =
        lower.includes('username') || lower.includes('user already registered');
      const onPassword =
        lower.includes('password')
        || lower.includes('weak')
        || lower.includes('leaked')
        || lower.includes('pwned');
      const base = { username: '', email: '', form: '', password: '' };
      if (onUsername) {
        setErrors({ ...base, username: msg });
      } else if (onPassword) {
        setErrors({ ...base, password: msg });
      } else {
        setErrors({ ...base, email: msg });
      }
      return;
    }
    if (!data.user) {
      setLoading(false);
      setPassword('');
      setVerifyEmail(cleanEmail);
      return;
    }

    let session = data.session ?? null;
    if (!session) {
      const { data: sessData } = await supabase.auth.getSession();
      session = sessData.session;
    }
    if (!session) {
      setLoading(false);
      setPassword('');
      setVerifyEmail(cleanEmail);
      return;
    }

    const { error: profileError } = await supabase.from('users').upsert(
      {
        id: data.user.id,
        email: cleanEmail,
        username: cleanUsername,
        plan: 'free',
      },
      { onConflict: 'id' },
    );

    if (profileError) {
      await supabase.auth.signOut();
      setLoading(false);
      setErrors({
        username: profileErrorMessage(profileError),
        email: '',
        form: '',
        password: '',
      });
      return;
    }

    setLoading(false);
    router.replace('/(auth)/onboarding/goal');
  };

  if (verifyEmail) {
    return (
      <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.container}>
            <View style={s.successIconWrap}>
              <Ionicons name="checkmark-circle" size={72} color={COLORS.green} />
            </View>
            <Text style={s.successTitle}>Account created successfully</Text>
            <Text style={s.successLead}>
              Please verify your email. We sent a confirmation link to:
            </Text>
            <Text style={s.successEmail}>{verifyEmail}</Text>
            <Text style={s.successHint}>
              Open that email, tap the link, then sign in. Your profile finishes saving once you are
              signed in.
            </Text>
            <TouchableOpacity style={s.primaryBtn} onPress={goToLogin} activeOpacity={0.85}>
              <Text style={s.primaryBtnText}>Go to Sign in</Text>
            </TouchableOpacity>
            {redirectSeconds > 0 ? (
              <Text style={s.redirectNote}>Taking you to sign in in {redirectSeconds}s…</Text>
            ) : null}
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
            <Text style={s.tagline}>Create your account</Text>
          </View>

          <View style={s.form}>
            {!!errors.form && <Text style={s.formError}>{errors.form}</Text>}
            <View>
              <Text style={s.fieldLabel}>Username</Text>
              <TextInput
                style={[s.input, errors.username ? s.inputError : null]}
                placeholder="lifter42"
                placeholderTextColor={COLORS.ink3}
                value={username}
                onChangeText={(t) => {
                  setUsername(t);
                  setErrors((e) => ({
                    ...e,
                    form: '',
                    ...(e.username ? { username: '' } : {}),
                  }));
                }}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
              />
              {!!errors.username && <Text style={s.fieldError}>{errors.username}</Text>}
            </View>
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
              />
              {!!errors.email && <Text style={s.fieldError}>{errors.email}</Text>}
            </View>
            <View>
              <Text style={s.fieldLabel}>Password</Text>
              <TextInput
                style={[s.input, errors.password ? s.inputError : null]}
                placeholder="8+ chars, letter & number"
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
                autoComplete="new-password"
                textContentType="newPassword"
              />
              {!!errors.password && <Text style={s.fieldError}>{errors.password}</Text>}
            </View>
            <TouchableOpacity style={s.primaryBtn} onPress={handleSignup} disabled={loading} activeOpacity={0.85}>
              {loading ? <ActivityIndicator color={COLORS.bg} /> : (
                <Text style={s.primaryBtnText}>Create Account</Text>
              )}
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
  successIconWrap: { alignItems: 'center', marginBottom: 24 },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.ink,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  successLead: {
    fontSize: 15,
    color: COLORS.ink2,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  successEmail: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.blue,
    textAlign: 'center',
    marginBottom: 20,
  },
  successHint: {
    fontSize: 14,
    color: COLORS.ink3,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  redirectNote: {
    marginTop: 16,
    fontSize: 13,
    color: COLORS.ink3,
    textAlign: 'center',
  },
});
