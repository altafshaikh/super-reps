import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StatusBar, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import type { PersonalRecord, WorkoutSession, Routine, Exercise, WorkoutExerciseInput } from '@/types';
import { derivePersonalBestsFromFlatRows, fetchAllSetsForPersonalBests } from '@/lib/personal-bests';
import { getReadinessMessage, type ReadinessContext } from '@/lib/ai';
import { formatWeight } from '@/lib/utils';
import { COLORS } from '@/constants';
import { Ionicons } from '@expo/vector-icons';
import { SRCard, SRDivider, SRSectionLabel } from '@/components/ui';

function formatMuscle(m: string): string {
  return m.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function greeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 18) return 'Good afternoon';
  return 'Good evening';
}

function localDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function calcWeekSessions(sessions: WorkoutSession[]): number {
  const today = new Date();
  const dow = today.getDay();
  const daysToMon = dow === 0 ? 6 : dow - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysToMon);
  monday.setHours(0, 0, 0, 0);
  const dates = new Set(
    sessions
      .filter(s => new Date(s.started_at) >= monday)
      .map(s => s.started_at.slice(0, 10))
  );
  return dates.size;
}

const TONE_COLOR: Record<string, string> = {
  green: COLORS.green,
  amber: COLORS.amber,
  blue: COLORS.blue,
  muted: COLORS.ink3,
};

const WEEKDAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// ── 7-day mini heatmap ───────────────────────────────────────

