import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useWorkoutStore } from '@/stores/workoutStore';
import type { Routine } from '@/types';
import { COLORS } from '@/constants';

export default function RoutineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { startWorkout } = useWorkoutStore();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('routines')
      .select(`*, days:routine_days(*, exercises:routine_exercises(*, exercise:exercises(*)))`)
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setRoutine(data as unknown as Routine);
        setLoading(false);
      });
  }, [id]);

  const handleDelete = () => {
    Alert.alert('Delete Routine', `Delete "${routine?.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('routines').delete().eq('id', id);
          router.back();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!routine) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <Text className="text-white">Routine not found</Text>
      </View>
    );
  }

  const workoutDays = routine.days?.filter(d => d.exercises?.length > 0) ?? [];

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View className="px-5 pt-16 pb-4 flex-row items-center gap-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-surface-card items-center justify-center"
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
        <Text className="text-white font-bold text-lg flex-1" numberOfLines={1}>{routine.name}</Text>
        <TouchableOpacity onPress={handleDelete}>
          <Ionicons name="trash-outline" size={22} color={COLORS.error} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
        {routine.description && (
          <Text className="text-white/50 text-sm mb-4">{routine.description}</Text>
        )}

        {/* Start workout buttons per day */}
        <Text className="text-white font-bold text-base mb-3">Start Workout</Text>
        <View className="gap-2 mb-6">
          {workoutDays.map(day => (
            <TouchableOpacity
              key={day.id}
              className="bg-brand-600 rounded-xl p-4 flex-row items-center justify-between"
              onPress={() => {
                const exercises = day.exercises?.map(re => re.exercise) ?? [];
                startWorkout(routine.id, `${routine.name} — ${day.name}`, exercises);
                router.push('/workout/active');
              }}
            >
              <View>
                <Text className="text-white font-bold">{day.name}</Text>
                <Text className="text-white/70 text-xs mt-0.5">
                  {day.exercises?.length} exercises
                </Text>
              </View>
              <Ionicons name="play-circle" size={30} color="white" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Exercise list by day */}
        <Text className="text-white font-bold text-base mb-3">Programme</Text>
        <View className="gap-4">
          {routine.days?.map(day => (
            <View key={day.id} className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
              <Text className="px-4 pt-3.5 pb-2 text-white font-bold">{day.name}</Text>
              {day.exercises?.length === 0 ? (
                <Text className="px-4 pb-3 text-white/30 text-sm">Rest Day</Text>
              ) : (
                day.exercises?.map((re, i) => (
                  <View
                    key={re.id}
                    className={`px-4 py-3 flex-row items-center justify-between ${
                      i < (day.exercises?.length ?? 0) - 1 ? 'border-t border-surface-border/50' : 'border-t border-surface-border/50'
                    }`}
                  >
                    <View className="flex-1">
                      <Text className="text-white text-sm font-medium">{re.exercise?.name}</Text>
                      <Text className="text-white/40 text-xs mt-0.5">{re.exercise?.category}</Text>
                    </View>
                    <Text className="text-brand-500 text-sm font-semibold">
                      {(re as any).sets_config?.sets}×{(re as any).sets_config?.rep_range}
                    </Text>
                    <Text className="text-white/30 text-xs ml-3">{re.rest_seconds}s rest</Text>
                  </View>
                ))
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
