import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StatusBar, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import type { PersonalRecord, WorkoutSession, Routine, Exercise } from '@/types';
import { derivePersonalBestsFromFlatRows, fetchAllSetsForPersonalBests } from '@/lib/personal-bests';
import { formatWeight } from '@/lib/utils';
import { COLORS } from '@/constants';
import { SRCard, SRDivider, SRSectionLabel } from '@/components/ui';

function greeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 18) return 'Good afternoon';
  return 'Good evening';
}

function calcStreak(sessions: WorkoutSession[]): number {
  if (!sessions.length) return 0;
  let s = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 60; i++) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const has = sessions.some(ws => {
      const d = new Date(ws.started_at);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === day.getTime();
    });
    if (has) s++;
    else if (i > 0) break;
  }
  return s;
}

function readinessAssessment(sessions: WorkoutSession[]): { label: string; color: string } {
  if (!sessions.length) {
    return { label: "Fresh start — begin your first workout today!", color: COLORS.green };
  }
  const last = new Date(sessions[0].started_at);
  const daysSince = Math.floor((Date.now() - last.getTime()) / 86400000);
  const lastVol = sessions[0].volume_total ?? 0;

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekFreq = sessions.filter(s => new Date(s.started_at).getTime() > weekAgo).length;

  if (daysSince === 0) {
    return { label: "You already trained today — great consistency!", color: COLORS.green };
  }
  if (daysSince === 1 && lastVol > 5000) {
    return { label: "Heavy session yesterday — consider lighter work or rest today.", color: COLORS.amber };
  }
  if (daysSince === 1) {
    return { label: "Trained yesterday — a lighter session or rest is smart today.", color: COLORS.amber };
  }
  if (daysSince <= 3) {
    return { label: `${daysSince} days rest — you're recovered and ready to push.`, color: COLORS.green };
  }
  if (daysSince <= 7) {
    return { label: `${daysSince} days since your last session — time to get back at it!`, color: COLORS.blue };
  }
  return { label: "It's been a while — ease back in with moderate weights today.", color: COLORS.ink3 };
}

// ── 7-day mini heatmap ───────────────────────────────────────

