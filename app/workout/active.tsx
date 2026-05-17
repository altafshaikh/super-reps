import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Animated, {
  FadeIn, FadeOut, SlideInUp, SlideOutUp, SlideInDown, SlideOutDown,
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  FlatList, Modal, ActivityIndicator, StyleSheet,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useUserStore } from '@/stores/userStore';
import { supabase } from '@/lib/supabase';
import { getCoachAdvice } from '@/lib/ai';
import { detectTrigger, generateTriggerMessage } from '@/lib/workout-coaching';
import { formatDuration, formatWeight } from '@/lib/utils';
import { fetchHistoricalMaxWeightByExercise } from '@/lib/workout-pr';
import { resolveSetPrefill } from '@/lib/set-prefill';
import type { SetHistory } from '@/lib/set-prefill';
import { COLORS } from '@/constants';
import { SRBottomSheet } from '@/components/ui';
import { ExerciseLibraryModal } from '@/components/workouts/ExerciseLibraryModal';
import type { Exercise, ActiveSet } from '@/types';

const GREEN_ROW = '#1B6B40';
const BLUE_ACCENT = '#0070FF';

function getExerciseDisplayType(exercise: Exercise): 'weight_reps' | 'bodyweight_reps' | 'duration' {
  const et = exercise.exercise_type ?? '';
  if (et === 'duration') return 'duration';
  if (et === 'bodyweight_reps') return 'bodyweight_reps';
  const bwEquip = exercise.equipment?.every(e => e === 'bodyweight' || e === 'pullup_bar');
  if (bwEquip && exercise.equipment?.length > 0) return 'bodyweight_reps';
  return 'weight_reps';
}

// ── Live PR Banner ────────────────────────────────────────────
function PRBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <Animated.View
      entering={SlideInUp.springify().damping(18)}
      exiting={SlideOutUp.duration(300)}
      style={s.prBanner}
    >
      <TouchableOpacity style={s.prBannerInner} onPress={onDismiss} activeOpacity={0.9}>
        <Text style={s.prBannerText}>🏆 {message}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Rest Timer Bottom Bar ─────────────────────────────────────
