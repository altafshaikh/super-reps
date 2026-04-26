import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, Alert, StyleSheet, StatusBar,
} from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('Login failed', error.message);
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.container}>
          {/* Logo */}
          <View style={s.logoBlock}>
            <Text style={s.appName}>SuperReps</Text>
            <Text style={s.tagline}>AI-powered workout tracker</Text>
          </View>

          {/* Form */}
          <View style={s.form}>
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
                autoComplete="email"
              />
            </View>
            <View>
              <Text style={s.fieldLabel}>Password</Text>
              <TextInput
                style={s.input}
                placeholder="••••••••"
                placeholderTextColor={COLORS.ink3}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
              />
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
