import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAIStore } from '@/stores/aiStore';
import { useUserStore } from '@/stores/userStore';
import { COLORS } from '@/constants';
import type { AIRoutineJSON, Exercise } from '@/types';
import type { RoutineUserContext } from '@/lib/ai';

const SCREEN_BG = '#0a0c14';
const AI_CARD = '#141824';
const AI_BUBBLE = '#1a1e2e';
const MODEL_LINE = 'llama-3.3-70b-versatile · Groq';

const INTRO_AI =
  "I'll build a personalised programme from your exercise library. Tell me your goal, days available, and any constraints — then tap send.";

const AI_CHIPS: { label: string; prompt: string }[] = [
  { label: 'Build me a 4-day push/pull split', prompt: 'Build me a 4-day push/pull split programme with barbell and dumbbell exercises.' },
  { label: 'I only have 3 days, what do you recommend?', prompt: 'I can only train 3 days a week. What programme do you recommend for overall strength and muscle?' },
  { label: 'Analyse my training and suggest improvements', prompt: 'Based on my recent training history and PRs, analyse my programme and suggest improvements.' },
  { label: 'I want to focus more on legs', prompt: 'I want to focus more on leg development. Build me a programme that prioritises quads, hamstrings and glutes.' },
];

function dayBadgeLabel(day: { name: string }): string {
  const m = day.name.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i);
  if (m) return m[1].charAt(0).toUpperCase() + m[1].slice(1, 3).toLowerCase();
  const t = day.name.trim();
  if (t.length <= 4) return t.toUpperCase();
  return t.slice(0, 3).toUpperCase();
}

