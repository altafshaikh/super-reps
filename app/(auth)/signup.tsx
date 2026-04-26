import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, Alert, StyleSheet, StatusBar,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants';

function profileErrorMessage(err: { message?: string; code?: string; details?: string }): string {
  const blob = `${err.details ?? ''} ${err.message ?? ''}`.toLowerCase();
  if (blob.includes('username') || blob.includes('users_username')) {
    return 'That username is already taken. Pick another one.';
  }
  if (err.code === '23505') {
    return 'This account or username already exists. Try signing in, or use a different username.';
  }
  return err.message || 'Could not save your profile.';
}

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanEmail || !password || !cleanUsername) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Password too short', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
    });
    if (error) {
      setLoading(false);
      Alert.alert('Sign up failed', error.message);
      return;
    }
    if (!data.user) {
      setLoading(false);
      Alert.alert(
        'Check your email',
        'If email confirmation is on, open the link in your inbox to finish signup.',
      );
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
      Alert.alert('Could not finish signup', profileErrorMessage(profileError));
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
            <View>
              <Text style={s.fieldLabel}>Username</Text>
              <TextInput
                style={s.input}
                placeholder="lifter42"
                placeholderTextColor={COLORS.ink3}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>
            <View>
              <Text style={s.fieldLabel}>Email</Text>
              <TextInput
                style={s.input}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.ink3}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View>
              <Text style={s.fieldLabel}>Password</Text>
              <TextInput
                style={s.input}
                placeholder="Min 6 characters"
                placeholderTextColor={COLORS.ink3}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
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
  fieldLabel: { color: COLORS.ink2, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: COLORS.surface, borderWidth: 0.5, borderColor: COLORS.borderMid,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: COLORS.ink,
  },
  primaryBtn: {
    backgroundColor: COLORS.ink, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  primaryBtnText: { color: COLORS.bg, fontWeight: '700', fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
});
