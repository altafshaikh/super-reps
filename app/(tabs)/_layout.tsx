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
      <Tabs.Screen name="log" />
      <Tabs.Screen name="ai" />
      <Tabs.Screen name="progress" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
