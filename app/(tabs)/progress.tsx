import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, StatusBar, Dimensions } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import type { WorkoutSession, PersonalRecord } from '@/types';
import { formatDate, formatDuration } from '@/lib/utils';
import { COLORS } from '@/constants';
import { SRCard, SRMetric, SRPill, SRDivider, SRSectionLabel } from '@/components/ui';

const { width } = Dimensions.get('window');

export default function ProgressScreen() {
  const { user } = useUserStore();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [prs, setPRs] = useState<PersonalRecord[]>([]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .not('finished_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(30),
      supabase
        .from('personal_records')
        .select('*, exercise:exercises(name)')
        .eq('user_id', user.id)
        .order('achieved_at', { ascending: false })
        .limit(10),
    ]).then(([sessRes, prRes]) => {
      if (sessRes.data) setSessions(sessRes.data as WorkoutSession[]);
      if (prRes.data) setPRs(prRes.data as unknown as PersonalRecord[]);
    });
  }, [user]);

  const totalVolume = sessions.reduce((s, w) => s + (w.volume_total ?? 0), 0);
  const avgDuration = sessions.length
    ? Math.round(sessions.reduce((s, w) => s + (w.duration_seconds ?? 0), 0) / sessions.length)
    : 0;

  // Last 8 weeks of volume bars
  const weeklyData = Array.from({ length: 8 }, (_, i) => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7 * (7 - i) - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    const vol = sessions
      .filter(s => { const d = new Date(s.started_at); return d >= weekStart && d < weekEnd; })
      .reduce((sum, s) => sum + (s.volume_total ?? 0), 0);
    return { label: `W${i + 1}`, vol };
  });
  const maxVol = Math.max(...weeklyData.map(d => d.vol), 1);
  const currentWeek = weeklyData[weeklyData.length - 1];

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={s.header}>
          <Text style={s.pageTitle}>Progress</Text>
        </View>

        <View style={s.content}>
          {/* Summary metrics */}
          <SRCard>
            <View style={s.metricsRow}>
              <SRMetric label="Sessions" value={sessions.length} />
              <View style={{ width: 0.5, backgroundColor: COLORS.border, height: 36 }} />
              <SRMetric
                label="Total Vol"
                value={totalVolume >= 1000 ? `${Math.round(totalVolume / 1000)}k` : String(totalVolume)}
                unit=" kg"
              />
              <View style={{ width: 0.5, backgroundColor: COLORS.border, height: 36 }} />
              <SRMetric label="Avg Time" value={formatDuration(avgDuration)} />
            </View>
          </SRCard>

          {/* Weekly Volume Chart */}
          <SRCard>
            <SRSectionLabel>Weekly Volume</SRSectionLabel>
            <View style={s.chartArea}>
              {weeklyData.map((d, i) => {
                const isCurrent = i === weeklyData.length - 1;
                const barHeight = d.vol > 0 ? Math.max(6, (d.vol / maxVol) * 100) : 4;
                return (
                  <View key={i} style={s.barCol}>
                    <View style={[
                      s.bar,
                      {
                        height: barHeight,
                        backgroundColor: isCurrent ? COLORS.ink : COLORS.surface3,
                      },
                    ]} />
                    <Text style={[s.barLabel, isCurrent && { color: COLORS.ink2 }]}>{d.label}</Text>
                  </View>
                );
              })}
            </View>
            {currentWeek.vol > 0 ? (
              <View style={s.chartFooter}>
                <Text style={s.chartFooterText}>
                  This week: {currentWeek.vol >= 1000 ? `${(currentWeek.vol / 1000).toFixed(1)}k` : currentWeek.vol} kg
                </Text>
              </View>
            ) : null}
          </SRCard>

          {/* PRs */}
          <SRCard>
            <SRSectionLabel>Personal Records 🏆</SRSectionLabel>
            {prs.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyText}>Complete workouts to set PRs</Text>
              </View>
            ) : (
              prs.map((pr, i) => (
                <View key={pr.id}>
                  {i > 0 && <SRDivider indent={20} />}
                  <View style={s.prRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.prName}>{pr.exercise_name}</Text>
                      <Text style={s.prDate}>{formatDate(pr.achieved_at)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.prWeight}>{pr.value} kg</Text>
                      <Text style={s.prType}>{pr.record_type?.toUpperCase()}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </SRCard>

          {/* Workout History */}
          <SRCard>
            <SRSectionLabel>Workout History</SRSectionLabel>
            {sessions.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyText}>No sessions yet</Text>
              </View>
            ) : (
              sessions.slice(0, 10).map((session, i) => (
                <View key={session.id}>
                  {i > 0 && <SRDivider indent={20} />}
                  <View style={s.sessionRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.sessionName}>{session.routine_name ?? 'Quick Workout'}</Text>
                      <Text style={s.sessionMeta}>
                        {formatDate(session.started_at)} · {formatDuration(session.duration_seconds ?? 0)}
                      </Text>
                    </View>
                    <Text style={s.sessionVol}>
                      {(session.volume_total ?? 0) >= 1000
                        ? `${((session.volume_total ?? 0) / 1000).toFixed(1)}k`
                        : String(session.volume_total ?? 0)} kg
                    </Text>
                  </View>
                </View>
              ))
            )}
          </SRCard>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: COLORS.ink },
  content: { paddingHorizontal: 14, gap: 10 },
  metricsRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    alignItems: 'center', paddingVertical: 20,
  },
  chartArea: {
    flexDirection: 'row', alignItems: 'flex-end',
    height: 120, paddingHorizontal: 16, paddingBottom: 4, gap: 4,
  },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { width: '100%', borderRadius: 4 },
  barLabel: { fontSize: 9, color: COLORS.ink3, fontWeight: '600' },
  chartFooter: { paddingHorizontal: 20, paddingBottom: 14 },
  chartFooterText: { fontSize: 12, color: COLORS.ink3 },
  empty: { padding: 20, alignItems: 'center' },
  emptyText: { color: COLORS.ink3, fontSize: 14 },
  prRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 20,
  },
  prName: { fontSize: 14, fontWeight: '600', color: COLORS.ink },
  prDate: { fontSize: 11, color: COLORS.ink3, marginTop: 1 },
  prWeight: { fontSize: 17, fontWeight: '800', color: COLORS.green },
  prType: { fontSize: 10, color: COLORS.ink3 },
  sessionRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 11, paddingHorizontal: 20,
  },
  sessionName: { fontSize: 14, fontWeight: '600', color: COLORS.ink },
  sessionMeta: { fontSize: 11, color: COLORS.ink3, marginTop: 1 },
  sessionVol: { fontSize: 14, fontWeight: '700', color: COLORS.ink2 },
});
