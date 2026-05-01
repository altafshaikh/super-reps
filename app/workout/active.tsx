import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Alert, FlatList, Modal, ActivityIndicator, Platform, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useUserStore } from '@/stores/userStore';
import { supabase } from '@/lib/supabase';
import { getCoachAdvice } from '@/lib/ai';
import { formatDuration, formatWeight } from '@/lib/utils';
import { fetchHistoricalMaxWeightByExercise, findBestSessionPR } from '@/lib/workout-pr';
import { COLORS, REST_TIMES } from '@/constants';
import type { Exercise, ActiveSet } from '@/types';

const RPE_OPTIONS = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];
const RPE_NOTES: Record<number, string> = {
  6: 'Very easy — 4+ reps left',
  7: 'Easy — 3 reps in reserve',
  7.5: 'Moderate — ~2–3 reps left',
  8: '2 reps in reserve — solid',
  8.5: 'Hard — ~1–2 reps left',
  9: '1 rep in reserve',
  9.5: 'Almost max — 0–1 reps',
  10: 'Maximum effort',
};

const REST_PRESETS = [60, 90, 120, 180];
const REST_CIRCUM = 2 * Math.PI * 40;

interface SetLogModalProps {
  visible: boolean;
  exerciseName: string;
  setIndex: number;
  weight: number;
  reps: number;
  rpe: number | null;
  prevWeight: number | null;
  prevReps: number | null;
  onSave: (weight: number, reps: number, rpe: number | null) => void;
  onClose: () => void;
}

