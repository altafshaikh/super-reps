import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
  StyleSheet, useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useWorkoutStore } from '@/stores/workoutStore';
import type { Routine } from '@/types';
import { COLORS } from '@/constants';
import { LineChart } from '@/components/ui';

interface LoggedSet { exercise_id: string; weight_kg: number; reps: number; set_index: number }
interface SessionSummary { date: string; volume: number; sets: LoggedSet[] }
type MetricTab = 'Volume' | 'Reps' | 'Duration';

function setsConfig(re: any): { sets: number; rep_range: string } {
  return {
    sets:      re?.sets_config?.sets      ?? re?.sets      ?? 1,
    rep_range: re?.sets_config?.rep_range ?? re?.rep_range ?? '–',
  };
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtRestTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}min ${s}s`;
}

export default function RoutineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const { startWorkout } = useWorkoutStore();
  const { width } = useWindowDimensions();

  const [routine, setRoutine]         = useState<Routine | null>(null);
  const [sessions, setSessions]       = useState<SessionSummary[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState<MetricTab>('Volume');

  useEffect(() => {
    (async () => {
      const [routineRes, sessionsRes] = await Promise.all([
        supabase
          .from('routines')
          .select(`*, days:routine_days(*, exercises:routine_exercises(*, exercise:exercises(*)))`)
          .eq('id', id)
          .single(),
        supabase
          .from('workout_sessions')
          .select('started_at, volume_total, sets:workout_sets(exercise_id, weight_kg, reps, set_index)')
          .eq('routine_id', id)
          .not('finished_at', 'is', null)
          .order('started_at', { ascending: false })
          .limit(12),
      ]);
      if (routineRes.data) setRoutine(routineRes.data as unknown as Routine);
      if (sessionsRes.data) {
        setSessions(sessionsRes.data.map((s: any) => ({
          date:   s.started_at.slice(0, 10),
          volume: s.volume_total ?? 0,
          sets:   (s.sets ?? []) as LoggedSet[],
        })));
      }
      setLoading(false);
    })();
  }, [id]);

  const handleDelete = () => {
    Alert.alert('Delete Routine', `Delete "${routine?.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('routines').delete().eq('id', id);
        router.back();
      }},
    ]);
  };

  const handleMore = () => {
    Alert.alert('Options', undefined, [
      { text: 'Edit Routine', onPress: () => router.push(`/routines/edit/${id}` as any) },
      { text: 'Delete Routine', style: 'destructive', onPress: handleDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleStart = () => {
    if (!routine) return;
    const day = routine.days?.find(d => (d.exercises?.length ?? 0) > 0);
    const inputs = (day?.exercises ?? []).filter((re: any) => re.exercise).map((re: any) => {
      const cfg = setsConfig(re);
      // Default to 1 set; if logged sets exist for this exercise, use that count
      const loggedCount = lastSets[re.exercise_id]?.length ?? 0;
      const setsCount = loggedCount > 0 ? loggedCount : 1;
      return {
        exercise:    re.exercise,
        setsCount,
        defaultReps: parseInt(String(cfg.rep_range).match(/(\d+)/)?.[1] ?? '0', 10),
        restSeconds: re.rest_seconds ?? 90,
      };
    });
    startWorkout(routine.id, routine.name, inputs);
    router.push('/workout/active');
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={COLORS.primary} /></View>;
  if (!routine) return <View style={s.center}><Text style={{ color: COLORS.ink }}>Not found</Text></View>;

  const workoutDays = routine.days?.filter(d => (d.exercises?.length ?? 0) > 0) ?? [];
  const lastSession = sessions[0];

  const chartData = sessions
    .slice().reverse()
    .filter(s => s.volume > 0)
    .map(s => ({ label: fmtDate(s.date), value: s.volume }));

  // Index last session's sets by exercise_id
  const lastSets: Record<string, LoggedSet[]> = {};
  for (const set of lastSession?.sets ?? []) {
    if (!lastSets[set.exercise_id]) lastSets[set.exercise_id] = [];
    lastSets[set.exercise_id].push(set);
  }

  return (
    <View style={s.root}>
      {/* ── Nav header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/routines')} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={20} color={COLORS.ink2} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Routine</Text>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.iconBtn}>
            <Ionicons name="share-outline" size={20} color={COLORS.ink2} />
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={handleMore}>
            <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.ink2} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Routine title + creator ── */}
        <Text style={s.routineName}>{routine.name}</Text>
        {routine.description
          ? <Text style={s.routineDesc}>{routine.description}</Text>
          : <Text style={s.routineCreator}>Your routine</Text>
        }

        {/* ── Start Routine ── */}
        <TouchableOpacity style={s.startBtn} onPress={handleStart} activeOpacity={0.85}>
          <Text style={s.startBtnTxt}>Start Routine</Text>
        </TouchableOpacity>

        {/* ── Volume chart ── */}
        {chartData.length > 0 && (
          <View style={s.chartCard}>
            <View style={s.chartHeaderRow}>
              <View style={s.chartVolRow}>
                <Text style={s.chartVol}>
                  {lastSession.volume.toLocaleString()} kg
                </Text>
                <Text style={s.chartDateBadge}>{fmtDate(lastSession.date)}</Text>
              </View>
              <TouchableOpacity style={s.rangeBtn}>
                <Text style={s.rangeBtnTxt}>Last 3 months</Text>
                <Ionicons name="chevron-down" size={13} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <LineChart data={chartData} width={width - 64} />

            <View style={s.chartTabs}>
              {(['Volume', 'Reps', 'Duration'] as MetricTab[]).map(tab => (
                <TouchableOpacity
                  key={tab}
                  style={[s.chartTab, activeTab === tab && s.chartTabActive]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[s.chartTabTxt, activeTab === tab && s.chartTabActiveTxt]}>
                    {tab}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Exercises section ── */}
        <View style={s.exSectionHeader}>
          <Text style={s.exSectionTitle}>Exercises</Text>
          <TouchableOpacity onPress={() => router.push(`/routines/edit/${id}` as any)}>
            <Text style={s.editLink}>Edit Routine</Text>
          </TouchableOpacity>
        </View>

        {workoutDays.map(day => (
          <View key={day.id}>
            {workoutDays.length > 1 && (
              <Text style={s.dayLabel}>{day.name}</Text>
            )}

            {(day.exercises ?? []).map((re: any) => {
              const cfg    = setsConfig(re);
              const logged = lastSets[re.exercise_id] ?? [];

              // If logged sets exist → show them; else show 1 placeholder row
              const rows = logged.length > 0
                ? logged.map((s, i) => ({ set: i + 1, kg: s.weight_kg, reps: s.reps, logged: true }))
                : [{ set: 1, kg: 0, reps: 0, logged: false }];

              return (
                <View key={re.id} style={s.exCard}>
                  {/* Exercise header */}
                  <View style={s.exNameRow}>
                    <View style={s.exThumb}>
                      <Ionicons name="barbell-outline" size={18} color={COLORS.primary} />
                    </View>
                    <Text style={s.exName}>{re.exercise?.name}</Text>
                  </View>

                  {/* Rest timer */}
                  <View style={s.restRow}>
                    <Ionicons name="time-outline" size={14} color={COLORS.primary} />
                    <Text style={s.restTxt}>
                      Rest Timer: {fmtRestTime(re.rest_seconds ?? 60)}
                    </Text>
                  </View>

                  {/* SET / KG / REPS table */}
                  <View style={s.table}>
                    <View style={s.tableHeader}>
                      <Text style={[s.col1, s.colHead]}>SET</Text>
                      <Text style={[s.col2, s.colHead]}>KG</Text>
                      <Text style={[s.col3, s.colHead]}>REPS</Text>
                    </View>

                    {rows.map((row, i) => (
                      <View key={i} style={[s.tableRow, i % 2 === 1 && s.tableRowAlt]}>
                        <Text style={[s.col1, s.colVal]}>{row.set}</Text>
                        <Text style={[s.col2, s.colVal, !row.logged && s.colDim]}>
                          {row.logged ? row.kg : '–'}
                        </Text>
                        <Text style={[s.col3, s.colVal, !row.logged && s.colDim]}>
                          {row.logged ? row.reps : '–'}
                        </Text>
                      </View>
                    ))}
                  </View>

                </View>
              );
            })}
          </View>
        ))}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },

  // Nav header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    color: COLORS.ink, fontWeight: '600', fontSize: 17,
  },
  headerRight: { flexDirection: 'row', gap: 2 },

  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  // Routine title
  routineName:    { fontSize: 28, fontWeight: '800', color: COLORS.ink, marginBottom: 4 },
  routineCreator: { fontSize: 14, color: COLORS.ink3, marginBottom: 20 },
  routineDesc:    { fontSize: 14, color: COLORS.ink3, marginBottom: 20 },

  // Start button
  startBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 24,
  },
  startBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 },

  // Chart card
  chartCard:      { marginBottom: 24 },
  chartHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  chartVolRow:    { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  chartVol:       { fontSize: 24, fontWeight: '900', color: COLORS.ink },
  chartDateBadge: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
  rangeBtn:       { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rangeBtnTxt:    { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  chartTabs:      { flexDirection: 'row', gap: 8, marginTop: 14 },
  chartTab:       {
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: COLORS.surface,
  },
  chartTabActive: { backgroundColor: COLORS.primary },
  chartTabTxt:    { fontSize: 13, fontWeight: '600', color: COLORS.ink3 },
  chartTabActiveTxt: { color: '#fff' },

  // Section header
  exSectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  exSectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.ink3, letterSpacing: 0.5 },
  editLink:       { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  dayLabel:       { fontSize: 13, fontWeight: '700', color: COLORS.ink3, marginBottom: 10, marginTop: 4 },

  // Exercise card
  exCard:    { marginBottom: 28 },
  exNameRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  exThumb:   {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.surface2, alignItems: 'center', justifyContent: 'center',
  },
  exName: { flex: 1, fontSize: 17, fontWeight: '700', color: COLORS.primary },

  // Rest row
  restRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  restTxt: { fontSize: 13, color: COLORS.primary, fontWeight: '500' },

  // Table
  table: { backgroundColor: COLORS.surface, borderRadius: 12, overflow: 'hidden', marginBottom: 8 },
  tableHeader: {
    flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.surface2,
  },
  tableRow:    { flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 16 },
  tableRowAlt: { backgroundColor: COLORS.surface2 },
  col1: { flex: 1, textAlign: 'center' },
  col2: { flex: 1.5, textAlign: 'center' },
  col3: { flex: 1.5, textAlign: 'center' },
  colHead: { fontSize: 11, fontWeight: '700', color: COLORS.ink3, letterSpacing: 1 },
  colVal:  { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  colDim:  { color: COLORS.ink3 },

});
