import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import { COLORS } from '@/constants';
import { formatWeight } from '@/lib/utils';
import { LineChart } from '@/components/ui';
import type { Exercise } from '@/types';

type ExerciseTab = 'summary' | 'history' | 'howto';

interface SetRow {
  weight_kg: number;
  reps: number;
  completed_at: string;
  session_id: string;
}

interface SessionGroup {
  date: string;
  sessionId: string;
  sets: SetRow[];
}

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUserStore();

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ExerciseTab>('summary');

  const [sets, setSets] = useState<SetRow[]>([]);
  const [sessions, setSessions] = useState<SessionGroup[]>([]);

  const [metric, setMetric] = useState<'weight' | '1rm' | 'volume'>('weight');

  useEffect(() => {
    if (!id) return;
    supabase.from('exercises').select('*').eq('id', id).single()
      .then(({ data }) => {
        if (data) setExercise(data as Exercise);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    supabase
      .from('workout_sets')
      .select('weight_kg, reps, completed_at, session_id')
      .eq('exercise_id', id)
      .eq('user_id', user.id)
      .order('completed_at', { ascending: true })
      .limit(500)
      .then(({ data }) => {
        if (!data) return;
        setSets(data as SetRow[]);

        // Group by session
        const map = new Map<string, SessionGroup>();
        for (const row of data) {
          const date = row.completed_at.slice(0, 10);
          if (!map.has(row.session_id)) {
            map.set(row.session_id, { date, sessionId: row.session_id, sets: [] });
          }
          map.get(row.session_id)!.sets.push(row);
        }
        setSessions([...map.values()].reverse());
      });
  }, [user, id]);

  const chartData = useCallback(() => {
    // One data point per session — group by session_id
    const bySession = new Map<string, { date: string; value: number }>();
    for (const row of sets) {
      const date = row.completed_at.slice(0, 10);
      let value = 0;
      if (metric === 'weight') value = row.weight_kg;
      else if (metric === '1rm') value = row.weight_kg * (1 + row.reps / 30);
      else if (metric === 'volume') value = row.weight_kg * row.reps;

      const existing = bySession.get(row.session_id);
      if (!existing || value > existing.value) {
        bySession.set(row.session_id, { date, value });
      }
    }
    return [...bySession.values()].map(d => ({ label: d.date.slice(5), value: d.value }));
  }, [sets, metric]);

  const prs = useCallback(() => {
    if (!sets.length) return { weight: 0, oneRM: 0, volume: 0 };
    const weight = Math.max(...sets.map(s => s.weight_kg));
    const oneRM = Math.max(...sets.map(s => s.weight_kg * (1 + s.reps / 30)));
    const volume = Math.max(...sets.map(s => s.weight_kg * s.reps));
    return { weight, oneRM: Math.round(oneRM * 10) / 10, volume };
  }, [sets]);

  if (loading) {
    return (
      <View style={[s.root, s.center]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  if (!exercise) {
    return (
      <View style={[s.root, s.center]}>
        <Text style={s.muted}>Exercise not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={s.link}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const prData = prs();
  const data = chartData();

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={26} color={COLORS.ink} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{exercise.name}</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Tab strip */}
      <View style={s.tabStrip}>
        {(['summary', 'history', 'howto'] as ExerciseTab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tabBtn, tab === t && s.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
              {t === 'summary' ? 'Summary' : t === 'history' ? 'History' : 'How To'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Summary tab */}
        {tab === 'summary' && (
          <>
            {/* Exercise image / placeholder */}
            <View style={s.imageWrap}>
              {exercise.image_url ? (
                <Image source={{ uri: exercise.image_url }} style={s.exerciseImage} resizeMode="contain" />
              ) : (
                <View style={s.imagePlaceholder}>
                  <Ionicons name="barbell-outline" size={64} color={COLORS.ink4} />
                </View>
              )}
            </View>

            <Text style={s.exName}>{exercise.name}</Text>
            <Text style={s.exSubtitle}>Primary: {exercise.muscle_groups?.[0]}</Text>

            {/* Metric selector */}
            <View style={s.metricRow}>
              {(['weight', '1rm', 'volume'] as const).map(m => (
                <TouchableOpacity
                  key={m}
                  style={[s.metricChip, metric === m && s.metricChipActive]}
                  onPress={() => setMetric(m)}
                >
                  <Text style={[s.metricTxt, metric === m && s.metricTxtActive]}>
                    {m === 'weight' ? 'Heaviest Weight' : m === '1rm' ? 'One Rep Max' : 'Best Set Vol'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Chart */}
            {data.length > 0 ? (
              <View style={s.chartWrap}>
                <LineChart
                  data={data}
                  width={340}
                />
              </View>
            ) : (
              <View style={s.emptyChart}>
                <Text style={s.muted}>No data yet — log this exercise to see progress</Text>
              </View>
            )}

            {/* PRs */}
            <View style={s.prSection}>
              <View style={s.prHeader}>
                <Text style={s.prHeaderTxt}>🏆 Personal Records</Text>
              </View>
              <View style={s.prRow}>
                <Text style={s.prLabel}>Heaviest Weight</Text>
                <Text style={s.prVal}>{prData.weight > 0 ? `${formatWeight(prData.weight)} kg` : '—'}</Text>
              </View>
              <View style={s.prDivider} />
              <View style={s.prRow}>
                <Text style={s.prLabel}>Best 1RM</Text>
                <Text style={s.prVal}>{prData.oneRM > 0 ? `${formatWeight(prData.oneRM)} kg` : '—'}</Text>
              </View>
              <View style={s.prDivider} />
              <View style={s.prRow}>
                <Text style={s.prLabel}>Best Set Volume</Text>
                <Text style={s.prVal}>{prData.volume > 0 ? `${formatWeight(prData.volume)} kg` : '—'}</Text>
              </View>
            </View>
          </>
        )}

        {/* History tab */}
        {tab === 'history' && (
          <>
            {sessions.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.muted}>No history yet — log this exercise to see past sessions</Text>
              </View>
            ) : sessions.map(session => (
              <View key={session.sessionId} style={s.historyCard}>
                <Text style={s.historyDate}>{new Date(session.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                {session.sets.map((set, i) => (
                  <Text key={i} style={s.historySet}>
                    Set {i + 1}: {formatWeight(set.weight_kg)} kg × {set.reps} reps
                  </Text>
                ))}
              </View>
            ))}
          </>
        )}

        {/* How To tab */}
        {tab === 'howto' && (
          <>
            <View style={s.imageWrap}>
              {exercise.image_url ? (
                <Image source={{ uri: exercise.image_url }} style={s.exerciseImage} resizeMode="contain" />
              ) : (
                <View style={s.imagePlaceholder}>
                  <Ionicons name="barbell-outline" size={64} color={COLORS.ink4} />
                </View>
              )}
            </View>

            <Text style={s.exName}>{exercise.name}</Text>

            {exercise.form_cues && exercise.form_cues.length > 0 ? (
              <View style={s.cuesWrap}>
                {exercise.form_cues.map((cue, i) => (
                  <View key={i} style={s.cueRow}>
                    <Text style={s.cueNum}>{i + 1}</Text>
                    <Text style={s.cueTxt}>{cue}</Text>
                  </View>
                ))}
              </View>
            ) : exercise.instructions ? (
              <View style={s.cuesWrap}>
                <Text style={s.instructionsTxt}>{exercise.instructions}</Text>
              </View>
            ) : (
              <View style={s.empty}>
                <Text style={s.muted}>No coaching cues available yet.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  muted: { color: COLORS.ink3, fontSize: 14, textAlign: 'center' },
  link: { color: COLORS.primary, fontSize: 15 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  headerTitle: { color: COLORS.ink, fontWeight: '700', fontSize: 17, flex: 1, textAlign: 'center' },

  tabStrip: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border,
    paddingHorizontal: 16,
  },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabTxt: { color: COLORS.ink3, fontWeight: '600', fontSize: 14 },
  tabTxtActive: { color: COLORS.primary },

  scroll: { paddingHorizontal: 20, paddingBottom: 60 },

  imageWrap: { marginTop: 20, marginBottom: 16, alignItems: 'center' },
  exerciseImage: { width: '100%', height: 200, borderRadius: 16 },
  imagePlaceholder: {
    width: '100%', height: 200, borderRadius: 16,
    backgroundColor: COLORS.surface2, alignItems: 'center', justifyContent: 'center',
  },

  exName: { color: COLORS.ink, fontSize: 24, fontWeight: '800', marginBottom: 4 },
  exSubtitle: { color: COLORS.ink3, fontSize: 14, marginBottom: 16, textTransform: 'capitalize' },

  metricRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  metricChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.surface2, borderWidth: 0.5, borderColor: COLORS.border,
  },
  metricChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  metricTxt: { color: COLORS.ink3, fontSize: 12, fontWeight: '600' },
  metricTxtActive: { color: COLORS.bg },

  chartWrap: { marginBottom: 20 },
  emptyChart: {
    height: 120, backgroundColor: COLORS.surface2, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },

  prSection: {
    backgroundColor: COLORS.surface2, borderRadius: 16,
    borderWidth: 0.5, borderColor: COLORS.border, overflow: 'hidden',
  },
  prHeader: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  prHeaderTxt: { color: COLORS.ink, fontWeight: '700', fontSize: 16 },
  prRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  prLabel: { color: COLORS.ink2, fontSize: 14 },
  prVal: { color: COLORS.primary, fontWeight: '700', fontSize: 16 },
  prDivider: { height: 0.5, backgroundColor: COLORS.border, marginHorizontal: 16 },

  historyCard: {
    backgroundColor: COLORS.surface2, borderRadius: 14,
    borderWidth: 0.5, borderColor: COLORS.border,
    padding: 16, marginBottom: 10,
  },
  historyDate: { color: COLORS.ink, fontWeight: '700', fontSize: 14, marginBottom: 8 },
  historySet: { color: COLORS.ink2, fontSize: 13, lineHeight: 22 },

  cuesWrap: { marginTop: 16, gap: 12 },
  cueRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  cueNum: {
    color: COLORS.primary, fontWeight: '800', fontSize: 16,
    width: 28, textAlign: 'center', paddingTop: 1,
  },
  cueTxt: { color: COLORS.ink, fontSize: 15, lineHeight: 22, flex: 1 },
  instructionsTxt: { color: COLORS.ink2, fontSize: 15, lineHeight: 24 },

  empty: { paddingVertical: 60, alignItems: 'center' },
});
