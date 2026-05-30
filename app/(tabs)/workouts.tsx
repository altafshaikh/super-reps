import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
  ActivityIndicator, Modal, Pressable, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import type { Routine, Exercise, WorkoutExerciseInput } from '@/types';
import { COLORS } from '@/constants';
import { ExerciseLibraryModal } from '@/components/workouts/ExerciseLibraryModal';

// weekday 0=Sun…6=Sat, displayed Mon–Sun
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_SHORT  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface ScheduleEntry { weekday: number; routine_id: string | null }

const MG_LABEL: Record<string, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes',
  calves: 'Calves', core: 'Core', full_body: 'Full body',
};

function formatMuscle(m: string): string {
  return MG_LABEL[m] ?? m.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function estimateRoutineMinutes(routine: Routine): number {
  let sec = 0;
  for (const day of routine.days ?? []) {
    for (const re of day.exercises ?? []) {
      sec += Math.max(1, re.sets ?? 3) * (40 + (re.rest_seconds ?? 90)) + 90;
    }
  }
  return Math.max(20, Math.round(sec / 60));
}

function routineMuscles(routine: Routine): string[] {
  const muscles = new Set<string>();
  for (const day of routine.days ?? []) {
    for (const re of day.exercises ?? []) {
      for (const mg of re.exercise?.muscle_groups ?? []) muscles.add(formatMuscle(mg));
    }
  }
  return [...muscles].slice(0, 4);
}

function totalExerciseCount(routine: Routine): number {
  return (routine.days ?? []).reduce((n, d) => n + (d.exercises?.length ?? 0), 0);
}

function firstWorkoutDay(routine: Routine) {
  return routine.days?.find(d => (d.exercises?.length ?? 0) > 0);
}

function parseRepRange(range: string | undefined | null): number {
  const match = range?.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export default function WorkoutsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUserStore();
  const { startWorkout, isActive } = useWorkoutStore();
  const [routines, setRoutines]       = useState<Routine[]>([]);
  const [schedule, setSchedule]       = useState<ScheduleEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [creatingRoutine, setCreatingRoutine] = useState(false);
  // picker: weekday being edited (-1 = pick day first), and which routine is being assigned
  const [pickingDay, setPickingDay]       = useState<number | null>(null);
  const [pickingRoutineId, setPickingRoutineId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) { setRoutines([]); setSchedule([]); setLoading(false); return; }
    const [routinesRes, scheduleRes] = await Promise.all([
      supabase
        .from('routines')
        .select(`*, days:routine_days(*, exercises:routine_exercises(*, exercise:exercises(*)))`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('weekly_schedule')
        .select('weekday, routine_id')
        .eq('user_id', user.id),
    ]);
    setRoutines((routinesRes.data ?? []) as unknown as Routine[]);
    setSchedule((scheduleRes.data ?? []) as ScheduleEntry[]);
    setLoading(false);
  }, [user]);

  const load = useCallback(() => {
    setLoading(true);
    void fetchData();
  }, [fetchData]);

  useFocusEffect(load);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const assignDay = async (weekday: number, routine_id: string | null) => {
    if (!user) return;
    setPickingDay(null);
    setPickingRoutineId(null);
    setSchedule(prev => {
      // remove old entry for this weekday AND old entry for this routine
      const next = prev.filter(e => e.weekday !== weekday && e.routine_id !== routine_id);
      if (routine_id !== null) next.push({ weekday, routine_id });
      return next;
    });
    if (routine_id === null) {
      await supabase.from('weekly_schedule').delete().eq('user_id', user.id).eq('weekday', weekday);
    } else {
      // remove any existing entry for this routine on a different day
      await supabase.from('weekly_schedule').delete().eq('user_id', user.id).eq('routine_id', routine_id);
      await supabase.from('weekly_schedule').upsert({ user_id: user.id, weekday, routine_id });
    }
  };

  const handleStartEmpty = () => { startWorkout(); router.push('/workout/active'); };

  const handleStartRoutine = (routine: Routine) => {
    const day = firstWorkoutDay(routine);
    const inputs: WorkoutExerciseInput[] = (day?.exercises ?? [])
      .filter(re => re.exercise)
      .map(re => ({
        exercise: re.exercise as Exercise,
        setsCount: re.sets ?? 3,
        defaultReps: parseRepRange(re.rep_range),
        restSeconds: re.rest_seconds ?? 90,
      }));
    startWorkout(routine.id, routine.name, inputs);
    router.push('/workout/active');
  };

  const handleAddFromLibrary = (exercise: Exercise) => {
    startWorkout(undefined, 'Quick workout', [{ exercise }]);
    setLibraryOpen(false);
    router.push('/workout/active');
  };

  const handleAddRoutine = async () => {
    if (!user || creatingRoutine) return;
    setCreatingRoutine(true);
    const { data: routine } = await supabase
      .from('routines')
      .insert({ user_id: user.id, name: 'New Routine', created_by_ai: false })
      .select()
      .single();
    if (routine) {
      await supabase.from('routine_days').insert({ routine_id: routine.id, day_of_week: 1 });
      router.push(`/routines/edit/${routine.id}`);
    }
    setCreatingRoutine(false);
  };

  if (isActive) {
    return (
      <View style={s.root}>
        <View style={s.activeWrap}>
          <Text style={s.activeEmoji}>⚡</Text>
          <Text style={s.activeTitle}>Workout in progress</Text>
          <Text style={s.activeSub}>You have an active session</Text>
          <TouchableOpacity onPress={() => router.push('/workout/active')} style={s.primaryBtn}>
            <Text style={s.primaryBtnText}>Resume workout</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.blue} />
      </View>
    );
  }

  const todayWd = new Date().getDay();
  const pickerEntry = pickingDay !== null ? schedule.find(e => e.weekday === pickingDay) : null;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.blue} />}
      >
        <View style={[s.header, { paddingTop: insets.top + 16 }]}>
          <Text style={s.pageTitle}>Workouts</Text>
        </View>

        {/* ── Utility row ───────────────────────────────────── */}
        <View style={s.utilRow}>
          <TouchableOpacity style={s.utilBtn} onPress={handleStartEmpty} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={22} color={COLORS.ink2} />
            <Text style={s.utilLabel}>Empty</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.utilBtn} onPress={() => router.navigate('/(tabs)/ai')} activeOpacity={0.8}>
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={COLORS.ink2} />
            <Text style={s.utilLabel}>AI Build</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.utilBtn} onPress={() => router.push('/routines/import-hevy-link')} activeOpacity={0.8}>
            <Ionicons name="download-outline" size={22} color={COLORS.ink2} />
            <Text style={s.utilLabel}>Import</Text>
          </TouchableOpacity>
        </View>

        {/* ── My Routines ───────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>MY ROUTINES</Text>
          <View style={s.routineList}>
            {routines.map(routine => {
              const exCount = totalExerciseCount(routine);
              const muscles = routineMuscles(routine);
              const mins    = estimateRoutineMinutes(routine);
              const assignedEntries = schedule.filter(e => e.routine_id === routine.id);
              const hasToday = assignedEntries.some(e => e.weekday === todayWd);
              return (
                <View key={routine.id} style={s.routineCard}>
                  <TouchableOpacity
                    style={s.routineCardBody}
                    onPress={() => router.push(`/routines/${routine.id}`)}
                    activeOpacity={0.75}
                  >
                    <View style={s.routineNameRow}>
                      <Text style={s.routineName}>{routine.name}</Text>
                      {/* Day badges — tap navigates to edit routine to manage schedule */}
                      <TouchableOpacity
                        style={s.dayBadgesRow}
                        onPress={() => router.push(`/routines/edit/${routine.id}`)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {assignedEntries.length === 0 ? (
                          <View style={s.dayBadge}>
                            <Text style={s.dayBadgeTxt}>+ Day</Text>
                          </View>
                        ) : (
                          assignedEntries
                            .sort((a, b) => a.weekday - b.weekday)
                            .map(e => (
                              <View key={e.weekday} style={[s.dayBadge, e.weekday === todayWd && s.dayBadgeToday]}>
                                <Text style={[s.dayBadgeTxt, e.weekday === todayWd && s.dayBadgeTxtToday]}>
                                  {DAY_SHORT[e.weekday]}
                                </Text>
                              </View>
                            ))
                        )}
                      </TouchableOpacity>
                    </View>
                    {muscles.length > 0 && (
                      <Text style={s.routineMuscles} numberOfLines={1}>{muscles.join(' · ')}</Text>
                    )}
                    <Text style={s.routineMeta}>{exCount} exercises · ~{mins} min</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.startBtn}
                    onPress={() => handleStartRoutine(routine)}
                    activeOpacity={0.85}
                  >
                    <Text style={s.startBtnTxt}>Start</Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Add Routine */}
            <TouchableOpacity style={s.addRoutineBtn} onPress={handleAddRoutine} disabled={creatingRoutine} activeOpacity={0.8}>
              {creatingRoutine
                ? <ActivityIndicator size="small" color={COLORS.blue} />
                : <Ionicons name="add" size={20} color={COLORS.blue} />
              }
              <Text style={s.addRoutineTxt}>Add Routine</Text>
            </TouchableOpacity>
          </View>
        </View>

        {routines.length === 0 && (
          <>
            <TouchableOpacity style={[s.guidanceCard, s.guidanceCardPrimary]} onPress={handleStartEmpty} activeOpacity={0.85}>
              <Ionicons name="flash-outline" size={32} color={COLORS.bg} />
              <View style={{ flex: 1 }}>
                <Text style={s.guidancePrimaryTitle}>Quick Start</Text>
                <Text style={s.guidancePrimarySub}>Start an empty workout now, add exercises as you go</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={s.guidanceCard} onPress={() => router.navigate('/(tabs)/ai')} activeOpacity={0.85}>
              <Ionicons name="chatbubble-ellipses-outline" size={32} color={COLORS.blue} />
              <View style={{ flex: 1 }}>
                <Text style={s.guidanceTitle}>Build with AI</Text>
                <Text style={s.guidanceSub}>Tell me your goal — I'll design a personalised programme</Text>
              </View>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* ── Day picker modal ──────────────────────────────── */}
      <Modal
        visible={pickingDay !== null}
        transparent
        animationType="slide"
        onRequestClose={() => { setPickingDay(null); setPickingRoutineId(null); }}
      >
        <Pressable style={s.modalOverlay} onPress={() => { setPickingDay(null); setPickingRoutineId(null); }}>
          <Pressable style={s.modalSheet} onPress={e => e.stopPropagation()}>
            <View style={s.modalHandle} />

            {pickingDay === -1 ? (
              /* Step 1: pick which weekday */
              <>
                <Text style={s.modalTitle}>Assign to a day</Text>
                <View style={s.dayPickerGrid}>
                  {WEEK_ORDER.map(wd => {
                    const taken = schedule.find(e => e.weekday === wd && e.routine_id !== pickingRoutineId);
                    return (
                      <TouchableOpacity
                        key={wd}
                        style={[s.dayPickerBtn, taken && s.dayPickerBtnTaken]}
                        onPress={() => {
                          if (!taken) assignDay(wd, pickingRoutineId);
                        }}
                        disabled={!!taken}
                      >
                        <Text style={[s.dayPickerBtnTxt, taken && s.dayPickerBtnTxtTaken]}>
                          {DAY_SHORT[wd]}
                        </Text>
                        {taken && <Text style={s.dayPickerTakenTxt} numberOfLines={1}>taken</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {/* Remove assignment if already set */}
                {schedule.some(e => e.routine_id === pickingRoutineId) && (
                  <TouchableOpacity
                    style={s.removeBtn}
                    onPress={() => {
                      const entry = schedule.find(e => e.routine_id === pickingRoutineId);
                      if (entry) assignDay(entry.weekday, null);
                    }}
                  >
                    <Ionicons name="trash-outline" size={16} color={COLORS.red} />
                    <Text style={s.removeBtnTxt}>Remove day assignment</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              /* Step 2 (or direct): reassign existing day */
              <>
                <Text style={s.modalTitle}>
                  {pickingDay !== null && pickingDay >= 0 ? DAY_FULL[pickingDay] : ''}
                </Text>
                <View style={s.dayPickerGrid}>
                  {WEEK_ORDER.map(wd => {
                    const isSelected = wd === pickingDay;
                    const taken = schedule.find(e => e.weekday === wd && e.routine_id !== pickingRoutineId);
                    return (
                      <TouchableOpacity
                        key={wd}
                        style={[s.dayPickerBtn, isSelected && s.dayPickerBtnActive, taken && !isSelected && s.dayPickerBtnTaken]}
                        onPress={() => {
                          if (!taken || isSelected) assignDay(wd, pickingRoutineId);
                        }}
                        disabled={!!taken && !isSelected}
                      >
                        <Text style={[s.dayPickerBtnTxt, isSelected && s.dayPickerBtnTxtActive, taken && !isSelected && s.dayPickerBtnTxtTaken]}>
                          {DAY_SHORT[wd]}
                        </Text>
                        {taken && !isSelected && <Text style={s.dayPickerTakenTxt}>taken</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TouchableOpacity
                  style={s.removeBtn}
                  onPress={() => assignDay(pickingDay!, null)}
                >
                  <Ionicons name="trash-outline" size={16} color={COLORS.red} />
                  <Text style={s.removeBtnTxt}>Remove day assignment</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <ExerciseLibraryModal
        visible={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onAddExercise={handleAddFromLibrary}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: COLORS.bg },
  scroll:     { paddingHorizontal: 16, paddingBottom: 110 },
  header:     { paddingBottom: 20 },
  pageTitle:  { fontSize: 30, fontWeight: '900', color: COLORS.ink, letterSpacing: -0.5 },
  section:    { marginBottom: 24 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.ink3, letterSpacing: 1, marginBottom: 10 },

  // Day badge on routine card
  routineNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  dayBadgesRow: { flexDirection: 'row', gap: 4 },
  dayBadge: {
    backgroundColor: COLORS.surface2, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  dayBadgeToday: { backgroundColor: COLORS.blue + '30' },
  dayBadgeTxt: { fontSize: 11, fontWeight: '700', color: COLORS.ink3 },
  dayBadgeTxtToday: { color: COLORS.blue },

  // Utility row
  utilRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  utilBtn: {
    flex: 1, alignItems: 'center', gap: 5, paddingVertical: 14,
    backgroundColor: COLORS.surface, borderRadius: 14,
    borderWidth: 0.5, borderColor: COLORS.border,
  },
  utilLabel: { fontSize: 11, fontWeight: '700', color: COLORS.ink3 },

  // Routine list
  routineList: { gap: 10 },
  routineCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 16,
    borderWidth: 0.5, borderColor: COLORS.border, overflow: 'hidden',
  },
  routineCardBody: { flex: 1, padding: 16 },
  routineName:    { fontSize: 17, fontWeight: '800', color: COLORS.ink, flex: 1 },
  routineMuscles: { fontSize: 13, color: COLORS.blue, marginBottom: 3, fontWeight: '500' },
  routineMeta:    { fontSize: 12, color: COLORS.ink3 },
  startBtn: {
    backgroundColor: COLORS.ink, paddingVertical: 14, paddingHorizontal: 18,
    margin: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  startBtnTxt: { color: COLORS.bg, fontWeight: '800', fontSize: 14 },

  addRoutineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: COLORS.blue + '40', borderRadius: 16,
    paddingVertical: 14, borderStyle: 'dashed',
  },
  addRoutineTxt: { color: COLORS.blue, fontWeight: '700', fontSize: 14 },

  // Guidance cards (empty state)
  guidanceCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: COLORS.surface, borderRadius: 18,
    borderWidth: 0.5, borderColor: COLORS.border, padding: 20, marginBottom: 12,
  },
  guidanceCardPrimary: { backgroundColor: COLORS.ink, borderColor: COLORS.ink },
  guidancePrimaryTitle: { fontSize: 18, fontWeight: '900', color: COLORS.bg, marginBottom: 3 },
  guidancePrimarySub:   { fontSize: 13, color: `${COLORS.bg}AA`, lineHeight: 18 },
  guidanceTitle: { fontSize: 18, fontWeight: '900', color: COLORS.ink, marginBottom: 3 },
  guidanceSub:   { fontSize: 13, color: COLORS.ink3, lineHeight: 18 },

  // Active banner
  activeWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  activeEmoji:   { fontSize: 40, marginBottom: 16 },
  activeTitle:   { fontSize: 22, fontWeight: '800', color: COLORS.ink, textAlign: 'center', marginBottom: 6 },
  activeSub:     { fontSize: 14, color: COLORS.ink3, textAlign: 'center', marginBottom: 28 },
  primaryBtn:    { backgroundColor: COLORS.ink, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
  primaryBtnText:{ color: COLORS.bg, fontWeight: '800', fontSize: 15 },

  // Day picker modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 40, maxHeight: '75%',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.surface2,
    alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.ink, marginBottom: 16 },
  // Day picker grid inside modal
  dayPickerGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  dayPickerBtn: {
    flex: 1, height: 48, borderRadius: 10,
    backgroundColor: COLORS.surface2, alignItems: 'center', justifyContent: 'center',
  },
  dayPickerBtnActive: { backgroundColor: COLORS.blue },
  dayPickerBtnTaken:  { opacity: 0.35 },
  dayPickerBtnTxt:    { fontSize: 12, fontWeight: '700', color: COLORS.ink },
  dayPickerBtnTxtActive: { color: '#fff' },
  dayPickerBtnTxtTaken:  { color: COLORS.ink3 },
  dayPickerTakenTxt: { fontSize: 8, color: COLORS.ink3, marginTop: 2 },
  removeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.red + '40',
  },
  removeBtnTxt: { color: COLORS.red, fontWeight: '600', fontSize: 14 },
});
