import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '@/stores/userStore';
import { COLORS, GOAL_OPTIONS, LEVEL_OPTIONS } from '@/constants';

export default function ProfileScreen() {
  const { user, signOut } = useUserStore();

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  const goalLabel = GOAL_OPTIONS.find(g => g.value === user?.goal)?.label ?? 'Not set';
  const levelLabel = LEVEL_OPTIONS.find(l => l.value === user?.level)?.label ?? 'Not set';

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="px-5 pt-16 pb-6">
        <Text className="text-white text-2xl font-bold">Profile</Text>
      </View>

      {/* Avatar + name */}
      <View className="items-center px-5 mb-8">
        <View className="w-20 h-20 rounded-full bg-brand-600 items-center justify-center mb-3">
          <Text className="text-white text-3xl font-bold">
            {(user?.username ?? 'U')[0].toUpperCase()}
          </Text>
        </View>
        <Text className="text-white text-xl font-bold">{user?.username ?? 'Lifter'}</Text>
        <Text className="text-white/40 text-sm mt-0.5">{user?.email}</Text>
        <View className="mt-2 bg-brand-600/20 rounded-full px-3 py-1">
          <Text className="text-brand-500 text-xs font-semibold uppercase tracking-wide">
            {user?.plan ?? 'Free'} Plan
          </Text>
        </View>
      </View>

      {/* Settings sections */}
      <View className="px-5 gap-4">
        {/* Training profile */}
        <View className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
          <Text className="px-4 pt-4 pb-2 text-white/40 text-xs font-semibold uppercase tracking-widest">
            Training Profile
          </Text>
          {[
            { label: 'Goal', value: goalLabel, icon: 'trophy-outline' },
            { label: 'Level', value: levelLabel, icon: 'stats-chart-outline' },
            { label: 'Equipment', value: (user?.equipment ?? []).join(', ') || 'Not set', icon: 'barbell-outline' },
          ].map((item, i, arr) => (
            <View
              key={item.label}
              className={`flex-row items-center px-4 py-3.5 ${i < arr.length - 1 ? 'border-b border-surface-border' : ''}`}
            >
              <Ionicons name={item.icon as any} size={18} color={COLORS.textMuted} />
              <Text className="text-white/60 text-sm ml-3 flex-1">{item.label}</Text>
              <Text className="text-white text-sm font-medium">{item.value}</Text>
            </View>
          ))}
        </View>

        {/* App info */}
        <View className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
          <Text className="px-4 pt-4 pb-2 text-white/40 text-xs font-semibold uppercase tracking-widest">
            App
          </Text>
          {[
            { label: 'Version', value: '1.0.0' },
            { label: 'Powered by', value: 'Groq + Llama 3.3' },
          ].map((item, i, arr) => (
            <View
              key={item.label}
              className={`flex-row items-center px-4 py-3.5 ${i < arr.length - 1 ? 'border-b border-surface-border' : ''}`}
            >
              <Text className="text-white/60 text-sm flex-1">{item.label}</Text>
              <Text className="text-white/40 text-sm">{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Sign out */}
        <TouchableOpacity
          className="bg-red-500/10 border border-red-500/30 rounded-xl py-4 items-center"
          onPress={handleSignOut}
        >
          <Text className="text-red-400 font-bold text-base">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