function SetLogModal({
  visible, exerciseName, setIndex, weight, reps, rpe,
  prevWeight, prevReps, onSave, onClose,
}: SetLogModalProps) {
  const [w, setW] = useState(weight);
  const [r, setR] = useState(reps);
  const [selectedRpe, setSelectedRpe] = useState<number | null>(rpe);

  useEffect(() => {
    if (visible) {
      setW(weight || (prevWeight ?? 0));
      setR(reps || (prevReps ?? 0));
      setSelectedRpe(rpe);
    }
  }, [visible]);

  const adjustW = (delta: number) => setW(v => Math.max(0, Math.round((v + delta) * 4) / 4));
  const adjustR = (delta: number) => setR(v => Math.max(0, v + delta));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={m.overlay}>
        <TouchableOpacity style={m.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={m.sheet}>
          <View style={m.grab} />
          <Text style={m.exName}>{exerciseName}</Text>
          <Text style={m.setLabel}>Set {setIndex + 1}</Text>

          {prevWeight != null && prevReps != null && (
            <Text style={m.prevText}>Prev: {formatWeight(prevWeight)} kg × {prevReps} reps</Text>
          )}

          {/* Weight stepper */}
          <Text style={m.fieldLabel}>Weight (kg)</Text>
          <View style={m.stepper}>
            <TouchableOpacity style={m.stepBtn} onPress={() => adjustW(-2.5)}>
              <Text style={m.stepBtnTxt}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={m.stepVal}
              keyboardType="decimal-pad"
              value={w > 0 ? formatWeight(w) : ''}
              placeholder="0"
              placeholderTextColor={COLORS.ink3}
              onChangeText={v => setW(parseFloat(v) || 0)}
            />
            <TouchableOpacity style={m.stepBtn} onPress={() => adjustW(2.5)}>
              <Text style={m.stepBtnTxt}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Reps stepper */}
          <Text style={m.fieldLabel}>Reps</Text>
          <View style={m.stepper}>
            <TouchableOpacity style={m.stepBtn} onPress={() => adjustR(-1)}>
              <Text style={m.stepBtnTxt}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={m.stepVal}
              keyboardType="number-pad"
              value={r > 0 ? String(r) : ''}
              placeholder="0"
              placeholderTextColor={COLORS.ink3}
              onChangeText={v => setR(parseInt(v) || 0)}
            />
            <TouchableOpacity style={m.stepBtn} onPress={() => adjustR(1)}>
              <Text style={m.stepBtnTxt}>+</Text>
            </TouchableOpacity>
          </View>

          {/* RPE selector */}
          <Text style={m.fieldLabel}>RPE (optional)</Text>
          <View style={m.rpeRow}>
            {RPE_OPTIONS.map(v => (
              <TouchableOpacity
                key={v}
                style={[m.rpePill, selectedRpe === v && m.rpePillActive]}
                onPress={() => setSelectedRpe(prev => prev === v ? null : v)}
              >
                <Text style={[m.rpePillTxt, selectedRpe === v && m.rpePillTxtActive]}>
                  {v}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {selectedRpe != null && (
            <Text style={m.rpeNote}>{RPE_NOTES[selectedRpe]}</Text>
          )}

          <TouchableOpacity
            style={m.saveBtn}
            onPress={() => onSave(w, r, selectedRpe)}
          >
            <Text style={m.saveBtnTxt}>Log Set {setIndex + 1} ✓</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const [logModal, setLogModal] = useState<{
    exerciseId: string;
    exerciseName: string;
    setId: string;
    setIndex: number;
  } | null>(null);

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

  const openLogModal = (exerciseId: string, exerciseName: string, setId: string, setIndex: number) => {
    setLogModal({ exerciseId, exerciseName, setId, setIndex });
  };

  const handleModalSave = (weight: number, reps: number, rpe: number | null) => {
    if (!logModal) return;
    updateSet(logModal.exerciseId, logModal.setId, { weight_kg: weight, reps, rpe });
    handleCompleteSet(logModal.exerciseId, logModal.setId);
    setLogModal(null);
  };

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
    const sessionPR = findBestSessionPR(exs, historicalMax);
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
        durationSec: String(duration), setCount: String(setsToInsert.length),
        volumeKg: String(Math.round(volumeTotal)),
        ...(sessionPR ? {
          prExercise: encodeURIComponent(sessionPR.exerciseName),
          prWeight: String(sessionPR.weightKg),
          prDelta: String(sessionPR.improvementKg),
        } : {}),
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

  const activeLogExercise = logModal
    ? exercises.find(e => e.exercise.id === logModal.exerciseId)
    : null;
  const activeLogSet = activeLogExercise?.sets.find(s => s.id === logModal?.setId);
  const prevCompletedSet = activeLogExercise
    ? activeLogExercise.sets.filter(s => s.completed).at(-1)
    : null;

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
        </View>
      )}

      <ScrollView contentContainerStyle={s.scroll}>
        {exercises.map(({ exercise, sets }) => (
          <View key={exercise.id} style={s.exerciseBlock}>
            {/* Exercise header */}
            <View style={s.exHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.exName}>{exercise.name}</Text>
                <Text style={s.exCategory}>{exercise.category}</Text>
              </View>
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

            {/* Set rows */}
            <View style={s.setsCard}>
              <View style={s.setsHeader}>
                <Text style={[s.colHdr, { width: 32 }]}>Set</Text>
                <Text style={[s.colHdr, { flex: 1, textAlign: 'center' }]}>kg</Text>
                <Text style={[s.colHdr, { flex: 1, textAlign: 'center' }]}>Reps</Text>
                <Text style={[s.colHdr, { width: 44, textAlign: 'center' }]}>Done</Text>
              </View>
              {sets.map((set, i) => {
                const prevCompleted = sets.slice(0, i).filter(s => s.completed).at(-1);
                return (
                  <SetRow
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
                    onTapLog={() => openLogModal(exercise.id, exercise.name, set.id, i)}
                  />
                );
              })}
            </View>

            <TouchableOpacity style={s.addSetBtn} onPress={() => addSet(exercise.id)}>
              <Text style={s.addSetTxt}>+ Add Set</Text>
            </TouchableOpacity>
            <Text style={s.longPressTip}>Hold a set row to remove it</Text>
          </View>
        ))}

        {/* Add exercise */}
        <TouchableOpacity style={s.addExBtn} onPress={() => setShowExercisePicker(true)}>
          <Ionicons name="add" size={24} color={COLORS.textDim} />
          <Text style={s.addExTxt}>Add Exercise</Text>
        </TouchableOpacity>
      </ScrollView>

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

      {/* Set log modal */}
      {logModal && activeLogSet && (
        <SetLogModal
          visible={true}
          exerciseName={logModal.exerciseName}
          setIndex={logModal.setIndex}
          weight={activeLogSet.weight_kg}
          reps={activeLogSet.reps}
          rpe={activeLogSet.rpe}
          prevWeight={prevCompletedSet?.weight_kg ?? null}
          prevReps={prevCompletedSet?.reps ?? null}
          onSave={handleModalSave}
          onClose={() => setLogModal(null)}
        />
      )}
    </View>
  );
}

