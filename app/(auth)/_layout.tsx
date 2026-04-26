import { Redirect, Stack, useSegments } from 'expo-router';
import { useUserStore } from '@/stores/userStore';

export default function AuthLayout() {
  const user = useUserStore((s) => s.user);
  const segments = useSegments();

  if (user) {
    const needsOnboarding = !user.goal || !user.level;
    const onOnboarding = segments.some((s) => s === 'onboarding');

    if (needsOnboarding && !onOnboarding) {
      return <Redirect href="/(auth)/onboarding/goal" />;
    }
    if (!needsOnboarding) {
      return <Redirect href="/(tabs)" />;
    }
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0F172A' } }} />
  );
}

