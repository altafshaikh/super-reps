import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  StatusBar,
  Platform,
  Modal,
  Share,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import { COLORS } from '@/constants';
import type { WorkoutSession, SetLog, PersonalRecord } from '@/types';
import { SRCard, SRDivider, SRSectionLabel } from '@/components/ui';
import { formatWeight, timeAgo } from '@/lib/utils';
import { derivePersonalBestsFromFlatRows, fetchAllSetsForPersonalBests } from '@/lib/personal-bests';

type SetRow = SetLog & { exercise?: { name: string } | null };
type SessionRow = WorkoutSession & { sets?: SetRow[] };

function formatLongDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDurationCompact(sec: number | null | undefined) {
  if (sec == null || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}h ${mm}min`;
  }
  return `${m}min`;
}

function weeklyBars(sessions: SessionRow[], weeks: number, metric: 'duration' | 'volume' | 'reps') {
  const bars: { label: string; value: number; isCurrent: boolean }[] = [];
  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7 * (weeks - i) - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    const inWeek = sessions.filter(s => {
      const d = new Date(s.started_at);
      return d >= weekStart && d < weekEnd;
    });
    let value = 0;
    if (metric === 'volume') {
      value = inWeek.reduce((sum, s) => sum + Number(s.volume_total ?? 0), 0);
    } else if (metric === 'duration') {
      value = inWeek.reduce((sum, s) => sum + Number(s.duration_seconds ?? 0), 0) / 3600;
    } else {
      value = inWeek.reduce(
        (sum, s) => sum + (s.sets ?? []).reduce((r, st) => r + Number(st.reps ?? 0), 0),
        0,
      );
    }
    const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
    bars.push({ label, value, isCurrent: i === weeks - 1 });
  }
  return bars;
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

const PROFILE_SESSION_LIMIT = 500;

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useUserStore();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [prDerived, setPrDerived] = useState<{
    bests: PersonalRecord[];
    prCountBySession: Map<string, number>;
  }>({ bests: [], prCountBySession: new Map() });
  const [chartMetric, setChartMetric] = useState<'duration' | 'volume' | 'reps'>('duration');
  const [menuSession, setMenuSession] = useState<SessionRow | null>(null);
  const [loading, setLoading] = useState(true);

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
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handle = user?.username ?? user?.email?.split('@')[0] ?? 'lifter';
  const displayName = user?.username
    ? user.username.replace(/_/g, ' ')
    : (user?.email?.split('@')[0] ?? 'Lifter');
  const initial = displayName[0]?.toUpperCase() ?? 'U';

  const prCountBySession = prDerived.prCountBySession;

  const chartWeeks = useMemo(() => {
    if (sessions.length === 0) return 12;
    const oldest = new Date(sessions[sessions.length - 1].started_at).getTime();
    const spanDays = Math.max(1, (Date.now() - oldest) / 86400000);
    return Math.min(104, Math.max(12, Math.ceil(spanDays / 7) + 1));
  }, [sessions]);

  const weeklyData = useMemo(
    () => weeklyBars(sessions, chartWeeks, chartMetric),
    [sessions, chartWeeks, chartMetric],
  );
  const maxBar = Math.max(...weeklyData.map(d => d.value), chartMetric === 'duration' ? 0.25 : 1);

  const shareProfile = async () => {
    try {
      await Share.share({
        message: `Training on SuperReps — @${handle}`,
      });
    } catch {
      /* cancelled */
    }
  };

  const deleteSession = async (id: string) => {
    const { error } = await supabase.from('workout_sessions').delete().eq('id', id);
    if (error) {
      Alert.alert('Could not delete', error.message);
      return;
    }
    setMenuSession(null);
    void load();
  };

  const chartSubtitle = useMemo(() => {
    const last = sessions[0];
    if (!last?.started_at) return 'Log workouts to see activity';
    const ago = timeAgo(last.started_at);
    const dur = formatDurationCompact(last.duration_seconds);
    return `Last workout ${ago} · ${dur}`;
  }, [sessions]);

  const screenW = Dimensions.get('window').width;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Top bar */}
        <View style={s.topBar}>
          <Text style={s.handle} numberOfLines={1}>
            {handle}
          </Text>
          <View style={s.topIcons}>
            <TouchableOpacity onPress={() => router.push('/profile/settings')} hitSlop={hitSlop}>
              <Ionicons name="create-outline" size={22} color={COLORS.ink} />
            </TouchableOpacity>
            <TouchableOpacity onPress={shareProfile} hitSlop={hitSlop}>
              <Ionicons name="share-outline" size={22} color={COLORS.ink} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/profile/settings')} hitSlop={hitSlop}>
              <Ionicons name="settings-outline" size={22} color={COLORS.ink} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile row: avatar + name + stats */}
        <View style={s.profileRow}>
          <View style={s.avatarSm}>
            <Text style={s.avatarSmText}>{initial}</Text>
          </View>
          <View style={s.profileMain}>
            <Text style={s.displayName}>{displayName}</Text>
            <View style={s.statsRow}>
              <View style={s.statCol}>
                <Text style={s.statVal}>{sessions.length}</Text>
                <Text style={s.statLab}>Workouts</Text>
              </View>
              <View style={s.statSep} />
              <View style={s.statCol}>
                <Text style={s.statVal}>—</Text>
                <Text style={s.statLab}>Followers</Text>
              </View>
              <View style={s.statSep} />
              <View style={s.statCol}>
                <Text style={s.statVal}>—</Text>
                <Text style={s.statLab}>Following</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Activity chart */}
        <SRCard style={{ marginTop: 10 }}>
          <View style={s.chartHeader}>
            <Text style={s.chartSub} numberOfLines={2}>
              {chartSubtitle}
            </Text>
            <Text style={s.chartRange}>Last {chartWeeks} weeks</Text>
          </View>
          <View style={[s.chartArea, { paddingHorizontal: Math.max(8, (screenW - 28) * 0.02) }]}>
            {weeklyData.map((d, i) => {
              const h = d.value > 0 ? Math.max(8, (d.value / maxBar) * 110) : 4;
              return (
                <View key={i} style={s.barCol}>
                  <View
                    style={[
                      s.bar,
                      { height: h, backgroundColor: d.isCurrent ? COLORS.blue : COLORS.surface3 },
                    ]}
                  />
                  <Text style={[s.barLab, d.isCurrent && { color: COLORS.ink2 }]} numberOfLines={1}>
                    {d.label}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={s.pillRow}>
            {(['duration', 'volume', 'reps'] as const).map(m => (
              <TouchableOpacity
                key={m}
                onPress={() => setChartMetric(m)}
                style={[s.pill, chartMetric === m && s.pillOn]}
                activeOpacity={0.85}
              >
                <Text style={[s.pillTxt, chartMetric === m && s.pillTxtOn]}>
                  {m === 'duration' ? 'Duration' : m === 'volume' ? 'Volume' : 'Reps'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </SRCard>

        {/* Data & import */}
        <Text style={[s.sectionKicker, { marginTop: 8 }]}>Data</Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push('/profile/import-export')}
          style={s.dataCard}
        >
          <View style={s.dataCardInner}>
            <Ionicons name="swap-horizontal-outline" size={22} color={COLORS.blue} />
            <View style={{ flex: 1 }}>
              <Text style={s.dataCardTitle}>Import / Export</Text>
              <Text style={s.dataCardSub}>Hevy workout CSV → import past sessions</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textDim} />
          </View>
        </TouchableOpacity>

        {/* Dashboard */}
        <Text style={s.sectionKicker}>Dashboard</Text>
        <View style={s.dashGrid}>
          {[
            { icon: 'analytics-outline' as const, label: 'Statistics', onPress: () => Alert.alert('Statistics', 'Use the chart above to compare duration, volume, and reps by week.') },
            { icon: 'barbell' as const, label: 'Exercises', onPress: () => router.push('/(tabs)/workouts') },
            { icon: 'body' as const, label: 'Measures', onPress: () => Alert.alert('Measures', 'Body measurements coming soon.') },
            { icon: 'calendar' as const, label: 'Calendar', onPress: () => Alert.alert('Calendar', 'Training calendar coming soon.') },
          ].map(tile => (
            <TouchableOpacity key={tile.label} style={s.dashTile} onPress={tile.onPress} activeOpacity={0.8}>
              <Ionicons name={tile.icon} size={28} color={COLORS.blue} />
              <Text style={s.dashTileLab}>{tile.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* PRs strip */}
        {prDerived.bests.length > 0 ? (
          <SRCard style={{ marginTop: 12 }}>
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
        ) : null}

        {/* Workouts feed */}
        <Text style={[s.sectionKicker, { marginTop: 16 }]}>Workouts</Text>
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
            const rec = prCountBySession.get(session.id) ?? 0;
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
                  <TouchableOpacity onPress={() => setMenuSession(session)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="ellipsis-horizontal" size={22} color={COLORS.ink3} />
                  </TouchableOpacity>
                </View>
                <Text style={s.cardTitle}>{title}</Text>
                <View style={s.cardStats}>
                  <View style={s.cardStat}>
                    <Text style={s.cardStatLab}>Time</Text>
                    <Text style={s.cardStatVal}>{formatDurationCompact(session.duration_seconds)}</Text>
                  </View>
                  <View style={s.cardStat}>
                    <Text style={s.cardStatLab}>Volume</Text>
                    <Text style={s.cardStatVal}>
                      {Number(session.volume_total ?? 0).toLocaleString('en-US', { maximumFractionDigits: 1 })} kg
                    </Text>
                  </View>
                  <View style={s.cardStat}>
                    <Text style={s.cardStatLab}>Reps</Text>
                    <Text style={s.cardStatVal}>{totalReps.toLocaleString('en-US')}</Text>
                  </View>
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
                    <Text style={s.exText}>
                      {g.setCount} set{g.setCount === 1 ? '' : 's'} {g.name}
                    </Text>
                  </View>
                ))}
                {more > 0 ? (
                  <Text style={s.seeMore}>See {more} more exercise{more === 1 ? '' : 's'}</Text>
                ) : null}
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
                      try {
                        await Share.share({ message: `${title} — ${formatLongDate(session.started_at)}` });
                      } catch {
                        /* */
                      }
                    }}
                  >
                    <Ionicons name="share-outline" size={20} color={COLORS.ink3} />
                  </TouchableOpacity>
                </View>
              </SRCard>
            );
          })
        )}

      </ScrollView>

      <Modal visible={menuSession !== null} transparent animationType="fade" onRequestClose={() => setMenuSession(null)}>
        <View style={s.sheetOverlay}>
          <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={() => setMenuSession(null)} />
          <View style={s.sheet}>
            <View style={s.sheetGrab} />
            {menuSession ? (
              <>
                <TouchableOpacity
                  style={s.sheetRow}
                  onPress={async () => {
                    const t = menuSession.routine_name ?? 'Workout';
                    setMenuSession(null);
                    try {
                      await Share.share({ message: `${t} — ${formatLongDate(menuSession.started_at)}` });
                    } catch {
                      /* */
                    }
                  }}
                >
                  <Ionicons name="share-outline" size={22} color={COLORS.ink} />
                  <Text style={s.sheetRowTxt}>Share workout</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.sheetRow}
                  onPress={() => {
                    setMenuSession(null);
                    Alert.alert('Save as routine', 'We will add this in a future update.');
                  }}
                >
                  <Ionicons name="download-outline" size={22} color={COLORS.ink} />
                  <Text style={s.sheetRowTxt}>Save as routine</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.sheetRow}
                  onPress={() => {
                    setMenuSession(null);
                    Alert.alert('Copy workout', 'Duplicate session to repeat the same day — coming soon.');
                  }}
                >
                  <Ionicons name="copy-outline" size={22} color={COLORS.ink} />
                  <Text style={s.sheetRowTxt}>Copy workout</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.sheetRow}
                  onPress={() => {
                    setMenuSession(null);
                    Alert.alert('Edit workout', 'Editing past sessions — coming soon.');
                  }}
                >
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
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingBottom: 120, paddingHorizontal: 14 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 52,
    paddingBottom: 12,
    paddingHorizontal: 6,
  },
  handle: { fontSize: 18, fontWeight: '800', color: COLORS.ink, flex: 1, marginRight: 12 },
  topIcons: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  avatarSm: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSmText: { color: COLORS.bg, fontSize: 28, fontWeight: '900' },
  profileMain: { flex: 1 },
  displayName: { fontSize: 20, fontWeight: '800', color: COLORS.ink, marginBottom: 10 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statCol: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 17, fontWeight: '800', color: COLORS.ink },
  statLab: { fontSize: 11, color: COLORS.ink3, marginTop: 2, fontWeight: '600' },
  statSep: { width: 1, height: 28, backgroundColor: COLORS.borderMid },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 12,
  },
  chartSub: { flex: 1, fontSize: 12, color: COLORS.ink3, lineHeight: 17 },
  chartRange: { fontSize: 12, fontWeight: '700', color: COLORS.blue },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 130,
    paddingBottom: 6,
    gap: 3,
    marginTop: 8,
  },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', minWidth: 0 },
  bar: { width: '100%', borderRadius: 4, maxWidth: 22 },
  barLab: { fontSize: 8, color: COLORS.ink3, fontWeight: '600', marginTop: 4 },
  pillRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: COLORS.surface2,
  },
  pillOn: { backgroundColor: COLORS.blue },
  pillTxt: { fontSize: 12, fontWeight: '700', color: COLORS.ink2 },
  pillTxtOn: { color: COLORS.bg },
  sectionKicker: {
    fontSize: 11,
    color: COLORS.ink3,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 8,
    marginTop: 4,
    marginLeft: 6,
    textTransform: 'uppercase',
  },
  dataCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    marginBottom: 10,
    marginHorizontal: 2,
  },
  dataCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  dataCardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.ink },
  dataCardSub: { fontSize: 12, color: COLORS.ink3, marginTop: 3 },
  dashGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dashTile: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    paddingVertical: 22,
    alignItems: 'center',
    gap: 8,
  },
  dashTileLab: { fontSize: 13, fontWeight: '700', color: COLORS.ink2 },
  prRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  prName: { fontSize: 14, fontWeight: '600', color: COLORS.ink, flex: 1, marginRight: 12 },
  prVal: { fontSize: 15, fontWeight: '800', color: COLORS.green },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 14 },
  avatarXs: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: COLORS.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarXsText: { fontSize: 14, fontWeight: '800', color: COLORS.ink },
  cardUser: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  cardDate: { fontSize: 11, color: COLORS.ink3, marginTop: 1 },
  cardTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.ink,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  cardStats: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 12, gap: 8 },
  cardStat: { flex: 1 },
  cardStatLab: { fontSize: 11, color: COLORS.ink3, fontWeight: '600' },
  cardStatVal: { fontSize: 14, fontWeight: '800', color: COLORS.ink, marginTop: 2 },
  exLine: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginTop: 10 },
  exThumb: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exText: { flex: 1, fontSize: 13, color: COLORS.ink2, fontWeight: '500' },
  seeMore: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.ink3,
    marginTop: 12,
    fontWeight: '600',
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    gap: 20,
  },
  socialBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  socialCt: { fontSize: 13, color: COLORS.ink3, fontWeight: '600' },
  muted: { fontSize: 14, color: COLORS.ink3, padding: 16 },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 28,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderColor: COLORS.border,
  },
  sheetGrab: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 99,
    backgroundColor: COLORS.surface3,
    marginBottom: 8,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  sheetRowTxt: { fontSize: 16, fontWeight: '600', color: COLORS.ink },
  sheetCancel: { alignItems: 'center', paddingVertical: 14 },
});
