import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

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
    <KeyboardAvoidingView
      className="flex-1 bg-surface"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center px-6 py-12">
          <View className="mb-10">
            <Text className="text-4xl font-bold text-white text-center tracking-tight">
              SuperReps
            </Text>
            <Text className="text-white/50 text-center mt-2 text-base">
              Create your account
            </Text>
          </View>

          <View className="gap-4">
            <View>
              <Text className="text-white/70 text-sm mb-1.5 font-medium">Username</Text>
              <TextInput
                className="bg-surface-card border border-surface-border rounded-xl px-4 py-3.5 text-white text-base"
                placeholder="lifter42"
                placeholderTextColor="#475569"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>

            <View>
              <Text className="text-white/70 text-sm mb-1.5 font-medium">Email</Text>
              <TextInput
                className="bg-surface-card border border-surface-border rounded-xl px-4 py-3.5 text-white text-base"
                placeholder="you@example.com"
                placeholderTextColor="#475569"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View>
              <Text className="text-white/70 text-sm mb-1.5 font-medium">Password</Text>
              <TextInput
                className="bg-surface-card border border-surface-border rounded-xl px-4 py-3.5 text-white text-base"
                placeholder="Min 6 characters"
                placeholderTextColor="#475569"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              className="bg-brand-600 rounded-xl py-4 mt-2 items-center"
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          <View className="mt-8 flex-row justify-center">
            <Text className="text-white/50">Already have an account? </Text>
            <Link href="/(auth)/login">
              <Text className="text-brand-500 font-semibold">Sign in</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
