import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants';
import { formatWeight, formatDurationClock } from '@/lib/utils';

interface SessionDetail {
  id: string;
  routine_name: string | null;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  volume_total: number | null;
  calories_burned: number | null;
  notes: string | null;
}

interface SetDetail {
  id: string;
  exercise_id: string;
  set_index: number;
  set_type: string;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  duration_seconds: number | null;
  exercise: { name: string; category: string } | null;
}

interface ExerciseGroup {
  exercise_id: string;
  name: string;
  category: string;
  sets: SetDetail[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function groupByExercise(sets: SetDetail[]): ExerciseGroup[] {
  const map = new Map<string, ExerciseGroup>();
  for (const s of sets) {
    if (!map.has(s.exercise_id)) {
      map.set(s.exercise_id, {
        exercise_id: s.exercise_id,
        name: s.exercise?.name ?? 'Exercise',
        category: s.exercise?.category ?? '',
        sets: [],
      });
    }
    map.get(s.exercise_id)!.sets.push(s);
  }
  return [...map.values()];
}

function setLabel(set: SetDetail, index: number): string {
  const num = index + 1;
  if (set.duration_seconds && set.duration_seconds > 0) {
    const base = `Set ${num}  ${set.duration_seconds}s`;
    return set.weight_kg > 0 ? `${base}  @${formatWeight(set.weight_kg)} kg` : base;
  }
  const base = `Set ${num}  ${formatWeight(set.weight_kg)} kg × ${set.reps}`;
  return set.rpe != null ? `${base}  RPE ${set.rpe}` : base;
}

export default function WorkoutDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [groups, setGroups] = useState<ExerciseGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    void load();
  }, [sessionId]);

  const load = async () => {
    setLoading(true);
    const [{ data: sess }, { data: sets }] = await Promise.all([
      supabase
        .from('workout_sessions')
        .select('id, routine_name, started_at, finished_at, duration_seconds, volume_total, calories_burned, notes')
        .eq('id', sessionId)
        .single(),
      supabase
        .from('workout_sets')
        .select('id, exercise_id, set_index, set_type, weight_kg, reps, rpe, duration_seconds, exercise:exercises(name, category)')
        .eq('session_id', sessionId)
        .order('set_index', { ascending: true }),
    ]);

    if (sess) setSession(sess as SessionDetail);
    if (sets) setGroups(groupByExercise(sets as unknown as SetDetail[]));
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={[s.root, s.center]}>
        <ActivityIndicator color={COLORS.blue} size="large" />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[s.root, s.center]}>
        <Text style={s.muted}>Workout not found.</Text>
      </View>
    );
  }

  const totalSets = groups.reduce((a, g) => a + g.sets.length, 0);
  const calories = Math.max(0, session.calories_burned ?? 0);

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={COLORS.ink} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>
            {session.routine_name ?? 'Workout'}
          </Text>
          <Text style={s.headerSub}>{formatDate(session.started_at)}</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push(`/workout/edit/${sessionId}`)}
          style={s.editBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="create-outline" size={22} color={COLORS.blue} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>

        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={s.statCell}>
            <Ionicons name="time-outline" size={18} color={COLORS.green} />
            <Text style={s.statVal} numberOfLines={1} adjustsFontSizeToFit>
              {session.duration_seconds ? formatDurationClock(session.duration_seconds) : '—'}
            </Text>
            <Text style={s.statLab}>Duration</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statCell}>
            <Ionicons name="barbell-outline" size={18} color={COLORS.green} />
            <Text style={s.statVal} numberOfLines={1} adjustsFontSizeToFit>
              {session.volume_total ? `${Number(session.volume_total).toLocaleString()} kg` : '—'}
            </Text>
            <Text style={s.statLab}>Volume</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statCell}>
            <Ionicons name="layers-outline" size={18} color={COLORS.green} />
            <Text style={s.statVal} numberOfLines={1} adjustsFontSizeToFit>{totalSets}</Text>
            <Text style={s.statLab}>Total sets</Text>
          </View>
          {calories > 0 && (
            <>
              <View style={s.statDivider} />
              <View style={s.statCell}>
                <Ionicons name="flame-outline" size={18} color={COLORS.green} />
                <Text style={s.statVal} numberOfLines={1} adjustsFontSizeToFit>{calories}</Text>
                <Text style={s.statLab}>kcal</Text>
              </View>
            </>
          )}
        </View>

        {/* Time info */}
        <View style={s.timeRow}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.ink3} />
          <Text style={s.timeText}>
            Started {formatTime(session.started_at)}
            {session.finished_at ? `  ·  Finished ${formatTime(session.finished_at)}` : ''}
          </Text>
        </View>

        {/* Notes */}
        {!!session.notes && (
          <View style={s.notesCard}>
            <Text style={s.notesLabel}>Notes</Text>
            <Text style={s.notesText}>{session.notes}</Text>
          </View>
        )}

        {/* Exercises */}
        {groups.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.muted}>No sets recorded.</Text>
          </View>
        ) : (
          groups.map(group => (
            <View key={group.exercise_id} style={s.exBlock}>
              <View style={s.exHeader}>
                <Ionicons name="barbell-outline" size={16} color={COLORS.green} />
                <View style={{ flex: 1 }}>
                  <Text style={s.exName}>{group.name}</Text>
                  {!!group.category && <Text style={s.exCat}>{group.category}</Text>}
                </View>
                <Text style={s.exSetCount}>{group.sets.length} set{group.sets.length !== 1 ? 's' : ''}</Text>
              </View>
              <View style={s.setsCard}>
                {group.sets.map((set, i) => (
                  <View key={set.id} style={[s.setRow, i < group.sets.length - 1 && s.setRowBorder]}>
                    <View style={s.setBadge}>
                      <Text style={s.setBadgeTxt}>{i + 1}</Text>
                    </View>
                    <View style={s.setDetails}>
                      {set.duration_seconds && set.duration_seconds > 0 ? (
                        <Text style={s.setMain}>
                          {set.duration_seconds}s
                          {set.weight_kg > 0 ? `  ·  ${formatWeight(set.weight_kg)} kg` : ''}
                        </Text>
                      ) : (
                        <Text style={s.setMain}>
                          {formatWeight(set.weight_kg)} kg  ×  {set.reps} reps
                        </Text>
                      )}
                      {set.rpe != null && (
                        <Text style={s.setRpe}>RPE {set.rpe}</Text>
                      )}
                    </View>
                    <Text style={s.setVol}>
                      {set.weight_kg > 0 && set.reps > 0
                        ? `${(set.weight_kg * set.reps).toLocaleString()} kg`
                        : ''}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: COLORS.bg },
  center:     { justifyContent: 'center', alignItems: 'center' },
  muted:      { color: COLORS.ink3, fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bg,
    gap: 10,
  },
  backBtn:      { padding: 2 },
  headerCenter: { flex: 1 },
  headerTitle:  { fontSize: 17, fontWeight: '800', color: COLORS.ink },
  headerSub:    { fontSize: 12, color: COLORS.ink3, marginTop: 1 },
  editBtn:      { padding: 2 },

  scroll: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface2,
    borderRadius: 14,
    paddingVertical: 16,
  },
  statCell:    { flex: 1, minWidth: 0, alignItems: 'center', gap: 4 },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: COLORS.border },
  statVal:     { fontSize: 16, fontWeight: '800', color: COLORS.ink },
  statLab:     { fontSize: 11, color: COLORS.ink3, fontWeight: '600', textAlign: 'center' },

  timeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 4,
  },
  timeText: { color: COLORS.ink3, fontSize: 12 },

  notesCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: 14,
    gap: 4,
  },
  notesLabel: { fontSize: 11, fontWeight: '700', color: COLORS.ink3, textTransform: 'uppercase', letterSpacing: 0.5 },
  notesText:  { fontSize: 14, color: COLORS.ink2, lineHeight: 20 },

  exBlock:  { gap: 8 },
  exHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 2,
  },
  exName:     { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  exCat:      { fontSize: 11, color: COLORS.ink3, marginTop: 1, textTransform: 'capitalize' },
  exSetCount: { fontSize: 12, color: COLORS.ink3, fontWeight: '600' },

  setsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  setRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, gap: 12,
  },
  setRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  setBadge: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: COLORS.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  setBadgeTxt: { fontSize: 12, fontWeight: '700', color: COLORS.ink3 },
  setDetails:  { flex: 1 },
  setMain:     { fontSize: 14, fontWeight: '600', color: COLORS.ink },
  setRpe:      { fontSize: 11, color: COLORS.ink3, marginTop: 2 },
  setVol:      { fontSize: 12, color: COLORS.ink3, fontWeight: '500' },

  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: 20,
    alignItems: 'center',
  },
});
