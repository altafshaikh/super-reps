import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import type { Routine } from '@/types';
import { COLORS } from '@/constants';

export default function RoutinesScreen() {
  const router = useRouter();
  const { user } = useUserStore();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRoutines = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('routines')
      .select(`
        *,
        days:routine_days(
          *,
          exercises:routine_exercises(*, exercise:exercises(*))
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) setRoutines(data as unknown as Routine[]);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { fetchRoutines(); }, [fetchRoutines]);

  const onRefresh = () => { setRefreshing(true); fetchRoutines(); };

  return (
    <View className="flex-1 bg-surface">
      {/* Header — stacked so Import + AI Build always fit (narrow phones / web) */}
      <View className="px-5 pt-16 pb-4">
        <Text className="text-white text-2xl font-bold mb-3">Routines</Text>
        <View className="flex-row gap-2">
          <TouchableOpacity
            className="flex-1 bg-surface-card border border-surface-border rounded-xl py-3 px-2 flex-row items-center justify-center gap-2"
            onPress={() => router.push('/routines/import-hevy')}
            activeOpacity={0.85}
          >
            <Ionicons name="download-outline" size={18} color={COLORS.primary} />
            <Text className="text-white font-bold text-sm" numberOfLines={1}>
              Import
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-brand-600 rounded-xl py-3 px-2 flex-row items-center justify-center gap-2"
            onPress={() => router.push('/routines/ai-builder')}
            activeOpacity={0.85}
          >
            <Ionicons name="sparkles" size={18} color="white" />
            <Text className="text-white font-bold text-sm" numberOfLines={1}>
              AI Build
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={routines}
        keyExtractor={r => r.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, flexGrow: 1 }}
        ListEmptyComponent={
          !loading ? (
            <View className="flex-1 w-full items-center justify-center py-20 px-4">
              <Text className="text-4xl mb-4">📋</Text>
              <Text className="text-white font-semibold text-lg text-center">No routines yet</Text>
              <Text className="text-white/50 text-sm text-center mt-2 mb-6 px-4">
                Import a Hevy CSV or let AI build your first programme
              </Text>
              <View className="flex-row gap-3 w-full max-w-sm px-2">
                <TouchableOpacity
                  className="flex-1 bg-surface-card border border-surface-border rounded-xl py-3 flex-row items-center justify-center gap-2"
                  onPress={() => router.push('/routines/import-hevy')}
                >
                  <Ionicons name="download-outline" size={18} color={COLORS.primary} />
                  <Text className="text-white font-bold text-sm">Import</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-brand-600 rounded-xl py-3 flex-row items-center justify-center gap-2"
                  onPress={() => router.push('/routines/ai-builder')}
                >
                  <Ionicons name="sparkles" size={18} color="white" />
                  <Text className="text-white font-bold text-sm">AI Build</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null
        }
        renderItem={({ item: routine }) => {
          const totalExercises = routine.days?.reduce(
            (sum, d) => sum + (d.exercises?.length ?? 0), 0,
          ) ?? 0;
          const workoutDays = routine.days?.filter(d => d.exercises?.length > 0).length ?? 0;

          return (
            <TouchableOpacity
              className="bg-surface-card border border-surface-border rounded-xl p-4 mb-3"
              onPress={() => router.push(`/routines/${routine.id}`)}
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-white font-bold text-base">{routine.name}</Text>
                    {routine.created_by_ai && (
                      <View className="bg-brand-600/20 rounded-md px-1.5 py-0.5">
                        <Text className="text-brand-500 text-xs font-semibold">AI</Text>
                      </View>
                    )}
                  </View>
                  {routine.description && (
                    <Text className="text-white/50 text-sm mt-1" numberOfLines={2}>
                      {routine.description}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textDim} />
              </View>
              <View className="flex-row gap-4 mt-3">
                <Text className="text-white/40 text-xs">📅 {workoutDays} days/week</Text>
                <Text className="text-white/40 text-xs">🏋️ {totalExercises} exercises</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
