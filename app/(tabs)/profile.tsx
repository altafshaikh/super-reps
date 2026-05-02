import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Image,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  StatusBar,
  Platform,
  Modal,
  Share,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import { COLORS } from '@/constants';
import type { WorkoutSession, SetLog, PersonalRecord } from '@/types';
import { SRCard, SRDivider, SRSectionLabel, SRPill, BarChart, LineChart, ExerciseDetailSheet } from '@/components/ui';
import { formatWeight, timeAgo } from '@/lib/utils';
import { derivePersonalBestsFromFlatRows, fetchAllSetsForPersonalBests } from '@/lib/personal-bests';
import { getWeeklyReview } from '@/lib/ai';

type SetRow = SetLog & { exercise?: { name: string } | null };
type SessionRow = WorkoutSession & { sets?: SetRow[] };
type ProfileTab = 'workouts' | 'statistics' | 'measures' | 'exercises' | 'calendar';

const PROFILE_TABS: { id: ProfileTab; label: string }[] = [
  { id: 'workouts',   label: 'Workouts'   },
  { id: 'statistics', label: 'Statistics' },
  { id: 'measures',   label: 'Measures'   },
  { id: 'exercises',  label: 'Exercises'  },
  { id: 'calendar',   label: 'Calendar'   },
];

function formatLongDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatDurationCompact(sec: number | null | undefined) {
  if (sec == null || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}min`;
  }
  return `${m}min`;
}

function groupExercises(sets: SetRow[] | undefined) {
  if (!sets?.length) return [];
  const by = new Map<string, { name: string; setCount: number }>();
  for (const st of sets) {
    const name = st.exercise?.name ?? 'Exercise';
    const cur = by.get(st.exercise_id) ?? { name, setCount: 0 };
    cur.setCount += 1;
    by.set(st.exercise_id, cur);
  }
  return [...by.values()];
}

function sessionTotalReps(sets: SetRow[] | undefined): number {
  if (!sets?.length) return 0;
  return sets.reduce((a, st) => a + Number(st.reps ?? 0), 0);
}

// ── Statistics Tab ────────────────────────────────────────────

type StatPeriod = '1M' | '3M' | 'All';

interface StatSession {
  id: string;
  started_at: string;
  duration_seconds: number | null;
  volume_total: number;
  routine_name: string | null;
}
interface StatSet {
  exercise_id: string;
  weight_kg: number;
  reps: number;
  completed_at: string;
  exercise?: { name: string; muscle_groups: string[] } | null;
}
type ActivityMetric = 'Volume' | 'Duration' | 'Reps';

function StatisticsTab() {
  const { user } = useUserStore();
  const [period, setPeriod] = useState<StatPeriod>('1M');
  const [sessions, setStatSessions] = useState<StatSession[]>([]);
  const [sets, setStatSets] = useState<StatSet[]>([]);
  const [loading, setStatLoading] = useState(true);
  const [activeLift, setActiveLift] = useState('');
  const [activeMetric, setActiveMetric] = useState<ActivityMetric>('Volume');

  const periodDays = period === '1M' ? 30 : period === '3M' ? 90 : 730;

  useEffect(() => {
    if (!user) { setStatLoading(false); return; }
    let cancelled = false;
    setStatLoading(true);
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - periodDays);
      const { data: sessData } = await supabase
        .from('workout_sessions')
        .select('id, started_at, duration_seconds, volume_total, routine_name')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .gte('started_at', since.toISOString())
        .order('started_at', { ascending: true });
      if (cancelled) return;
      const sessRows = (sessData ?? []) as StatSession[];
      setStatSessions(sessRows);

      if (sessRows.length > 0) {
        const { data: setsData } = await supabase
          .from('workout_sets')
          .select('exercise_id, weight_kg, reps, completed_at, exercise:exercises(name, muscle_groups)')
          .in('session_id', sessRows.map(s => s.id));
        if (!cancelled) setStatSets((setsData ?? []) as unknown as StatSet[]);
      } else {
        setStatSets([]);
      }
      if (!cancelled) setStatLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, periodDays]);

  const totalSessions = sessions.length;
  const totalVolume = sessions.reduce((a, s) => a + (s.volume_total ?? 0), 0);
  const avgDuration = sessions.length
    ? Math.round(sessions.reduce((a, s) => a + (s.duration_seconds ?? 0), 0) / sessions.length / 60)
    : 0;

  const weeklyActivity = useMemo(() => {
    const volMap = new Map<string, number>();
    const durMap = new Map<string, number>();
    const repMap = new Map<string, number>();
    sessions.forEach(s => {
      const d = new Date(s.started_at);
      const ws = new Date(d);
      ws.setDate(d.getDate() - d.getDay());
      const k = ws.toISOString().slice(5, 10);
      volMap.set(k, (volMap.get(k) ?? 0) + (s.volume_total ?? 0));
      durMap.set(k, (durMap.get(k) ?? 0) + Math.round((s.duration_seconds ?? 0) / 60));
    });
    sets.forEach(st => {
      const d = new Date(st.completed_at);
      const ws = new Date(d);
      ws.setDate(d.getDate() - d.getDay());
      const k = ws.toISOString().slice(5, 10);
      repMap.set(k, (repMap.get(k) ?? 0) + (st.reps ?? 0));
    });
    const keys = [...new Set([...volMap.keys(), ...durMap.keys()])].sort().slice(-8);
    return keys.map(k => ({
      label: k.slice(3),
      volume: Math.round(volMap.get(k) ?? 0),
      duration: Math.round(durMap.get(k) ?? 0),
      reps: Math.round(repMap.get(k) ?? 0),
    }));
  }, [sessions, sets]);

  const barData = useMemo(() => weeklyActivity.map(w => ({
    label: w.label,
    value: activeMetric === 'Volume' ? w.volume : activeMetric === 'Duration' ? w.duration : w.reps,
  })), [weeklyActivity, activeMetric]);

  const muscleFocus = useMemo(() => {
    const totals = new Map<string, number>();
    sets.forEach(st => {
      const muscles: string[] = (st.exercise as any)?.muscle_groups ?? [];
      muscles.forEach(m => totals.set(m, (totals.get(m) ?? 0) + 1));
    });
    const total = Array.from(totals.values()).reduce((a, b) => a + b, 0) || 1;
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100) }));
  }, [sets]);

  const liftHistory = useMemo(() => {
    const byExercise = new Map<string, { name: string; weekly: Map<string, number> }>();
    sets.forEach(st => {
      const name = (st.exercise as any)?.name;
      if (!name || !st.weight_kg) return;
      if (!byExercise.has(name)) byExercise.set(name, { name, weekly: new Map() });
      const d = new Date(st.completed_at);
      const ws = new Date(d);
      ws.setDate(d.getDate() - d.getDay());
      const k = ws.toISOString().slice(0, 10);
      const ex = byExercise.get(name)!;
      ex.weekly.set(k, Math.max(ex.weekly.get(k) ?? 0, st.weight_kg));
    });
    const result: Record<string, number[]> = {};
    byExercise.forEach(({ name, weekly }) => {
      const vals = Array.from(weekly.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
      if (vals.length >= 2) result[name] = vals.slice(-8);
    });
    return result;
  }, [sets]);

  const liftNames = useMemo(() => Object.keys(liftHistory), [liftHistory]);
  const currentLift = activeLift && liftHistory[activeLift] ? activeLift : liftNames[0] ?? '';
  const liftData = liftHistory[currentLift] ?? [];
  const liftStart = liftData[0] ?? 0;
  const liftNow = liftData[liftData.length - 1] ?? 0;
  const liftPeak = liftData.length ? Math.max(...liftData) : 0;
  const liftGain = +(liftNow - liftStart).toFixed(1);

  if (loading) {
    return (
      <View style={st.loadWrap}>
        <ActivityIndicator color={COLORS.blue} size="large" />
      </View>
    );
  }

  if (totalSessions === 0) {
    return (
      <ScrollView contentContainerStyle={st.scroll}>
        <View style={st.periodRow}>
          {(['1M', '3M', 'All'] as StatPeriod[]).map(p => (
            <SRPill key={p} label={p} active={period === p} onPress={() => setPeriod(p)} />
          ))}
        </View>
        <View style={st.empty}>
          <Text style={st.emptyIcon}>📊</Text>
          <Text style={st.emptyTitle}>No data yet</Text>
          <Text style={st.emptySub}>Log workouts to see your statistics here.</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
      {/* Period toggle */}
      <View style={st.periodRow}>
        {(['1M', '3M', 'All'] as StatPeriod[]).map(p => (
          <SRPill key={p} label={p} active={period === p} onPress={() => setPeriod(p)} />
        ))}
      </View>

      {/* Metric ribbon */}
      <SRCard style={st.card}>
        <View style={st.ribbonRow}>
          {[
            { label: 'Sessions', val: String(totalSessions) },
            { label: 'Volume', val: totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : String(Math.round(totalVolume)), unit: 'kg' },
            { label: 'Avg Dur', val: String(avgDuration), unit: 'min' },
          ].map((m, i) => (
            <View key={i} style={st.ribbonCell}>
              {i > 0 && <View style={st.cellDiv} />}
              <View style={st.cellInner}>
                <Text style={st.cellVal}>{m.val}<Text style={st.cellUnit}>{m.unit ? ` ${m.unit}` : ''}</Text></Text>
                <Text style={st.cellLab}>{m.label}</Text>
              </View>
            </View>
          ))}
        </View>
      </SRCard>

      {/* Activity bar chart */}
      {barData.length > 0 && (
        <SRCard style={st.card}>
          <View style={st.cardHead}>
            <Text style={st.cardTitle}>Activity</Text>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {(['Volume', 'Duration', 'Reps'] as ActivityMetric[]).map(m => (
                <SRPill key={m} label={m} active={activeMetric === m} onPress={() => setActiveMetric(m)} size="xs" />
              ))}
            </View>
          </View>
          <BarChart data={barData} width={320} />
        </SRCard>
      )}

      {/* Muscle distribution */}
      {muscleFocus.length > 0 && (
        <SRCard style={st.card}>
          <Text style={[st.cardTitle, { marginBottom: 14 }]}>Muscle Focus</Text>
          {muscleFocus.map((m, i) => (
            <View key={i} style={{ marginBottom: i < muscleFocus.length - 1 ? 12 : 0 }}>
              <View style={st.muscleRow}>
                <Text style={st.muscleName}>{m.name.replace(/_/g, ' ')}</Text>
                <Text style={st.muscleCount}>{m.count} sets</Text>
              </View>
              <View style={st.muscleBarBg}>
                <View style={[st.muscleBarFill, { width: `${m.pct}%` as any }]} />
              </View>
            </View>
          ))}
        </SRCard>
      )}

      {/* Lift progression */}
      {liftNames.length > 0 && (
        <SRCard style={st.card}>
          <View style={[st.cardHead, { marginBottom: 10 }]}>
            <Text style={st.cardTitle}>Lift Progression</Text>
            {liftGain > 0 && (
              <View style={st.gainPill}>
                <Text style={st.gainPillTxt}>+{liftGain} kg</Text>
              </View>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {liftNames.map(l => (
                <SRPill key={l} label={l} active={currentLift === l} onPress={() => setActiveLift(l)} size="xs" />
              ))}
            </View>
          </ScrollView>
          {liftData.length >= 2 && (
            <LineChart data={liftData.map((v, i) => ({ label: `W${i + 1}`, value: v }))} width={320} />
          )}
          <View style={st.liftStatRow}>
            {[
              { lab: 'Start', val: `${liftStart} kg` },
              { lab: 'Peak', val: `${liftPeak} kg` },
              { lab: 'Now', val: `${liftNow} kg` },
              { lab: 'Gain', val: `+${liftGain} kg`, green: true },
            ].map((stat, i) => (
              <View key={i} style={st.liftStatCell}>
                <Text style={st.liftStatLab}>{stat.lab}</Text>
                <Text style={[st.liftStatVal, stat.green && { color: COLORS.green }]}>{stat.val}</Text>
              </View>
            ))}
          </View>
        </SRCard>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  loadWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 14, paddingBottom: 120, paddingTop: 14, gap: 10 },
  periodRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  card: { padding: 16 },
  ribbonRow: { flexDirection: 'row', justifyContent: 'space-around' },
  ribbonCell: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  cellDiv: { width: 0.5, backgroundColor: COLORS.border, alignSelf: 'stretch' },
  cellInner: { flex: 1, alignItems: 'center', gap: 2 },
  cellVal: { fontSize: 26, fontWeight: '900', color: COLORS.ink },
  cellUnit: { fontSize: 12, fontWeight: '500' },
  cellLab: { fontSize: 10, color: COLORS.ink3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.7 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  muscleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  muscleName: { fontSize: 12, color: COLORS.ink2, textTransform: 'capitalize' },
  muscleCount: { fontSize: 12, fontWeight: '700', color: COLORS.ink },
  muscleBarBg: { height: 5, backgroundColor: COLORS.surface2, borderRadius: 99 },
  muscleBarFill: { height: '100%', backgroundColor: COLORS.blue, borderRadius: 99 },
  gainPill: { backgroundColor: COLORS.greenLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  gainPillTxt: { fontSize: 11, fontWeight: '600', color: COLORS.green },
  liftStatRow: { flexDirection: 'row', marginTop: 12 },
  liftStatCell: { flex: 1, alignItems: 'center' },
  liftStatLab: { fontSize: 10, color: COLORS.ink3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  liftStatVal: { fontSize: 14, fontWeight: '800', color: COLORS.ink, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.ink },
  emptySub: { fontSize: 13, color: COLORS.ink3 },
});

// ── Measures Tab ─────────────────────────────────────────────

interface WeightLog {
  id: string;
  logged_at: string;
  weight_kg: number;
}

type MeasurePeriod = '1M' | '3M' | 'All';

function MeasuresTab() {
  const { user } = useUserStore();
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [logWeight, setLogWeight] = useState(70);
  const [logging, setLogging] = useState(false);
  const [period, setMeasurePeriod] = useState<MeasurePeriod>('1M');

  const fetchLogs = useCallback(async () => {
    if (!user) { setLoadingLogs(false); return; }
    setLoadingLogs(true);
    const { data } = await supabase
      .from('body_weight_logs')
      .select('id, logged_at, weight_kg')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })
      .limit(365);
    setLogs((data ?? []) as WeightLog[]);
    setLoadingLogs(false);
  }, [user]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  // Pre-fill with yesterday's or most recent weight
  useEffect(() => {
    if (logs.length > 0) setLogWeight(Math.round(logs[0].weight_kg * 10) / 10);
  }, [logs]);

  const handleLog = async () => {
    if (!user) return;
    setLogging(true);
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const { error } = await supabase.from('body_weight_logs').upsert(
      { user_id: user.id, weight_kg: logWeight, logged_at: `${today}T00:00:00+00:00` },
      { onConflict: 'user_id,logged_at' },
    );
    if (error) {
      Alert.alert('Could not log weight', error.message);
    } else {
      await fetchLogs();
    }
    setLogging(false);
  };

  const periodDays = period === '1M' ? 30 : period === '3M' ? 90 : 99999;
  const filteredLogs = useMemo(() => {
    const cutoff = new Date(Date.now() - periodDays * 86400000).toISOString();
    return logs.filter(l => l.logged_at >= cutoff);
  }, [logs, periodDays]);

  const chartData = useMemo(() =>
    [...filteredLogs].reverse().map(l => ({
      label: l.logged_at.slice(5, 10),
      value: l.weight_kg,
    })), [filteredLogs]);

  const startW = filteredLogs.length > 0 ? filteredLogs[filteredLogs.length - 1].weight_kg : null;
  const currentW = filteredLogs.length > 0 ? filteredLogs[0].weight_kg : null;
  const lowestW = filteredLogs.length > 0 ? Math.min(...filteredLogs.map(l => l.weight_kg)) : null;
  const change = startW !== null && currentW !== null ? +(currentW - startW).toFixed(1) : null;

  if (loadingLogs) {
    return (
      <View style={mt.loadWrap}>
        <ActivityIndicator color={COLORS.blue} size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={mt.scroll} showsVerticalScrollIndicator={false}>
      {/* Quick log card */}
      <SRCard style={mt.card}>
        <Text style={mt.cardTitle}>Log Weight</Text>
        <View style={mt.stepperRow}>
          <TouchableOpacity style={mt.stepBtn} onPress={() => setLogWeight(w => Math.max(0, +(w - 0.5).toFixed(1)))} activeOpacity={0.7}>
            <Text style={mt.stepBtnTxt}>−</Text>
          </TouchableOpacity>
          <View style={mt.weightDisplay}>
            <Text style={mt.weightVal}>{logWeight.toFixed(1)}</Text>
            <Text style={mt.weightUnit}>kg</Text>
          </View>
          <TouchableOpacity style={mt.stepBtn} onPress={() => setLogWeight(w => +(w + 0.5).toFixed(1))} activeOpacity={0.7}>
            <Text style={mt.stepBtnTxt}>+</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={mt.logBtn} onPress={handleLog} disabled={logging} activeOpacity={0.85}>
          {logging ? <ActivityIndicator color={COLORS.bg} size="small" /> : <Text style={mt.logBtnTxt}>Log Weight</Text>}
        </TouchableOpacity>
      </SRCard>

      {logs.length === 0 ? (
        <View style={mt.empty}>
          <Text style={mt.emptyIcon}>⚖️</Text>
          <Text style={mt.emptyTitle}>No entries yet</Text>
          <Text style={mt.emptySub}>Log your weight above to start tracking.</Text>
        </View>
      ) : (
        <>
          {/* Period toggle */}
          <View style={mt.periodRow}>
            {(['1M', '3M', 'All'] as MeasurePeriod[]).map(p => (
              <SRPill key={p} label={p} active={period === p} onPress={() => setMeasurePeriod(p)} />
            ))}
          </View>

          {/* Line chart */}
          {chartData.length >= 2 && (
            <SRCard style={mt.card}>
              <Text style={mt.cardTitle}>Body Weight</Text>
              <LineChart data={chartData} width={320} />
            </SRCard>
          )}

          {/* Stats strip */}
          {startW !== null && (
            <SRCard style={mt.card}>
              <View style={mt.statsRow}>
                {[
                  { lab: 'Start', val: `${startW?.toFixed(1)} kg` },
                  { lab: 'Current', val: `${currentW?.toFixed(1)} kg` },
                  { lab: 'Lowest', val: `${lowestW?.toFixed(1)} kg` },
                  { lab: 'Change', val: `${change !== null ? (change >= 0 ? '+' : '') + change : '—'} kg`, color: change !== null ? (change <= 0 ? COLORS.green : COLORS.amber) : COLORS.ink3 },
                ].map((stat, i) => (
                  <View key={i} style={mt.statCell}>
                    {i > 0 && <View style={mt.statDiv} />}
                    <View style={mt.statInner}>
                      <Text style={[mt.statVal, stat.color ? { color: stat.color } : {}]}>{stat.val}</Text>
                      <Text style={mt.statLab}>{stat.lab}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </SRCard>
          )}

          {/* History list */}
          <SRCard>
            <SRSectionLabel>History</SRSectionLabel>
            {filteredLogs.slice(0, 50).map((log, i) => (
              <View key={log.id}>
                {i > 0 && <SRDivider indent={16} />}
                <View style={mt.histRow}>
                  <Text style={mt.histDate}>{new Date(log.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                  <Text style={mt.histWeight}>{log.weight_kg.toFixed(1)} kg</Text>
                </View>
              </View>
            ))}
          </SRCard>
        </>
      )}
    </ScrollView>
  );
}

const mt = StyleSheet.create({
  loadWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 14, paddingBottom: 120, paddingTop: 14, gap: 10 },
  card: { padding: 16 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.ink, marginBottom: 14 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 16 },
  stepBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: COLORS.surface2, alignItems: 'center', justifyContent: 'center' },
  stepBtnTxt: { fontSize: 24, fontWeight: '300', color: COLORS.ink },
  weightDisplay: { alignItems: 'center' },
  weightVal: { fontSize: 40, fontWeight: '900', color: COLORS.ink },
  weightUnit: { fontSize: 13, color: COLORS.ink3, marginTop: -4 },
  logBtn: { backgroundColor: COLORS.ink, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  logBtnTxt: { color: COLORS.bg, fontWeight: '800', fontSize: 15 },
  periodRow: { flexDirection: 'row', gap: 6 },
  statsRow: { flexDirection: 'row' },
  statCell: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  statDiv: { width: 0.5, backgroundColor: COLORS.border, alignSelf: 'stretch' },
  statInner: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  statVal: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
  statLab: { fontSize: 10, color: COLORS.ink3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2 },
  histRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11 },
  histDate: { fontSize: 13, color: COLORS.ink2 },
  histWeight: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.ink },
  emptySub: { fontSize: 13, color: COLORS.ink3 },
});

// ── Calendar Tab ─────────────────────────────────────────────

interface CalSession {
  id: string;
  started_at: string;
  routine_name: string | null;
  duration_seconds: number | null;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function CalendarTab() {
  const { user } = useUserStore();
  const today = new Date();
  const [displayYear, setDisplayYear] = useState(today.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(today.getMonth()); // 0-indexed
  const [calSessions, setCalSessions] = useState<CalSession[]>([]);
  const [calLoading, setCalLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(today.toISOString().slice(0, 10));

  useEffect(() => {
    if (!user) { setCalLoading(false); return; }
    let cancelled = false;
    setCalLoading(true);
    (async () => {
      const { data } = await supabase
        .from('workout_sessions')
        .select('id, started_at, routine_name, duration_seconds')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .not('finished_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(500);
      if (!cancelled) { setCalSessions((data ?? []) as CalSession[]); setCalLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const prevMonth = () => {
    if (displayMonth === 0) { setDisplayYear(y => y - 1); setDisplayMonth(11); }
    else setDisplayMonth(m => m - 1);
  };
  const nextMonth = () => {
    const now = new Date();
    if (displayYear > now.getFullYear() || (displayYear === now.getFullYear() && displayMonth >= now.getMonth())) return;
    if (displayMonth === 11) { setDisplayYear(y => y + 1); setDisplayMonth(0); }
    else setDisplayMonth(m => m + 1);
  };

  const trainedDates = useMemo(() => new Set(calSessions.map(s => s.started_at.slice(0, 10))), [calSessions]);

  // Build calendar grid for displayed month
  const grid = useMemo(() => {
    const firstDay = new Date(displayYear, displayMonth, 1);
    const lastDay = new Date(displayYear, displayMonth + 1, 0);
    // getDay: 0=Sun → map to Mon-first: Mon=0...Sun=6
    const startDow = (firstDay.getDay() + 6) % 7;
    const rows: (number | null)[][] = [];
    let row: (number | null)[] = Array(startDow).fill(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      row.push(d);
      if (row.length === 7) { rows.push(row); row = []; }
    }
    if (row.length > 0) { while (row.length < 7) row.push(null); rows.push(row); }
    return rows;
  }, [displayYear, displayMonth]);

  // Streak and rest days in the current week of selectedDate
  const { weekStreak, weekRest } = useMemo(() => {
    const selD = new Date(selectedDate);
    const dow = (selD.getDay() + 6) % 7; // Mon=0
    let trained = 0, rest = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(selD);
      d.setDate(selD.getDate() - dow + i);
      if (d > today) break;
      const iso = d.toISOString().slice(0, 10);
      trainedDates.has(iso) ? trained++ : rest++;
    }
    return { weekStreak: trained, weekRest: rest };
  }, [selectedDate, trainedDates]);

  // Sessions for the week containing selectedDate
  const weekSessions = useMemo(() => {
    const selD = new Date(selectedDate);
    const dow = (selD.getDay() + 6) % 7;
    const weekStart = new Date(selD);
    weekStart.setDate(selD.getDate() - dow);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const ws = weekStart.toISOString().slice(0, 10);
    const we = weekEnd.toISOString().slice(0, 10);
    return calSessions.filter(s => s.started_at.slice(0, 10) >= ws && s.started_at.slice(0, 10) <= we);
  }, [selectedDate, calSessions]);

  const monthLabel = new Date(displayYear, displayMonth, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  if (calLoading) {
    return <View style={ct.loadWrap}><ActivityIndicator color={COLORS.blue} size="large" /></View>;
  }

  const monthHasSessions = calSessions.some(s => {
    const d = new Date(s.started_at);
    return d.getFullYear() === displayYear && d.getMonth() === displayMonth;
  });

  return (
    <ScrollView contentContainerStyle={ct.scroll} showsVerticalScrollIndicator={false}>
      {/* Month nav header */}
      <View style={ct.monthNav}>
        <TouchableOpacity onPress={prevMonth} hitSlop={12} style={ct.navBtn}>
          <Ionicons name="chevron-back" size={20} color={COLORS.ink} />
        </TouchableOpacity>
        <Text style={ct.monthLabel}>{monthLabel}</Text>
        <TouchableOpacity onPress={nextMonth} hitSlop={12} style={ct.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={COLORS.ink} />
        </TouchableOpacity>
      </View>

      {/* Week summary */}
      <SRCard style={ct.summaryCard}>
        <Text style={ct.summaryText}>
          {weekStreak > 0 ? `${weekStreak} 🔥 sessions` : 'No sessions'} · {weekRest} rest day{weekRest !== 1 ? 's' : ''} this week
        </Text>
      </SRCard>

      {/* Calendar grid */}
      <SRCard style={ct.gridCard}>
        <View style={ct.dayLabels}>
          {DAY_LABELS.map((l, i) => <Text key={i} style={ct.dayLabel}>{l}</Text>)}
        </View>
        {grid.map((week, wi) => (
          <View key={wi} style={ct.weekRow}>
            {week.map((day, di) => {
              if (day === null) return <View key={di} style={ct.dayCell} />;
              const iso = `${displayYear}-${String(displayMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const trained = trainedDates.has(iso);
              const isToday = iso === today.toISOString().slice(0, 10);
              const isSelected = iso === selectedDate;
              return (
                <TouchableOpacity
                  key={di}
                  style={[
                    ct.dayCell,
                    trained && ct.dayCellTrained,
                    isToday && !trained && ct.dayCellToday,
                    isSelected && ct.dayCellSelected,
                  ]}
                  onPress={() => setSelectedDate(iso)}
                  activeOpacity={0.7}
                >
                  <Text style={[ct.dayNum, trained && ct.dayNumTrained, isToday && !trained && { color: COLORS.blue }]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </SRCard>

      {/* Weekly session list */}
      {weekSessions.length > 0 ? (
        <SRCard>
          <SRSectionLabel>This Week's Sessions</SRSectionLabel>
          {weekSessions.map((s, i) => (
            <View key={s.id}>
              {i > 0 && <SRDivider indent={16} />}
              <View style={ct.sessionRow}>
                <View style={ct.sessionDot} />
                <View style={{ flex: 1 }}>
                  <Text style={ct.sessionName}>{s.routine_name ?? 'Quick Workout'}</Text>
                  <Text style={ct.sessionDate}>
                    {new Date(s.started_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </Text>
                </View>
                {s.duration_seconds != null && (
                  <Text style={ct.sessionDur}>{Math.round(s.duration_seconds / 60)}min</Text>
                )}
              </View>
            </View>
          ))}
        </SRCard>
      ) : !monthHasSessions ? (
        <View style={ct.empty}>
          <Text style={ct.emptyIcon}>📅</Text>
          <Text style={ct.emptyTitle}>No sessions this month</Text>
          <Text style={ct.emptySub}>Start training to see your calendar fill up.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const ct = StyleSheet.create({
  loadWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 14, paddingBottom: 120, paddingTop: 14, gap: 10 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  navBtn: { padding: 4 },
  monthLabel: { fontSize: 17, fontWeight: '800', color: COLORS.ink },
  summaryCard: { padding: 12, alignItems: 'center' },
  summaryText: { fontSize: 13, fontWeight: '600', color: COLORS.ink2 },
  gridCard: { padding: 12 },
  dayLabels: { flexDirection: 'row', marginBottom: 6 },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: COLORS.ink3 },
  weekRow: { flexDirection: 'row', marginBottom: 5 },
  dayCell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  dayCellTrained: { backgroundColor: COLORS.blue },
  dayCellToday: { borderWidth: 1.5, borderColor: COLORS.blue },
  dayCellSelected: { borderWidth: 1.5, borderColor: COLORS.ink3 },
  dayNum: { fontSize: 13, fontWeight: '500', color: COLORS.ink },
  dayNumTrained: { color: COLORS.bg, fontWeight: '700' },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11 },
  sessionDot: { width: 8, height: 8, borderRadius: 99, backgroundColor: COLORS.blue },
  sessionName: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  sessionDate: { fontSize: 11, color: COLORS.ink3, marginTop: 2 },
  sessionDur: { fontSize: 13, fontWeight: '700', color: COLORS.ink3 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.ink },
  emptySub: { fontSize: 13, color: COLORS.ink3, textAlign: 'center' },
});

// ── AI Review Card ────────────────────────────────────────────

const PILL_CONFIG = [
  { key: 'volume',      icon: '📈', label: 'Volume'      },
  { key: 'prs',         icon: '🏆', label: 'PRs'         },
  { key: 'recovery',    icon: '💤', label: 'Recovery'    },
  { key: 'consistency', icon: '🎯', label: 'Consistency' },
] as const;

type PillKey = typeof PILL_CONFIG[number]['key'];

function derivePillColors(sessions: WorkoutSession[], hasPRs: boolean): Record<PillKey, string> {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const weekSessions = sessions.filter(s => new Date(s.started_at).getTime() > weekAgo);
  const last = sessions[0];
  const daysSince = last ? Math.floor((now - new Date(last.started_at).getTime()) / 86400000) : null;

  return {
    volume:      weekSessions.length > 0 ? COLORS.green : COLORS.amber,
    prs:         hasPRs ? COLORS.green : COLORS.amber,
    recovery:    daysSince === 1 ? COLORS.amber : COLORS.green,
    consistency: weekSessions.length >= 3 ? COLORS.green : weekSessions.length >= 1 ? COLORS.amber : COLORS.red,
  };
}

function AIReviewCard({ sessions, hasPRs }: { sessions: WorkoutSession[]; hasPRs: boolean }) {
  const { user, aiReview, aiReviewGeneratedAt, setAIReview } = useUserStore();
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);

  const pillColors = derivePillColors(sessions, hasPRs);

  useEffect(() => {
    if (!user || !sessions.length || generating) return;
    const stale = !aiReviewGeneratedAt || (Date.now() - aiReviewGeneratedAt) > 24 * 60 * 60 * 1000;
    if (!stale) return;
    setGenerating(true);
    const recentSessions = sessions.slice(0, 7).map(s => ({
      date: s.started_at,
      exercises: [s.routine_name ?? 'Workout'],
      volume: Number(s.volume_total ?? 0),
    }));
    getWeeklyReview(recentSessions)
      .then(text => { if (text) setAIReview(text.trim()); })
      .catch(() => {})
      .finally(() => setGenerating(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, sessions.length]);

  const reviewText = aiReview ?? (generating ? null : 'Tap to generate your weekly review.');

  return (
    <TouchableOpacity
      style={ar.card}
      activeOpacity={0.85}
      onPress={() => setExpanded(e => !e)}
    >
      <View style={ar.pillRow}>
        {PILL_CONFIG.map(p => (
          <View key={p.key} style={ar.pill}>
            <View style={[ar.pillDot, { backgroundColor: pillColors[p.key] }]} />
            <Text style={ar.pillLabel}>{p.icon} {p.label}</Text>
          </View>
        ))}
      </View>
      {generating ? (
        <View style={ar.textRow}>
          <ActivityIndicator size="small" color={COLORS.ink3} style={{ marginRight: 6 }} />
          <Text style={ar.loadingText}>Analysing your week…</Text>
        </View>
      ) : reviewText ? (
        <Text style={ar.reviewText} numberOfLines={expanded ? undefined : 1}>
          {reviewText}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const ar = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 4,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 12,
    gap: 8,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.surface2, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
  pillDot: { width: 6, height: 6, borderRadius: 99 },
  pillLabel: { fontSize: 11, fontWeight: '600', color: COLORS.ink2 },
  textRow: { flexDirection: 'row', alignItems: 'center' },
  loadingText: { fontSize: 12, color: COLORS.ink3, fontStyle: 'italic' },
  reviewText: { fontSize: 13, color: COLORS.ink2, lineHeight: 18 },
});

// ── Exercises Catalog Tab ─────────────────────────────────────

type CatalogExercise = {
  id: string;
  name: string;
  category: string;
  muscle_groups: string[];
  equipment: string[];
  image_url: string | null;
};

const MUSCLE_CHIPS = ['All', 'chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'core'];

function ExercisesTab() {
  const [exercises, setExercises] = useState<CatalogExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState('All');
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('exercises')
      .select('id, name, category, muscle_groups, equipment, image_url')
      .order('name')
      .limit(1000)
      .then(({ data }) => {
        setExercises((data ?? []) as CatalogExercise[]);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    let list = exercises;
    if (muscleFilter !== 'All') {
      list = list.filter(e => e.muscle_groups?.includes(muscleFilter));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q));
    }
    return list;
  }, [exercises, search, muscleFilter]);

  if (loading) {
    return (
      <View style={et.center}>
        <ActivityIndicator color={COLORS.blue} size="large" />
      </View>
    );
  }

  return (
    <View style={et.root}>
      <View style={et.searchWrap}>
        <Ionicons name="search-outline" size={16} color={COLORS.ink3} style={et.searchIcon} />
        <TextInput
          style={et.searchInput}
          placeholder="Search exercises…"
          placeholderTextColor={COLORS.ink3}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={et.chipScroll}
        contentContainerStyle={et.chipRow}
      >
        {MUSCLE_CHIPS.map(m => (
          <TouchableOpacity
            key={m}
            style={[et.chip, muscleFilter === m && et.chipActive]}
            onPress={() => setMuscleFilter(m)}
          >
            <Text style={[et.chipTxt, muscleFilter === m && et.chipTxtActive]}>{m === 'All' ? 'All' : m.replace(/_/g, ' ')}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={e => e.id}
        contentContainerStyle={et.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={et.center}>
            <Text style={et.emptyTxt}>No exercises found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ExerciseRow item={item} onPress={() => setDetailId(item.id)} />
        )}
      />

      <ExerciseDetailSheet exerciseId={detailId} onClose={() => setDetailId(null)} />
    </View>
  );
}

function ExerciseRow({ item, onPress }: { item: CatalogExercise; onPress: () => void }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  return (
    <TouchableOpacity style={et.row} onPress={onPress} activeOpacity={0.75}>
      <View style={et.thumb}>
        {item.image_url ? (
          <>
            {!imgLoaded && (
              <View style={et.thumbSkeleton}>
                <ActivityIndicator size="small" color={COLORS.ink3} />
              </View>
            )}
            <Image
              source={{ uri: item.image_url }}
              style={et.thumbImg}
              resizeMode="cover"
              onLoad={() => setImgLoaded(true)}
            />
          </>
        ) : (
          <View style={et.thumbFallback}>
            <Ionicons name="barbell-outline" size={22} color={COLORS.ink3} />
          </View>
        )}
      </View>
      <View style={et.rowInfo}>
        <Text style={et.rowName} numberOfLines={1}>{item.name}</Text>
        <Text style={et.rowMeta} numberOfLines={1}>
          {item.muscle_groups?.[0]?.replace(/_/g, ' ') ?? item.category}
          {item.equipment?.length > 0 ? ` · ${item.equipment[0]}` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.ink3} />
    </TouchableOpacity>
  );
}

const et = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTxt: { color: COLORS.ink3, fontSize: 14 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 12, marginBottom: 8,
    backgroundColor: COLORS.surface2, borderRadius: 12,
    borderWidth: 0.5, borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: COLORS.ink, fontSize: 14 },
  chipScroll: { maxHeight: 44 },
  chipRow: { paddingHorizontal: 16, gap: 8, flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: COLORS.surface2, borderRadius: 99,
    borderWidth: 0.5, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.blue, borderColor: COLORS.blue },
  chipTxt: { fontSize: 12, fontWeight: '600', color: COLORS.ink2, textTransform: 'capitalize' },
  chipTxtActive: { color: COLORS.bg },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, gap: 12,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.border,
  },
  thumb: {
    width: 52, height: 52, borderRadius: 10,
    backgroundColor: COLORS.surface2, overflow: 'hidden',
  },
  thumbSkeleton: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface2,
  },
  thumbImg: { width: 52, height: 52 },
  thumbFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rowInfo: { flex: 1 },
  rowName: { color: COLORS.ink, fontWeight: '600', fontSize: 15 },
  rowMeta: { color: COLORS.ink3, fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
});

// ── Stub tab ──────────────────────────────────────────────────

function StubTab({ label }: { label: string }) {
  return (
    <ScrollView contentContainerStyle={s.stubWrap}>
      <Text style={s.stubIcon}>🚧</Text>
      <Text style={s.stubTitle}>{label}</Text>
      <Text style={s.stubSub}>Coming in next update</Text>
    </ScrollView>
  );
}

// ── Workouts tab ──────────────────────────────────────────────

interface WorkoutsTabProps {
  loading: boolean;
  sessions: SessionRow[];
  prDerived: { bests: PersonalRecord[]; prCountBySession: Map<string, number> };
  handle: string;
  initial: string;
  onMenuPress: (s: SessionRow) => void;
}

function WorkoutsTab({ loading, sessions, prDerived, handle, initial, onMenuPress }: WorkoutsTabProps) {
  const router = useRouter();
  const { signOut } = useUserStore();

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.tabScrollContent}>

      {/* PRs strip */}
      {prDerived.bests.length > 0 && (
        <SRCard style={{ marginBottom: 10 }}>
          <SRSectionLabel>Personal records</SRSectionLabel>
          {prDerived.bests.slice(0, 5).map((pr, i) => (
            <View key={pr.id}>
              {i > 0 && <SRDivider indent={20} />}
              <View style={s.prRow}>
                <Text style={s.prName}>{pr.exercise_name}</Text>
                <Text style={s.prVal}>{formatWeight(Number(pr.value))} kg</Text>
              </View>
            </View>
          ))}
        </SRCard>
      )}


      {/* Workouts feed */}
      <Text style={s.sectionKicker}>Workouts</Text>
      {loading ? (
        <Text style={s.muted}>Loading…</Text>
      ) : sessions.length === 0 ? (
        <SRCard>
          <Text style={s.muted}>No workouts logged yet. Start one from the Workouts tab.</Text>
        </SRCard>
      ) : (
        sessions.map(session => {
          const title = session.routine_name ?? 'Quick Workout';
          const totalReps = sessionTotalReps(session.sets);
          const groups = groupExercises(session.sets);
          const preview = groups.slice(0, 3);
          const more = Math.max(0, groups.length - preview.length);
          const rec = prDerived.prCountBySession.get(session.id) ?? 0;
          return (
            <SRCard key={session.id} style={{ marginBottom: 10 }}>
              <View style={s.cardHead}>
                <View style={s.avatarXs}>
                  <Text style={s.avatarXsText}>{initial}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardUser}>{handle}</Text>
                  <Text style={s.cardDate}>{formatLongDate(session.started_at)}</Text>
                </View>
                <TouchableOpacity onPress={() => onMenuPress(session)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="ellipsis-horizontal" size={22} color={COLORS.ink3} />
                </TouchableOpacity>
              </View>
              <Text style={s.cardTitle}>{title}</Text>
              <View style={s.cardStats}>
                {[
                  { lab: 'Time',   val: formatDurationCompact(session.duration_seconds) },
                  { lab: 'Volume', val: `${Number(session.volume_total ?? 0).toLocaleString('en-US', { maximumFractionDigits: 1 })} kg` },
                  { lab: 'Reps',   val: totalReps.toLocaleString('en-US') },
                ].map(c => (
                  <View key={c.lab} style={s.cardStat}>
                    <Text style={s.cardStatLab}>{c.lab}</Text>
                    <Text style={s.cardStatVal}>{c.val}</Text>
                  </View>
                ))}
                <View style={s.cardStat}>
                  <Text style={s.cardStatLab}>PRs</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 14 }}>🏅</Text>
                    <Text style={s.cardStatVal}>{rec}</Text>
                  </View>
                </View>
              </View>
              {preview.map((g, idx) => (
                <View key={idx} style={s.exLine}>
                  <View style={s.exThumb}>
                    <Ionicons name="barbell-outline" size={18} color={COLORS.ink3} />
                  </View>
                  <Text style={s.exText}>{g.setCount} set{g.setCount === 1 ? '' : 's'} {g.name}</Text>
                </View>
              ))}
              {more > 0 && <Text style={s.seeMore}>See {more} more exercise{more === 1 ? '' : 's'}</Text>}
              <View style={s.socialRow}>
                <TouchableOpacity style={s.socialBtn} onPress={() => Alert.alert('Likes', 'Coming soon.')}>
                  <Ionicons name="thumbs-up-outline" size={20} color={COLORS.ink3} />
                  <Text style={s.socialCt}>0</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.socialBtn} onPress={() => Alert.alert('Comments', 'Coming soon.')}>
                  <Ionicons name="chatbubble-outline" size={20} color={COLORS.ink3} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.socialBtn}
                  onPress={async () => {
                    try { await Share.share({ message: `${title} — ${formatLongDate(session.started_at)}` }); } catch { /* */ }
                  }}
                >
                  <Ionicons name="share-outline" size={20} color={COLORS.ink3} />
                </TouchableOpacity>
              </View>
            </SRCard>
          );
        })
      )}

      {/* Account */}
      <Text style={[s.sectionKicker, { marginTop: 8 }]}>Account</Text>
      <SRCard style={{ marginBottom: 4 }}>
        <TouchableOpacity style={s.settingRow} activeOpacity={0.7} onPress={() => router.push('/profile/settings')}>
          <Text style={s.settingLabel}>Edit Profile</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.ink3} />
        </TouchableOpacity>
        <SRDivider indent={16} />
        <TouchableOpacity
          style={s.settingRow}
          activeOpacity={0.7}
          onPress={() => {
            if (Platform.OS === 'web') {
              if (typeof window !== 'undefined' && window.confirm('Sign out?')) void signOut();
              return;
            }
            Alert.alert('Sign out?', undefined, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
            ]);
          }}
        >
          <Text style={[s.settingLabel, { color: COLORS.red }]}>Sign Out</Text>
        </TouchableOpacity>
      </SRCard>

      <Text style={s.footer}>SuperReps v1.0 · Expo SDK 54 · Supabase + Groq</Text>
    </ScrollView>
  );
}