function WeekHeatmap({ sessions }: { sessions: WorkoutSession[] }) {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysToMonday);
  monday.setHours(0, 0, 0, 0);

  const sessionDates = new Set(sessions.map(s => localDate(new Date(s.started_at))));
  const trainedCount = [...Array(7)].filter((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return sessionDates.has(localDate(d));
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
          const trained = sessionDates.has(localDate(d));
          const isToday = d.toDateString() === today.toDateString();
          const isFuture = d > today;
          return (
            <View key={i} style={s.heatmapDay}>
              <View style={[
                s.heatmapDot,
                trained && !isToday && s.heatmapDotFilled,
                isToday && trained && s.heatmapDotTodayDone,
                isToday && !trained && s.heatmapDotToday,
                isFuture && s.heatmapDotFuture,
              ]}>
                {isToday && trained && (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                )}
              </View>
              <Text style={[s.heatmapLabel, isToday && { color: COLORS.green, fontWeight: '700' }]}>
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

function parseRepRange(range: string | undefined | null): number {
  if (!range) return 0;
  const match = range.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

// REST_DAY_MESSAGES shown when no routine is scheduled today
const REST_DAY_MESSAGES = [
  "Today's a rest day — your muscles grow while you recover. 💤",
  "Rest day. Prioritize sleep, walk, and hydrate. Recovery is the work. 🌊",
  "Active recovery day — light movement, stretching, and good nutrition go a long way. 🧘",
  "Your body is rebuilding right now. Trust the process and rest well. ✨",
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUserStore();
  const { isActive, startWorkout } = useWorkoutStore();

  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [personalBests, setPersonalBests] = useState<PersonalRecord[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [todayRoutineId, setTodayRoutineId]   = useState<string | null>(null);
  const [allSchedule, setAllSchedule]         = useState<{ weekday: number; routine_id: string }[]>([]);
  const [hasSchedule, setHasSchedule]         = useState(false);
  const [loading, setLoading] = useState(true);
  const [readiness, setReadiness] = useState<{ label: string; color: string }>({
    label: '',
    color: COLORS.green,
  });
  const [readinessLoading, setReadinessLoading] = useState(true);
  const readinessCacheKey = useRef<string>('');

  const fetchDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const todayWd = new Date().getDay();
    const [sessionsRes, prFlat, routinesRes, scheduleRes] = await Promise.all([
      supabase
        .from('workout_sessions')
        .select('id, started_at, volume_total, duration_seconds, routine_name, finished_at, calories_burned')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .not('finished_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(500),
      fetchAllSetsForPersonalBests(supabase, user.id),
      supabase
        .from('routines')
        .select(`id, name, days:routine_days(id, name, day_index, exercises:routine_exercises(*, exercise:exercises(*)))`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('weekly_schedule')
        .select('weekday, routine_id')
        .eq('user_id', user.id),
    ]);

    if (sessionsRes.data) setSessions(sessionsRes.data as WorkoutSession[]);
    const { bests } = derivePersonalBestsFromFlatRows(prFlat);
    setPersonalBests(bests);
    if (routinesRes.data) setRoutines(routinesRes.data as unknown as Routine[]);

    const sched = (scheduleRes.data ?? []) as { weekday: number; routine_id: string }[];
    setAllSchedule(sched);
    setTodayRoutineId(sched.find(e => e.weekday === todayWd)?.routine_id ?? null);
    setHasSchedule(sched.length > 0);
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { void fetchDashboard(); }, [fetchDashboard]));

  const userName = user?.name ?? user?.username ?? user?.email?.split('@')[0] ?? 'Lifter';
  const initial = userName[0]?.toUpperCase() ?? 'U';
  const streak = useMemo(() => calcWeekSessions(sessions), [sessions]);
  const top3PRs = useMemo(() => personalBests.slice(0, 3), [personalBests]);

  // Build readiness context and call LLM once per unique sessions+routines combination
  useEffect(() => {
    if (loading) return;

    // No data at all — show a default immediately
    if (!sessions.length && !routines.length) {
      setReadiness({ label: "Fresh start — log your first workout today!", color: COLORS.green });
      setReadinessLoading(false);
      return;
    }

    const cacheKey = `${sessions.length}-${routines.length}-${sessions[0]?.started_at ?? ''}`;
    if (cacheKey === readinessCacheKey.current) return;
    readinessCacheKey.current = cacheKey;

    // Show instant fallback while LLM loads
    const last = sessions[0];
    const daysSince = last
      ? Math.floor((Date.now() - new Date(last.started_at).getTime()) / 86400000)
      : 99;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekFreq = sessions.filter(s => new Date(s.started_at).getTime() > weekAgo).length;
    const instantLabel =
      daysSince === 0 ? weekFreq >= 4 ? "Solid week — you trained today, keep it up!"
        : weekFreq >= 2 ? "You trained today — building momentum this week."
        : "You trained today — aim for more sessions this week."
      : daysSince === 1 ? "Trained yesterday — ready to go again today."
      : daysSince <= 3 ? `${daysSince} days rest — recovered and ready to push.`
      : "Time to get back in — let's pick up where you left off.";
    const instantColor = daysSince === 0 ? COLORS.green : daysSince <= 1 ? COLORS.amber : COLORS.blue;
    setReadiness({ label: instantLabel, color: instantColor });
    setReadinessLoading(false);

    const today = new Date();
    const todayStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    // Monday of this week
    const dow = today.getDay();
    const daysToMon = dow === 0 ? 6 : dow - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysToMon);
    monday.setHours(0, 0, 0, 0);

    // Days from Monday through today (YYYY-MM-DD)
    const weekRange: string[] = [];
    for (let i = 0; i <= daysToMon; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekRange.push(localDate(d));
    }

    const weekDaysTrained = [...new Set(
      sessions
        .filter(s => weekRange.includes(localDate(new Date(s.started_at))))
        .map(s => localDate(new Date(s.started_at)))
    )];

    // Scheduled days across all routines
    const allScheduledDays: ReadinessContext['scheduledDays'] = [];
    const seenWeekdays = new Set<number>();
    for (const routine of routines) {
      for (const day of (routine.days ?? [])) {
        const wd = day.weekday;
        if (wd == null || seenWeekdays.has(wd)) continue;
        seenWeekdays.add(wd);
        const mgs = (day.exercises ?? []).flatMap(re =>
          (re.exercise?.muscle_groups ?? []).map(m => formatMuscle(m))
        );
        allScheduledDays.push({
          weekdayName: WEEKDAY_NAMES[wd],
          dayName: day.name,
          muscleGroups: [...new Set(mgs)],
        });
      }
    }

    // Which dates in weekRange had a scheduled workout
    const weekDaysScheduled = weekRange.filter(dateStr => {
      const wdName = WEEKDAY_NAMES[new Date(dateStr).getDay()];
      return allScheduledDays.some(d => d.weekdayName === wdName);
    });

    const ctx: ReadinessContext = {
      todayLabel: todayStr,
      sessions: sessions.slice(0, 14).map(s => ({
        date: s.started_at.slice(0, 10),
        routineName: s.routine_name,
        volume: s.volume_total ?? 0,
        durationMinutes: Math.round((s.duration_seconds ?? 0) / 60),
      })),
      scheduledDays: allScheduledDays,
      weekDaysTrained,
      weekDaysScheduled,
    };

    // Silently upgrade to LLM message — skip if trained today (instant label is already correct)
    if (daysSince === 0) return;
    getReadinessMessage(ctx)
      .then(res => setReadiness({ label: res.label, color: TONE_COLOR[res.color] ?? COLORS.blue }))
      .catch(() => { /* keep the instant fallback */ });
  }, [loading, sessions, routines]);

  // Resolve today's routine from weekly_schedule
  const currentRoutine = useMemo(() => {
    if (todayRoutineId) return routines.find(r => r.id === todayRoutineId) ?? null;
    return null;
  }, [todayRoutineId, routines]);

  const todaySession = useMemo(() =>
    sessions.find(s => localDate(new Date(s.started_at)) === localDate(new Date())) ?? null,
  [sessions]);
  const trainedToday = todaySession !== null;
  const [todaySetsCount, setTodaySetsCount] = useState<number>(0);

  useEffect(() => {
    if (!todaySession) return;
    supabase
      .from('workout_sets')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', todaySession.id)
      .then(({ count }) => setTodaySetsCount(count ?? 0));
  }, [todaySession?.id]);
  // Only show REST DAY if: user has a schedule configured, today is not a training day, and hasn't trained today
  const isRestDay = !loading && hasSchedule && todayRoutineId === null && !trainedToday;

  // Next scheduled workout after today
  const nextScheduled = useMemo(() => {
    if (!hasSchedule) return null;
    const todayWd = new Date().getDay();
    for (let i = 1; i <= 7; i++) {
      const wd = (todayWd + i) % 7;
      const entry = allSchedule.find(e => e.weekday === wd);
      if (entry) {
        const routine = routines.find(r => r.id === entry.routine_id) ?? null;
        return routine ? { weekday: wd, routine } : null;
      }
    }
    return null;
  }, [allSchedule, routines]);
  const routineDay = useMemo(() => currentRoutine?.days?.find(d => (d.exercises?.length ?? 0) > 0) ?? null, [currentRoutine]);
  const dayExercises = routineDay?.exercises ?? [];
  const previewExercises = dayExercises.slice(0, 3);
  const extraCount = Math.max(0, dayExercises.length - 3);

  const muscleTags = useMemo(() => {
    const groups = new Set<string>();
    dayExercises.forEach(re => re.exercise?.muscle_groups?.forEach(mg => groups.add(mg)));
    return Array.from(groups).slice(0, 4);
  }, [routineDay]);

  const estimatedMinutes = useMemo(() => {
    if (!dayExercises.length) return 0;
    const totalSets = dayExercises.reduce((n, re) => n + (re.sets ?? 0), 0);
    const avgRest = dayExercises.reduce((sum, re) => sum + (re.rest_seconds ?? 90), 0) / dayExercises.length;
    return Math.round(totalSets * (avgRest + 30) / 60);
  }, [routineDay]);

  const restDayMessage = useMemo(() => REST_DAY_MESSAGES[new Date().getDay() % REST_DAY_MESSAGES.length], []);

  const handleStartRoutine = () => {
    if (!currentRoutine || !routineDay) {
      startWorkout();
      router.push('/workout/active');
      return;
    }
    const inputs: WorkoutExerciseInput[] = (routineDay.exercises ?? [])
      .filter(re => re.exercise)
      .map(re => ({
        exercise: re.exercise as Exercise,
        setsCount: re.sets ?? 3,
        defaultReps: parseRepRange(re.rep_range),
        restSeconds: re.rest_seconds ?? 90,
      }));
    startWorkout(currentRoutine.id, currentRoutine.name, inputs);
    router.push('/workout/active');
  };

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

        {/* AI Coach card */}
        <SRCard style={s.coachCard}>
          <View style={s.coachTopRow}>
            {/* Avatar */}
            <View style={[s.coachAvatar, { borderColor: COLORS.green }]}>
              <Ionicons name="barbell-outline" size={18} color={COLORS.green} />
            </View>

            {/* Coach label */}
            <View style={s.coachLabelCol}>
              <Text style={s.coachLabel}>MESSAGE FROM COACH</Text>
            </View>

            {/* Week sessions badge */}
            <View style={s.streakBadge}>
              <Text style={s.streakVal}>{streak > 0 ? `${streak} 🔥` : '0'}</Text>
              <Text style={s.streakLab}>this week</Text>
            </View>
          </View>

          {/* Speech bubble */}
          <View style={[s.speechBubble, { borderLeftColor: readiness.color, backgroundColor: readiness.color + '18' }]}>
            {readinessLoading ? (
              <View style={s.typingRow}>
                <ActivityIndicator size="small" color={COLORS.ink3} />
                <Text style={s.typingText}>Analysing your week…</Text>
              </View>
            ) : (
              <Text style={s.coachMessage}>{readiness.label}</Text>
            )}
          </View>
        </SRCard>

        {/* Rest day card */}
        {!isActive && isRestDay && (
          <SRCard style={s.restDayCard}>
            <Text style={s.restDayLabel}>REST DAY</Text>
            <Text style={s.restDayTitle}>Recovery is progress</Text>
            <Text style={s.restDayMsg}>{restDayMessage}</Text>
          </SRCard>
        )}

        {/* Routine / start card */}
        {/* Completed workout card */}
        {!isActive && trainedToday && todaySession && (
          <SRCard style={s.doneCard}>
            <View style={s.doneHeader}>
              <View style={s.doneBadge}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.doneLabel}>WORKOUT COMPLETE</Text>
                <Text style={s.doneName} numberOfLines={1}>
                  {todaySession.routine_name ?? 'Free Workout'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/(tabs)/workouts')}>
                <Text style={s.doneSeeAll}>Details →</Text>
              </TouchableOpacity>
            </View>

            <View style={s.doneStats}>
              <View style={s.doneStat}>
                <Ionicons name="time-outline" size={18} color={COLORS.green} />
                <Text style={s.doneStatVal}>
                  {todaySession.duration_seconds
                    ? `${Math.round(todaySession.duration_seconds / 60)} min`
                    : '–'}
                </Text>
                <Text style={s.doneStatLab}>Duration</Text>
              </View>
              <View style={s.doneStatDivider} />
              <View style={s.doneStat}>
                <Ionicons name="barbell-outline" size={18} color={COLORS.green} />
                <Text style={s.doneStatVal}>
                  {todaySession.volume_total
                    ? `${Number(todaySession.volume_total).toLocaleString()} kg`
                    : '–'}
                </Text>
                <Text style={s.doneStatLab}>Volume</Text>
              </View>
              <View style={s.doneStatDivider} />
              <View style={s.doneStat}>
                <Ionicons name="layers-outline" size={18} color={COLORS.green} />
                <Text style={s.doneStatVal}>{todaySetsCount}</Text>
                <Text style={s.doneStatLab}>Total sets</Text>
              </View>
              {(todaySession.calories_burned ?? 0) > 0 && (
                <>
                  <View style={s.doneStatDivider} />
                  <View style={s.doneStat}>
                    <Ionicons name="flame-outline" size={18} color={COLORS.green} />
                    <Text style={s.doneStatVal}>~{todaySession.calories_burned}</Text>
                    <Text style={s.doneStatLab}>kcal</Text>
                  </View>
                </>
              )}
            </View>
          </SRCard>
        )}

        {!isActive && !isRestDay && !trainedToday && (
          <SRCard style={s.routineCard}>
            <View style={s.routineHeader}>
              <Text style={s.routineLabel}>
                {currentRoutine ? "TODAY'S PLAN" : 'START TRAINING'}
              </Text>
              {estimatedMinutes > 0 && (
                <View style={s.durationBadge}>
                  <Text style={s.durationText}>~{estimatedMinutes} min</Text>
                </View>
              )}
            </View>

            <Text style={s.routineName} numberOfLines={1}>
              {currentRoutine ? `${currentRoutine.name}${routineDay?.name ? ` · ${routineDay.name}` : ''}` : 'Empty Workout'}
            </Text>

            {muscleTags.length > 0 && (
              <View style={s.tagRow}>
                {muscleTags.map(tag => (
                  <View key={tag} style={s.tag}>
                    <Text style={s.tagText}>{formatMuscle(tag)}</Text>
                  </View>
                ))}
              </View>
            )}

            {dayExercises.length > 0 && (
              <View style={s.exerciseList}>
                {previewExercises.map(re => (
                  <View key={re.id} style={s.exerciseRow}>
                    <Text style={s.exerciseName} numberOfLines={1}>{re.exercise?.name}</Text>
                    <Text style={s.exerciseSets}>{re.sets}×{re.rep_range}</Text>
                  </View>
                ))}
                {extraCount > 0 && (
                  <Text style={s.moreExercises}>+{extraCount} more exercise{extraCount > 1 ? 's' : ''}</Text>
                )}
              </View>
            )}

            <TouchableOpacity style={s.startBtn} onPress={handleStartRoutine} activeOpacity={0.85}>
              <Text style={s.startBtnTxt}>
                {currentRoutine ? `Start ${routineDay?.name ?? currentRoutine.name} →` : 'Start Workout →'}
              </Text>
            </TouchableOpacity>
          </SRCard>
        )}

        {/* Next scheduled workout — shown when trained today OR on any rest day */}
        {!isActive && (trainedToday || (hasSchedule && todayRoutineId === null)) && nextScheduled && (() => {
          const { weekday, routine } = nextScheduled;
          const day = routine.days?.find(d => (d.exercises?.length ?? 0) > 0);
          const exercises = day?.exercises ?? [];
          const preview = exercises.slice(0, 3);
          const extra = Math.max(0, exercises.length - 3);
          const muscles = (() => {
            const s = new Set<string>();
            exercises.forEach(re => re.exercise?.muscle_groups?.forEach(mg => s.add(formatMuscle(mg))));
            return [...s].slice(0, 4);
          })();
          const daysAway = (() => {
            const todayWd = new Date().getDay();
            let diff = weekday - todayWd;
            if (diff <= 0) diff += 7;
            return diff;
          })();
          const dayLabel = daysAway === 1 ? 'Tomorrow' : WEEKDAY_NAMES[weekday];

          return (
            <SRCard style={s.nextCard}>
              <View style={s.nextHeader}>
                <View>
                  <Text style={s.nextLabel}>NEXT WORKOUT</Text>
                  <Text style={s.nextDay}>{dayLabel}</Text>
                </View>
                <TouchableOpacity onPress={() => router.push(`/routines/${routine.id}`)}>
                  <Text style={s.nextSeeAll}>View →</Text>
                </TouchableOpacity>
              </View>

              <Text style={s.nextRoutineName} numberOfLines={1}>{routine.name}</Text>

              {muscles.length > 0 && (
                <View style={s.tagRow}>
                  {muscles.map(tag => (
                    <View key={tag} style={s.tag}><Text style={s.tagText}>{tag}</Text></View>
                  ))}
                </View>
              )}

              {exercises.length > 0 && (
                <View style={s.exerciseList}>
                  {preview.map(re => (
                    <View key={re.id} style={s.exerciseRow}>
                      <Text style={s.exerciseName} numberOfLines={1}>{re.exercise?.name}</Text>
                      <Text style={s.exerciseSets}>
                        {((re as any).sets_config?.rows?.length ?? re.sets ?? 1)}×{re.rep_range ?? '–'}
                      </Text>
                    </View>
                  ))}
                  {extra > 0 && (
                    <Text style={s.moreExercises}>+{extra} more exercise{extra > 1 ? 's' : ''}</Text>
                  )}
                </View>
              )}
            </SRCard>
          );
        })()}

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
                  <View style={s.prIconWrap}>
                    <Ionicons name="barbell-outline" size={14} color={COLORS.blue} />
                  </View>
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

  // Coach card
  coachCard: { padding: 16, gap: 12 },
  coachTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  coachAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.surface2,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  coachLabelCol: { flex: 1, gap: 2 },
  coachLabel: { fontSize: 10, fontWeight: '700', color: COLORS.ink3, letterSpacing: 1 },
  coachOnlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  coachOnlineDot: { width: 6, height: 6, borderRadius: 3 },
  coachOnlineText: { fontSize: 11, fontWeight: '600' },
  streakBadge: { alignItems: 'flex-end' },
  streakVal: { fontSize: 20, fontWeight: '900', color: COLORS.ink },
  streakLab: { fontSize: 11, color: COLORS.ink3 },
  speechBubble: {
    backgroundColor: COLORS.surface2,
    borderRadius: 12,
    borderLeftWidth: 3,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  coachMessage: { fontSize: 14, fontWeight: '500', color: COLORS.ink, lineHeight: 22 },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText: { fontSize: 13, color: COLORS.ink3, fontStyle: 'italic' },

  // Completed workout card
  doneCard:        { padding: 16, gap: 14, borderColor: `${COLORS.green}30`, borderWidth: 1 },
  doneHeader:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  doneBadge:       {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center',
  },
  doneLabel:       { fontSize: 10, fontWeight: '800', color: COLORS.green, letterSpacing: 1 },
  doneName:        { fontSize: 17, fontWeight: '800', color: COLORS.ink, marginTop: 1 },
  doneSeeAll:      { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  doneStats:       {
    flexDirection: 'row', backgroundColor: COLORS.surface2,
    borderRadius: 12, paddingVertical: 16,
  },
  doneStat:        { flex: 1, alignItems: 'center', gap: 4 },
  doneStatVal:     { fontSize: 16, fontWeight: '800', color: COLORS.ink },
  doneStatLab:     { fontSize: 11, color: COLORS.ink3, fontWeight: '600' },
  doneStatDivider: { width: StyleSheet.hairlineWidth, backgroundColor: COLORS.surface3 },

  restDayCard: { padding: 20, gap: 8, borderColor: `${COLORS.amber}30`, borderWidth: 1 },
  restDayLabel: { fontSize: 10, color: COLORS.amber, fontWeight: '800', letterSpacing: 1 },
  restDayTitle: { fontSize: 22, fontWeight: '900', color: COLORS.ink },
  restDayMsg: { fontSize: 14, color: COLORS.ink2, lineHeight: 20 },

  routineCard: { padding: 16, gap: 10 },
  routineHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  routineLabel: { fontSize: 10, color: COLORS.ink3, fontWeight: '800', letterSpacing: 1 },
  durationBadge: { backgroundColor: COLORS.surface2, borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10 },
  durationText: { fontSize: 12, color: COLORS.ink, fontWeight: '700' },
  routineName: { fontSize: 26, fontWeight: '900', color: COLORS.ink },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: COLORS.surface2, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 10 },
  tagText: { fontSize: 12, color: COLORS.ink3, fontWeight: '600' },
  exerciseList: { backgroundColor: COLORS.surface2, borderRadius: 12, paddingVertical: 4 },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 14 },
  exerciseName: { fontSize: 14, fontWeight: '600', color: COLORS.ink, flex: 1, marginRight: 12 },
  exerciseSets: { fontSize: 13, fontWeight: '700', color: COLORS.ink3 },
  moreExercises: { textAlign: 'center', fontSize: 12, color: COLORS.ink3, fontWeight: '600', paddingVertical: 8 },
  startBtn: { backgroundColor: COLORS.ink, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  startBtnTxt: { color: COLORS.bg, fontWeight: '800', fontSize: 16 },

  // Next workout card
  nextCard:        { padding: 16, gap: 10, borderColor: `${COLORS.primary}25`, borderWidth: 1 },
  nextHeader:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  nextLabel:       { fontSize: 10, fontWeight: '800', color: COLORS.primary, letterSpacing: 1 },
  nextDay:         { fontSize: 20, fontWeight: '900', color: COLORS.ink, marginTop: 2 },
  nextSeeAll:      { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  nextRoutineName: { fontSize: 15, fontWeight: '700', color: COLORS.ink2 },

  heatmapCard: { padding: 16 },
  heatmapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  heatmapTitle: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  heatmapCount: { fontSize: 12, color: COLORS.ink3, fontWeight: '600' },
  heatmapRow: { flexDirection: 'row', justifyContent: 'space-between' },
  heatmapDay: { alignItems: 'center', gap: 4 },
  heatmapDot: { width: 32, height: 32, borderRadius: 8, backgroundColor: COLORS.surface2, alignItems: 'center', justifyContent: 'center' },
  heatmapDotFilled: { backgroundColor: COLORS.blue },
  heatmapDotTodayDone: { backgroundColor: COLORS.green },
  heatmapDotToday: { backgroundColor: COLORS.green },
  heatmapDotFuture: { opacity: 0.3 },
  heatmapLabel: { fontSize: 10, color: COLORS.ink3, fontWeight: '600' },

  prRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 16 },
  prIconWrap: { width: 30, height: 30, borderRadius: 8, backgroundColor: `${COLORS.blue}18`, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  prName: { fontSize: 14, fontWeight: '600', color: COLORS.ink, flex: 1, marginRight: 12 },
  prVal: { fontSize: 16, fontWeight: '800', color: COLORS.green },
});