function WeekHeatmap({ sessions }: { sessions: WorkoutSession[] }) {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysToMonday);
  monday.setHours(0, 0, 0, 0);

  const sessionDates = new Set(sessions.map(s => s.started_at.slice(0, 10)));
  const trainedCount = [...Array(7)].filter((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return sessionDates.has(d.toISOString().slice(0, 10));
  }).length;

  return (
    <SRCard style={s.heatmapCard}>
      <View style={s.heatmapHeader}>
        <Text style={s.heatmapTitle}>This Week</Text>
        <Text style={s.heatmapCount}>{trainedCount} sessions</Text>
      </View>
      <View style={s.heatmapRow}>
        {days.map((label, i) => {
          const d = new Date(monday);
          d.setDate(monday.getDate() + i);
          const iso = d.toISOString().slice(0, 10);
          const trained = sessionDates.has(iso);
          const isToday = d.toDateString() === today.toDateString();
          const isFuture = d > today;
          return (
            <View key={i} style={s.heatmapDay}>
              <View style={[
                s.heatmapDot,
                trained && s.heatmapDotFilled,
                isToday && !trained && s.heatmapDotToday,
                isFuture && s.heatmapDotFuture,
              ]} />
              <Text style={[s.heatmapLabel, isToday && { color: COLORS.blue, fontWeight: '700' }]}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </SRCard>
  );
}

// ── Main screen ───────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUserStore();
  const { isActive, startWorkout } = useWorkoutStore();

  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [personalBests, setPersonalBests] = useState<PersonalRecord[]>([]);
  const [firstRoutine, setFirstRoutine] = useState<Routine | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [sessionsRes, prFlat, routineRes] = await Promise.all([
      supabase
        .from('workout_sessions')
        .select('id, started_at, volume_total, duration_seconds, routine_name, finished_at')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .not('finished_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(500),
      fetchAllSetsForPersonalBests(supabase, user.id),
      supabase
        .from('routines')
        .select(`id, name, days:routine_days(id, name, exercises:routine_exercises(*, exercise:exercises(*)))`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
    ]);

    if (sessionsRes.data) setSessions(sessionsRes.data as WorkoutSession[]);
    const { bests } = derivePersonalBestsFromFlatRows(prFlat);
    setPersonalBests(bests);
    if (routineRes.data) setFirstRoutine(routineRes.data as unknown as Routine);
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { void fetchDashboard(); }, [fetchDashboard]));

  const userName = user?.name ?? user?.username ?? user?.email?.split('@')[0] ?? 'Lifter';
  const initial = userName[0]?.toUpperCase() ?? 'U';
  const streak = useMemo(() => calcStreak(sessions), [sessions]);
  const readiness = useMemo(() => readinessAssessment(sessions), [sessions]);
  const top3PRs = useMemo(() => personalBests.slice(0, 3), [personalBests]);

  const handleStartRoutine = () => {
    if (!firstRoutine) {
      startWorkout();
      router.push('/workout/active');
      return;
    }
    const day = firstRoutine.days?.find(d => (d.exercises?.length ?? 0) > 0);
    const exercises: Exercise[] = day?.exercises?.map(re => re.exercise as Exercise).filter(Boolean) ?? [];
    startWorkout(firstRoutine.id, firstRoutine.name, exercises);
    router.push('/workout/active');
  };

  const routineExCount = firstRoutine
    ? (firstRoutine.days ?? []).reduce((n, d) => n + (d.exercises?.length ?? 0), 0)
    : 0;

  if (loading) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={COLORS.blue} size="large" />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16 }]}>

        {/* Greeting header */}
        <View style={s.greetRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.greetSub}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
            <Text style={s.greetName}>{greeting()}, {userName}</Text>
          </View>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initial}</Text>
          </View>
        </View>

        {/* Active workout banner */}
        {isActive && (
          <TouchableOpacity onPress={() => router.push('/workout/active')} style={s.activeBanner}>
            <View style={s.activeDot} />
            <Text style={s.activeBannerText}>Workout in progress — tap to continue</Text>
          </TouchableOpacity>
        )}

        {/* AI readiness card */}
        <SRCard style={s.readinessCard}>
          <View style={s.readinessRow}>
            <View style={[s.readinessDot, { backgroundColor: readiness.color }]} />
            <Text style={[s.readinessText, { color: readiness.color }]}>{readiness.label}</Text>
          </View>
          <View style={s.streakRow}>
            <Text style={s.streakVal}>{streak > 0 ? `${streak} 🔥` : '0'}</Text>
            <Text style={s.streakLab}>day streak</Text>
          </View>
        </SRCard>

        {/* Routine / start card */}
        {!isActive && (
          <SRCard style={s.routineCard}>
            <View style={s.routineBody}>
              <Text style={s.routineLabel}>{firstRoutine ? 'TODAY\'S ROUTINE' : 'START TRAINING'}</Text>
              <Text style={s.routineName} numberOfLines={1}>
                {firstRoutine?.name ?? 'Empty Workout'}
              </Text>
              {firstRoutine && (
                <Text style={s.routineMeta}>{routineExCount} exercises</Text>
              )}
            </View>
            <TouchableOpacity style={s.startBtn} onPress={handleStartRoutine} activeOpacity={0.85}>
              <Text style={s.startBtnTxt}>Start →</Text>
            </TouchableOpacity>
          </SRCard>
        )}

        {/* 7-day heatmap */}
        <WeekHeatmap sessions={sessions} />

        {/* Top 3 PRs */}
        {top3PRs.length > 0 && (
          <SRCard>
            <SRSectionLabel action="See all" onAction={() => router.push('/(tabs)/profile')}>
              Top Lifts
            </SRSectionLabel>
            {top3PRs.map((pr, i) => (
              <View key={pr.id}>
                {i > 0 && <SRDivider indent={20} />}
                <View style={s.prRow}>
                  <Text style={s.prName} numberOfLines={1}>{pr.exercise_name}</Text>
                  <Text style={s.prVal}>{formatWeight(Number(pr.value))} kg</Text>
                </View>
              </View>
            ))}
          </SRCard>
        )}

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: 14, paddingBottom: 100, gap: 10 },

  greetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  greetSub: { fontSize: 12, color: COLORS.ink3, marginBottom: 2 },
  greetName: { fontSize: 24, fontWeight: '900', color: COLORS.ink },
  avatar: { width: 44, height: 44, borderRadius: 99, backgroundColor: COLORS.ink, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.bg, fontSize: 20, fontWeight: '900' },

  activeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.greenLight, borderRadius: 14,
    padding: 14, borderWidth: 0.5, borderColor: COLORS.green,
  },
  activeDot: { width: 10, height: 10, borderRadius: 99, backgroundColor: COLORS.green },
  activeBannerText: { color: COLORS.green, fontWeight: '700', fontSize: 14, flex: 1 },

  readinessCard: { padding: 16 },
  readinessRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  readinessDot: { width: 8, height: 8, borderRadius: 99, marginTop: 4 },
  readinessText: { fontSize: 14, fontWeight: '600', flex: 1, lineHeight: 20 },
  streakRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 10 },
  streakVal: { fontSize: 22, fontWeight: '900', color: COLORS.ink },
  streakLab: { fontSize: 12, color: COLORS.ink3 },

  routineCard: { flexDirection: 'row', alignItems: 'center' },
  routineBody: { flex: 1, padding: 16 },
  routineLabel: { fontSize: 10, color: COLORS.ink3, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  routineName: { fontSize: 20, fontWeight: '900', color: COLORS.ink },
  routineMeta: { fontSize: 12, color: COLORS.ink3, marginTop: 3 },
  startBtn: { backgroundColor: COLORS.ink, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 18, margin: 12 },
  startBtnTxt: { color: COLORS.bg, fontWeight: '800', fontSize: 14 },

  heatmapCard: { padding: 16 },
  heatmapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  heatmapTitle: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  heatmapCount: { fontSize: 12, color: COLORS.ink3, fontWeight: '600' },
  heatmapRow: { flexDirection: 'row', justifyContent: 'space-between' },
  heatmapDay: { alignItems: 'center', gap: 4 },
  heatmapDot: { width: 32, height: 32, borderRadius: 8, backgroundColor: COLORS.surface2 },
  heatmapDotFilled: { backgroundColor: COLORS.blue },
  heatmapDotToday: { borderWidth: 1.5, borderColor: COLORS.blue },
  heatmapDotFuture: { opacity: 0.3 },
  heatmapLabel: { fontSize: 10, color: COLORS.ink3, fontWeight: '600' },

  prRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 20 },
  prName: { fontSize: 14, fontWeight: '600', color: COLORS.ink, flex: 1, marginRight: 12 },
  prVal: { fontSize: 16, fontWeight: '800', color: COLORS.green },
});
