import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import type { Routine, Exercise } from '@/types';
import { COLORS } from '@/constants';
import { ExerciseLibraryModal } from '@/components/workouts/ExerciseLibraryModal';

const MG_LABEL: Record<string, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  core: 'Core',
  full_body: 'Full body',
};

function formatMuscle(m: string): string {
  return MG_LABEL[m] ?? m.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function estimateRoutineMinutes(routine: Routine): number {
  let sec = 0;
  for (const day of routine.days ?? []) {
    for (const re of day.exercises ?? []) {
      const sets = Math.max(1, re.sets ?? 3);
      const rest = re.rest_seconds ?? 90;
      sec += sets * (40 + rest) + 90;
    }
  }
  return Math.max(20, Math.round(sec / 60));
}

function routineSubtitle(routine: Routine): string {
  const muscles = new Set<string>();
  for (const day of routine.days ?? []) {
    for (const re of day.exercises ?? []) {
      for (const mg of re.exercise?.muscle_groups ?? []) {
        muscles.add(formatMuscle(mg));
      }
    }
  }
  const line = [...muscles].slice(0, 4).join(' · ');
  const min = estimateRoutineMinutes(routine);
  return line ? `${line} · ~${min} min` : `~${min} min`;
}

function totalExerciseCount(routine: Routine): number {
  let n = 0;
  for (const day of routine.days ?? []) {
    n += day.exercises?.length ?? 0;
  }
  return n;
}

export default function WorkoutsScreen() {
  const router = useRouter();
  const { user } = useUserStore();
  const { startWorkout, isActive } = useWorkoutStore();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [routinesLoading, setRoutinesLoading] = useState(true);
  const [libraryOpen, setLibraryOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setRoutines([]);
      setRoutinesLoading(false);
      return;
    }
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
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleStartEmpty = () => {
    startWorkout();
    router.push('/workout/active');
  };

  const handleAddFromLibrary = (exercise: Exercise) => {
    startWorkout(undefined, 'Quick workout', [exercise]);
    setLibraryOpen(false);
    router.push('/workout/active');
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

  const hasRoutines = routines.length > 0;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          s.scrollContent,
          !routinesLoading && !hasRoutines && { flexGrow: 1 },
        ]}
      >
        <View style={s.header}>
          <Text style={s.pageTitle}>Workouts</Text>
          <Text style={s.subtitle}>Routines, quick start, and exercise library</Text>
        </View>

        {routinesLoading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.blue} />
          </View>
        ) : (
          <>
            <View style={s.actionRow}>
              <TouchableOpacity
                style={s.cardEmptyWorkout}
                onPress={handleStartEmpty}
                activeOpacity={0.9}
              >
                <Text style={s.cardEmptyWorkoutTxt}>+ Empty Workout</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.cardBuildAi}
                onPress={() => router.push('/routines/ai-builder')}
                activeOpacity={0.9}
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={18}
                  color={COLORS.ink}
                  style={{ marginRight: 8 }}
                />
                <Text style={s.cardBuildAiTxt} numberOfLines={1}>
                  Build with AI
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={s.cardImport}
              onPress={() => router.push('/routines/import-hevy-link')}
              activeOpacity={0.85}
            >
              <Ionicons name="download-outline" size={20} color={COLORS.ink} style={{ marginRight: 10 }} />
              <Text style={s.cardImportTxt}>Import Routine</Text>
            </TouchableOpacity>

            {hasRoutines ? (
              <>
                <View style={s.sectionHead}>
                  <Text style={s.sectionKicker}>MY ROUTINES</Text>
                  <TouchableOpacity onPress={() => router.push('/routines/ai-builder')} hitSlop={12}>
                    <Text style={s.sectionNew}>+ New</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.routineCardsWrap}>
                  {routines.map((routine) => {
                    const exN = totalExerciseCount(routine);
                    const sub = routineSubtitle(routine);
                    return (
                      <TouchableOpacity
                        key={routine.id}
                        style={s.routineCard}
                        onPress={() => router.push(`/routines/${routine.id}`)}
                        activeOpacity={0.75}
                      >
                        <View style={s.routineCardBody}>
                          <Text style={s.routineName}>{routine.name}</Text>
                          <Text style={s.routineSub} numberOfLines={2}>
                            {sub}
                          </Text>
                        </View>
                        <View style={s.routineMeta}>
                          <Text style={s.routineEx}>{exN} ex</Text>
                          <Ionicons name="chevron-forward" size={18} color={COLORS.ink3} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : (
              <View style={s.emptyHint}>
                <Text style={s.emptyHintTitle}>No routines yet</Text>
                <Text style={s.emptyHintBody}>
                  Use Import Routine or Build with AI — saved plans show up here as cards.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={s.dashedBrowse}
              onPress={() => setLibraryOpen(true)}
              activeOpacity={0.85}
            >
              <Text style={s.dashedBrowseTxt}>Browse exercise library</Text>
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
  scrollContent: { paddingBottom: 110, paddingHorizontal: 16 },
  header: { paddingTop: 56, paddingBottom: 20 },
  pageTitle: { fontSize: 30, fontWeight: '900', color: COLORS.ink, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: COLORS.ink3, marginTop: 6, lineHeight: 20 },
  loadingBox: {
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  cardEmptyWorkout: {
    flex: 1,
    minHeight: 52,
    backgroundColor: COLORS.ink,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  cardEmptyWorkoutTxt: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.bg,
    textAlign: 'center',
  },
  cardBuildAi: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    backgroundColor: COLORS.surface2,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  cardBuildAiTxt: { fontSize: 14, fontWeight: '700', color: COLORS.ink, flexShrink: 1 },
  cardImport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 16,
    marginBottom: 22,
  },
  cardImportTxt: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionKicker: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.ink3,
    letterSpacing: 1.2,
  },
  sectionNew: { fontSize: 14, fontWeight: '700', color: COLORS.ink3 },
  routineCardsWrap: { gap: 12, marginBottom: 20 },
  routineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  routineCardBody: { flex: 1, paddingRight: 12, minWidth: 0 },
  routineName: { fontSize: 17, fontWeight: '800', color: COLORS.ink },
  routineSub: { fontSize: 13, color: COLORS.ink3, marginTop: 5, lineHeight: 18 },
  routineMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  routineEx: { fontSize: 14, fontWeight: '700', color: COLORS.ink3 },
  emptyHint: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 22,
    paddingHorizontal: 18,
    marginBottom: 20,
  },
  emptyHintTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.ink,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyHintBody: {
    fontSize: 14,
    color: COLORS.ink3,
    textAlign: 'center',
    lineHeight: 20,
  },
  dashedBrowse: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.borderMid,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dashedBrowseTxt: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  activeWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  activeEmoji: { fontSize: 40, marginBottom: 16 },
  activeTitle: { fontSize: 22, fontWeight: '800', color: COLORS.ink, textAlign: 'center', marginBottom: 6 },
  activeSub: { fontSize: 14, color: COLORS.ink3, textAlign: 'center', marginBottom: 28 },
  primaryBtn: {
    backgroundColor: COLORS.ink,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  primaryBtnText: { color: COLORS.bg, fontWeight: '800', fontSize: 15 },
});
