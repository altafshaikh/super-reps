import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useWorkoutStore } from '@/stores/workoutStore';
import type { Routine, RoutineDay } from '@/types';
import { COLORS } from '@/constants';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function RoutineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { startWorkout } = useWorkoutStore();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingDay, setSavingDay] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('routines')
      .select(`*, days:routine_days(*, exercises:routine_exercises(*, exercise:exercises(*)))`)
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setRoutine(data as unknown as Routine);
        setLoading(false);
      });
  }, [id]);

  const handleDelete = () => {
    Alert.alert('Delete Routine', `Delete "${routine?.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('routines').delete().eq('id', id);
          router.back();
        },
      },
    ]);
  };

  const assignWeekday = async (day: RoutineDay, weekday: number | null) => {
    if (!routine) return;
    setSavingDay(day.id);
    const newWeekday = day.weekday === weekday ? null : weekday;
    await supabase.from('routine_days').update({ weekday: newWeekday }).eq('id', day.id);
    setRoutine(prev => prev ? {
      ...prev,
      days: prev.days.map(d => d.id === day.id ? { ...d, weekday: newWeekday } : d),
    } : prev);
    setSavingDay(null);
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!routine) {
    return (
      <View style={s.center}>
        <Text style={{ color: COLORS.ink }}>Routine not found</Text>
      </View>
    );
  }

  const workoutDays = routine.days?.filter(d => d.exercises?.length > 0) ?? [];

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color={COLORS.ink2} />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{routine.name}</Text>
        <TouchableOpacity onPress={handleDelete}>
          <Ionicons name="trash-outline" size={22} color={COLORS.red} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {routine.description && (
          <Text style={s.desc}>{routine.description}</Text>
        )}

        {/* Start workout */}
        <Text style={s.sectionLabel}>Start Workout</Text>
        <View style={s.gap2}>
          {workoutDays.map(day => (
            <TouchableOpacity
              key={day.id}
              style={s.startBtn}
              onPress={() => {
                const inputs = (day.exercises ?? [])
                  .filter((re: any) => re.exercise)
                  .map((re: any) => ({
                    exercise: re.exercise,
                    setsCount: re.sets ?? 3,
                    defaultReps: re.rep_range ? parseInt(re.rep_range.match(/(\d+)/)?.[1] ?? '0', 10) : 0,
                    restSeconds: re.rest_seconds ?? 90,
                  }));
                startWorkout(routine.id, `${routine.name} — ${day.name}`, inputs);
                router.push('/workout/active');
              }}
            >
              <View>
                <Text style={s.startBtnName}>{day.name}</Text>
                <Text style={s.startBtnSub}>{day.exercises?.length} exercises</Text>
              </View>
              <Ionicons name="play-circle" size={30} color="white" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Programme with weekday assignment */}
        <Text style={s.sectionLabel}>Programme</Text>
        <View style={s.gap4}>
          {routine.days?.map(day => (
            <View key={day.id} style={s.dayCard}>
              {/* Day header */}
              <View style={s.dayHeader}>
                <Text style={s.dayName}>{day.name}</Text>
                {day.weekday != null && (
                  <View style={s.assignedBadge}>
                    <Text style={s.assignedBadgeText}>{DAY_NAMES[day.weekday]}</Text>
                  </View>
                )}
              </View>

              {/* Weekday picker */}
              <View style={s.weekdayRow}>
                <Text style={s.weekdayLabel}>Schedule</Text>
                <View style={s.weekdayBtns}>
                  {DAYS.map((label, i) => {
                    const assigned = day.weekday === i;
                    const saving = savingDay === day.id;
                    return (
                      <TouchableOpacity
                        key={i}
                        onPress={() => assignWeekday(day, i)}
                        disabled={saving}
                        style={[s.dayBtn, assigned && s.dayBtnActive]}
                      >
                        <Text style={[s.dayBtnText, assigned && s.dayBtnTextActive]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Exercises */}
              {day.exercises?.length === 0 ? (
                <Text style={s.restLabel}>Rest Day</Text>
              ) : (
                day.exercises?.map((re, i) => (
                  <View
                    key={re.id}
                    style={[s.exRow, i > 0 && s.exRowBorder]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.exName}>{re.exercise?.name}</Text>
                      <Text style={s.exCategory}>{re.exercise?.category}</Text>
                    </View>
                    <Text style={s.exSets}>{re.sets}×{re.rep_range}</Text>
                    <Text style={s.exRest}>{re.rest_seconds}s</Text>
                  </View>
                ))
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: COLORS.ink, fontWeight: '700', fontSize: 18 },
  desc: { color: COLORS.ink3, fontSize: 13, marginBottom: 16 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionLabel: { color: COLORS.ink, fontWeight: '700', fontSize: 15, marginBottom: 10, marginTop: 4 },
  gap2: { gap: 8, marginBottom: 24 },
  gap4: { gap: 16 },
  startBtn: { backgroundColor: COLORS.primary, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  startBtnName: { color: '#fff', fontWeight: '700', fontSize: 15 },
  startBtnSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  dayCard: { backgroundColor: COLORS.surface, borderRadius: 14, overflow: 'hidden' },
  dayHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, gap: 8 },
  dayName: { color: COLORS.ink, fontWeight: '700', fontSize: 14, flex: 1 },
  assignedBadge: { backgroundColor: COLORS.primary + '22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  assignedBadgeText: { color: COLORS.primary, fontWeight: '700', fontSize: 11 },
  weekdayRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10, borderBottomWidth: 1, borderBottomColor: COLORS.surface2 },
  weekdayLabel: { color: COLORS.ink3, fontSize: 11, fontWeight: '600', width: 56 },
  weekdayBtns: { flexDirection: 'row', gap: 6, flex: 1 },
  dayBtn: { flex: 1, aspectRatio: 1, borderRadius: 8, backgroundColor: COLORS.surface2, alignItems: 'center', justifyContent: 'center' },
  dayBtnActive: { backgroundColor: COLORS.primary },
  dayBtnText: { color: COLORS.ink3, fontSize: 11, fontWeight: '600' },
  dayBtnTextActive: { color: '#fff', fontWeight: '700' },
  restLabel: { color: COLORS.ink3, fontSize: 13, paddingHorizontal: 16, paddingVertical: 12 },
  exRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  exRowBorder: { borderTopWidth: 1, borderTopColor: COLORS.surface2 },
  exName: { color: COLORS.ink, fontSize: 13, fontWeight: '500' },
  exCategory: { color: COLORS.ink3, fontSize: 11, marginTop: 1 },
  exSets: { color: COLORS.primary, fontSize: 13, fontWeight: '600', marginRight: 10 },
  exRest: { color: COLORS.ink3, fontSize: 11 },
});
