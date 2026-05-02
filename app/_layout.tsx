import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import { MotionProvider } from '@/context/MotionContext';

export default function RootLayout() {
  const { setUser, fetchProfile } = useUserStore();

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session?.user) {
          void fetchProfile(session.user.id);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void fetchProfile(session.user.id);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile, setUser]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <MotionProvider>
      <StatusBar style="light" backgroundColor="#0F172A" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0F172A' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="routines" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="workout" />
        <Stack.Screen name="log" />
      </Stack>
      </MotionProvider>
    </GestureHandlerRootView>
  );
}
