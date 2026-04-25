import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import type { Routine } from '@/types';
import { COLORS } from '@/constants';

export default function LogScreen() {
  const router = useRouter();
  const { user } = useUserStore();
  const { startWorkout, isActive } = useWorkoutStore();
  const [routines, setRoutines] = useState<Routine[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('routines')
      .select(`*, days:routine_days(*, exercises:routine_exercises(*, exercise:exercises(*)))`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => { if (data) setRoutines(data as unknown as Routine[]); });
  }, [user]);

  const handleStartEmpty = () => {
    startWorkout();
    router.push('/workout/active');
  };

  const handleStartRoutine = (routine: Routine) => {
    const dayExercises = routine.days?.[0]?.exercises?.map(re => re.exercise) ?? [];
    startWorkout(routine.id, routine.name, dayExercises);
    router.push('/workout/active');
  };

  if (isActive) {
    return (
      <View className="flex-1 bg-surface items-center justify-center px-6">
        <Text className="text-4xl mb-4">⚡</Text>
        <Text className="text-white font-bold text-xl text-center mb-2">Workout in progress</Text>
        <Text className="text-white/50 text-center mb-6">You have an active session</Text>
        <TouchableOpacity
          className="bg-brand-600 rounded-xl px-8 py-4"
          onPress={() => router.push('/workout/active')}
        >
          <Text className="text-white font-bold text-base">Resume Workout</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="px-5 pt-16 pb-6">
        <Text className="text-white text-2xl font-bold">Start a Workout</Text>
        <Text className="text-white/50 text-sm mt-1">Pick a routine or start from scratch</Text>
      </View>

      {/* Quick start */}
      <View className="px-5 mb-6">
        <TouchableOpacity
          className="bg-surface-card border border-surface-border rounded-xl p-4 flex-row items-center gap-4"
          onPress={handleStartEmpty}
        >
          <View className="w-12 h-12 rounded-xl bg-brand-600/20 items-center justify-center">
            <Ionicons name="add" size={28} color={COLORS.primary} />
          </View>
          <View>
            <Text className="text-white font-bold text-base">Empty Workout</Text>
            <Text className="text-white/50 text-sm">Add exercises as you go</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Routines */}
      <View className="px-5">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-white font-bold text-lg">From Routine</Text>
          <TouchableOpacity onPress={() => router.push('/routines/ai-builder')}>
            <Text className="text-brand-500 text-sm font-medium">+ New</Text>
          </TouchableOpacity>
        </View>

        {routines.length === 0 ? (
          <View className="bg-surface-card border border-surface-border rounded-xl p-6 items-center">
            <Text className="text-white/50 text-sm text-center">
              No routines yet.{' '}
              <Text
                className="text-brand-500 font-semibold"
                onPress={() => router.push('/routines/ai-builder')}
              >
                Build one with AI
              </Text>
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {routines.map(routine => {
              const workoutDays = routine.days?.filter(d => d.exercises?.length > 0) ?? [];
              return (
                <View key={routine.id} className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
                  <View className="p-4">
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-white font-bold text-base">{routine.name}</Text>
                      {routine.created_by_ai && (
                        <View className="bg-brand-600/20 rounded-md px-1.5 py-0.5">
                          <Text className="text-brand-500 text-xs font-semibold">AI</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-white/40 text-xs mb-3">
                      {workoutDays.length} training days
                    </Text>
                    {/* Day buttons */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View className="flex-row gap-2">
                        {workoutDays.map(day => (
                          <TouchableOpacity
                            key={day.id}
                            className="bg-brand-600 rounded-lg px-3 py-2"
                            onPress={() => {
                              const exercises = day.exercises?.map(re => re.exercise) ?? [];
                              startWorkout(routine.id, `${routine.name} — ${day.name}`, exercises);
                              router.push('/workout/active');
                            }}
                          >
                            <Text className="text-white text-xs font-bold">{day.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
