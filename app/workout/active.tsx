import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Alert, FlatList, Modal, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useUserStore } from '@/stores/userStore';
import { supabase } from '@/lib/supabase';
import { getCoachAdvice } from '@/lib/ai';
import { formatDuration, formatWeight } from '@/lib/utils';
import { fetchHistoricalMaxWeightByExercise, findBestSessionPR } from '@/lib/workout-pr';
import { COLORS, REST_TIMES } from '@/constants';
import type { Exercise, ActiveSet } from '@/types';

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const {
    routineName, startedAt, exercises, isActive,
    addSet, updateSet, completeSet, removeSet, addExercise,
    startRest, tickRest, skipRest, restRemaining, restActive, restSeconds,
    coachText, setCoachText, finishWorkout, resetWorkout,
  } = useWorkoutStore();
  const { user } = useUserStore();

  const [elapsed, setElapsed] = useState(0);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [coachLoading, setCoachLoading] = useState<string | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    elapsedRef.current = setInterval(() => {
      if (startedAt) setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    }, 1000);
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, [startedAt]);

  useEffect(() => {
    if (restActive) {
      restRef.current = setInterval(() => tickRest(), 1000);
    } else {
      if (restRef.current) clearInterval(restRef.current);
    }
    return () => { if (restRef.current) clearInterval(restRef.current); };
  }, [restActive]);

  const handleCompleteSet = useCallback((exerciseId: string, setId: string) => {
    completeSet(exerciseId, setId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startRest(restSeconds);
  }, [completeSet, startRest, restSeconds]);

  const handleGetCoach = async (exerciseId: string, exerciseName: string) => {
    const ex = exercises.find(e => e.exercise.id === exerciseId);
    if (!ex) return;
    setCoachLoading(exerciseId);
    const completedSets = ex.sets.filter(s => s.completed);
    let text = '';
    await getCoachAdvice(
      exerciseName,
      completedSets.map(s => ({ weight_kg: s.weight_kg, reps: s.reps, rpe: s.rpe })),
      [],
      (chunk) => {
        text += chunk;
        setCoachText(exerciseId, text);
      },
    );
    setCoachLoading(null);
  };

  const discardWorkout = useCallback(() => {
    resetWorkout();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/workouts');
  }, [resetWorkout, router]);

  const confirmDiscard = useCallback(() => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Discard this workout? Nothing will be saved.')) {
        discardWorkout();
      }
      return;
    }
    Alert.alert('Discard workout?', 'Nothing will be saved.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: discardWorkout },
    ]);
  }, [discardWorkout]);

  const handleFinish = () => {
    const completedSets = exercises.flatMap(e => e.sets.filter(s => s.completed));

    if (exercises.length === 0) {
      if (Platform.OS === 'web') {
        const discard = typeof window !== 'undefined' &&
          window.confirm(
            'You have not added any exercises. Discard this empty workout?\n\nPress OK to discard, or Cancel to stay.',
          );
        if (discard) discardWorkout();
        return;
      }
      Alert.alert(
        'Nothing to save',
        'Add at least one exercise before finishing, or discard this session.',
        [
          { text: 'Discard', style: 'destructive', onPress: discardWorkout },
          { text: 'OK', style: 'cancel' },
        ],
      );
      return;
    }

    if (completedSets.length === 0) {
      if (Platform.OS === 'web') {
        const discard = typeof window !== 'undefined' &&
          window.confirm(
            'No sets completed yet. Discard this workout?\n\nPress OK to discard, or Cancel to stay.',
          );
        if (discard) discardWorkout();
        return;
      }
      Alert.alert(
        'No sets completed',
        'Mark at least one set as done before finishing, or discard this session.',
        [
          { text: 'Discard', style: 'destructive', onPress: discardWorkout },
          { text: 'OK', style: 'cancel' },
        ],
      );
      return;
    }

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        const ok = window.confirm(
          `Finish workout? You've logged ${completedSets.length} set(s).`,
        );
        if (ok) void saveAndFinish();
      }
      return;
    }

    Alert.alert('Finish Workout?', `You've logged ${completedSets.length} sets.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Finish', onPress: saveAndFinish },
    ]);
  };

  const saveAndFinish = async () => {
    if (!user) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('Sign in to save this workout.');
      } else {
        Alert.alert('Not signed in', 'Sign in to save your workout.');
      }
      return;
    }
    const { exercises: exs, startedAt: sa, sessionId } = finishWorkout();
    const now = new Date();
    const duration = Math.floor((now.getTime() - sa.getTime()) / 1000);

    const exerciseIds = [...new Set(exs.map(e => e.exercise.id))];
    const historicalMax = await fetchHistoricalMaxWeightByExercise(user.id, exerciseIds);
    const sessionPR = findBestSessionPR(exs, historicalMax);

    let volumeTotal = 0;
    const setsToInsert: any[] = [];
    for (const ex of exs) {
      for (const set of ex.sets.filter(s => s.completed)) {
        volumeTotal += set.weight_kg * set.reps;
        setsToInsert.push({
          session_id: sessionId,
          exercise_id: ex.exercise.id,
          set_index: set.set_index,
          set_type: set.set_type,
          weight_kg: set.weight_kg,
          reps: set.reps,
          rpe: set.rpe,
          completed_at: new Date().toISOString(),
        });
      }
    }

    const { error: sessionErr } = await supabase.from('workout_sessions').insert({
      id: sessionId,
      user_id: user.id,
      routine_id: useWorkoutStore.getState().routineId,
      routine_name: useWorkoutStore.getState().routineName,
      started_at: sa.toISOString(),
      finished_at: now.toISOString(),
      duration_seconds: duration,
      volume_total: volumeTotal,
    });

    if (sessionErr) {
      const msg = sessionErr.message ?? 'Could not save workout.';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(msg);
      } else {
        Alert.alert('Save failed', msg);
      }
      return;
    }

    if (setsToInsert.length > 0) {
      const { error: setsErr } = await supabase.from('workout_sets').insert(setsToInsert);
      if (setsErr) {
        const msg = setsErr.message ?? 'Could not save sets.';
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert(msg);
        } else {
          Alert.alert('Save failed', msg);
        }
        return;
      }
    }

    resetWorkout();

    const routineTitle = useWorkoutStore.getState().routineName ?? 'Quick Workout';
    router.replace({
      pathname: '/workout/complete',
      params: {
        routineName: encodeURIComponent(routineTitle),
        durationSec: String(duration),
        setCount: String(setsToInsert.length),
        volumeKg: String(Math.round(volumeTotal)),
        ...(sessionPR
          ? {
              prExercise: encodeURIComponent(sessionPR.exerciseName),
              prWeight: String(sessionPR.weightKg),
              prDelta: String(sessionPR.improvementKg),
            }
          : {}),
      },
    });
  };

  const fetchExercises = useCallback(async (q: string) => {
    const query = supabase.from('exercises').select('*').limit(40);
    if (q) query.ilike('name', `%${q}%`);
    const { data } = await query;
    setAllExercises((data ?? []) as Exercise[]);
  }, []);

  useEffect(() => {
    if (showExercisePicker) fetchExercises('');
  }, [showExercisePicker]);

  if (!isActive) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <Text className="text-white/50">No active workout</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-brand-500 mt-4">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View className="px-5 pt-16 pb-3 flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-white font-bold text-base" numberOfLines={1}>
            {routineName ?? 'Quick Workout'}
          </Text>
          <Text className="text-brand-500 font-bold text-2xl">{formatDuration(elapsed)}</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <TouchableOpacity
            className="px-3 py-2.5 rounded-xl"
            onPress={confirmDiscard}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Text className="text-red-400 font-semibold text-sm">Discard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-green-500 rounded-xl px-4 py-2.5"
            onPress={handleFinish}
          >
            <Text className="text-white font-bold text-sm">Finish</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Rest timer */}
      {restActive && (
        <View className="mx-5 mb-3 bg-amber-500/20 border border-amber-500/40 rounded-xl px-4 py-3 flex-row items-center justify-between">
          <Text className="text-amber-400 font-bold text-lg">
            Rest: {formatDuration(restRemaining)}
          </Text>
          <TouchableOpacity onPress={skipRest}>
            <Text className="text-amber-400/70 font-medium text-sm">Skip</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
        {exercises.map(({ exercise, sets }) => (
          <View key={exercise.id} className="mb-5">
            {/* Exercise header */}
            <View className="flex-row items-center justify-between mb-2">
              <View>
                <Text className="text-white font-bold text-base">{exercise.name}</Text>
                <Text className="text-white/40 text-xs">{exercise.category}</Text>
              </View>
              <View className="flex-row gap-3 items-center">
                {coachLoading === exercise.id ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <TouchableOpacity onPress={() => handleGetCoach(exercise.id, exercise.name)}>
                    <Ionicons name="sparkles-outline" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => {
                  Alert.alert('Remove exercise?', exercise.name, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => useWorkoutStore.getState().removeExercise(exercise.id) },
                  ]);
                }}>
                  <Ionicons name="close-circle-outline" size={20} color={COLORS.textDim} />
                </TouchableOpacity>
              </View>
            </View>

            {/* AI Coach text */}
            {coachText[exercise.id] && (
              <View className="bg-brand-600/10 border border-brand-600/20 rounded-xl px-3 py-2.5 mb-2">
                <Text className="text-brand-500/90 text-xs leading-5">{coachText[exercise.id]}</Text>
              </View>
            )}

            {/* Set rows */}
            <View className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
              {/* Column headers */}
              <View className="flex-row px-4 py-2 border-b border-surface-border">
                <Text className="text-white/30 text-xs w-8">Set</Text>
                <Text className="text-white/30 text-xs flex-1 text-center">kg</Text>
                <Text className="text-white/30 text-xs flex-1 text-center">Reps</Text>
                <Text className="text-white/30 text-xs w-10 text-center">Done</Text>
              </View>

              {sets.map((set, i) => (
                <SetRow
                  key={set.id}
                  set={set}
                  index={i}
                  exerciseId={exercise.id}
                  onUpdate={updateSet}
                  onComplete={handleCompleteSet}
                  onRemove={removeSet}
                  isLast={i === sets.length - 1}
                />
              ))}
            </View>

            <TouchableOpacity
              className="mt-2 border border-surface-border rounded-xl py-2.5 items-center"
              onPress={() => addSet(exercise.id)}
            >
              <Text className="text-brand-500 text-sm font-semibold">+ Add Set</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Add exercise */}
        <TouchableOpacity
          className="border-2 border-dashed border-surface-border rounded-xl py-4 items-center mt-2"
          onPress={() => setShowExercisePicker(true)}
        >
          <Ionicons name="add" size={24} color={COLORS.textDim} />
          <Text className="text-white/40 text-sm mt-1">Add Exercise</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Exercise picker modal */}
      <Modal visible={showExercisePicker} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-surface">
          <View className="px-5 pt-8 pb-4 flex-row items-center gap-3">
            <Text className="text-white font-bold text-lg flex-1">Add Exercise</Text>
            <TouchableOpacity onPress={() => setShowExercisePicker(false)}>
              <Ionicons name="close" size={24} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
          <View className="px-5 mb-3">
            <TextInput
              className="bg-surface-card border border-surface-border rounded-xl px-4 py-3 text-white"
              placeholder="Search exercises..."
              placeholderTextColor="#475569"
              value={search}
              onChangeText={(q) => { setSearch(q); fetchExercises(q); }}
            />
          </View>
          <FlatList
            data={allExercises}
            keyExtractor={e => e.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                className="py-3.5 border-b border-surface-border flex-row items-center justify-between"
                onPress={() => {
                  addExercise(item);
                  setShowExercisePicker(false);
                  setSearch('');
                }}
              >
                <View>
                  <Text className="text-white font-medium">{item.name}</Text>
                  <Text className="text-white/40 text-xs mt-0.5">
                    {item.category} · {item.muscle_groups?.join(', ')}
                  </Text>
                </View>
                <Ionicons name="add-circle-outline" size={22} color={COLORS.primary} />
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

function SetRow({
  set, index, exerciseId, onUpdate, onComplete, onRemove, isLast,
}: {
  set: ActiveSet;
  index: number;
  exerciseId: string;
  onUpdate: (exId: string, setId: string, updates: Partial<ActiveSet>) => void;
  onComplete: (exId: string, setId: string) => void;
  onRemove: (exId: string, setId: string) => void;
  isLast: boolean;
}) {
  return (
    <View
      className={`flex-row items-center px-4 py-2.5 ${
        set.completed ? 'bg-green-500/10' : ''
      } ${!isLast ? 'border-b border-surface-border/50' : ''}`}
    >
      <Text className="text-white/50 text-sm w-8 font-medium">{index + 1}</Text>

      <TextInput
        className="flex-1 text-center text-white text-base font-semibold bg-surface/50 rounded-lg py-1 mx-1"
        keyboardType="decimal-pad"
        value={set.weight_kg > 0 ? formatWeight(set.weight_kg) : ''}
        placeholder="0"
        placeholderTextColor={COLORS.textDim}
        onChangeText={v => onUpdate(exerciseId, set.id, { weight_kg: parseFloat(v) || 0 })}
        editable={!set.completed}
      />

      <TextInput
        className="flex-1 text-center text-white text-base font-semibold bg-surface/50 rounded-lg py-1 mx-1"
        keyboardType="number-pad"
        value={set.reps > 0 ? String(set.reps) : ''}
        placeholder="0"
        placeholderTextColor={COLORS.textDim}
        onChangeText={v => onUpdate(exerciseId, set.id, { reps: parseInt(v) || 0 })}
        editable={!set.completed}
      />

      <TouchableOpacity
        className={`w-10 h-10 rounded-full items-center justify-center ${
          set.completed ? 'bg-green-500' : 'border-2 border-surface-border'
        }`}
        onPress={() => {
          if (set.completed) {
            onUpdate(exerciseId, set.id, { completed: false });
          } else {
            onComplete(exerciseId, set.id);
          }
        }}
        onLongPress={() => onRemove(exerciseId, set.id)}
      >
        {set.completed && <Ionicons name="checkmark" size={18} color="white" />}
      </TouchableOpacity>
    </View>
  );
}