function RestTimerBar({
  remaining, total, onAdjust, onSkip, coachMsg, insetBottom,
}: {
  remaining: number;
  total: number;
  onAdjust: (delta: number) => void;
  onSkip: () => void;
  coachMsg: string | null;
  insetBottom: number;
}) {
  return (
    <Animated.View
      entering={SlideInDown.springify().damping(20)}
      exiting={SlideOutDown.duration(250)}
      style={[s.restBar, { paddingBottom: insetBottom + 8 }]}
    >
      {coachMsg && (
        <Text style={s.restCoachMsg} numberOfLines={2}>{coachMsg}</Text>
      )}
      <View style={s.restBarRow}>
        <TouchableOpacity style={s.restAdjBtn} onPress={() => onAdjust(-15)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={s.restAdjTxt}>−15</Text>
        </TouchableOpacity>
        <Text style={s.restCountdown}>{formatDuration(remaining)}</Text>
        <TouchableOpacity style={s.restAdjBtn} onPress={() => onAdjust(15)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={s.restAdjTxt}>+15</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.restSkipBtn} onPress={onSkip}>
          <Text style={s.restSkipTxt}>Skip</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ── Exercise 3-dot menu ───────────────────────────────────────
function ExerciseMenu({
  visible, exerciseName, onClose, onReorder, onReplace, onRemove,
}: {
  visible: boolean;
  exerciseName: string;
  onClose: () => void;
  onReorder: () => void;
  onReplace: () => void;
  onRemove: () => void;
}) {
  return (
    <SRBottomSheet visible={visible} onClose={onClose}>
      <View style={s.menuSheet}>
        <Text style={s.menuTitle} numberOfLines={1}>{exerciseName}</Text>
        <TouchableOpacity style={s.menuItem} onPress={() => { onClose(); onReorder(); }}>
          <Ionicons name="swap-vertical-outline" size={20} color={COLORS.ink2} />
          <Text style={s.menuItemTxt}>Reorder Exercises</Text>
        </TouchableOpacity>
        <View style={s.menuDivider} />
        <TouchableOpacity style={s.menuItem} onPress={() => { onClose(); onReplace(); }}>
          <Ionicons name="refresh-outline" size={20} color={COLORS.ink2} />
          <Text style={s.menuItemTxt}>Replace Exercise</Text>
        </TouchableOpacity>
        <View style={s.menuDivider} />
        <TouchableOpacity style={s.menuItem} onPress={() => { onClose(); onRemove(); }}>
          <Ionicons name="close-circle-outline" size={20} color={COLORS.red} />
          <Text style={[s.menuItemTxt, { color: COLORS.red }]}>Remove Exercise</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.menuCancel} onPress={onClose}>
          <Text style={s.menuCancelTxt}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </SRBottomSheet>
  );
}

// ── Reorder Sheet ─────────────────────────────────────────────
function ReorderSheet({
  visible, exercises, onClose, onMove,
}: {
  visible: boolean;
  exercises: { id: string; name: string }[];
  onClose: () => void;
  onMove: (fromIndex: number, toIndex: number) => void;
}) {
  return (
    <SRBottomSheet visible={visible} onClose={onClose} title="Reorder Exercises">
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}>
        {exercises.map((ex, i) => (
          <View key={ex.id} style={s.reorderRow}>
            <Text style={s.reorderName} numberOfLines={1}>{ex.name}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[s.reorderBtn, i === 0 && s.reorderBtnDisabled]}
                onPress={() => i > 0 && onMove(i, i - 1)}
                disabled={i === 0}
              >
                <Ionicons name="chevron-up" size={16} color={i === 0 ? COLORS.ink4 : COLORS.ink2} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.reorderBtn, i === exercises.length - 1 && s.reorderBtnDisabled]}
                onPress={() => i < exercises.length - 1 && onMove(i, i + 1)}
                disabled={i === exercises.length - 1}
              >
                <Ionicons name="chevron-down" size={16} color={i === exercises.length - 1 ? COLORS.ink4 : COLORS.ink2} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </SRBottomSheet>
  );
}

// ── Discard confirmation sheet ────────────────────────────────
function DiscardSheet({
  visible, completedCount, onKeepGoing, onDiscard,
}: {
  visible: boolean;
  completedCount: number;
  onKeepGoing: () => void;
  onDiscard: () => void;
}) {
  return (
    <SRBottomSheet visible={visible} onClose={onKeepGoing}>
      <View style={s.discardSheet}>
        <Text style={s.discardTitle}>Discard Workout?</Text>
        <Text style={s.discardBody}>
          {completedCount > 0
            ? `This workout will not be saved. All ${completedCount} set${completedCount !== 1 ? 's' : ''} you've logged will be lost.`
            : "You haven't logged any sets yet. The workout will be discarded."}
        </Text>
        <TouchableOpacity style={s.discardDestructiveBtn} onPress={onDiscard}>
          <Text style={s.discardDestructiveTxt}>Discard Workout</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.discardCancelBtn} onPress={onKeepGoing}>
          <Text style={s.discardCancelTxt}>Keep Going</Text>
        </TouchableOpacity>
      </View>
    </SRBottomSheet>
  );
}

// ── Duration stopwatch cell ───────────────────────────────────
function DurationCell({
  value, isRunning, onToggle, onUpdate,
}: {
  value: number;
  isRunning: boolean;
  onToggle: () => void;
  onUpdate: (sec: number) => void;
}) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);

  const start = useCallback(() => {
    startRef.current = Date.now() - value * 1000;
    intervalRef.current = setInterval(() => {
      onUpdate(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
  }, [value, onUpdate]);

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (isRunning) start();
    else stop();
    return stop;
  }, [isRunning]);

  const mm = String(Math.floor(value / 60)).padStart(2, '0');
  const ss = String(value % 60).padStart(2, '0');

  return (
    <TouchableOpacity style={s.durationCell} onPress={onToggle}>
      <Ionicons name={isRunning ? 'pause' : 'play'} size={14} color={isRunning ? COLORS.amber : COLORS.primary} />
      <Text style={[s.durationTxt, isRunning && { color: COLORS.amber }]}>{mm}:{ss}</Text>
    </TouchableOpacity>
  );
}

