import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import type { Routine, Exercise } from '@/types';
import { COLORS } from '@/constants';
import { ExerciseLibraryModal } from '@/components/workouts/ExerciseLibraryModal';

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
      for (const mg of re.exercise?.muscle_groups ?? []) {
        muscles.add(formatMuscle(mg));
      }
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

export default function WorkoutsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUserStore();
  const { startWorkout, isActive } = useWorkoutStore();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [routinesLoading, setRoutinesLoading] = useState(true);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const loadRoutines = useCallback(() => {
    if (!user) { setRoutines([]); setRoutinesLoading(false); return; }
    let cancelled = false;
    setRoutinesLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('routines')
          .select(`*, days:routine_days(*, exercises:routine_exercises(*, exercise:exercises(*)))`)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);
        if (cancelled) return;
        if (!error && data) setRoutines(data as unknown as Routine[]);
        else setRoutines([]);
      } catch {
        if (!cancelled) setRoutines([]);
      } finally {
        if (!cancelled) setRoutinesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  useFocusEffect(loadRoutines);

  const handleStartEmpty = () => {
    startWorkout();
    router.push('/workout/active');
  };

  const handleStartRoutine = (routine: Routine) => {
    const day = firstWorkoutDay(routine);
    const exercises: Exercise[] = day?.exercises?.map(re => re.exercise as Exercise).filter(Boolean) ?? [];
    startWorkout(routine.id, routine.name, exercises);
    router.push('/workout/active');
  };

  const handleAddFromLibrary = (exercise: Exercise) => {
    startWorkout(undefined, 'Quick workout', [exercise]);
    setLibraryOpen(false);
    router.push('/workout/active');
  };

  // Active workout banner
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

  if (routinesLoading) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.blue} />
      </View>
    );
  }

  const hasRoutines = routines.length > 0;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        <View style={[s.header, { paddingTop: insets.top + 16 }]}>
          <Text style={s.pageTitle}>Workouts</Text>
        </View>

        {hasRoutines ? (
          <>
            {/* Compact utility icon row */}
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

            {/* Routine list */}
            <View style={s.routineList}>
              {routines.map(routine => {
                const exCount = totalExerciseCount(routine);
                const muscles = routineMuscles(routine);
                const mins = estimateRoutineMinutes(routine);
                return (
                  <View key={routine.id} style={s.routineCard}>
                    <TouchableOpacity
                      style={s.routineCardBody}
                      onPress={() => router.push(`/routines/${routine.id}`)}
                      activeOpacity={0.75}
                    >
                      <Text style={s.routineName}>{routine.name}</Text>
                      {muscles.length > 0 && (
                        <Text style={s.routineMuscles} numberOfLines={1}>
                          {muscles.join(' · ')}
                        </Text>
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
            </View>
          </>
        ) : (
          <>
            {/* Guidance cards for new users */}
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

            <TouchableOpacity style={s.guidanceCard} onPress={() => router.push('/routines/import-hevy-link')} activeOpacity={0.85}>
              <Ionicons name="download-outline" size={32} color={COLORS.ink2} />
              <View style={{ flex: 1 }}>
                <Text style={s.guidanceTitle}>Import Routine</Text>
                <Text style={s.guidanceSub}>Bring in an existing programme from a CSV or link</Text>
              </View>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <ExerciseLibraryModal
        visible={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onAddExercise={handleAddFromLibrary}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: 16, paddingBottom: 110 },
  header: { paddingBottom: 16 },
  pageTitle: { fontSize: 30, fontWeight: '900', color: COLORS.ink, letterSpacing: -0.5 },

  // Compact utility row
  utilRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  utilBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  utilLabel: { fontSize: 11, fontWeight: '700', color: COLORS.ink3 },

  // Routine list
  routineList: { gap: 12 },
  routineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  routineCardBody: { flex: 1, padding: 16 },
  routineName: { fontSize: 17, fontWeight: '800', color: COLORS.ink, marginBottom: 4 },
  routineMuscles: { fontSize: 13, color: COLORS.blue, marginBottom: 3, fontWeight: '500' },
  routineMeta: { fontSize: 12, color: COLORS.ink3 },
  startBtn: {
    backgroundColor: COLORS.ink,
    paddingVertical: 14,
    paddingHorizontal: 18,
    margin: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnTxt: { color: COLORS.bg, fontWeight: '800', fontSize: 14 },

  // Guidance cards
  guidanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 20,
    marginBottom: 12,
  },
  guidanceCardPrimary: {
    backgroundColor: COLORS.ink,
    borderColor: COLORS.ink,
  },
  guidancePrimaryTitle: { fontSize: 18, fontWeight: '900', color: COLORS.bg, marginBottom: 3 },
  guidancePrimarySub: { fontSize: 13, color: `${COLORS.bg}AA`, lineHeight: 18 },
  guidanceTitle: { fontSize: 18, fontWeight: '900', color: COLORS.ink, marginBottom: 3 },
  guidanceSub: { fontSize: 13, color: COLORS.ink3, lineHeight: 18 },

  // Active banner
  activeWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  activeEmoji: { fontSize: 40, marginBottom: 16 },
  activeTitle: { fontSize: 22, fontWeight: '800', color: COLORS.ink, textAlign: 'center', marginBottom: 6 },
  activeSub: { fontSize: 14, color: COLORS.ink3, textAlign: 'center', marginBottom: 28 },
  primaryBtn: { backgroundColor: COLORS.ink, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
  primaryBtnText: { color: COLORS.bg, fontWeight: '800', fontSize: 15 },
});
