import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Defs, LinearGradient, Stop, Line, Text as SvgText } from 'react-native-svg';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import { getWeeklyReview } from '@/lib/ai';
import { COLORS } from '@/constants';
import { SRCard, SRPill, SRDivider, SRSectionLabel } from '@/components/ui';

type Period = '4W' | '3M' | 'All';

interface SessionRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  volume_total: number;
  routine_name: string | null;
}

interface SetRow {
  exercise_id: string;
  weight_kg: number;
  reps: number;
  completed_at: string;
  exercise?: { name: string; muscle_groups: string[] } | null;
}

interface WeeklyVolume { week: string; vol: number }

// ── SVG Area Chart ────────────────────────────────────────────

function AreaChart({ data, width = 300, height = 90 }: { data: WeeklyVolume[]; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const pad = { l: 4, r: 4, t: 10, b: 20 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const vols = data.map(d => d.vol);
  const maxV = Math.max(...vols);
  const minV = Math.min(...vols) * 0.85;
  const range = maxV - minV || 1;

  const pts = data.map((d, i) => ({
    x: pad.l + (i / (data.length - 1)) * W,
    y: pad.t + H - ((d.vol - minV) / range) * H,
    label: d.week,
    vol: d.vol,
  }));

  const lineParts = pts.map((p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = pts[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `C ${cx} ${prev.y} ${cx} ${p.y} ${p.x} ${p.y}`;
  });
  const linePath = lineParts.join(' ');
  const last = pts[pts.length - 1];
  const first = pts[0];
  const areaPath = `${linePath} L ${last.x} ${height - pad.b} L ${first.x} ${height - pad.b} Z`;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <LinearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={COLORS.ink} stopOpacity="0.18" />
          <Stop offset="100%" stopColor={COLORS.ink} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      {[0, 0.5, 1].map((t, i) => (
        <Line key={i} x1={pad.l} x2={width - pad.r}
          y1={pad.t + H * (1 - t)} y2={pad.t + H * (1 - t)}
          stroke={COLORS.border} strokeWidth="0.5" />
      ))}
      <Path d={areaPath} fill="url(#vg)" />
      <Path d={linePath} fill="none" stroke={COLORS.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y}
          r={i === pts.length - 1 ? 4 : 2.5}
          fill={i === pts.length - 1 ? COLORS.ink : COLORS.bg}
          stroke={COLORS.ink} strokeWidth={i === pts.length - 1 ? 0 : 1.5} />
      ))}
      {pts.map((p, i) => (
        <SvgText key={i} x={p.x} y={height - 3} textAnchor="middle"
          fontSize="9" fill={i === pts.length - 1 ? COLORS.ink : COLORS.ink3}
          fontWeight={i === pts.length - 1 ? '700' : '400'}>
          {p.label}
        </SvgText>
      ))}
      <SvgText x={last.x} y={last.y - 8} textAnchor="middle"
        fontSize="10" fontWeight="700" fill={COLORS.ink}>
        {last.vol >= 1000 ? `${(last.vol / 1000).toFixed(1)}k` : String(last.vol)}
      </SvgText>
    </Svg>
  );
}

// ── Mini sparkline ────────────────────────────────────────────

function Sparkline({ values, width = 48, height = 20 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values), min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * width,
    y: height - ((v - min) / range) * (height * 0.8) - height * 0.1,
  }));
  const path = pts.map((p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = pts[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `C ${cx} ${prev.y} ${cx} ${p.y} ${p.x} ${p.y}`;
  }).join(' ');
  const last = pts[pts.length - 1];
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Path d={path} fill="none" stroke={COLORS.ink3} strokeWidth="1.5" strokeLinecap="round" />
      <Circle cx={last.x} cy={last.y} r="2.5" fill={COLORS.ink3} />
    </Svg>
  );
}

// ── Heatmap ───────────────────────────────────────────────────

