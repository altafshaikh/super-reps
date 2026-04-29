import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, StyleSheet, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAIStore } from '@/stores/aiStore';
import { useUserStore } from '@/stores/userStore';
import { QUICK_PROMPTS, COLORS, quickPromptParts } from '@/constants';
import type { AIRoutineJSON, Exercise } from '@/types';
import { SRCard, SRPill, SRDivider, SRSectionLabel } from '@/components/ui';

export default function AITab() {
  const router = useRouter();
  const { user } = useUserStore();
  const { builderState, pendingRoutine, errorMessage, generate, clearBuilder } = useAIStore();
  const [prompt, setPrompt] = useState('');
  const [saving, setSaving] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    const { data: exercises } = await supabase.from('exercises').select('*').limit(150);
    await generate(prompt, (exercises ?? []) as Exercise[]);
  };

  const handleSave = async () => {
    if (!pendingRoutine || !user) return;
    setSaving(true);
    try {
      const { data: routineRow, error: routineErr } = await supabase
        .from('routines')
        .insert({
          user_id: user.id,
          name: pendingRoutine.name,
          description: pendingRoutine.description,
          created_by_ai: true,
          ai_prompt: prompt,
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

      clearBuilder();
      setPrompt('');
      Alert.alert('Saved!', `"${pendingRoutine.name}" added to your routines.`, [
        { text: 'Go to Workouts', onPress: () => router.push('/(tabs)/workouts') },
        { text: 'OK' },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to save routine. Please try again.');
    }
    setSaving(false);
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" />
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.pageTitle}>AI Builder</Text>
          <Text style={s.subtitle}>Powered by Groq Llama 3.3</Text>
        </View>
        {builderState !== 'idle' && (
          <TouchableOpacity onPress={clearBuilder} style={s.resetBtn}>
            <Text style={{ color: COLORS.ink3, fontSize: 13 }}>Reset</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── IDLE: prompt input + quick picks ── */}
        {(builderState === 'idle' || (builderState as string) === 'error') && (
          <>
            <SRCard style={{ marginBottom: 10 }}>
              <View style={{ padding: 16 }}>
                <Text style={s.inputLabel}>Describe your ideal programme</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="e.g. 4 day upper/lower, intermediate, barbell + dumbbells, hypertrophy focus"
                  placeholderTextColor={COLORS.ink3}
                  value={prompt}
                  onChangeText={setPrompt}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  onPress={handleGenerate}
                  disabled={!prompt.trim()}
                  style={[s.generateBtn, !prompt.trim() && s.generateBtnDisabled]}
                  activeOpacity={0.85}
                >
                  {builderState === 'loading' ? (
                    <ActivityIndicator color={COLORS.bg} />
                  ) : (
                    <Text style={[s.generateBtnText, !prompt.trim() && { color: COLORS.ink3 }]}>
                      ✦ Generate Programme
                    </Text>
                  )}
                </TouchableOpacity>
                {builderState === 'error' && errorMessage ? (
                  <Text style={s.errorText}>{errorMessage}</Text>
                ) : null}
              </View>
            </SRCard>

            {/* Quick picks */}
            <SRCard>
              <SRSectionLabel>Quick Picks</SRSectionLabel>
              {QUICK_PROMPTS.map((p, i) => {
                const { title, subtitle } = quickPromptParts(p);
                return (
                <View key={p}>
                  {i > 0 && <SRDivider indent={20} />}
                  <TouchableOpacity
                    style={s.quickPickRow}
                    activeOpacity={0.7}
                    onPress={() => setPrompt(p)}
                  >
                    <Ionicons name="flash" size={15} color={COLORS.amber} style={{ marginTop: 1 }} />
                    <Text style={s.quickPickTextWrap} numberOfLines={3}>
                      <Text style={s.quickPickTitle}>{title}</Text>
                      {subtitle ? (
                        <Text style={s.quickPickSubtitle}>{' — '}{subtitle}</Text>
                      ) : null}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.ink3} />
                  </TouchableOpacity>
                </View>
                );
              })}
            </SRCard>
          </>
        )}

        {/* ── LOADING ── */}
        {builderState === 'loading' && (
          <View style={s.loadingState}>
            <ActivityIndicator size="large" color={COLORS.ink} />
            <Text style={s.loadingTitle}>Building your programme…</Text>
            <Text style={s.loadingSubtitle}>
              Groq is generating a personalised routine{'\n'}matched to your exercise library
            </Text>
          </View>
        )}

        {/* ── PREVIEW ── */}
        {builderState === 'preview' && pendingRoutine && (
          <RoutinePreview
            routine={pendingRoutine}
            onSave={handleSave}
            onDiscard={() => { clearBuilder(); setPrompt(''); }}
            saving={saving}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function RoutinePreview({
  routine, onSave, onDiscard, saving,
}: {
  routine: AIRoutineJSON;
  onSave: () => void;
  onDiscard: () => void;
  saving: boolean;
}) {
  const [expanded, setExpanded] = useState<number | null>(0);

  return (
    <View style={{ gap: 10 }}>
      {/* Summary card */}
      <SRCard>
        <View style={{ padding: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Text style={s.routineTitle}>{routine.name}</Text>
            <SRPill label="AI" size="xs" style={{ backgroundColor: COLORS.blueLight }} />
          </View>
          <Text style={s.routineDesc}>{routine.description}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {[`${routine.days_per_week} days/wk`, routine.goal, routine.level].map(tag => (
              <SRPill key={tag} label={tag} muted size="xs" />
            ))}
          </View>
        </View>
      </SRCard>

      {/* Programme days */}
      <SRCard>
        <SRSectionLabel>Programme</SRSectionLabel>
        {routine.days.map((day, i) => (
          <View key={day.day_index}>
            {i > 0 && <SRDivider indent={20} />}
            <TouchableOpacity
              style={s.dayHeader}
              activeOpacity={0.75}
              onPress={() => setExpanded(expanded === day.day_index ? null : day.day_index)}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.dayName}>{day.name}</Text>
                <Text style={s.dayCount}>
                  {day.exercises.length > 0 ? `${day.exercises.length} exercises` : 'Rest Day'}
                </Text>
              </View>
              <Text style={{ color: COLORS.ink3, fontSize: 16 }}>
                {expanded === day.day_index ? '∧' : '∨'}
              </Text>
            </TouchableOpacity>
            {expanded === day.day_index && day.exercises.length > 0 && (
              <View style={{ backgroundColor: COLORS.surface2 }}>
                {day.exercises.map((ex, j) => (
                  <View key={j}>
                    {j > 0 && <SRDivider indent={16} />}
                    <View style={s.exRow}>
                      <Text style={s.exName}>
                        {ex.exercise_slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </Text>
                      <Text style={s.exSets}>{ex.sets}×{ex.rep_range}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </SRCard>

      {/* Progression */}
      {routine.progression ? (
        <SRCard style={{ padding: 16 }}>
          <Text style={[s.inputLabel, { marginBottom: 6 }]}>Progression</Text>
          <Text style={{ fontSize: 13, color: COLORS.ink2, lineHeight: 19 }}>{routine.progression}</Text>
        </SRCard>
      ) : null}

      {/* Actions */}
      <TouchableOpacity
        onPress={onSave}
        disabled={saving}
        style={s.saveBtn}
        activeOpacity={0.85}
      >
        {saving ? (
          <ActivityIndicator color={COLORS.bg} />
        ) : (
          <Text style={s.saveBtnText}>Save Routine</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={onDiscard} style={s.discardBtn} activeOpacity={0.7}>
        <Text style={{ color: COLORS.ink3, fontSize: 14 }}>Discard & start over</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14,
  },
  pageTitle: { fontSize: 28, fontWeight: '800', color: COLORS.ink },
  subtitle: { fontSize: 12, color: COLORS.ink3, marginTop: 2 },
  resetBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  inputLabel: {
    fontSize: 11, color: COLORS.ink3, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 10,
  },
  textInput: {
    borderRadius: 12, borderWidth: 0.5, borderColor: COLORS.border,
    backgroundColor: COLORS.surface, padding: 14,
    fontSize: 14, color: COLORS.ink, minHeight: 90,
    marginBottom: 14,
  },
  generateBtn: {
    height: 48, borderRadius: 12, backgroundColor: COLORS.ink,
    alignItems: 'center', justifyContent: 'center',
  },
  generateBtnDisabled: { backgroundColor: COLORS.surface2 },
  generateBtnText: { color: COLORS.bg, fontWeight: '700', fontSize: 15 },
  errorText: { color: COLORS.red, fontSize: 13, marginTop: 10, textAlign: 'center' },
  quickPickRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, gap: 12,
  },
  quickPickTextWrap: { flex: 1, flexWrap: 'wrap' },
  quickPickTitle: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  quickPickSubtitle: { fontSize: 14, fontWeight: '400', color: COLORS.ink3 },
  loadingState: { alignItems: 'center', paddingTop: 80, paddingBottom: 40, gap: 16 },
  loadingTitle: { fontSize: 18, fontWeight: '700', color: COLORS.ink },
  loadingSubtitle: { fontSize: 13, color: COLORS.ink3, textAlign: 'center', lineHeight: 20 },
  routineTitle: { fontSize: 22, fontWeight: '900', color: COLORS.ink, flex: 1 },
  routineDesc: { fontSize: 13, color: COLORS.ink2, lineHeight: 18, marginTop: 4 },
  dayHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, paddingHorizontal: 20,
  },
  dayName: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  dayCount: { fontSize: 11, color: COLORS.ink3, marginTop: 1 },
  exRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 20,
  },
  exName: { fontSize: 13, color: COLORS.ink2, flex: 1 },
  exSets: { fontSize: 13, fontWeight: '700', color: COLORS.blue },
  saveBtn: {
    height: 50, borderRadius: 14, backgroundColor: COLORS.ink,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { color: COLORS.bg, fontWeight: '700', fontSize: 16 },
  discardBtn: { alignItems: 'center', paddingVertical: 12 },
});
