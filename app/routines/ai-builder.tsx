import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAIStore } from '@/stores/aiStore';
import { useUserStore } from '@/stores/userStore';
import { QUICK_PROMPTS, COLORS } from '@/constants';
import type { AIRoutineJSON, Exercise } from '@/types';

export default function AIBuilderScreen() {
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
      // Insert routine
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

      // Insert days + exercises
      for (const day of pendingRoutine.days) {
        const { data: dayRow, error: dayErr } = await supabase
          .from('routine_days')
          .insert({ routine_id: routineRow.id, day_index: day.day_index, name: day.name })
          .select()
          .single();
        if (dayErr) throw dayErr;

        for (let i = 0; i < day.exercises.length; i++) {
          const ex = day.exercises[i];
          // Find exercise by slug
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
      Alert.alert('Saved!', `"${pendingRoutine.name}" added to your routines.`, [
        { text: 'View Routines', onPress: () => router.replace('/(tabs)/routines') },
      ]);
    } catch (e) {
      Alert.alert('Error', 'Failed to save routine. Please try again.');
    }
    setSaving(false);
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View className="px-5 pt-16 pb-4 flex-row items-center gap-3">
        <TouchableOpacity
          onPress={() => { clearBuilder(); router.back(); }}
          className="w-9 h-9 rounded-full bg-surface-card items-center justify-center"
        >
          <Ionicons name="close" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-white font-bold text-lg">AI Routine Builder</Text>
          <Text className="text-white/40 text-xs">Powered by Groq Llama 3.3</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {builderState === 'idle' && (
          <>
            {/* Prompt input */}
            <View className="mb-5">
              <Text className="text-white font-semibold text-base mb-3">
                Describe your ideal programme
              </Text>
              <TextInput
                className="bg-surface-card border border-surface-border rounded-xl px-4 py-4 text-white text-base"
                placeholder="e.g. 4 day upper/lower split, intermediate, barbell + dumbbells, hypertrophy focus"
                placeholderTextColor="#475569"
                value={prompt}
                onChangeText={setPrompt}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={{ minHeight: 100 }}
              />
            </View>

            {/* Quick prompts */}
            <Text className="text-white/50 text-sm mb-3">Quick picks</Text>
            <View className="gap-2 mb-6">
              {QUICK_PROMPTS.map(p => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPrompt(p)}
                  className="bg-surface-card border border-surface-border rounded-xl px-4 py-3 flex-row items-center gap-3"
                >
                  <Ionicons name="flash" size={16} color={COLORS.primary} />
                  <Text className="text-white/70 text-sm flex-1">{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={handleGenerate}
              disabled={!prompt.trim()}
              className={`rounded-xl py-4 items-center flex-row justify-center gap-2 ${
                prompt.trim() ? 'bg-brand-600' : 'bg-surface-card'
              }`}
            >
              <Ionicons name="sparkles" size={20} color={prompt.trim() ? 'white' : COLORS.textDim} />
              <Text className={`font-bold text-base ${prompt.trim() ? 'text-white' : 'text-white/30'}`}>
                Generate Programme
              </Text>
            </TouchableOpacity>
          </>
        )}

        {builderState === 'loading' && (
          <View className="items-center py-16">
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text className="text-white font-semibold text-lg mt-6">Building your programme...</Text>
            <Text className="text-white/40 text-sm text-center mt-2">
              Groq is generating a personalised routine{'\n'}for: {prompt}
            </Text>
          </View>
        )}

        {builderState === 'error' && (
          <View className="items-center py-16">
            <Text className="text-3xl mb-4">😬</Text>
            <Text className="text-white font-semibold text-lg mb-2">Generation failed</Text>
            <Text className="text-white/50 text-sm text-center mb-6">{errorMessage}</Text>
            <TouchableOpacity
              onPress={clearBuilder}
              className="bg-brand-600 rounded-xl px-6 py-3"
            >
              <Text className="text-white font-bold">Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {builderState === 'preview' && pendingRoutine && (
          <RoutinePreview
            routine={pendingRoutine}
            onSave={handleSave}
            onDiscard={clearBuilder}
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
    <View>
      <View className="bg-surface-card border border-surface-border rounded-xl p-4 mb-4">
        <View className="flex-row items-center gap-2 mb-1">
          <Text className="text-white font-bold text-xl flex-1">{routine.name}</Text>
          <View className="bg-brand-600/20 rounded-md px-2 py-0.5">
            <Text className="text-brand-500 text-xs font-semibold">AI</Text>
          </View>
        </View>
        <Text className="text-white/60 text-sm mb-3">{routine.description}</Text>
        <View className="flex-row flex-wrap gap-2">
          {[
            `${routine.days_per_week} days/week`,
            routine.goal,
            routine.level,
            `Deload wk ${routine.deload_week}`,
          ].map(tag => (
            <View key={tag} className="bg-surface rounded-md px-2 py-1">
              <Text className="text-white/50 text-xs capitalize">{tag}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Days */}
      <Text className="text-white font-bold text-base mb-3">Programme</Text>
      <View className="gap-3 mb-6">
        {routine.days.map(day => (
          <View key={day.day_index} className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
            <TouchableOpacity
              className="px-4 py-3.5 flex-row items-center justify-between"
              onPress={() => setExpanded(expanded === day.day_index ? null : day.day_index)}
            >
              <View>
                <Text className="text-white font-bold">{day.name}</Text>
                <Text className="text-white/40 text-xs mt-0.5">
                  {day.exercises.length > 0 ? `${day.exercises.length} exercises` : 'Rest Day'}
                </Text>
              </View>
              <Ionicons
                name={expanded === day.day_index ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={COLORS.textDim}
              />
            </TouchableOpacity>

            {expanded === day.day_index && day.exercises.length > 0 && (
              <View className="border-t border-surface-border">
                {day.exercises.map((ex, i) => (
                  <View
                    key={i}
                    className={`px-4 py-3 flex-row items-center justify-between ${
                      i < day.exercises.length - 1 ? 'border-b border-surface-border/50' : ''
                    }`}
                  >
                    <View className="flex-1">
                      <Text className="text-white text-sm font-medium capitalize">
                        {ex.exercise_slug.replace(/_/g, ' ')}
                      </Text>
                      {ex.notes && <Text className="text-white/40 text-xs mt-0.5">{ex.notes}</Text>}
                    </View>
                    <Text className="text-brand-500 text-sm font-semibold ml-3">
                      {ex.sets}×{ex.rep_range}
                    </Text>
                    <Text className="text-white/30 text-xs ml-3">{ex.rest_seconds}s</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Progression note */}
      <View className="bg-brand-600/10 border border-brand-600/30 rounded-xl p-4 mb-6">
        <Text className="text-brand-500 text-xs font-semibold uppercase tracking-wide mb-1">Progression</Text>
        <Text className="text-white/70 text-sm">{routine.progression}</Text>
      </View>

      {/* Actions */}
      <View className="gap-3">
        <TouchableOpacity
          onPress={onSave}
          disabled={saving}
          className="bg-brand-600 rounded-xl py-4 items-center flex-row justify-center gap-2"
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="white" />
              <Text className="text-white font-bold text-base">Save Routine</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDiscard}
          disabled={saving}
          className="rounded-xl py-4 items-center border border-surface-border"
        >
          <Text className="text-white/60 font-medium">Discard & Try Again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