function WorkoutHeatmap({ sessionDates, period }: { sessionDates: string[]; period: Period }) {
  const weeks = period === '4W' ? 4 : period === '3M' ? 12 : 16;
  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const heatmap = useMemo(() => {
    const grid: boolean[][] = [];
    const today = new Date();
    const dateSet = new Set(sessionDates.map(d => d.slice(0, 10)));
    for (let w = 0; w < weeks; w++) {
      const row: boolean[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(today);
        date.setDate(today.getDate() - (weeks - 1 - w) * 7 - (6 - d) + (today.getDay() === 0 ? -6 : 1 - today.getDay()));
        const iso = date.toISOString().slice(0, 10);
        row.push(dateSet.has(iso));
      }
      grid.push(row);
    }
    return grid;
  }, [sessionDates, weeks]);

  const totalSessions = heatmap.flat().filter(Boolean).length;

  return (
    <SRCard style={s.card}>
      <View style={s.heatmapHeader}>
        <Text style={s.cardTitle}>Workout Frequency</Text>
        <Text style={s.cardSub}>{totalSessions} sessions · {period}</Text>
      </View>
      <View style={s.heatmapDayRow}>
        <View style={{ width: 22 }} />
        {DAY_LABELS.map((d, i) => (
          <Text key={i} style={s.heatmapDayLabel}>{d}</Text>
        ))}
      </View>
      {heatmap.map((week, wi) => (
        <View key={wi} style={s.heatmapRow}>
          <Text style={s.heatmapWeekLabel}>W{wi + 1}</Text>
          {week.map((active, di) => (
            <View key={di} style={[s.heatmapCell, { backgroundColor: active ? COLORS.ink : COLORS.surface2 }]} />
          ))}
        </View>
      ))}
      <View style={s.heatmapLegend}>
        <View style={[s.legendDot, { backgroundColor: COLORS.surface2 }]} />
        <Text style={s.legendText}>Rest</Text>
        <View style={[s.legendDot, { backgroundColor: COLORS.ink }]} />
        <Text style={s.legendText}>Trained</Text>
      </View>
    </SRCard>
  );
}

// ── Main Screen ───────────────────────────────────────────────

