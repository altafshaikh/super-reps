import { Redirect, Tabs } from 'expo-router';
import { useUserStore } from '@/stores/userStore';
import { SRTabBar } from '@/components/ui';

export default function TabsLayout() {
  const user = useUserStore((s) => s.user);

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      tabBar={(props) => <SRTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="workouts" />
      <Tabs.Screen name="ai" />
      <Tabs.Screen name="profile" />
      {/* Progress tab removed from nav — file kept for data extraction reference */}
      <Tabs.Screen name="progress" options={{ href: null }} />
      {/* Full routines list + Import (hidden from tab bar) */}
      <Tabs.Screen name="routines" options={{ href: null }} />
    </Tabs>
  );
}
