import { Redirect, Stack } from 'expo-router';
import { useUserStore } from '@/stores/userStore';

export default function ProfileStackLayout() {
  const user = useUserStore((s) => s.user);

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0F172A' } }} />;
}