export default function ProgressScreen() {
  const { user } = useUserStore();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>('4W');
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sets, setSets] = useState<SetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [activeLift, setActiveLift] = useState('');

  const periodDays = period === '4W' ? 28 : period === '3M' ? 90 : 730;

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - periodDays);

    const { data: sessData } = await supabase
      .from('workout_sessions')
      .select('id, started_at, finished_at, duration_seconds, volume_total, routine_name')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .gte('started_at', since.toISOString())
      .order('started_at', { ascending: true });

    setSessions((sessData ?? []) as SessionRow[]);

    const { data: setsData } = await supabase
      .from('workout_sets')
      .select('exercise_id, weight_kg, reps, completed_at, exercise:exercises(name, muscle_groups)')
      .in('session_id', (sessData ?? []).map(s => s.id));

    setSets((setsData ?? []) as unknown as SetRow[]);
    setLoading(false);
  }, [user, periodDays]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  // ── Derived stats ──────────────────────────────────────────

  const totalSessions = sessions.length;
  const totalVolumeKg = sessions.reduce((a, s) => a + (s.volume_total ?? 0), 0);
  const avgDuration = sessions.length
    ? Math.round(sessions.reduce((a, s) => a + (s.duration_seconds ?? 0), 0) / sessions.length / 60)
    : 0;

  // Previous period for trend comparison
  const prevPeriodDays = periodDays;
  const prevSince = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - periodDays * 2); return d;
  }, [periodDays]);
  const prevUntil = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - periodDays); return d;
  }, [periodDays]);

  const prevSessionsCount = useMemo(() => {
    return sessions.filter(s => {
      const d = new Date(s.started_at);
      return d >= prevSince && d < prevUntil;
    }).length;
  }, [sessions, prevSince, prevUntil]);

  const sessionTrend = totalSessions - prevSessionsCount;

  // Weekly volume data for chart
  const weeklyVolume = useMemo((): WeeklyVolume[] => {
    const map = new Map<string, number>();
    sessions.forEach(s => {
      const d = new Date(s.started_at);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = `W${weekStart.toISOString().slice(5, 10)}`;
      map.set(key, (map.get(key) ?? 0) + (s.volume_total ?? 0));
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-8)
      .map(([week, vol]) => ({ week: week.slice(1, 6), vol: Math.round(vol) }));
  }, [sessions]);

  // Lift progression by exercise (max weight per week)
  const liftHistory = useMemo(() => {
    const byExercise = new Map<string, { name: string; weekly: Map<string, number> }>();
    sets.forEach(s => {
      const name = (s.exercise as any)?.name;
      if (!name || !s.weight_kg) return;
      if (!byExercise.has(name)) byExercise.set(name, { name, weekly: new Map() });
      const d = new Date(s.completed_at);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      const ex = byExercise.get(name)!;
      ex.weekly.set(key, Math.max(ex.weekly.get(key) ?? 0, s.weight_kg));
    });
    const result: Record<string, number[]> = {};
    byExercise.forEach(({ name, weekly }) => {
      const values = Array.from(weekly.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, v]) => v);
      if (values.length >= 2) result[name] = values.slice(-8);
    });
    return result;
  }, [sets]);

  const liftNames = Object.keys(liftHistory);
  const currentLift = activeLift && liftHistory[activeLift] ? activeLift : liftNames[0] ?? '';
  const liftData = liftHistory[currentLift] ?? [];
  const liftStart = liftData[0] ?? 0;
  const liftNow = liftData[liftData.length - 1] ?? 0;
  const liftGain = +(liftNow - liftStart).toFixed(1);

  // Muscle focus % from sets
  const muscleFocus = useMemo(() => {
    const totals = new Map<string, number>();
    sets.forEach(s => {
      const muscles: string[] = (s.exercise as any)?.muscle_groups ?? [];
      muscles.forEach(m => totals.set(m, (totals.get(m) ?? 0) + 1));
    });
    const total = Array.from(totals.values()).reduce((a, b) => a + b, 0) || 1;
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([name, count]) => ({ name, pct: Math.round((count / total) * 100) }));
  }, [sets]);

  // PR table
  const prTable = useMemo(() => {
    return Object.entries(liftHistory)
      .filter(([, vals]) => vals.length >= 2)
      .map(([lift, vals]) => ({
        lift,
        from: vals[0],
        to: vals[vals.length - 1],
        gain: +(vals[vals.length - 1] - vals[0]).toFixed(1),
        sparkline: vals,
      }))
      .filter(r => r.gain > 0)
      .sort((a, b) => b.gain - a.gain)
      .slice(0, 5);
  }, [liftHistory]);

  // AI review
  const openReview = async () => {
    setReviewOpen(o => !o);
    if (reviewText || reviewLoading) return;
    setReviewLoading(true);
    try {
      const recentSessions = sessions.slice(-7).map(s => ({
        date: new Date(s.started_at).toLocaleDateString(),
        exercises: [],
        volume: s.volume_total ?? 0,
      }));
      const text = await getWeeklyReview(recentSessions);
      setReviewText(text);
    } catch {
      setReviewText('Could not load review. Check your connection and try again.');
    }
    setReviewLoading(false);
  };

  const sessionDates = sessions.map(s => s.started_at);
  const bestVol = weeklyVolume.length ? Math.max(...weeklyVolume.map(d => d.vol)) : 0;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 14 }]}>
        <View style={s.headerTop}>
          <Text style={s.title}>Progress</Text>
          {sessionTrend !== 0 && (
            <View style={[s.trendPill, { backgroundColor: sessionTrend > 0 ? COLORS.greenLight : COLORS.amberLight }]}>
              <Text style={[s.trendPillText, { color: sessionTrend > 0 ? COLORS.green : COLORS.amber }]}>
                {sessionTrend > 0 ? '↑' : '↓'} {Math.abs(sessionTrend)} sessions
              </Text>
            </View>
          )}
        </View>
        <View style={s.periodRow}>
          {(['4W', '3M', 'All'] as Period[]).map(p => (
            <SRPill key={p} label={p} active={period === p} onPress={() => setPeriod(p)} />
          ))}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 }}>
          <ActivityIndicator color={COLORS.blue} size="large" />
          <Text style={{ color: COLORS.ink3, marginTop: 12, fontSize: 14 }}>Loading progress…</Text>
        </View>
      ) : (
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Metric ribbon */}
        <SRCard style={s.card}>
          <View style={s.metricRow}>
            {[
              { label: 'Sessions', value: String(totalSessions), unit: '', trend: sessionTrend > 0 ? `+${sessionTrend}` : String(sessionTrend), up: sessionTrend >= 0 },
              { label: 'Volume', value: totalVolumeKg >= 1000 ? (totalVolumeKg / 1000).toFixed(1) : String(Math.round(totalVolumeKg)), unit: totalVolumeKg >= 1000 ? 'k kg' : ' kg', trend: '', up: true },
              { label: 'Avg Dur', value: String(avgDuration), unit: ' min', trend: '', up: true },
            ].map((m, i) => (
              <View key={i} style={s.metricCell}>
                {i > 0 && <View style={s.metricDivider} />}
                <View style={s.metricInner}>
                  <Text style={s.metricValue}>{m.value}<Text style={s.metricUnit}>{m.unit}</Text></Text>
                  <Text style={s.metricLabel}>{m.label}</Text>
                  {!!m.trend && <Text style={[s.metricTrend, { color: m.up ? COLORS.green : COLORS.amber }]}>{m.trend}</Text>}
                </View>
              </View>
            ))}
          </View>
        </SRCard>

        {/* Heatmap */}
        {sessionDates.length > 0 && (
          <WorkoutHeatmap sessionDates={sessionDates} period={period} />
        )}

        {/* Volume trend chart */}
        {weeklyVolume.length >= 2 && (
          <SRCard style={s.card}>
            <View style={s.chartHeader}>
              <View>
                <Text style={s.cardTitle}>Volume Trend</Text>
                <Text style={s.cardSub}>8-week rolling</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.chartBigVal}>
                  {bestVol >= 1000 ? `${(bestVol / 1000).toFixed(1)}k kg` : `${bestVol} kg`}
                </Text>
                <Text style={[s.cardSub, { color: COLORS.green }]}>↑ Best week</Text>
              </View>
            </View>
            <AreaChart data={weeklyVolume} width={320} height={100} />
          </SRCard>
        )}

        {/* Lift progression */}
        {liftNames.length > 0 && (
          <SRCard style={s.card}>
            <View style={[s.chartHeader, { marginBottom: 8 }]}>
              <Text style={s.cardTitle}>Lift Progression</Text>
              {liftGain > 0 && (
                <View style={[s.trendPill, { backgroundColor: COLORS.greenLight }]}>
                  <Text style={[s.trendPillText, { color: COLORS.green }]}>+{liftGain} kg</Text>
                </View>
              )}
            </View>
            {/* Lift selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', gap: 5, paddingHorizontal: 2 }}>
                {liftNames.map(l => (
                  <SRPill key={l} label={l} active={currentLift === l} onPress={() => setActiveLift(l)} size="xs" />
                ))}
              </View>
            </ScrollView>
            <View style={s.divider} />
            {liftData.length >= 2 && (
              <View style={{ paddingTop: 12 }}>
                <View style={s.chartHeader}>
                  <View>
                    <Text style={s.cardSub}>8-week progression</Text>
                    <Text style={s.liftBigVal}>{liftNow} kg</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.cardSub}>Started at</Text>
                    <Text style={[s.liftBigVal, { color: COLORS.ink3, fontSize: 18 }]}>{liftStart} kg</Text>
                  </View>
                </View>
                <AreaChart data={liftData.map((v, i) => ({ week: `W${i + 1}`, vol: v }))} width={320} height={88} />
              </View>
            )}
            <View style={s.divider} />
            <View style={{ flexDirection: 'row', paddingVertical: 8 }}>
              {[
                { label: 'Start', val: `${liftStart} kg` },
                { label: 'Peak', val: `${liftData.length ? Math.max(...liftData) : 0} kg` },
                { label: 'Now', val: `${liftNow} kg` },
                { label: 'Gain', val: `+${liftGain} kg`, green: true },
              ].map((stat, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                  {i > 0 && <View style={[s.metricDivider, { position: 'absolute', left: 0, top: 2, height: '80%' }]} />}
                  <Text style={s.statLabel}>{stat.label}</Text>
                  <Text style={[s.statVal, stat.green && { color: COLORS.green }]}>{stat.val}</Text>
                </View>
              ))}
            </View>
          </SRCard>
        )}

        {/* Muscle focus */}
        {muscleFocus.length > 0 && (
          <SRCard style={s.card}>
            <Text style={[s.cardTitle, { marginBottom: 14 }]}>Muscle Focus — {period}</Text>
            {muscleFocus.map((m, i) => (
              <View key={i} style={{ marginBottom: i < muscleFocus.length - 1 ? 12 : 0 }}>
                <View style={s.muscleRow}>
                  <Text style={s.muscleName}>{m.name.replace('_', ' ')}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Sparkline values={[m.pct - 12, m.pct - 8, m.pct - 4, m.pct - 2, m.pct].map(v => Math.max(0, v))} />
                    <Text style={s.musclePct}>{m.pct}%</Text>
                  </View>
                </View>
                <View style={s.muscleBarBg}>
                  <View style={[s.muscleBarFill, { width: `${m.pct}%` as any }]} />
                </View>
              </View>
            ))}
          </SRCard>
        )}

        {/* PR table */}
        {prTable.length > 0 && (
          <SRCard>
            <SRSectionLabel>{`Lift PRs — ${period}`}</SRSectionLabel>
            <View style={[s.prHeaderRow, { paddingHorizontal: 16, paddingBottom: 6 }]}>
              {['Lift', '', 'Start', 'Now', '+'].map((h, i) => (
                <Text key={i} style={[s.prHeaderCell, { flex: i === 0 ? 2 : i === 1 ? 1.2 : 1 }]}>{h}</Text>
              ))}
            </View>
            {prTable.map((row, i) => (
              <View key={i}>
                <SRDivider />
                <View style={[s.prRow, { paddingHorizontal: 16, paddingVertical: 10 }]}>
                  <Text style={[s.prCell, { flex: 2 }]}>{row.lift}</Text>
                  <View style={{ flex: 1.2, alignItems: 'flex-start' }}>
                    <Sparkline values={row.sparkline} />
                  </View>
                  <Text style={[s.prCellDim, { flex: 1 }]}>{row.from} kg</Text>
                  <Text style={[s.prCellBold, { flex: 1 }]}>{row.to} kg</Text>
                  <View style={{ flex: 1 }}>
                    <View style={[s.trendPill, { backgroundColor: COLORS.greenLight }]}>
                      <Text style={[s.trendPillText, { color: COLORS.green }]}>+{row.gain}</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </SRCard>
        )}

        {/* AI Weekly Review */}
        <SRCard style={{ marginBottom: 16 }}>
          <TouchableOpacity style={s.reviewHeader} onPress={openReview} activeOpacity={0.8}>
            <View style={s.reviewLeft}>
              <View style={s.aiIcon}>
                <Text style={s.aiIconText}>AI</Text>
              </View>
              <View>
                <Text style={s.cardTitle}>AI Weekly Review</Text>
                <Text style={s.cardSub}>llama-3.3-70b · {period} analysis</Text>
              </View>
            </View>
            <Text style={[s.cardSub, { transform: [{ rotate: reviewOpen ? '180deg' : '0deg' }] }]}>▾</Text>
          </TouchableOpacity>

          {/* Status pills */}
          <View style={s.reviewPills}>
            {[
              { icon: '📈', label: 'Volume', status: totalVolumeKg > 0 ? 'green' : 'amber' },
              { icon: '🏆', label: 'PRs', status: prTable.length > 0 ? 'green' : 'amber' },
              { icon: '💤', label: 'Recovery', status: avgDuration > 60 ? 'amber' : 'green' },
              { icon: '🎯', label: 'Consistency', status: totalSessions >= 3 ? 'green' : 'red' },
            ].map((item, i) => {
              const bg = item.status === 'green' ? COLORS.greenLight : item.status === 'amber' ? COLORS.amberLight : COLORS.redLight;
              const color = item.status === 'green' ? COLORS.green : item.status === 'amber' ? COLORS.amber : COLORS.red;
              return (
                <View key={i} style={[s.reviewPill, { backgroundColor: bg }]}>
                  <Text style={{ fontSize: 11 }}>{item.icon}</Text>
                  <Text style={[s.reviewPillText, { color }]}>{item.label}</Text>
                </View>
              );
            })}
          </View>

          {reviewOpen && (
            <View style={s.reviewBody}>
              <View style={s.divider} />
              <View style={{ padding: 14 }}>
                <Text style={s.reviewAnalysisLabel}>Full Analysis</Text>
                {reviewLoading ? (
                  <Text style={s.reviewText}>Generating review…</Text>
                ) : reviewText ? (
                  <Text style={s.reviewText}>{reviewText}</Text>
                ) : (
                  <Text style={[s.reviewText, { color: COLORS.ink3 }]}>
                    {totalSessions === 0
                      ? 'No workouts recorded in this period. Start logging to see your review.'
                      : 'Tap to load your AI analysis.'}
                  </Text>
                )}
              </View>
            </View>
          )}
        </SRCard>

        {totalSessions === 0 && (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>📊</Text>
            <Text style={s.emptyTitle}>No data yet</Text>
            <Text style={s.emptySub}>Log workouts to see your progress charts here.</Text>
          </View>
        )}

      </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    backgroundColor: COLORS.bg, paddingHorizontal: 20, paddingBottom: 14,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.border,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  title: { fontFamily: 'System', fontSize: 26, fontWeight: '900', color: COLORS.ink },
  periodRow: { flexDirection: 'row', gap: 6 },
  scroll: { padding: 14, paddingBottom: 100, gap: 10 },
  card: { padding: 16 },
  divider: { height: 0.5, backgroundColor: COLORS.border },
  // Metric ribbon
  metricRow: { flexDirection: 'row', justifyContent: 'space-around' },
  metricCell: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  metricDivider: { width: 0.5, backgroundColor: COLORS.border, alignSelf: 'stretch' },
  metricInner: { flex: 1, alignItems: 'center', gap: 2 },
  metricValue: { fontSize: 28, fontWeight: '900', color: COLORS.ink, lineHeight: 32 },
  metricUnit: { fontSize: 13, fontWeight: '500' },
  metricLabel: { fontSize: 10, color: COLORS.ink3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.7 },
  metricTrend: { fontSize: 10, fontWeight: '700' },
  // Trend pill
  trendPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  trendPillText: { fontSize: 11, fontWeight: '600' },
  // Heatmap
  heatmapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  heatmapDayRow: { flexDirection: 'row', gap: 5, marginBottom: 5 },
  heatmapDayLabel: { flex: 1, textAlign: 'center', fontSize: 9, color: COLORS.ink3, fontWeight: '600', textTransform: 'uppercase' },
  heatmapRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  heatmapWeekLabel: { width: 22, fontSize: 9, color: COLORS.ink3, fontWeight: '600' },
  heatmapCell: { flex: 1, aspectRatio: 1, borderRadius: 4 },
  heatmapLegend: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, justifyContent: 'flex-end' },
  legendDot: { width: 8, height: 8, borderRadius: 2 },
  legendText: { fontSize: 9, color: COLORS.ink3 },
  // Charts
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  cardSub: { fontSize: 11, color: COLORS.ink3, marginTop: 1 },
  chartBigVal: { fontSize: 18, fontWeight: '900', color: COLORS.ink },
  liftBigVal: { fontSize: 26, fontWeight: '900', color: COLORS.ink },
  // Stat row
  statLabel: { fontSize: 10, color: COLORS.ink3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  statVal: { fontSize: 14, fontWeight: '800', color: COLORS.ink, marginTop: 2 },
  // Muscle focus
  muscleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  muscleName: { fontSize: 12, color: COLORS.ink2, fontWeight: '500', textTransform: 'capitalize' },
  musclePct: { fontSize: 14, fontWeight: '800', color: COLORS.ink, minWidth: 32, textAlign: 'right' },
  muscleBarBg: { height: 5, backgroundColor: COLORS.surface2, borderRadius: 99 },
  muscleBarFill: { height: '100%', backgroundColor: COLORS.ink, borderRadius: 99 },
  // PR table
  prHeaderRow: { flexDirection: 'row' },
  prHeaderCell: { fontSize: 10, color: COLORS.ink3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  prRow: { flexDirection: 'row', alignItems: 'center' },
  prCell: { fontSize: 13, fontWeight: '500', color: COLORS.ink },
  prCellDim: { fontSize: 11, color: COLORS.ink3 },
  prCellBold: { fontSize: 12, fontWeight: '700', color: COLORS.ink },
  // AI Review
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  reviewLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.ink, alignItems: 'center', justifyContent: 'center' },
  aiIconText: { color: COLORS.bg, fontSize: 13, fontWeight: '900' },
  reviewPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, paddingHorizontal: 14, paddingBottom: 12 },
  reviewPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  reviewPillText: { fontSize: 11, fontWeight: '600' },
  reviewBody: {},
  reviewAnalysisLabel: { fontSize: 11, color: COLORS.ink3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 },
  reviewText: { fontSize: 13, color: COLORS.ink2, lineHeight: 20 },
  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.ink, marginBottom: 6 },
  emptySub: { fontSize: 13, color: COLORS.ink3, textAlign: 'center' },
});