function SetRow({
  set, index, exerciseId, prevWeight, prevReps,
  onUpdate, onComplete, onRemove, isLast, onTapLog,
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
  onTapLog: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={set.completed ? 1 : 0.7}
      onPress={() => { if (!set.completed) onTapLog(); }}
      onLongPress={() => onRemove(exerciseId, set.id)}
      style={[
        s.setRow,
        set.completed && s.setRowDone,
        !isLast && s.setRowBorder,
      ]}
    >
      <Text style={s.setNum}>{index + 1}</Text>

      <View style={{ flex: 1, alignItems: 'center' }}>
        {prevWeight != null && (
          <Text style={s.setPrev}>{formatWeight(prevWeight)}</Text>
        )}
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

      <View style={{ flex: 1, alignItems: 'center' }}>
        {prevReps != null && (
          <Text style={s.setPrev}>{prevReps}</Text>
        )}
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

      <TouchableOpacity
        style={[s.setCheck, set.completed && s.setCheckDone]}
        onPress={() => {
          if (set.completed) onUpdate(exerciseId, set.id, { completed: false });
          else onTapLog();
        }}
      >
        {set.completed && <Ionicons name="checkmark" size={18} color="white" />}
      </TouchableOpacity>
    </TouchableOpacity>
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
  setPrev: { color: COLORS.textDim, fontSize: 10, marginBottom: 2 },
  setInput: {
    color: COLORS.ink, fontSize: 16, fontWeight: '700',
    backgroundColor: `${COLORS.surface3}80`, borderRadius: 8,
    paddingVertical: 4, textAlign: 'center', minWidth: 50,
  },
  setInputDone: { color: COLORS.green },
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

// SetLogModal styles
const m = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 40, paddingHorizontal: 24, paddingTop: 12,
    borderTopWidth: 0.5, borderColor: COLORS.border,
  },
  grab: {
    alignSelf: 'center', width: 40, height: 4,
    borderRadius: 99, backgroundColor: COLORS.surface3, marginBottom: 16,
  },
  exName: { color: COLORS.ink, fontWeight: '800', fontSize: 20, marginBottom: 2 },
  setLabel: { color: COLORS.ink3, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  prevText: { color: COLORS.blue, fontSize: 13, marginBottom: 16, fontWeight: '500' },
  fieldLabel: {
    color: COLORS.ink3, fontSize: 12, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 16,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: COLORS.surface2, borderWidth: 0.5, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnTxt: { color: COLORS.ink, fontSize: 28, fontWeight: '300', lineHeight: 32 },
  stepVal: {
    flex: 1, textAlign: 'center', fontSize: 28, fontWeight: '800', color: COLORS.ink,
    backgroundColor: COLORS.surface2, borderRadius: 14, paddingVertical: 10,
  },
  rpeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rpePill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: COLORS.surface2, borderWidth: 0.5, borderColor: COLORS.border,
  },
  rpePillActive: { backgroundColor: COLORS.blue, borderColor: COLORS.blue },
  rpePillTxt: { color: COLORS.ink2, fontWeight: '600', fontSize: 14 },
  rpePillTxtActive: { color: COLORS.bg },
  rpeNote: { color: COLORS.ink3, fontSize: 13, marginTop: 8, fontStyle: 'italic' },
  saveBtn: {
    backgroundColor: COLORS.ink, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', marginTop: 24,
  },
  saveBtnTxt: { color: COLORS.bg, fontWeight: '800', fontSize: 17 },
});