// ── Main screen ───────────────────────────────────────────────

const PROFILE_SESSION_LIMIT = 500;

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUserStore();

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [prDerived, setPrDerived] = useState<{
    bests: PersonalRecord[];
    prCountBySession: Map<string, number>;
  }>({ bests: [], prCountBySession: new Map() });
  const [loading, setLoading] = useState(true);
  const [routineCount, setRoutineCount] = useState(0);
  const [activeTab, setActiveTab] = useState<ProfileTab>('workouts');
  const [menuSession, setMenuSession] = useState<SessionRow | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [sessRes, flatSets] = await Promise.all([
      supabase
        .from('workout_sessions')
        .select('*, sets:workout_sets(*, exercise:exercises(name))')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .not('finished_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(PROFILE_SESSION_LIMIT),
      fetchAllSetsForPersonalBests(supabase, user.id),
    ]);
    if (sessRes.data) setSessions(sessRes.data as SessionRow[]);
    setPrDerived(derivePersonalBestsFromFlatRows(flatSets));

    const { count } = await supabase
      .from('routines')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    setRoutineCount(count ?? 0);
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handle = user?.username ?? user?.email?.split('@')[0] ?? 'lifter';
  const displayName = user?.name || (user?.username
    ? user.username.replace(/_/g, ' ')
    : (user?.email?.split('@')[0] ?? 'Lifter'));
  const initial = displayName[0]?.toUpperCase() ?? 'U';

  const streak = useMemo(() => {
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
  }, [sessions]);

  const shareProfile = async () => {
    try { await Share.share({ message: `Training on SuperReps — @${handle}` }); } catch { /* */ }
  };

  const deleteSession = async (id: string) => {
    const { error } = await supabase.from('workout_sessions').delete().eq('id', id);
    if (error) { Alert.alert('Could not delete', error.message); return; }
    setMenuSession(null);
    void load();
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* ── Sticky header ── */}
      <View style={[s.header, { paddingTop: insets.top }]}>

        {/* Top bar */}
        <View style={s.topBar}>
          <Text style={s.handle} numberOfLines={1}>{handle}</Text>
          <View style={s.topIcons}>
            <TouchableOpacity onPress={() => router.push('/profile/settings')} hitSlop={hitSlop}>
              <Ionicons name="create-outline" size={22} color={COLORS.ink} />
            </TouchableOpacity>
            <TouchableOpacity onPress={shareProfile} hitSlop={hitSlop}>
              <Ionicons name="share-outline" size={22} color={COLORS.ink} />
            </TouchableOpacity>
            <TouchableOpacity testID="profile-open-settings" onPress={() => router.push('/profile/settings')} hitSlop={hitSlop}>
              <Ionicons name="settings-outline" size={22} color={COLORS.ink} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Avatar + name + stats */}
        <View style={s.profileRow}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initial}</Text>
          </View>
          <View style={s.profileMain}>
            <Text style={s.displayName} numberOfLines={1}>{displayName}</Text>
            <Text style={s.handleSub}>@{handle}</Text>
            <View style={s.statsRow}>
              {[
                { val: streak > 0 ? `${streak} 🔥` : '0', lab: 'Streak'   },
                { val: String(sessions.length),             lab: 'Sessions' },
                { val: String(routineCount),                lab: 'Routines' },
              ].map((stat, i) => (
                <View key={i} style={s.statItem}>
                  {i > 0 && <View style={s.statSep} />}
                  <View style={s.statCol}>
                    <Text style={s.statVal}>{stat.val}</Text>
                    <Text style={s.statLab}>{stat.lab}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* AI Review Card */}
        <AIReviewCard sessions={sessions} hasPRs={prDerived.bests.length > 0} />

        {/* Horizontal tab strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabStrip}
        >
          {PROFILE_TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[s.tabBtn, active && s.tabBtnActive]}
                activeOpacity={0.7}
              >
                <Text style={[s.tabBtnTxt, active && s.tabBtnTxtActive]}>{tab.label}</Text>
                {active && <View style={s.tabUnderline} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Tab body ── */}
      {activeTab === 'workouts' && (
        <WorkoutsTab
          loading={loading}
          sessions={sessions}
          prDerived={prDerived}
          handle={handle}
          initial={initial}
          onMenuPress={setMenuSession}
        />
      )}
      {activeTab === 'statistics' && <StatisticsTab />}
      {activeTab === 'measures'   && <MeasuresTab />}
      {activeTab === 'exercises'  && <ExercisesTab />}
      {activeTab === 'calendar'   && <CalendarTab />}

      {/* ── Session action sheet ── */}
      <Modal visible={menuSession !== null} transparent animationType="fade" onRequestClose={() => setMenuSession(null)}>
        <View style={s.sheetOverlay}>
          <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={() => setMenuSession(null)} />
          <View style={s.sheet}>
            <View style={s.sheetGrab} />
            {menuSession && (
              <>
                <TouchableOpacity
                  style={s.sheetRow}
                  onPress={async () => {
                    const t = menuSession.routine_name ?? 'Workout';
                    setMenuSession(null);
                    try { await Share.share({ message: `${t} — ${formatLongDate(menuSession.started_at)}` }); } catch { /* */ }
                  }}
                >
                  <Ionicons name="share-outline" size={22} color={COLORS.ink} />
                  <Text style={s.sheetRowTxt}>Share workout</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.sheetRow} onPress={() => { setMenuSession(null); Alert.alert('Save as routine', 'We will add this in a future update.'); }}>
                  <Ionicons name="download-outline" size={22} color={COLORS.ink} />
                  <Text style={s.sheetRowTxt}>Save as routine</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.sheetRow} onPress={() => { setMenuSession(null); Alert.alert('Copy workout', 'Duplicate session — coming soon.'); }}>
                  <Ionicons name="copy-outline" size={22} color={COLORS.ink} />
                  <Text style={s.sheetRowTxt}>Copy workout</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.sheetRow} onPress={() => {
                  const id = menuSession?.id;
                  setMenuSession(null);
                  if (id) router.push(`/workout/edit/${id}`);
                }}>
                  <Ionicons name="create-outline" size={22} color={COLORS.ink} />
                  <Text style={s.sheetRowTxt}>Edit workout</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.sheetRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border }]}
                  onPress={() => {
                    const id = menuSession.id;
                    if (Platform.OS === 'web') {
                      if (typeof window !== 'undefined' && window.confirm('Delete this workout?')) {
                        void deleteSession(id);
                      } else {
                        setMenuSession(null);
                      }
                      return;
                    }
                    Alert.alert('Delete workout?', 'This cannot be undone.', [
                      { text: 'Cancel', style: 'cancel', onPress: () => setMenuSession(null) },
                      { text: 'Delete', style: 'destructive', onPress: () => void deleteSession(id) },
                    ]);
                  }}
                >
                  <Ionicons name="trash-outline" size={22} color={COLORS.red} />
                  <Text style={[s.sheetRowTxt, { color: COLORS.red }]}>Delete workout</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.sheetCancel} onPress={() => setMenuSession(null)}>
                  <Text style={s.muted}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  // ── Header ──
  header: {
    backgroundColor: COLORS.bg,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    paddingBottom: 0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  handle: { fontSize: 18, fontWeight: '800', color: COLORS.ink, flex: 1, marginRight: 12 },
  topIcons: { flexDirection: 'row', alignItems: 'center', gap: 14 },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 999,
    backgroundColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: COLORS.bg, fontSize: 26, fontWeight: '900' },
  profileMain: { flex: 1 },
  displayName: { fontSize: 19, fontWeight: '800', color: COLORS.ink, marginBottom: 2 },
  handleSub: { fontSize: 12, color: COLORS.ink3, marginBottom: 10 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flexDirection: 'row', alignItems: 'center' },
  statSep: { width: 1, height: 26, backgroundColor: COLORS.borderMid, marginHorizontal: 12 },
  statCol: { alignItems: 'center' },
  statVal: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
  statLab: { fontSize: 10, color: COLORS.ink3, marginTop: 1, fontWeight: '600' },

  // ── Tab strip ──
  tabStrip: { paddingHorizontal: 12, gap: 4 },
  tabBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    position: 'relative',
  },
  tabBtnActive: {},
  tabBtnTxt: { fontSize: 13, fontWeight: '600', color: COLORS.ink3 },
  tabBtnTxtActive: { color: COLORS.ink, fontWeight: '700' },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 14,
    right: 14,
    height: 2,
    borderRadius: 99,
    backgroundColor: COLORS.blue,
  },

  // ── Tab scroll content ──
  tabScrollContent: { paddingHorizontal: 14, paddingBottom: 120, paddingTop: 14 },

  // ── Stub ──
  stubWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  stubIcon: { fontSize: 40 },
  stubTitle: { fontSize: 18, fontWeight: '800', color: COLORS.ink },
  stubSub: { fontSize: 14, color: COLORS.ink3 },

  // ── Session cards ──
  prRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20 },
  prName: { fontSize: 14, fontWeight: '600', color: COLORS.ink, flex: 1, marginRight: 12 },
  prVal: { fontSize: 15, fontWeight: '800', color: COLORS.green },
  sectionKicker: { fontSize: 11, color: COLORS.ink3, fontWeight: '800', letterSpacing: 1.1, marginBottom: 8, marginTop: 4, marginLeft: 6, textTransform: 'uppercase' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 14 },
  avatarXs: { width: 36, height: 36, borderRadius: 999, backgroundColor: COLORS.surface2, alignItems: 'center', justifyContent: 'center' },
  avatarXsText: { fontSize: 14, fontWeight: '800', color: COLORS.ink },
  cardUser: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  cardDate: { fontSize: 11, color: COLORS.ink3, marginTop: 1 },
  cardTitle: { fontSize: 22, fontWeight: '900', color: COLORS.ink, paddingHorizontal: 16, marginTop: 10 },
  cardStats: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 12, gap: 8 },
  cardStat: { flex: 1 },
  cardStatLab: { fontSize: 11, color: COLORS.ink3, fontWeight: '600' },
  cardStatVal: { fontSize: 14, fontWeight: '800', color: COLORS.ink, marginTop: 2 },
  exLine: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginTop: 10 },
  exThumb: { width: 40, height: 40, borderRadius: 10, backgroundColor: COLORS.surface2, alignItems: 'center', justifyContent: 'center' },
  exText: { flex: 1, fontSize: 13, color: COLORS.ink2, fontWeight: '500' },
  seeMore: { textAlign: 'center', fontSize: 12, color: COLORS.ink3, marginTop: 12, fontWeight: '600' },
  socialRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border, gap: 20 },
  socialBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  socialCt: { fontSize: 13, color: COLORS.ink3, fontWeight: '600' },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16 },
  settingLabel: { fontSize: 15, fontWeight: '600', color: COLORS.ink },

  // ── Sheet ──
  muted: { fontSize: 14, color: COLORS.ink3, padding: 16 },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingBottom: 28, paddingTop: 8, borderTopWidth: 0.5, borderColor: COLORS.border },
  sheetGrab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 99, backgroundColor: COLORS.surface3, marginBottom: 8 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 22 },
  sheetRowTxt: { fontSize: 16, fontWeight: '600', color: COLORS.ink },
  sheetCancel: { alignItems: 'center', paddingVertical: 14 },
  footer: { textAlign: 'center', fontSize: 11, color: COLORS.ink3, marginTop: 12, marginBottom: 8, paddingHorizontal: 16 },
});
