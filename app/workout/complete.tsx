import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants';
import { formatDurationClock, formatVolumeDisplay, formatWeight } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import { getWeeklyReview } from '@/lib/ai';

function decodeParam(s: string | undefined, fallback = ''): string {
  if (!s || typeof s !== 'string') return fallback;
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export default function WorkoutCompleteScreen() {
  const router = useRouter();
  const { user } = useUserStore();
  const params = useLocalSearchParams<{
    routineName?: string;
    durationSec?: string;
    setCount?: string;
    volumeKg?: string;
    prExercise?: string;
    prWeight?: string;
    prDelta?: string;
  }>();

  const routineName = decodeParam(params.routineName, 'Workout');
  const durationSec = Number(params.durationSec) || 0;
  const setCount = Number(params.setCount) || 0;
  const volumeKg = Number(params.volumeKg) || 0;
  const prExercise = params.prExercise ? decodeParam(params.prExercise) : '';
  const prWeight = Number(params.prWeight);
  const prDelta = Number(params.prDelta);
  const hasPR = Boolean(prExercise && prWeight > 0 && prDelta > 0);

  const [review, setReview] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        setReviewLoading(false);
        setReview('Sign in to get AI weekly reviews.');
        return;
      }
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('workout_sessions')
        .select('started_at, volume_total, routine_name')
        .eq('user_id', user.id)
        .not('finished_at', 'is', null)
        .gte('started_at', weekAgo)
        .order('started_at', { ascending: false });

      if (cancelled) return;
      if (!data?.length) {
        setReview('Keep showing up — your weekly insights will appear here after you log sessions.');
        setReviewLoading(false);
        return;
      }
      try {
        const sessions = data.map(s => ({
          date: s.started_at,
          exercises: [s.routine_name ?? 'Workout'],
          volume: Number(s.volume_total ?? 0),
        }));
        const text = await getWeeklyReview(sessions);
        if (!cancelled) setReview(text.trim() || null);
      } catch {
        if (!cancelled) setReview(null);
      } finally {
        if (!cancelled) setReviewLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingTop: 44,
        paddingBottom: 40,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="items-center mb-6">
        <Ionicons name="trophy" size={52} color="#EAB308" style={{ marginBottom: 12 }} />
        <Text className="text-white font-bold text-3xl text-center">Complete!</Text>
        <Text className="text-ink-3 text-base text-center mt-1.5">{routineName}</Text>
      </View>

      {/* Stats */}
      <View className="border border-surface-border rounded-2xl px-2 py-4 mb-4 flex-row">
        <View className="flex-1 items-center border-r border-white/[0.08]">
          <Text className="text-white font-bold text-xl">{formatDurationClock(durationSec)}</Text>
          <Text className="text-ink-3 text-[10px] uppercase tracking-wider mt-1">Duration</Text>
        </View>
        <View className="flex-1 items-center border-r border-white/[0.08]">
          <Text className="text-white font-bold text-xl">{setCount}</Text>
          <Text className="text-ink-3 text-[10px] uppercase tracking-wider mt-1">Sets</Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-white font-bold text-xl">{formatVolumeDisplay(volumeKg)}</Text>
          <Text className="text-ink-3 text-[10px] uppercase tracking-wider mt-1">Volume</Text>
        </View>
      </View>

      {hasPR && (
        <View className="border border-surface-border rounded-2xl px-4 py-3.5 mb-4">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-sr-green font-semibold text-sm mb-1">NEW PR 🎉</Text>
              <Text className="text-white font-bold text-base leading-snug">
                {prExercise} — {formatWeight(prWeight)} kg
              </Text>
            </View>
            <View className="bg-sr-green/15 px-2.5 py-1 rounded-full border border-sr-green/30">
              <Text className="text-sr-green font-bold text-sm">
                +{formatWeight(prDelta)} kg
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* AI Weekly Review */}
      <View className="rounded-2xl overflow-hidden mb-8 flex-row bg-surface-card border border-surface-border">
        <View className="w-1 bg-brand-500/80" />
        <View className="flex-1 px-4 py-3.5 pl-3">
          <Text className="text-ink-3 text-[10px] uppercase tracking-wider mb-2">
            AI weekly review
          </Text>
          {reviewLoading ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : (
            <Text className="text-white/90 text-sm leading-5">
              {review ?? 'Stay consistent — you are building lasting strength.'}
            </Text>
          )}
        </View>
      </View>

      <TouchableOpacity
        className="bg-white rounded-2xl py-4 items-center mb-3 active:opacity-90"
        onPress={() => router.replace('/(tabs)')}
      >
        <Text className="text-surface font-bold text-base">Done</Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="border border-surface-border rounded-2xl py-4 items-center bg-transparent"
        onPress={() => router.replace('/(tabs)/workouts')}
      >
        <Text className="text-white font-semibold text-base">View Full Summary</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
