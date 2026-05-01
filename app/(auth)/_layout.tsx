import { Redirect, Stack, useSegments } from 'expo-router';
import { useUserStore } from '@/stores/userStore';

export default function AuthLayout() {
  const user = useUserStore((s) => s.user);
  const segments = useSegments();

  if (user) {
    const needsGoalOrLevel = !user.goal || !user.level;
    const needsEquipment = !user.equipment?.length;
    const onOnboarding = segments.some((s) => s === 'onboarding');

    if (needsGoalOrLevel && !onOnboarding) {
      return <Redirect href="/(auth)/onboarding/goal" />;
    }
    if (!needsGoalOrLevel && needsEquipment && !onOnboarding) {
      return <Redirect href="/(auth)/onboarding/equipment" />;
    }
    if (!needsGoalOrLevel && !needsEquipment) {
      return <Redirect href="/(tabs)" />;
    }
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0F172A' } }} />
  );
}

