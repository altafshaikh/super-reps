import { useEffect, useRef, useState, useCallback } from 'react';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Alert, FlatList, Modal, ActivityIndicator, Platform, StyleSheet,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useUserStore } from '@/stores/userStore';
import { supabase } from '@/lib/supabase';
import { getCoachAdvice } from '@/lib/ai';
import { detectTrigger, generateTriggerMessage } from '@/lib/workout-coaching';
import { formatDuration, formatWeight } from '@/lib/utils';
import { fetchHistoricalMaxWeightByExercise, findAllSessionPRs } from '@/lib/workout-pr';
import { resolveSetPrefill } from '@/lib/set-prefill';
import type { SetHistory } from '@/lib/set-prefill';
import { COLORS, REST_TIMES } from '@/constants';
import { ExerciseDetailSheet } from '@/components/ui';
import type { Exercise, ActiveSet } from '@/types';

const RPE_OPTIONS = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];

const REST_PRESETS = [60, 90, 120, 180];
const REST_CIRCUM = 2 * Math.PI * 40;

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    routineName, startedAt, exercises, isActive,
    addSet, updateSet, completeSet, removeSet, addExercise,
    startRest, tickRest, skipRest, restRemaining, restActive, restSeconds,
    coachText, setCoachText, nextCoachMessage, finishWorkout, resetWorkout,
  } = useWorkoutStore();
  const { user } = useUserStore();

  const [elapsed, setElapsed] = useState(0);
  const [restCoachMsg, setRestCoachMsg] = useState<string | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [coachLoading, setCoachLoading] = useState<string | null>(null);
  const [exerciseHistory, setExerciseHistory] = useState<Map<string, SetHistory>>(new Map());
  const prefilledSets = useRef(new Set<string>());

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
      setRestCoachMsg(nextCoachMessage());
    } else {
      if (restRef.current) clearInterval(restRef.current);
      setRestCoachMsg(null);
    }
    return () => { if (restRef.current) clearInterval(restRef.current); };
  }, [restActive]);

  // Fetch last-logged values for all exercises in the workout
  useEffect(() => {
    if (!user || exercises.length === 0) return;
    const exerciseIds = exercises.map(e => e.exercise.id);
    supabase
      .from('workout_sets')
      .select('exercise_id, weight_kg, reps, completed_at')
      .in('exercise_id', exerciseIds)
      .order('completed_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (!data) return;
        const hist = new Map<string, SetHistory>();
        for (const row of data) {
          if (!hist.has(row.exercise_id)) {
            hist.set(row.exercise_id, { weight_kg: row.weight_kg, reps: row.reps });
          }
        }
        setExerciseHistory(hist);
      });
  }, [user, exercises.length]);

  // Pre-fill fresh sets with history (each set pre-filled exactly once)
  useEffect(() => {
    for (const ex of exercises) {
      for (const set of ex.sets) {
        if (set.completed || prefilledSets.current.has(set.id)) continue;
        const prefill = resolveSetPrefill(ex.exercise.id, exerciseHistory);
        if (prefill.weight_kg === 0 && prefill.reps === 8) continue; // no history yet
        prefilledSets.current.add(set.id);
        updateSet(ex.exercise.id, set.id, { weight_kg: prefill.weight_kg, reps: prefill.reps });
      }
    }
  }, [exerciseHistory, exercises]);

  const handleCompleteSet = useCallback((exerciseId: string, setId: string) => {
    completeSet(exerciseId, setId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startRest(restSeconds);

    // Trigger-based coaching
    const exEntry = exercises.find(e => e.exercise.id === exerciseId);
    const set = exEntry?.sets.find(s => s.id === setId);
    if (exEntry && set) {
      const totalSets = exercises.reduce((a, ex) => a + ex.sets.length, 0);
      const completedSets = exercises.reduce((a, ex) => a + ex.sets.filter(s => s.completed).length, 0) + 1;
      const hist = exerciseHistory.get(exerciseId);
      const histArr = hist ? [{ exerciseId, lastWeightKg: hist.weight_kg }] : [];
      const event = detectTrigger(exerciseId, set.set_index, set.weight_kg,
        { exercises, totalSets, completedSets }, histArr);
      if (event) {
        generateTriggerMessage(event, { exercises, totalSets, completedSets }, histArr)
          .then(msg => { if (msg) setCoachText(exerciseId, msg); })
          .catch(() => {});
      }
    }
  }, [completeSet, startRest, restSeconds, exercises, exerciseHistory, setCoachText]);

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
      if (typeof window !== 'undefined' && window.confirm('Discard this workout? Nothing will be saved.')) discardWorkout();
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
        if (typeof window !== 'undefined' && window.confirm('No exercises added. Discard?')) discardWorkout();
        return;
      }
      Alert.alert('Nothing to save', 'Add at least one exercise or discard.', [
        { text: 'Discard', style: 'destructive', onPress: discardWorkout },
        { text: 'OK', style: 'cancel' },
      ]);
      return;
    }
    if (completedSets.length === 0) {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.confirm('No sets completed. Discard?')) discardWorkout();
        return;
      }
      Alert.alert('No sets completed', 'Mark at least one set or discard.', [
        { text: 'Discard', style: 'destructive', onPress: discardWorkout },
        { text: 'OK', style: 'cancel' },
      ]);
      return;
    }
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Finish workout? You've logged ${completedSets.length} set(s).`)) void saveAndFinish();
      return;
    }
    Alert.alert('Finish Workout?', `You've logged ${completedSets.length} sets.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Finish', onPress: saveAndFinish },
    ]);
  };

  const saveAndFinish = async () => {
    if (!user) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert('Sign in to save.');
      else Alert.alert('Not signed in', 'Sign in to save your workout.');
      return;
    }
    const { exercises: exs, startedAt: sa, sessionId } = finishWorkout();
    const now = new Date();
    const duration = Math.floor((now.getTime() - sa.getTime()) / 1000);
    const exerciseIds = [...new Set(exs.map(e => e.exercise.id))];
    const historicalMax = await fetchHistoricalMaxWeightByExercise(user.id, exerciseIds);
    const allPRs = findAllSessionPRs(exs, historicalMax);
    let volumeTotal = 0;
    const setsToInsert: any[] = [];
    for (const ex of exs) {
      for (const set of ex.sets.filter(s => s.completed)) {
        volumeTotal += set.weight_kg * set.reps;
        setsToInsert.push({
          session_id: sessionId, exercise_id: ex.exercise.id,
          set_index: set.set_index, set_type: set.set_type,
          weight_kg: set.weight_kg, reps: set.reps, rpe: set.rpe,
          completed_at: new Date().toISOString(),
        });
      }
    }
    const { error: sessionErr } = await supabase.from('workout_sessions').insert({
      id: sessionId, user_id: user.id,
      routine_id: useWorkoutStore.getState().routineId,
      routine_name: useWorkoutStore.getState().routineName,
      started_at: sa.toISOString(), finished_at: now.toISOString(),
      duration_seconds: duration, volume_total: volumeTotal,
    });
    if (sessionErr) {
      const msg = sessionErr.message ?? 'Could not save workout.';
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(msg);
      else Alert.alert('Save failed', msg);
      return;
    }
    if (setsToInsert.length > 0) {
      const { error: setsErr } = await supabase.from('workout_sets').insert(setsToInsert);
      if (setsErr) {
        const msg = setsErr.message ?? 'Could not save sets.';
        if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(msg);
        else Alert.alert('Save failed', msg);
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
        ...(allPRs.length > 0 ? { prsJson: encodeURIComponent(JSON.stringify(allPRs)) } : {}),
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

  const totalSets = exercises.reduce((a, ex) => a + ex.sets.length, 0);
  const doneSets = exercises.reduce((a, ex) => a + ex.sets.filter(s => s.completed).length, 0);
  const progressPct = totalSets > 0 ? doneSets / totalSets : 0;

  const restProgress = restSeconds > 0 ? restRemaining / restSeconds : 0;
  const restStrokeDash = REST_CIRCUM * (1 - restProgress);

  if (!isActive) {
    return (
      <View style={s.centred}>
        <Text style={s.mutedTxt}>No active workout</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backTxt}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={s.routineName} numberOfLines={1}>
            {routineName ?? 'Quick Workout'}
          </Text>
          <Text style={s.elapsed}>{formatDuration(elapsed)}</Text>
        </View>
        <View style={s.headerActions}>
          <TouchableOpacity style={s.discardBtn} onPress={confirmDiscard} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
            <Text style={s.discardTxt}>Discard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.finishBtn} onPress={handleFinish}>
            <Text style={s.finishTxt}>Finish</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress bar */}
      {totalSets > 0 && (
        <View style={s.progressWrap}>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${progressPct * 100}%` as any }]} />
          </View>
          <Text style={s.progressLabel}>{doneSets} / {totalSets} sets</Text>
        </View>
      )}

      {/* Circular rest timer */}
      {restActive && (
        <View style={s.restCard}>
          <Svg width={96} height={96} viewBox="0 0 100 100">
            <Circle cx={50} cy={50} r={40} stroke={COLORS.surface3} strokeWidth={6} fill="none" />
            <Circle
              cx={50} cy={50} r={40}
              stroke={COLORS.amber} strokeWidth={6} fill="none"
              strokeDasharray={REST_CIRCUM}
              strokeDashoffset={restStrokeDash}
              strokeLinecap="round"
              rotation={-90}
              originX={50} originY={50}
            />
            <SvgText
              x={50} y={55}
              textAnchor="middle"
              fontSize={16} fontWeight="700"
              fill={COLORS.ink}
            >
              {formatDuration(restRemaining)}
            </SvgText>
          </Svg>
          <View style={s.restPresets}>
            {REST_PRESETS.map(sec => (
              <TouchableOpacity key={sec} style={s.presetBtn} onPress={() => startRest(sec)}>
                <Text style={s.presetTxt}>{sec}s</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[s.presetBtn, s.presetSkip]} onPress={skipRest}>
              <Text style={[s.presetTxt, { color: COLORS.amber }]}>Skip</Text>
            </TouchableOpacity>
          </View>
          {restCoachMsg && (
            <Animated.View entering={FadeIn.duration(400)} style={s.coachCard}>
              <Text style={s.coachCardText} numberOfLines={2}>{restCoachMsg}</Text>
            </Animated.View>
          )}
        </View>
      )}

      <ScrollView contentContainerStyle={s.scroll}>
        {exercises.map(({ exercise, sets }) => (
          <View key={exercise.id} style={s.exerciseBlock}>
            {/* Exercise header */}
            <View style={s.exHeader}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => setSelectedExerciseId(exercise.id)} activeOpacity={0.7}>
                <Text style={s.exName}>{exercise.name}</Text>
                <Text style={s.exCategory}>{exercise.category}</Text>
              </TouchableOpacity>
              <View style={s.exActions}>
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

            {/* Coach text */}
            {coachText[exercise.id] ? (
              <View style={s.coachBubble}>
                <Text style={s.coachText}>{coachText[exercise.id]}</Text>
              </View>
            ) : null}

            {/* Set rows — inline logging */}
            <View style={s.setsCard}>
              <View style={s.setsHeader}>
                <Text style={[s.colHdr, { width: 32 }]}>Set</Text>
                <Text style={[s.colHdr, { flex: 1, textAlign: 'center' }]}>kg</Text>
                <Text style={[s.colHdr, { flex: 1, textAlign: 'center' }]}>Reps</Text>
                <Text style={[s.colHdr, { width: 40, textAlign: 'center' }]}>RPE</Text>
                <Text style={[s.colHdr, { width: 44, textAlign: 'center' }]}>Done</Text>
              </View>
              {sets.map((set, i) => {
                const prevCompleted = sets.slice(0, i).filter(ss => ss.completed).at(-1);
                return (
                  <InlineSetRow
                    key={set.id}
                    set={set}
                    index={i}
                    exerciseId={exercise.id}
                    prevWeight={prevCompleted?.weight_kg ?? null}
                    prevReps={prevCompleted?.reps ?? null}
                    onUpdate={updateSet}
                    onComplete={handleCompleteSet}
                    onRemove={removeSet}
                    isLast={i === sets.length - 1}
                  />
                );
              })}
            </View>

            <TouchableOpacity style={s.addSetBtn} onPress={() => addSet(exercise.id)}>
              <Text style={s.addSetTxt}>+ Add Set</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Add exercise */}
        <TouchableOpacity style={s.addExBtn} onPress={() => setShowExercisePicker(true)}>
          <Ionicons name="add" size={24} color={COLORS.textDim} />
          <Text style={s.addExTxt}>Add Exercise</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Exercise detail sheet */}
      <ExerciseDetailSheet
        exerciseId={selectedExerciseId}
        onClose={() => setSelectedExerciseId(null)}
      />

      {/* Exercise picker modal */}
      <Modal visible={showExercisePicker} animationType="slide" presentationStyle="pageSheet">
        <View style={s.pickerRoot}>
          <View style={s.pickerHeader}>
            <Text style={s.pickerTitle}>Add Exercise</Text>
            <TouchableOpacity onPress={() => setShowExercisePicker(false)}>
              <Ionicons name="close" size={24} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={s.pickerSearch}>
            <TextInput
              style={s.pickerInput}
              placeholder="Search exercises..."
              placeholderTextColor={COLORS.textDim}
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
                style={s.pickerRow}
                onPress={() => { addExercise(item); setShowExercisePicker(false); setSearch(''); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.pickerExName}>{item.name}</Text>
                  <Text style={s.pickerExMeta}>{item.category} · {item.muscle_groups?.join(', ')}</Text>
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

// ── Inline set row with RPE expander ─────────────────────────

function InlineSetRow({
  set, index, exerciseId, prevWeight, prevReps,
  onUpdate, onComplete, onRemove, isLast,
}: {
  set: ActiveSet;
  index: number;
  exerciseId: string;
  prevWeight: number | null;
  prevReps: number | null;
  onUpdate: (exId: string, setId: string, updates: Partial<ActiveSet>) => void;
  onComplete: (exId: string, setId: string) => void;
  onRemove: (exId: string, setId: string) => void;
  isLast: boolean;
}) {
  const [rpeExpanded, setRpeExpanded] = useState(false);
  const swipeableRef = useRef<Swipeable>(null);
  const checkScale = useSharedValue(1);
  const prevCompleted = useRef(set.completed);

  useEffect(() => {
    if (!prevCompleted.current && set.completed) {
      checkScale.value = withSpring(1.3, { damping: 8, stiffness: 300 }, () => {
        checkScale.value = withSpring(1, { damping: 12, stiffness: 300 });
      });
    }
    prevCompleted.current = set.completed;
  }, [set.completed]);

  const checkAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const handleSwipeDelete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onRemove(exerciseId, set.id);
  }, [exerciseId, set.id, onRemove]);

  const renderRightActions = () => (
    <View style={s.deleteAction}>
      <Ionicons name="trash-outline" size={18} color="white" />
      <Text style={s.deleteActionText}>Delete</Text>
    </View>
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={60}
      onSwipeableOpen={handleSwipeDelete}
      enabled={!set.completed}
    >
      <View>
        <View
          style={[
            s.setRow,
            set.completed && s.setRowDone,
            !isLast && s.setRowBorder,
          ]}
        >
          <Text style={[s.setNum, set.completed && s.setNumDone]}>{index + 1}</Text>

          {/* Weight */}
          <View style={{ flex: 1, alignItems: 'center' }}>
            {prevWeight != null && <Text style={s.setPrev}>{formatWeight(prevWeight)}</Text>}
            <TextInput
              style={[s.setInput, set.completed && s.setInputDone]}
              keyboardType="decimal-pad"
              value={set.weight_kg > 0 ? formatWeight(set.weight_kg) : ''}
              placeholder="0"
              placeholderTextColor={COLORS.textDim}
              onChangeText={v => onUpdate(exerciseId, set.id, { weight_kg: parseFloat(v) || 0 })}
              editable={!set.completed}
            />
          </View>

          {/* Reps */}
          <View style={{ flex: 1, alignItems: 'center' }}>
            {prevReps != null && <Text style={s.setPrev}>{prevReps}</Text>}
            <TextInput
              style={[s.setInput, set.completed && s.setInputDone]}
              keyboardType="number-pad"
              value={set.reps > 0 ? String(set.reps) : ''}
              placeholder="0"
              placeholderTextColor={COLORS.textDim}
              onChangeText={v => onUpdate(exerciseId, set.id, { reps: parseInt(v) || 0 })}
              editable={!set.completed}
            />
          </View>

          {/* RPE expander */}
          <TouchableOpacity
            style={[s.rpeToggle, set.rpe != null && s.rpeToggleActive]}
            onPress={() => setRpeExpanded(v => !v)}
            disabled={set.completed}
          >
            <Text style={[s.rpeToggleTxt, set.rpe != null && s.rpeToggleTxtActive]}>
              {set.rpe != null ? String(set.rpe) : '+'}
            </Text>
          </TouchableOpacity>

          {/* Checkmark */}
          <Animated.View style={checkAnimStyle}>
            <TouchableOpacity
              style={[s.setCheck, set.completed && s.setCheckDone]}
              onPress={() => {
                if (set.completed) {
                  onUpdate(exerciseId, set.id, { completed: false });
                } else {
                  onComplete(exerciseId, set.id);
                }
              }}
            >
              {set.completed && <Ionicons name="checkmark" size={18} color="white" />}
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* RPE picker row */}
        {rpeExpanded && !set.completed && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.rpePickerRow}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 6, paddingVertical: 6 }}
          >
            {RPE_OPTIONS.map(v => (
              <TouchableOpacity
                key={v}
                style={[s.rpePill, set.rpe === v && s.rpePillActive]}
                onPress={() => {
                  onUpdate(exerciseId, set.id, { rpe: set.rpe === v ? null : v });
                  if (set.rpe !== v) setRpeExpanded(false);
                }}
              >
                <Text style={[s.rpePillTxt, set.rpe === v && s.rpePillTxtActive]}>{v}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </Swipeable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  centred: { flex: 1, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  mutedTxt: { color: COLORS.textDim },
  backTxt: { color: COLORS.primary, marginTop: 16 },
  header: {
    paddingHorizontal: 20, paddingBottom: 12,
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  routineName: { color: COLORS.ink, fontWeight: '700', fontSize: 16 },
  elapsed: { color: COLORS.primary, fontWeight: '700', fontSize: 26, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  discardBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  discardTxt: { color: COLORS.error, fontWeight: '600', fontSize: 14 },
  finishBtn: { backgroundColor: COLORS.success, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  finishTxt: { color: COLORS.bg, fontWeight: '700', fontSize: 14 },
  progressWrap: {
    marginHorizontal: 20, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  progressTrack: {
    flex: 1, height: 4, backgroundColor: COLORS.surface3, borderRadius: 99, overflow: 'hidden',
  },
  progressFill: { height: 4, backgroundColor: COLORS.green, borderRadius: 99 },
  progressLabel: { fontSize: 11, color: COLORS.ink3, fontWeight: '600', minWidth: 48, textAlign: 'right' },
  restCard: {
    marginHorizontal: 20, marginBottom: 12,
    backgroundColor: `${COLORS.amber}18`,
    borderWidth: 0.5, borderColor: `${COLORS.amber}40`,
    borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 16,
  },
  restPresets: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  presetBtn: {
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: COLORS.surface3, borderRadius: 10,
    minHeight: 44, justifyContent: 'center',
  },
  presetSkip: { backgroundColor: `${COLORS.amber}20` },
  presetTxt: { color: COLORS.ink2, fontWeight: '600', fontSize: 13 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  exerciseBlock: { marginBottom: 20 },
  exHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  exName: { color: COLORS.ink, fontWeight: '700', fontSize: 16 },
  exCategory: { color: COLORS.textDim, fontSize: 12, marginTop: 1 },
  exActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  coachBubble: {
    backgroundColor: `${COLORS.primary}18`,
    borderWidth: 0.5, borderColor: `${COLORS.primary}30`,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8,
  },
  coachText: { color: COLORS.primary, fontSize: 12, lineHeight: 18 },
  coachCard: {
    marginTop: 10,
    backgroundColor: `${COLORS.blue}15`,
    borderWidth: 0.5, borderColor: `${COLORS.blue}40`,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
    maxWidth: '90%',
  },
  coachCardText: { color: COLORS.blue, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  setsCard: {
    backgroundColor: COLORS.surface2, borderWidth: 0.5, borderColor: COLORS.border,
    borderRadius: 14, overflow: 'hidden',
  },
  setsHeader: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.border,
  },
  colHdr: { color: COLORS.textDim, fontSize: 11, fontWeight: '600' },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  setRowDone: { backgroundColor: `${COLORS.green}12` },
  setRowBorder: { borderBottomWidth: 0.5, borderBottomColor: `${COLORS.border}` },
  setNum: { color: COLORS.textDim, fontSize: 14, fontWeight: '500', width: 32 },
  setNumDone: { color: COLORS.ink4 },
  deleteAction: {
    backgroundColor: COLORS.red, justifyContent: 'center', alignItems: 'center',
    width: 80, flexDirection: 'row', gap: 4,
  },
  deleteActionText: { color: 'white', fontSize: 12, fontWeight: '700' },
  setPrev: { color: COLORS.textDim, fontSize: 10, marginBottom: 2 },
  setInput: {
    color: COLORS.ink, fontSize: 16, fontWeight: '700',
    backgroundColor: `${COLORS.surface3}80`, borderRadius: 8,
    paddingVertical: 4, textAlign: 'center', minWidth: 50,
  },
  setInputDone: { color: COLORS.green },
  rpeToggle: {
    width: 36, height: 36, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface3,
    marginHorizontal: 2,
  },
  rpeToggleActive: { backgroundColor: `${COLORS.blue}30` },
  rpeToggleTxt: { color: COLORS.ink3, fontSize: 12, fontWeight: '700' },
  rpeToggleTxtActive: { color: COLORS.blue },
  rpePickerRow: { backgroundColor: COLORS.surface3, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  rpePill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: COLORS.surface2, borderWidth: 0.5, borderColor: COLORS.border,
  },
  rpePillActive: { backgroundColor: COLORS.blue, borderColor: COLORS.blue },
  rpePillTxt: { color: COLORS.ink2, fontWeight: '600', fontSize: 13 },
  rpePillTxtActive: { color: COLORS.bg },
  setCheck: {
    width: 40, height: 40, borderRadius: 99,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.surface3,
  },
  setCheckDone: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  addSetBtn: {
    marginTop: 8, borderWidth: 0.5, borderColor: COLORS.border,
    borderRadius: 12, paddingVertical: 10, alignItems: 'center',
  },
  addSetTxt: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
  addExBtn: {
    borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.surface3,
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    gap: 4, marginTop: 8,
  },
  addExTxt: { color: COLORS.textDim, fontSize: 14 },
  longPressTip: { color: COLORS.ink3, fontSize: 10, textAlign: 'center', marginTop: 4, fontStyle: 'italic' },
  pickerRoot: { flex: 1, backgroundColor: COLORS.surface },
  pickerHeader: {
    paddingHorizontal: 20, paddingTop: 32, paddingBottom: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  pickerTitle: { color: COLORS.ink, fontWeight: '700', fontSize: 18, flex: 1 },
  pickerSearch: { paddingHorizontal: 20, marginBottom: 12 },
  pickerInput: {
    backgroundColor: COLORS.surface2, borderWidth: 0.5, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    color: COLORS.ink, fontSize: 15,
  },
  pickerRow: {
    paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  pickerExName: { color: COLORS.ink, fontWeight: '500', fontSize: 15 },
  pickerExMeta: { color: COLORS.textDim, fontSize: 12, marginTop: 2 },
});
