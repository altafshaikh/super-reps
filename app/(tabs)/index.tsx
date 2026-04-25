import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import type { WorkoutSession } from '@/types';
import { formatDuration, timeAgo } from '@/lib/utils';
import { COLORS } from '@/constants';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useUserStore();
  const { isActive } = useWorkoutStore();
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchDashboard();
  }, [user]);

  const fetchDashboard = async () => {
    const { data } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', user!.id)
      .not('finished_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(5);

    if (data) {
      setRecentSessions(data as WorkoutSession[]);
      setStreak(calcStreak(data));
    }
    setLoading(false);
  };

  const calcStreak = (sessions: WorkoutSession[]): number => {
    if (!sessions.length) return 0;
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 30; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      const hasSession = sessions.some(s => {
        const d = new Date(s.started_at);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === day.getTime();
      });
      if (hasSession) streak++;
      else if (i > 0) break;
    }
    return streak;
  };

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Header */}
      <View className="px-5 pt-16 pb-6">
        <Text className="text-white/50 text-sm font-medium">Welcome back,</Text>
        <Text className="text-white text-2xl font-bold mt-0.5">
          {user?.username ?? 'Lifter'} 👋
        </Text>
      </View>

      {/* Stats row */}
      <View className="px-5 flex-row gap-3 mb-6">
        <View className="flex-1 bg-surface-card rounded-xl p-4 border border-surface-border">
          <Text className="text-3xl font-bold text-brand-500">{streak}</Text>
          <Text className="text-white/50 text-xs mt-1">Day streak 🔥</Text>
        </View>
        <View className="flex-1 bg-surface-card rounded-xl p-4 border border-surface-border">
          <Text className="text-3xl font-bold text-white">{recentSessions.length}</Text>
          <Text className="text-white/50 text-xs mt-1">This week</Text>
        </View>
        <View className="flex-1 bg-surface-card rounded-xl p-4 border border-surface-border">
          <Text className="text-3xl font-bold text-white">
            {recentSessions.reduce((sum, s) => sum + (s.volume_total ?? 0), 0).toLocaleString()}
          </Text>
          <Text className="text-white/50 text-xs mt-1">kg lifted</Text>
        </View>
      </View>

      {/* Start workout CTA */}
      {isActive ? (
        <TouchableOpacity
          className="mx-5 mb-6 bg-green-500/20 border border-green-500 rounded-xl p-4 flex-row items-center gap-3"
          onPress={() => router.push('/workout/active')}
        >
          <View className="w-3 h-3 rounded-full bg-green-500" />
          <Text className="text-green-400 font-bold text-base flex-1">Workout in progress</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.success} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          className="mx-5 mb-6 bg-brand-600 rounded-xl p-4 flex-row items-center justify-between"
          onPress={() => router.push('/(tabs)/log')}
        >
          <View>
            <Text className="text-white font-bold text-lg">Start Workout</Text>
            <Text className="text-white/70 text-sm mt-0.5">Pick a routine or start empty</Text>
          </View>
          <Ionicons name="play-circle" size={40} color="white" />
        </TouchableOpacity>
      )}

      {/* Recent sessions */}
      <View className="px-5">
        <Text className="text-white font-bold text-lg mb-4">Recent Workouts</Text>
        {loading ? (
          <Text className="text-white/40 text-center py-8">Loading...</Text>
        ) : recentSessions.length === 0 ? (
          <View className="bg-surface-card border border-surface-border rounded-xl p-6 items-center">
            <Text className="text-3xl mb-3">🏋️</Text>
            <Text className="text-white font-semibold text-center">No workouts yet</Text>
            <Text className="text-white/50 text-sm text-center mt-1">
              Start your first session or let AI build you a routine
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {recentSessions.map(session => (
              <View
                key={session.id}
                className="bg-surface-card border border-surface-border rounded-xl p-4"
              >
                <View className="flex-row justify-between items-start">
                  <Text className="text-white font-semibold flex-1">
                    {session.routine_name ?? 'Quick Workout'}
                  </Text>
                  <Text className="text-white/40 text-sm">{timeAgo(session.started_at)}</Text>
                </View>
                <View className="flex-row gap-4 mt-2">
                  <Text className="text-white/50 text-sm">
                    ⏱ {formatDuration(session.duration_seconds ?? 0)}
                  </Text>
                  <Text className="text-white/50 text-sm">
                    🏋️ {session.volume_total?.toLocaleString() ?? 0} kg
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
