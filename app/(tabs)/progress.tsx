import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import type { WorkoutSession, PersonalRecord } from '@/types';
import { formatDate, formatDuration } from '@/lib/utils';
import { COLORS } from '@/constants';

const { width } = Dimensions.get('window');

export default function ProgressScreen() {
  const { user } = useUserStore();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [prs, setPRs] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .not('finished_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(30),
      supabase
        .from('personal_records')
        .select('*, exercise:exercises(name)')
        .eq('user_id', user.id)
        .order('achieved_at', { ascending: false })
        .limit(10),
    ]).then(([sessRes, prRes]) => {
      if (sessRes.data) setSessions(sessRes.data as WorkoutSession[]);
      if (prRes.data) setPRs(prRes.data as unknown as PersonalRecord[]);
      setLoading(false);
    });
  }, [user]);

  const totalVolume = sessions.reduce((s, w) => s + (w.volume_total ?? 0), 0);
  const avgDuration = sessions.length
    ? Math.round(sessions.reduce((s, w) => s + (w.duration_seconds ?? 0), 0) / sessions.length)
    : 0;

  // Build weekly volume bar data (last 8 weeks)
  const weeklyData = Array.from({ length: 8 }, (_, i) => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - (7 * (7 - i)) - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    const vol = sessions
      .filter(s => {
        const d = new Date(s.started_at);
        return d >= weekStart && d < weekEnd;
      })
      .reduce((sum, s) => sum + (s.volume_total ?? 0), 0);
    return { label: `W${i + 1}`, vol };
  });

  const maxVol = Math.max(...weeklyData.map(d => d.vol), 1);

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="px-5 pt-16 pb-6">
        <Text className="text-white text-2xl font-bold">Progress</Text>
      </View>

      {/* Summary stats */}
      <View className="px-5 flex-row gap-3 mb-6">
        {[
          { label: 'Total Sessions', value: sessions.length },
          { label: 'Total Volume', value: `${Math.round(totalVolume / 1000)}k kg` },
          { label: 'Avg Duration', value: formatDuration(avgDuration) },
        ].map(stat => (
          <View key={stat.label} className="flex-1 bg-surface-card border border-surface-border rounded-xl p-3">
            <Text className="text-white font-bold text-lg">{stat.value}</Text>
            <Text className="text-white/40 text-xs mt-0.5">{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Volume chart */}
      <View className="px-5 mb-6">
        <Text className="text-white font-bold text-base mb-4">Weekly Volume (last 8 weeks)</Text>
        <View className="bg-surface-card border border-surface-border rounded-xl p-4">
          <View className="flex-row items-end gap-2 h-32">
            {weeklyData.map((d, i) => (
              <View key={i} className="flex-1 items-center gap-1">
                <View
                  style={{
                    width: '100%',
                    height: d.vol > 0 ? Math.max(4, (d.vol / maxVol) * 100) : 4,
                    backgroundColor: d.vol > 0 ? COLORS.primary : COLORS.border,
                    borderRadius: 4,
                  }}
                />
                <Text className="text-white/30 text-xs">{d.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* PRs */}
      <View className="px-5 mb-6">
        <Text className="text-white font-bold text-base mb-4">Personal Records 🏆</Text>
        {prs.length === 0 ? (
          <View className="bg-surface-card border border-surface-border rounded-xl p-6 items-center">
            <Text className="text-white/50 text-sm">Complete workouts to set PRs</Text>
          </View>
        ) : (
          <View className="gap-3">
            {prs.map(pr => (
              <View key={pr.id} className="bg-surface-card border border-surface-border rounded-xl p-4 flex-row items-center justify-between">
                <View>
                  <Text className="text-white font-semibold">{pr.exercise_name}</Text>
                  <Text className="text-white/40 text-xs mt-0.5">{formatDate(pr.achieved_at)}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-brand-500 font-bold text-lg">{pr.value} kg</Text>
                  <Text className="text-white/40 text-xs">{pr.record_type.toUpperCase()}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Recent sessions */}
      <View className="px-5">
        <Text className="text-white font-bold text-base mb-4">Workout History</Text>
        <View className="gap-3">
          {sessions.slice(0, 10).map(session => (
            <View key={session.id} className="bg-surface-card border border-surface-border rounded-xl p-4">
              <View className="flex-row justify-between">
                <Text className="text-white font-semibold">{session.routine_name ?? 'Quick Workout'}</Text>
                <Text className="text-white/40 text-xs">{formatDate(session.started_at)}</Text>
              </View>
              <View className="flex-row gap-4 mt-2">
                <Text className="text-white/50 text-xs">⏱ {formatDuration(session.duration_seconds ?? 0)}</Text>
                <Text className="text-white/50 text-xs">🏋️ {session.volume_total?.toLocaleString()} kg</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
