import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StatusBar, StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import type { PersonalRecord, WorkoutSession } from '@/types';
import { derivePersonalBestsFromFlatRows, fetchAllSetsForPersonalBests } from '@/lib/personal-bests';
import { formatDuration, timeAgo, formatWeight } from '@/lib/utils';
import { COLORS } from '@/constants';
import { SRCard, SRMetric, SRPill, SRDivider, SRSectionLabel } from '@/components/ui';

const DASHBOARD_SESSION_LIMIT = 500;

function sessionRepsFromSets(s: WorkoutSession & { sets?: { reps: number }[] }): number {
  const sets = s.sets;
  if (!sets?.length) return 0;
  return sets.reduce((a, row) => a + Number(row.reps ?? 0), 0);
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useUserStore();
  const { isActive } = useWorkoutStore();
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [streak, setStreak] = useState(0);
  const [weeklyVol, setWeeklyVol] = useState(0);
  const [personalBests, setPersonalBests] = useState<PersonalRecord[]>([]);

  const fetchDashboard = useCallback(async () => {
    if (!user) return;
    const [sessionsRes, prFlat] = await Promise.all([
      supabase
        .from('workout_sessions')
        .select('*, sets:workout_sets(reps)')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .not('finished_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(DASHBOARD_SESSION_LIMIT),
      fetchAllSetsForPersonalBests(supabase, user.id),
    ]);

    const { data } = sessionsRes;
    if (data) {
      setRecentSessions(data as WorkoutSession[]);
      setStreak(calcStreak(data as WorkoutSession[]));
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const weekVol = (data as WorkoutSession[])
        .filter(s => new Date(s.started_at).getTime() > weekAgo)
        .reduce((sum, s) => sum + (s.volume_total ?? 0), 0);
      setWeeklyVol(weekVol);
    }
    const { bests } = derivePersonalBestsFromFlatRows(prFlat);
    setPersonalBests(bests);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void fetchDashboard();
    }, [fetchDashboard]),
  );

  const calcStreak = (sessions: WorkoutSession[]): number => {
    if (!sessions.length) return 0;
    let s = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 30; i++) {
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
  };

  const thisWeekSessions = recentSessions.filter(s => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return new Date(s.started_at).getTime() > weekAgo;
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const userName = user?.name ?? user?.username ?? user?.email?.split('@')[0] ?? 'Lifter';
  const initial = userName[0]?.toUpperCase() ?? 'U';

  const totalVolStr = weeklyVol >= 1000
    ? `${(weeklyVol / 1000).toFixed(1)}k`
    : String(weeklyVol);

  const topPersonalBests = useMemo(
    () => personalBests.slice(0, 5),
    [personalBests],
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header card */}
        <SRCard style={s.headerCard}>
          {/* Greeting row */}
          <View style={s.greetRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.greetDate}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
              <Text style={s.greetName}>{greeting},{'\n'}{userName}</Text>
            </View>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initial}</Text>
            </View>
          </View>

          {/* Metrics row */}
          <View style={s.metricsRow}>
            <SRMetric label="Day Streak 🔥" value={streak} />
            <View style={{ width: 0.5, backgroundColor: COLORS.border, height: 36 }} />
            <SRMetric label="This Week" value={thisWeekSessions.length} unit=" sess" />
            <View style={{ width: 0.5, backgroundColor: COLORS.border, height: 36 }} />
            <SRMetric label="Total Vol" value={totalVolStr} unit=" kg" />
          </View>
        </SRCard>

        <View style={s.content}>
          {/* Goal / level pills */}
          {user?.goal || user?.level ? (
            <View style={s.pillRow}>
              {user?.goal ? <SRPill label={`Goal: ${user.goal}`} muted size="xs" style={{ marginRight: 6 }} /> : null}
              {user?.level ? <SRPill label={user.level} muted size="xs" /> : null}
            </View>
          ) : null}

          {/* Active workout banner */}
          {isActive ? (
            <TouchableOpacity onPress={() => router.push('/workout/active')} style={s.activeBanner}>
              <View style={s.activeDot} />
              <Text style={s.activeBannerText}>Workout in progress — tap to continue</Text>
            </TouchableOpacity>
          ) : (
            <SRCard style={s.startCard}>
              <View style={s.startInner}>
                <View>
                  <Text style={s.startLabel}>Ready to train?</Text>
                  <Text style={s.startTitle}>Start Workout</Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/workouts')}
                  style={s.startBtn}
                  activeOpacity={0.85}
                >
                  <Text style={s.startBtnText}>Start →</Text>
                </TouchableOpacity>
              </View>
            </SRCard>
          )}

          {/* Personal records — derived from all logged sets (CSV import includes sets, not PR rows) */}
          {topPersonalBests.length > 0 ? (
            <SRCard>
              <SRSectionLabel action="Profile" onAction={() => router.push('/(tabs)/profile')}>
                Personal records
              </SRSectionLabel>
              {topPersonalBests.map((pr, i) => (
                <View key={pr.id}>
                  {i > 0 && <SRDivider indent={20} />}
                  <View style={s.prRow}>
                    <Text style={s.prName} numberOfLines={1}>
                      {pr.exercise_name}
                    </Text>
                    <Text style={s.prVal}>{formatWeight(Number(pr.value))} kg</Text>
                  </View>
                </View>
              ))}
            </SRCard>
          ) : null}

          {/* Recent Workouts */}
          <SRCard>
            <SRSectionLabel>Recent Workouts</SRSectionLabel>
            {recentSessions.length === 0 ? (
              <View style={s.emptyState}>
                <Text style={s.emptyText}>No workouts yet — start one above</Text>
              </View>
            ) : (
              recentSessions.slice(0, 5).map((session, i) => {
                const reps = sessionRepsFromSets(session as WorkoutSession & { sets?: { reps: number }[] });
                return (
                <View key={session.id}>
                  {i > 0 && <SRDivider indent={20} />}
                  <View style={s.sessionRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.sessionName}>{session.routine_name ?? 'Quick Workout'}</Text>
                      <Text style={s.sessionMeta}>
                        {timeAgo(session.started_at)} · {formatDuration(session.duration_seconds ?? 0)}
                        {reps > 0 ? ` · ${reps} reps` : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.sessionVol}>
                        {(session.volume_total ?? 0) >= 1000
                          ? `${((session.volume_total ?? 0) / 1000).toFixed(1)}k`
                          : String(session.volume_total ?? 0)} kg
                      </Text>
                      <Text style={s.sessionVolLabel}>volume</Text>
                    </View>
                  </View>
                </View>
                );
              })
            )}
          </SRCard>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  headerCard: {
    margin: 14,
    marginTop: 56,
    borderRadius: 20,
  },
  greetRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 14,
  },
  greetDate: { fontSize: 11, color: COLORS.ink3, fontWeight: '500', marginBottom: 3 },
  greetName: { fontSize: 22, fontWeight: '700', color: COLORS.ink, lineHeight: 28 },
  avatar: {
    width: 44, height: 44, borderRadius: 99,
    backgroundColor: COLORS.ink,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: COLORS.bg, fontSize: 20, fontWeight: '900' },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
  },
  content: { paddingHorizontal: 14, gap: 10 },
  pillRow: { flexDirection: 'row', marginBottom: 2 },
  activeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.greenLight, borderRadius: 14,
    padding: 14, borderWidth: 0.5, borderColor: COLORS.green,
  },
  activeDot: { width: 10, height: 10, borderRadius: 99, backgroundColor: COLORS.green },
  activeBannerText: { color: COLORS.green, fontWeight: '700', fontSize: 14, flex: 1 },
  startCard: { padding: 0 },
  startInner: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 18,
  },
  startLabel: { fontSize: 11, color: COLORS.ink3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 },
  startTitle: { fontSize: 24, fontWeight: '900', color: COLORS.ink },
  startBtn: {
    backgroundColor: COLORS.ink, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 20,
  },
  startBtnText: { color: COLORS.bg, fontWeight: '700', fontSize: 15 },
  emptyState: { padding: 20, alignItems: 'center' },
  emptyText: { color: COLORS.ink3, fontSize: 14 },
  sessionRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 11, paddingHorizontal: 20,
  },
  sessionName: { fontSize: 14, fontWeight: '600', color: COLORS.ink },
  sessionMeta: { fontSize: 11, color: COLORS.ink3, marginTop: 1 },
  sessionVol: { fontSize: 17, fontWeight: '800', color: COLORS.ink },
  sessionVolLabel: { fontSize: 10, color: COLORS.ink3 },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  prName: { fontSize: 14, fontWeight: '600', color: COLORS.ink, flex: 1, marginRight: 12 },
  prVal: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
});
