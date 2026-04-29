import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import type { Routine } from '@/types';
import { COLORS } from '@/constants';
import { SRCard, SRPill, SRSectionLabel, SRDivider } from '@/components/ui';

export default function LogScreen() {
  const router = useRouter();
  const { user } = useUserStore();
  const { startWorkout, isActive } = useWorkoutStore();
  const [routines, setRoutines] = useState<Routine[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('routines')
      .select(`*, days:routine_days(*, exercises:routine_exercises(*, exercise:exercises(*)))`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => { if (data) setRoutines(data as unknown as Routine[]); });
  }, [user]);

  const handleStartEmpty = () => {
    startWorkout();
    router.push('/workout/active');
  };

  if (isActive) {
    return (
      <View style={s.root}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>⚡</Text>
          <Text style={[s.pageTitle, { textAlign: 'center', marginBottom: 6 }]}>Workout in progress</Text>
          <Text style={[s.subtitle, { textAlign: 'center', marginBottom: 28 }]}>You have an active session</Text>
          <TouchableOpacity onPress={() => router.push('/workout/active')} style={s.primaryBtn}>
            <Text style={s.primaryBtnText}>Resume Workout</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.pageTitle}>Start a Workout</Text>
          <Text style={s.subtitle}>Pick a routine or start from scratch</Text>
        </View>

        <View style={s.content}>
          {/* Quick start card */}
          <SRCard>
            <TouchableOpacity onPress={handleStartEmpty} style={s.quickStart} activeOpacity={0.75}>
              <View style={s.quickStartIcon}>
                <Text style={{ fontSize: 24 }}>+</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.quickStartTitle}>Empty Workout</Text>
                <Text style={s.quickStartSub}>Add exercises as you go</Text>
              </View>
              <Text style={{ color: COLORS.ink3, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          </SRCard>

          {/* Routines */}
          <SRCard>
            <SRSectionLabel
              action="Import"
              onAction={() => router.push('/routines/import-hevy')}
              action2="+ New AI routine"
              onAction2={() => router.push('/(tabs)/ai')}
            >
              My Routines
            </SRSectionLabel>
            {routines.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyText}>No routines yet</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 4 }}>
                  <TouchableOpacity onPress={() => router.push('/routines/import-hevy')} style={s.emptyLink}>
                    <Text style={{ color: COLORS.blue, fontWeight: '600', fontSize: 13 }}>Import workouts →</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/ai')} style={s.emptyLink}>
                    <Text style={{ color: COLORS.blue, fontWeight: '600', fontSize: 13 }}>Build with AI →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              routines.map((routine, i) => {
                const workoutDays = routine.days?.filter(d => d.exercises?.length > 0) ?? [];
                return (
                  <View key={routine.id}>
                    {i > 0 && <SRDivider indent={20} />}
                    <View style={s.routineItem}>
                      <View style={s.routineHeader}>
                        <Text style={s.routineName}>{routine.name}</Text>
                        {routine.created_by_ai && (
                          <SRPill label="AI" size="xs" style={{ backgroundColor: COLORS.blueLight }} />
                        )}
                      </View>
                      <Text style={s.routineDayCount}>{workoutDays.length} training days</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                        <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 2 }}>
                          {workoutDays.map(day => (
                            <TouchableOpacity
                              key={day.id}
                              style={s.dayBtn}
                              activeOpacity={0.8}
                              onPress={() => {
                                const exercises = day.exercises?.map(re => re.exercise) ?? [];
                                startWorkout(routine.id, `${routine.name} — ${day.name}`, exercises);
                                router.push('/workout/active');
                              }}
                            >
                              <Text style={s.dayBtnText}>{day.name}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
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
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: COLORS.ink },
  subtitle: { fontSize: 14, color: COLORS.ink3, marginTop: 2 },
  content: { paddingHorizontal: 14, gap: 10 },
  quickStart: {
    flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14,
  },
  quickStartIcon: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: COLORS.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  quickStartTitle: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  quickStartSub: { fontSize: 12, color: COLORS.ink3, marginTop: 1 },
  empty: { padding: 20, alignItems: 'center', gap: 8 },
  emptyText: { color: COLORS.ink3, fontSize: 14 },
  emptyLink: { paddingVertical: 4 },
  routineItem: { padding: 18 },
  routineHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  routineName: { fontSize: 15, fontWeight: '700', color: COLORS.ink, flex: 1 },
  routineDayCount: { fontSize: 11, color: COLORS.ink3 },
  dayBtn: {
    backgroundColor: COLORS.ink, borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 14,
  },
  dayBtnText: { color: COLORS.bg, fontSize: 12, fontWeight: '700' },
  primaryBtn: {
    backgroundColor: COLORS.ink, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 32,
  },
  primaryBtnText: { color: COLORS.bg, fontWeight: '700', fontSize: 15 },
});