export default function AITab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { user } = useUserStore();
  const { builderState, streamingText, pendingRoutine, errorMessage, generate, clearBuilder } = useAIStore();
  const [prompt, setPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [displayedUserPrompt, setDisplayedUserPrompt] = useState<string | null>(null);
  const lastGenerationPrompt = useRef('');

  const scrollToEnd = useCallback(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [builderState, displayedUserPrompt, pendingRoutine, scrollToEnd]);

  const resetSession = useCallback(() => {
    clearBuilder();
    setPrompt('');
    setDisplayedUserPrompt(null);
    lastGenerationPrompt.current = '';
  }, [clearBuilder]);

  const handleGenerate = async (text: string) => {
    const t = text.trim();
    if (!t) return;
    lastGenerationPrompt.current = t;
    setDisplayedUserPrompt(t);
    setPrompt('');

    const [exercisesRes, sessionsRes, setsRes] = await Promise.all([
      supabase.from('exercises').select('*').limit(150),
      user ? supabase
        .from('workout_sessions')
        .select('started_at, routine_name, volume_total')
        .eq('user_id', user.id)
        .not('finished_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(7) : Promise.resolve({ data: null }),
      user ? supabase
        .from('workout_sets')
        .select('exercise_id, weight_kg, exercises(name, muscle_groups)')
        .eq('user_id', user.id)
        .limit(500) : Promise.resolve({ data: null }),
    ]);

    const userContext: RoutineUserContext = {};

    if (sessionsRes.data?.length) {
      userContext.recentSessions = sessionsRes.data.map(s => ({
        date: s.started_at.slice(0, 10),
        routineName: s.routine_name ?? 'Workout',
        volumeKg: Number(s.volume_total ?? 0),
      }));
    }

    if (setsRes.data?.length) {
      // Top muscles by set count
      const muscleCounts: Record<string, number> = {};
      const exerciseMaxes: Record<string, { name: string; max: number }> = {};
      for (const row of setsRes.data as any[]) {
        const muscles: string[] = row.exercises?.muscle_groups ?? [];
        for (const m of muscles) muscleCounts[m] = (muscleCounts[m] ?? 0) + 1;
        const exId = row.exercise_id;
        const w = Number(row.weight_kg);
        if (!exerciseMaxes[exId] || w > exerciseMaxes[exId].max) {
          exerciseMaxes[exId] = { name: row.exercises?.name ?? exId, max: w };
        }
      }
      userContext.topMuscles = Object.entries(muscleCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([muscle, count]) => ({ muscle, count }));
      userContext.topPRs = Object.values(exerciseMaxes)
        .sort((a, b) => b.max - a.max)
        .slice(0, 5)
        .map(p => ({ exerciseName: p.name, weightKg: p.max }));
    }

    await generate(t, (exercisesRes.data ?? []) as Exercise[], userContext);
  };

  const handleSend = () => {
    if (!prompt.trim() || builderState === 'loading') return;
    void handleGenerate(prompt);
  };

  const handleRegenerate = async () => {
    const t = lastGenerationPrompt.current;
    if (!t.trim() || builderState === 'loading') return;
    const { data: exercises } = await supabase.from('exercises').select('*').limit(150);
    await generate(t, (exercises ?? []) as Exercise[]);
  };

  const handleSave = async () => {
    if (!pendingRoutine || !user) return;
    setSaving(true);
    const promptForSave = lastGenerationPrompt.current;
    try {
      const { data: routineRow, error: routineErr } = await supabase
        .from('routines')
        .insert({
          user_id: user.id,
          name: pendingRoutine.name,
          description: pendingRoutine.description,
          created_by_ai: true,
          ai_prompt: promptForSave,
        })
        .select()
        .single();
      if (routineErr) throw routineErr;

      for (const day of pendingRoutine.days) {
        const { data: dayRow, error: dayErr } = await supabase
          .from('routine_days')
          .insert({ routine_id: routineRow.id, day_index: day.day_index, name: day.name })
          .select()
          .single();
        if (dayErr) throw dayErr;

        for (let i = 0; i < day.exercises.length; i++) {
          const ex = day.exercises[i];
          const { data: exerciseRow } = await supabase
            .from('exercises')
            .select('id')
            .eq('slug', ex.exercise_slug)
            .single();
          if (!exerciseRow) continue;
          await supabase.from('routine_exercises').insert({
            routine_day_id: dayRow.id,
            exercise_id: exerciseRow.id,
            order_index: i,
            sets_config: { sets: ex.sets, rep_range: ex.rep_range, rir: ex.rir },
            rest_seconds: ex.rest_seconds,
            notes: ex.notes ?? null,
          });
        }
      }

      resetSession();
      Alert.alert('Saved!', `"${pendingRoutine.name}" added to your routines.`, [
        { text: 'Go to Workouts', onPress: () => router.push('/(tabs)/workouts') },
        { text: 'OK' },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to save routine. Please try again.');
    }
    setSaving(false);
  };

  const showRoutineCard = builderState === 'preview' && pendingRoutine;

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <StatusBar barStyle="light-content" />
      <View style={[s.flex, { backgroundColor: SCREEN_BG }]}>
        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={s.pageTitle}>AI Builder</Text>
            <Text style={s.modelLine}>{MODEL_LINE}</Text>
          </View>
          <View style={s.headerActions}>
            {builderState !== 'idle' && (
              <TouchableOpacity onPress={resetSession} style={s.headerLink} hitSlop={10}>
                <Text style={s.headerLinkText}>New</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/routines')}
              style={s.libraryBtn}
              hitSlop={8}
            >
              <View style={s.libraryDotWrap}>
                <View style={s.libraryDot} />
              </View>
              <Text style={s.libraryLabel}>Library</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={s.flex}
          contentContainerStyle={[s.scrollContent, { paddingBottom: 12 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToEnd}
        >
          {/* AI intro */}
          <View style={s.aiBubbleWrap}>
            <View style={s.aiBubble}>
              <Text style={s.aiBubbleText}>{INTRO_AI}</Text>
            </View>
          </View>

          {displayedUserPrompt ? (
            <View style={s.userBubbleWrap}>
              <View style={s.userBubble}>
                <Text style={s.userBubbleText}>{displayedUserPrompt}</Text>
              </View>
            </View>
          ) : null}

          {builderState === 'loading' ? (
            <View style={s.aiBubbleWrap}>
              <View style={s.aiBubble}>
                {streamingText ? (
                  <Text style={s.aiBubbleText}>{streamingText}</Text>
                ) : (
                  <View style={s.typingBubble}>
                    <ActivityIndicator color={COLORS.ink2} size="small" />
                    <Text style={s.typingText}>Building your programme…</Text>
                  </View>
                )}
              </View>
            </View>
          ) : null}

          {builderState === 'error' && errorMessage ? (
            <View style={s.aiBubbleWrap}>
              <View style={[s.aiBubble, s.errorBubble]}>
                <Text style={s.errorBubbleText}>{errorMessage}</Text>
                <TouchableOpacity onPress={() => void handleRegenerate()} style={s.retryChip}>
                  <Text style={s.retryChipText}>Try again</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {showRoutineCard && pendingRoutine ? (
            <RoutineChatCard
              routine={pendingRoutine}
              onSave={handleSave}
              onRegenerate={() => void handleRegenerate()}
              onDiscard={resetSession}
              saving={saving}
            />
          ) : null}
        </ScrollView>

        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chipsRow}
            keyboardShouldPersistTaps="handled"
          >
            {AI_CHIPS.map((chip) => (
              <TouchableOpacity
                key={chip.label}
                style={s.chip}
                onPress={() => setPrompt(chip.prompt)}
                activeOpacity={0.75}
              >
                <Text style={s.chipText}>{chip.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={s.composerRow}>
            <TextInput
              style={s.composerInput}
              placeholder="Describe your programme…"
              placeholderTextColor={COLORS.ink3}
              value={prompt}
              onChangeText={setPrompt}
              multiline
              maxLength={2000}
              editable={builderState !== 'loading'}
            />
            <TouchableOpacity
              style={[s.sendBtn, !prompt.trim() && s.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!prompt.trim() || builderState === 'loading'}
              activeOpacity={0.85}
            >
              {builderState === 'loading' ? (
                <ActivityIndicator color={SCREEN_BG} size="small" />
              ) : (
                <Ionicons name="arrow-forward" size={22} color={SCREEN_BG} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function RoutineChatCard({
  routine,
  onSave,
  onRegenerate,
  onDiscard,
  saving,
}: {
  routine: AIRoutineJSON;
  onSave: () => void;
  onRegenerate: () => void;
  onDiscard: () => void;
  saving: boolean;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <View style={s.routineCard}>
      <View style={s.routineCardHeader}>
        <Text style={s.routineModelTag}>LLAMA-3.3-70B-VERSATILE</Text>
        <View style={s.daysBadge}>
          <Text style={s.daysBadgeText}>{routine.days_per_week}d/wk</Text>
        </View>
      </View>
      <Text style={s.routineCardTitle}>{routine.name}</Text>
      <Text style={s.routineCardDesc} numberOfLines={3}>
        {routine.description}
      </Text>

      <View style={s.dayList}>
        {routine.days.map((day, i) => (
          <View key={`${day.day_index}-${i}`}>
            {i > 0 ? <View style={s.dayDivider} /> : null}
            <TouchableOpacity
              style={s.dayRow}
              activeOpacity={0.75}
              onPress={() => setExpanded(expanded === day.day_index ? null : day.day_index)}
            >
              <View style={s.dayBadge}>
                <Text style={s.dayBadgeText}>{dayBadgeLabel(day)}</Text>
              </View>
              <View style={s.dayRowText}>
                <Text style={s.dayRowTitle} numberOfLines={1}>
                  {day.name}
                </Text>
                <Text style={s.dayRowSub}>
                  {day.exercises.length > 0 ? `${day.exercises.length} exercises` : 'Rest day'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.ink3} />
            </TouchableOpacity>
            {expanded === day.day_index && day.exercises.length > 0 ? (
              <View style={s.dayExpanded}>
                {day.exercises.map((ex, j) => (
                  <View key={j}>
                    {j > 0 ? <View style={s.exDivider} /> : null}
                    <View style={s.exRow}>
                      <Text style={s.exName} numberOfLines={2}>
                        {ex.exercise_slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </Text>
                      <Text style={s.exSets}>
                        {ex.sets}×{ex.rep_range}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </View>

      {routine.progression ? (
        <View style={s.progressionBlock}>
          <Text style={s.progressionLabel}>Progression</Text>
          <Text style={s.progressionBody}>{routine.progression}</Text>
        </View>
      ) : null}

      <View style={s.cardActions}>
        <TouchableOpacity
          onPress={onSave}
          disabled={saving}
          style={s.saveRoutineBtn}
          activeOpacity={0.88}
        >
          {saving ? (
            <ActivityIndicator color={SCREEN_BG} />
          ) : (
            <Text style={s.saveRoutineBtnText}>Save Routine</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onRegenerate}
          disabled={saving}
          style={s.regenBtn}
          activeOpacity={0.75}
        >
          <Text style={s.regenBtnText}>Regenerate</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={onDiscard} style={s.discardLink} hitSlop={12}>
        <Text style={s.discardLinkText}>Discard</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: SCREEN_BG },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  pageTitle: { fontSize: 26, fontWeight: '800', color: COLORS.ink, letterSpacing: -0.3 },
  modelLine: { fontSize: 11, color: COLORS.ink3, marginTop: 4, letterSpacing: 0.2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 4 },
  headerLink: { paddingVertical: 4 },
  headerLinkText: { fontSize: 13, fontWeight: '600', color: COLORS.ink3 },
  libraryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  libraryDotWrap: { justifyContent: 'center', alignItems: 'center' },
  libraryDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.green,
    shadowColor: COLORS.green,
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  libraryLabel: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },
  aiBubbleWrap: { alignItems: 'flex-start', marginBottom: 12 },
  aiBubble: {
    maxWidth: '92%',
    backgroundColor: AI_BUBBLE,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  aiBubbleText: { fontSize: 15, color: COLORS.ink2, lineHeight: 22 },
  userBubbleWrap: { alignItems: 'flex-end', marginBottom: 12 },
  userBubble: {
    maxWidth: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  userBubbleText: { fontSize: 15, color: SCREEN_BG, lineHeight: 22, fontWeight: '500' },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typingText: { fontSize: 14, color: COLORS.ink3, fontWeight: '600' },
  errorBubble: { borderColor: 'rgba(248,113,113,0.35)' },
  errorBubbleText: { color: COLORS.red, fontSize: 14, lineHeight: 20 },
  retryChip: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(248,113,113,0.15)',
  },
  retryChipText: { color: COLORS.red, fontSize: 13, fontWeight: '700' },
  routineCard: {
    backgroundColor: AI_CARD,
    borderRadius: 20,
    padding: 18,
    marginTop: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.borderMid,
  },
  routineCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  routineModelTag: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.ink3,
    letterSpacing: 0.8,
  },
  daysBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  daysBadgeText: { fontSize: 11, fontWeight: '800', color: COLORS.ink2, letterSpacing: 0.3 },
  routineCardTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.ink,
    letterSpacing: -0.8,
    marginBottom: 6,
  },
  routineCardDesc: { fontSize: 13, color: COLORS.ink3, lineHeight: 19 },
  dayList: { marginTop: 16, borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.2)' },
  dayDivider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
  },
  dayBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeText: { fontSize: 11, fontWeight: '800', color: COLORS.ink, letterSpacing: 0.2 },
  dayRowText: { flex: 1, minWidth: 0 },
  dayRowTitle: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  dayRowSub: { fontSize: 12, color: COLORS.ink3, marginTop: 2 },
  dayExpanded: { backgroundColor: 'rgba(0,0,0,0.25)', paddingBottom: 4 },
  exDivider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginLeft: 68 },
  exRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    paddingLeft: 68,
  },
  exName: { flex: 1, fontSize: 13, color: COLORS.ink2, paddingRight: 8 },
  exSets: { fontSize: 13, fontWeight: '700', color: COLORS.blue },
  progressionBlock: { marginTop: 14, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  progressionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.ink3,
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  progressionBody: { fontSize: 13, color: COLORS.ink2, lineHeight: 19 },
  cardActions: { marginTop: 18, gap: 10 },
  saveRoutineBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveRoutineBtnText: { color: SCREEN_BG, fontWeight: '800', fontSize: 16 },
  regenBtn: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  regenBtnText: { color: COLORS.ink, fontWeight: '700', fontSize: 15 },
  discardLink: { alignItems: 'center', marginTop: 8, paddingVertical: 6 },
  discardLinkText: { fontSize: 13, color: COLORS.ink3, fontWeight: '600' },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    backgroundColor: SCREEN_BG,
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  chipsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 10, paddingHorizontal: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: AI_BUBBLE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.ink2 },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 4 },
  composerInput: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderRadius: 16,
    backgroundColor: AI_BUBBLE,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.ink,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: COLORS.ink4, opacity: 0.45 },
});