// ── Inline set row ────────────────────────────────────────────
function InlineSetRow({
  set, index, exerciseId, displayType, prevWeight, prevReps, prevDuration,
  onUpdate, onComplete, onRemove, isLast,
}: {
  set: ActiveSet;
  index: number;
  exerciseId: string;
  displayType: 'weight_reps' | 'bodyweight_reps' | 'duration';
  prevWeight: number | null;
  prevReps: number | null;
  prevDuration: number | null;
  onUpdate: (exId: string, setId: string, updates: Partial<ActiveSet>) => void;
  onComplete: (exId: string, setId: string) => void;
  onRemove: (exId: string, setId: string) => void;
  isLast: boolean;
}) {
  const [timerRunning, setTimerRunning] = useState(false);
  const swipeableRef = useRef<Swipeable>(null);
  const checkScale = useSharedValue(1);
  const prevCompleted = useRef(set.completed);

  useEffect(() => {
    if (!prevCompleted.current && set.completed) {
      checkScale.value = withSpring(1.3, { damping: 8, stiffness: 300 }, () => {
        checkScale.value = withSpring(1, { damping: 12, stiffness: 300 });
      });
      setTimerRunning(false);
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

  // Format previous value based on display type
  const prevDisplay = useMemo(() => {
    if (displayType === 'duration') {
      if (prevDuration == null) return '—';
      const mm = String(Math.floor(prevDuration / 60)).padStart(2, '0');
      const ss = String(prevDuration % 60).padStart(2, '0');
      return `${mm}:${ss}`;
    }
    if (displayType === 'bodyweight_reps') {
      return prevReps != null ? `× ${prevReps}` : '—';
    }
    if (prevWeight != null && prevReps != null) return `${formatWeight(prevWeight)} × ${prevReps}`;
    if (prevWeight != null) return `${formatWeight(prevWeight)}`;
    return '—';
  }, [displayType, prevWeight, prevReps, prevDuration]);

  const rowBg = set.completed ? { backgroundColor: GREEN_ROW } : {};

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={60}
      onSwipeableOpen={handleSwipeDelete}
      enabled={!set.completed}
    >
      <View style={[s.setRow, rowBg, !isLast && s.setRowBorder]}>
        {/* Set number */}
        <Text style={[s.setNum, set.completed && s.setNumDone]}>{index + 1}</Text>

        {/* PREVIOUS column */}
        <Text style={[s.prevCol, set.completed && s.prevColDone]} numberOfLines={1}>{prevDisplay}</Text>

        {/* Input columns by display type */}
        {displayType === 'weight_reps' && (
          <>
            <TextInput
              style={[s.setInput, set.completed && s.setInputDone]}
              keyboardType="decimal-pad"
              value={set.weight_kg > 0 ? formatWeight(set.weight_kg) : ''}
              placeholder="kg"
              placeholderTextColor={COLORS.ink4}
              onChangeText={v => onUpdate(exerciseId, set.id, { weight_kg: parseFloat(v) || 0 })}
              editable={!set.completed}
            />
            <TextInput
              style={[s.setInput, set.completed && s.setInputDone]}
              keyboardType="number-pad"
              value={set.reps > 0 ? String(set.reps) : ''}
              placeholder="reps"
              placeholderTextColor={COLORS.ink4}
              onChangeText={v => onUpdate(exerciseId, set.id, { reps: parseInt(v) || 0 })}
              editable={!set.completed}
            />
          </>
        )}

        {displayType === 'bodyweight_reps' && (
          <TextInput
            style={[s.setInputWide, set.completed && s.setInputDone]}
            keyboardType="number-pad"
            value={set.reps > 0 ? String(set.reps) : ''}
            placeholder="reps"
            placeholderTextColor={COLORS.ink4}
            onChangeText={v => onUpdate(exerciseId, set.id, { reps: parseInt(v) || 0 })}
            editable={!set.completed}
          />
        )}

        {displayType === 'duration' && (
          <DurationCell
            value={set.duration_seconds ?? 0}
            isRunning={timerRunning && !set.completed}
            onToggle={() => setTimerRunning(r => !r)}
            onUpdate={sec => onUpdate(exerciseId, set.id, { duration_seconds: sec })}
          />
        )}

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
    </Swipeable>
  );
}

// ── Main Screen ───────────────────────────────────────────────
export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    routineName, startedAt, exercises, isActive,
    addSet, updateSet, completeSet, removeSet, addExercise,
    reorderExercises, replaceExercise, updateExerciseNotes,
    startRest, adjustRest, tickRest, skipRest,
    restRemaining, restActive, restSeconds,
    coachText, setCoachText, nextCoachMessage,
    resetWorkout, minimizeWorkout, expandWorkout, prCache, setPrCache,
  } = useWorkoutStore();
  const { user } = useUserStore();

  const [elapsed, setElapsed] = useState(0);
  const [restCoachMsg, setRestCoachMsg] = useState<string | null>(null);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [coachLoading, setCoachLoading] = useState<string | null>(null);
  const [exerciseHistory, setExerciseHistory] = useState<Map<string, SetHistory>>(new Map());

  // Menu state
  const [menuExerciseId, setMenuExerciseId] = useState<string | null>(null);
  const [showReorder, setShowReorder] = useState(false);
  const [replaceForExerciseId, setReplaceForExerciseId] = useState<string | null>(null);
  const [showDiscard, setShowDiscard] = useState(false);

  // PR banner queue
  const [prBannerQueue, setPrBannerQueue] = useState<string[]>([]);
  const currentPrBanner = prBannerQueue[0] ?? null;

  const prefilledSets = useRef(new Set<string>());
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    expandWorkout();
  }, []);

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

  // Fetch history for prefill + PR cache
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

    // Fetch PR cache for live PR detection
    fetchHistoricalMaxWeightByExercise(user.id, exerciseIds).then(cache => {
      setPrCache(cache as Record<string, number>);
    }).catch(() => {});
  }, [user, exercises.length]);

  // Prefill set weights/reps from history (once per set)
  useEffect(() => {
    for (const ex of exercises) {
      for (const set of ex.sets) {
        if (set.completed || prefilledSets.current.has(set.id)) continue;
        const prefill = resolveSetPrefill(ex.exercise.id, exerciseHistory);
        if (prefill.weight_kg === 0 && prefill.reps === 8) continue;
        prefilledSets.current.add(set.id);
        updateSet(ex.exercise.id, set.id, { weight_kg: prefill.weight_kg, reps: prefill.reps });
      }
    }
  }, [exerciseHistory, exercises]);

  const handleCompleteSet = useCallback((exerciseId: string, setId: string) => {
    completeSet(exerciseId, setId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const exEntry = exercises.find(e => e.exercise.id === exerciseId);
    const set = exEntry?.sets.find(s => s.id === setId);
    if (!exEntry || !set) return;

    // Start rest using exercise-specific rest seconds
    startRest(exEntry.restSeconds ?? restSeconds);

    // Live PR detection
    const maxForExercise = prCache[exerciseId];
    if (maxForExercise != null && set.weight_kg > 0 && set.weight_kg > maxForExercise) {
      const msg = `New PR! ${exEntry.exercise.name} · ${formatWeight(set.weight_kg)} × ${set.reps} reps`;
      setPrBannerQueue(q => [...q, msg]);
    }

    // Trigger-based coaching
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
  }, [completeSet, startRest, restSeconds, exercises, exerciseHistory, setCoachText, prCache]);

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
    setShowDiscard(false);
    resetWorkout();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/workouts');
  }, [resetWorkout, router]);

  const confirmDiscard = useCallback(() => {
    setShowDiscard(true);
  }, []);

  const handleFinish = () => {
    const completedSets = exercises.flatMap(e => e.sets.filter(s => s.completed));
    if (exercises.length === 0 || completedSets.length === 0) {
      setShowDiscard(true);
      return;
    }
    const volumeTotal = exercises.reduce((a, ex) =>
      a + ex.sets.filter(s => s.completed).reduce((b, s) => b + s.weight_kg * s.reps, 0), 0);
    router.push({
      pathname: '/workout/complete',
      params: {
        routineName: encodeURIComponent(routineName ?? 'Quick Workout'),
        durationSec: String(elapsed),
        setCount: String(completedSets.length),
        volumeKg: String(Math.round(volumeTotal)),
      },
    });
  };


  const totalSets = exercises.reduce((a, ex) => a + ex.sets.length, 0);
  const doneSets = exercises.reduce((a, ex) => a + ex.sets.filter(s => s.completed).length, 0);
  const progressPct = totalSets > 0 ? doneSets / totalSets : 0;
  const totalVolumeKg = exercises.reduce((a, ex) =>
    a + ex.sets.filter(s => s.completed).reduce((b, s) => b + s.weight_kg * s.reps, 0), 0);

  const menuExercise = menuExerciseId ? exercises.find(e => e.exercise.id === menuExerciseId) : null;
  const exerciseListForReorder = exercises.map((e, i) => ({ id: e.exercise.id, name: e.exercise.name, index: i }));

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
      {/* Live PR banner */}
      {currentPrBanner && (
        <View style={[s.prBannerWrap, { top: insets.top }]}>
          <PRBanner
            message={currentPrBanner}
            onDismiss={() => setPrBannerQueue(q => q.slice(1))}
          />
        </View>
      )}

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={s.minimizeBtn}
          onPress={() => { minimizeWorkout(); router.back(); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-down" size={22} color={COLORS.ink2} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: 8 }}>
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

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: restActive ? 120 : 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Stats strip — always visible */}
        <View style={s.statsStrip}>
          <View style={s.statItem}>
            <Text style={s.statValueBlue}>{formatDuration(elapsed)}</Text>
            <Text style={s.statLabel}>Duration</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statValue}>{Math.round(totalVolumeKg)} kg</Text>
            <Text style={s.statLabel}>Volume</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statValue}>{doneSets}</Text>
            <Text style={s.statLabel}>Sets</Text>
          </View>
        </View>

        {exercises.length === 0 ? (
          <View style={s.emptyState}>
            {/* Empty state content */}
            <View style={s.emptyContent}>
              <Ionicons name="barbell-outline" size={80} color={COLORS.ink4} />
              <Text style={s.emptyTitle}>Get started</Text>
              <Text style={s.emptySubtitle}>Add an exercise to start your workout</Text>
            </View>

            {/* Primary CTA */}
            <TouchableOpacity style={s.addExPrimary} onPress={() => setShowExercisePicker(true)}>
              <Ionicons name="add" size={22} color="white" />
              <Text style={s.addExPrimaryTxt}>Add Exercise</Text>
            </TouchableOpacity>

            {/* Secondary buttons */}
            <View style={s.emptySecondaryRow}>
              <TouchableOpacity style={s.emptySecBtn}>
                <Text style={s.emptySecBtnTxt}>Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.emptySecBtn} onPress={() => setShowDiscard(true)}>
                <Text style={[s.emptySecBtnTxt, { color: COLORS.red }]}>Discard Workout</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {exercises.map(({ exercise, sets, notes, restSeconds: exRest }) => {
              const displayType = getExerciseDisplayType(exercise);
              return (
                <View key={exercise.id} style={s.exerciseBlock}>
                  {/* Exercise header */}
                  <View style={s.exHeader}>
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: exercise.id } })}
                      activeOpacity={0.7}
                    >
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
                      <TouchableOpacity onPress={() => setMenuExerciseId(exercise.id)}>
                        <Ionicons name="ellipsis-vertical" size={20} color={COLORS.ink3} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Rest timer label */}
                  <Text style={s.restLabel}>
                    🔵 Rest Timer: {Math.floor(exRest / 60) > 0 ? `${Math.floor(exRest / 60)}min ` : ''}{exRest % 60 > 0 ? `${exRest % 60}s` : exRest === 60 ? '' : ''}
                    {exRest === 0 ? 'OFF' : ''}
                  </Text>

                  {/* Notes field */}
                  <TextInput
                    style={s.notesInput}
                    placeholder="Add notes here…"
                    placeholderTextColor={COLORS.ink4}
                    value={notes}
                    onChangeText={text => updateExerciseNotes(exercise.id, text)}
                    multiline
                  />

                  {/* Coach text */}
                  {coachText[exercise.id] ? (
                    <View style={s.coachBubble}>
                      <Text style={s.coachText}>{coachText[exercise.id]}</Text>
                    </View>
                  ) : null}

                  {/* Set table */}
                  <View style={s.setsCard}>
                    <View style={s.setsHeader}>
                      <Text style={[s.colHdr, { width: 28 }]}>SET</Text>
                      <Text style={[s.colHdr, s.colHdrPrev]}>PREVIOUS</Text>
                      {displayType === 'weight_reps' && (
                        <>
                          <Text style={[s.colHdr, s.colHdrInput]}>↔ KG</Text>
                          <Text style={[s.colHdr, s.colHdrInput]}>REPS</Text>
                        </>
                      )}
                      {displayType === 'bodyweight_reps' && (
                        <Text style={[s.colHdr, s.colHdrInputWide]}>REPS</Text>
                      )}
                      {displayType === 'duration' && (
                        <Text style={[s.colHdr, s.colHdrInputWide]}>TIME</Text>
                      )}
                      <Text style={[s.colHdr, { width: 44, textAlign: 'center' }]}>✓</Text>
                    </View>

                    {sets.map((set, i) => {
                      const prevCompleted = sets.slice(0, i).filter(ss => ss.completed).at(-1);
                      const histEntry = exerciseHistory.get(exercise.id);
                      const prevW = prevCompleted?.weight_kg ?? histEntry?.weight_kg ?? null;
                      const prevR = prevCompleted?.reps ?? histEntry?.reps ?? null;
                      const prevD = prevCompleted?.duration_seconds ?? null;
                      return (
                        <InlineSetRow
                          key={set.id}
                          set={set}
                          index={i}
                          exerciseId={exercise.id}
                          displayType={displayType}
                          prevWeight={prevW}
                          prevReps={prevR}
                          prevDuration={prevD}
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
              );
            })}

            <TouchableOpacity style={s.addExBtn} onPress={() => setShowExercisePicker(true)}>
              <Ionicons name="add" size={24} color={COLORS.textDim} />
              <Text style={s.addExTxt}>Add Exercise</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Fixed rest timer bottom bar */}
      {restActive && (
        <View style={s.restBarWrap}>
          <RestTimerBar
            remaining={restRemaining}
            total={restSeconds}
            onAdjust={adjustRest}
            onSkip={skipRest}
            coachMsg={restCoachMsg}
            insetBottom={insets.bottom}
          />
        </View>
      )}

      {/* Exercise 3-dot menu */}
      <ExerciseMenu
        visible={!!menuExerciseId}
        exerciseName={menuExercise?.exercise.name ?? ''}
        onClose={() => setMenuExerciseId(null)}
        onReorder={() => setShowReorder(true)}
        onReplace={() => setReplaceForExerciseId(menuExerciseId)}
        onRemove={() => {
          if (menuExerciseId) useWorkoutStore.getState().removeExercise(menuExerciseId);
          setMenuExerciseId(null);
        }}
      />

      {/* Reorder sheet */}
      <ReorderSheet
        visible={showReorder}
        exercises={exerciseListForReorder}
        onClose={() => setShowReorder(false)}
        onMove={(from, to) => reorderExercises(from, to)}
      />

      {/* Discard confirmation */}
      <DiscardSheet
        visible={showDiscard}
        completedCount={doneSets}
        onKeepGoing={() => setShowDiscard(false)}
        onDiscard={discardWorkout}
      />

      {/* Add exercise picker */}
      <ExerciseLibraryModal
        visible={showExercisePicker}
        onClose={() => setShowExercisePicker(false)}
        onAddExercise={(item) => { addExercise(item); setShowExercisePicker(false); }}
      />

      {/* Replace exercise picker */}
      <ExerciseLibraryModal
        visible={!!replaceForExerciseId}
        onClose={() => setReplaceForExerciseId(null)}
        onAddExercise={(item) => {
          if (replaceForExerciseId) replaceExercise(replaceForExerciseId, item);
          setReplaceForExerciseId(null);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  centred: { flex: 1, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  mutedTxt: { color: COLORS.textDim },
  backTxt: { color: COLORS.primary, marginTop: 16 },

  // PR banner
  prBannerWrap: { position: 'absolute', left: 0, right: 0, zIndex: 100, alignItems: 'center', paddingHorizontal: 20 },
  prBanner: { width: '100%' },
  prBannerInner: {
    backgroundColor: '#2A1A00', borderWidth: 1, borderColor: '#FCD34D',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
  },
  prBannerText: { color: '#FCD34D', fontWeight: '700', fontSize: 14, textAlign: 'center' },

  // Header
  header: {
    paddingHorizontal: 16, paddingBottom: 12,
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  minimizeBtn: { paddingTop: 2, paddingRight: 4 },
  routineName: { color: COLORS.ink, fontWeight: '700', fontSize: 16 },
  elapsed: { color: COLORS.primary, fontWeight: '700', fontSize: 26, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  discardBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  discardTxt: { color: COLORS.error, fontWeight: '600', fontSize: 14 },
  finishBtn: { backgroundColor: COLORS.success, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  finishTxt: { color: COLORS.bg, fontWeight: '700', fontSize: 14 },

  // Progress
  progressWrap: { marginHorizontal: 20, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTrack: { flex: 1, height: 4, backgroundColor: COLORS.surface3, borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: COLORS.green, borderRadius: 99 },
  progressLabel: { fontSize: 11, color: COLORS.ink3, fontWeight: '600', minWidth: 48, textAlign: 'right' },

  // Rest bar
  restBarWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50 },
  restBar: {
    backgroundColor: COLORS.bg,
    borderTopWidth: 1, borderTopColor: COLORS.borderMid,
    paddingTop: 12, paddingHorizontal: 24,
  },
  restCoachMsg: { color: COLORS.ink3, fontSize: 12, textAlign: 'center', marginBottom: 8, lineHeight: 16 },
  restBarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  restCountdown: { color: COLORS.ink, fontWeight: '900', fontSize: 38, minWidth: 100, textAlign: 'center' },
  restAdjBtn: {
    backgroundColor: COLORS.surface2, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10, minHeight: 44, justifyContent: 'center', alignItems: 'center',
  },
  restAdjTxt: { color: COLORS.ink2, fontWeight: '700', fontSize: 15 },
  restSkipBtn: {
    backgroundColor: `${COLORS.amber}20`, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10, minHeight: 44, justifyContent: 'center', alignItems: 'center',
  },
  restSkipTxt: { color: COLORS.amber, fontWeight: '700', fontSize: 15 },

  // Scroll
  scroll: { paddingHorizontal: 20 },

  // Exercise block
  exerciseBlock: { marginBottom: 20 },
  exHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  exName: { color: BLUE_ACCENT, fontWeight: '700', fontSize: 16 },
  exCategory: { color: COLORS.ink3, fontSize: 12, marginTop: 1 },
  exActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },

  restLabel: { color: COLORS.primary, fontSize: 11, marginBottom: 6 },

  notesInput: {
    backgroundColor: COLORS.surface2,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    color: COLORS.ink, fontSize: 13, marginBottom: 8,
    borderWidth: 0.5, borderColor: COLORS.border,
  },

  coachBubble: {
    backgroundColor: `${COLORS.primary}18`,
    borderWidth: 0.5, borderColor: `${COLORS.primary}30`,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8,
  },
  coachText: { color: COLORS.primary, fontSize: 12, lineHeight: 18 },

  // Set table
  setsCard: {
    backgroundColor: COLORS.surface2, borderWidth: 0.5, borderColor: COLORS.border,
    borderRadius: 14, overflow: 'hidden',
  },
  setsHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.border,
  },
  colHdr: { color: COLORS.ink3, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  colHdrPrev: { flex: 1, textAlign: 'center' },
  colHdrInput: { width: 56, textAlign: 'center' },
  colHdrInputWide: { flex: 1, textAlign: 'center' },

  setRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  setRowBorder: { borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  setNum: { color: COLORS.ink2, fontSize: 13, fontWeight: '700', width: 28, textAlign: 'center' },
  setNumDone: { color: '#FFFFFF' },

  prevCol: { flex: 1, color: COLORS.ink3, fontSize: 12, textAlign: 'center' },
  prevColDone: { color: 'rgba(255,255,255,0.6)' },

  deleteAction: {
    backgroundColor: COLORS.red, justifyContent: 'center', alignItems: 'center',
    width: 80, flexDirection: 'row', gap: 4,
  },
  deleteActionText: { color: 'white', fontSize: 12, fontWeight: '700' },

  setInput: {
    color: COLORS.ink, fontSize: 15, fontWeight: '700',
    backgroundColor: COLORS.surface3, borderRadius: 8,
    paddingVertical: 6, textAlign: 'center', width: 52,
  },
  setInputWide: {
    color: COLORS.ink, fontSize: 15, fontWeight: '700',
    backgroundColor: COLORS.surface3, borderRadius: 8,
    paddingVertical: 6, textAlign: 'center', flex: 1,
  },
  setInputDone: { backgroundColor: 'transparent', color: '#FFFFFF' },

  durationCell: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  durationTxt: { color: COLORS.ink, fontSize: 15, fontWeight: '700' },

  setCheck: {
    width: 36, height: 36, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.ink4,
  },
  setCheckDone: { backgroundColor: COLORS.green, borderColor: COLORS.green },

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

  // Stats strip (always visible)
  statsStrip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface2, borderRadius: 16,
    paddingVertical: 14, marginBottom: 20,
    borderWidth: 0.5, borderColor: COLORS.border,
  },

  // Empty state
  emptyState: {},
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { color: COLORS.ink, fontWeight: '700', fontSize: 17 },
  statValueBlue: { color: BLUE_ACCENT, fontWeight: '700', fontSize: 17 },
  statLabel: { color: COLORS.textDim, fontSize: 11, marginTop: 3, fontWeight: '500' },
  statDivider: { width: 0.5, height: 28, backgroundColor: COLORS.border },
  emptyContent: { alignItems: 'center', paddingVertical: 32 },
  emptyTitle: { color: COLORS.ink, fontWeight: '800', fontSize: 22, marginTop: 18 },
  emptySubtitle: {
    color: COLORS.textDim, fontSize: 14, marginTop: 6,
    textAlign: 'center', lineHeight: 20,
  },
  addExPrimary: {
    backgroundColor: BLUE_ACCENT, borderRadius: 14,
    paddingVertical: 16, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  },
  addExPrimaryTxt: { color: 'white', fontWeight: '700', fontSize: 16 },
  emptySecondaryRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  emptySecBtn: {
    flex: 1, backgroundColor: COLORS.surface2, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 0.5, borderColor: COLORS.border,
  },
  emptySecBtnTxt: { color: COLORS.ink, fontWeight: '600', fontSize: 15 },

  // Menu sheet
  menuSheet: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  menuTitle: { color: COLORS.ink3, fontSize: 12, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  menuItemTxt: { color: COLORS.ink, fontSize: 16, fontWeight: '500' },
  menuDivider: { height: 0.5, backgroundColor: COLORS.border },
  menuCancel: {
    marginTop: 12, backgroundColor: COLORS.surface2, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  menuCancelTxt: { color: COLORS.ink2, fontWeight: '700', fontSize: 16 },

  // Reorder sheet
  reorderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: COLORS.border,
  },
  reorderName: { color: COLORS.ink, fontSize: 15, fontWeight: '500', flex: 1, marginRight: 12 },
  reorderBtn: {
    width: 36, height: 36, borderRadius: 8, backgroundColor: COLORS.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  reorderBtnDisabled: { opacity: 0.3 },

  // Discard sheet
  discardSheet: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 12 },
  discardTitle: { color: COLORS.ink, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  discardBody: { color: COLORS.ink2, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  discardDestructiveBtn: {
    backgroundColor: COLORS.red, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  discardDestructiveTxt: { color: 'white', fontWeight: '700', fontSize: 16 },
  discardCancelBtn: {
    backgroundColor: COLORS.surface2, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  discardCancelTxt: { color: COLORS.ink, fontWeight: '600', fontSize: 16 },

  // Exercise pickers
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
