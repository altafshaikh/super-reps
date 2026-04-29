import { useState, useCallback } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import { COLORS } from '@/constants';
import type { ExerciseRow } from '@/lib/import-hevy-workouts';
import {
  normalizeHevyRoutineUrl,
  fetchHevyRoutineContent,
  parseHevyRoutineAny,
  saveHevyShareRoutine,
  previewResolvedExercises,
} from '@/lib/import-hevy-routine-share';

export default function ImportHevyLinkScreen() {
  const router = useRouter();
  const { user } = useUserStore();
  const [url, setUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const [previewExercises, setPreviewExercises] = useState<string[]>([]);
  const [previewNote, setPreviewNote] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const runPreview = useCallback(async () => {
    const canonical = normalizeHevyRoutineUrl(url);
    if (!canonical) {
      setFetchError('Paste a valid Hevy routine link (hevy.com/routine/…).');
      setPreviewTitle(null);
      setPreviewExercises([]);
      setPreviewNote(null);
      return;
    }
    setFetchError(null);
    setPreviewNote(null);
    setLoadingPreview(true);
    try {
      const raw = await fetchHevyRoutineContent(canonical);
      const parsed = parseHevyRoutineAny(raw);
      setPreviewTitle(parsed.title);
      setPreviewExercises(parsed.exercises.map((e) => e.name));
      const { data: exercises } = await supabase.from('exercises').select('id,name,slug').limit(2000);
      const catalog = (exercises ?? []).map((e) => ({
        id: e.id as string,
        name: e.name as string,
        slug: e.slug as string,
      })) as ExerciseRow[];
      const { matched, unmatched } = previewResolvedExercises(
        parsed.exercises.map((e) => e.name),
        catalog,
      );
      setPreviewNote(
        `${parsed.exercises.length} exercises found · ${matched} exact catalog matches` +
          (unmatched.length ? ` · ${unmatched.length} will use new custom exercises if needed` : ''),
      );
    } catch (e) {
      setPreviewTitle(null);
      setPreviewExercises([]);
      setFetchError(e instanceof Error ? e.message : 'Could not load routine.');
    } finally {
      setLoadingPreview(false);
    }
  }, [url]);

  const pasteUrl = async () => {
    try {
      const t = await Clipboard.getStringAsync();
      if (t?.trim()) setUrl(t.trim());
    } catch {
      Alert.alert('Clipboard', 'Could not read the clipboard.');
    }
  };

  const handleSave = async () => {
    if (!user) return;
    const canonical = normalizeHevyRoutineUrl(url);
    if (!canonical) {
      Alert.alert('Invalid link', 'Use a Hevy share URL like https://hevy.com/routine/…');
      return;
    }
    setSaving(true);
    try {
      const raw = await fetchHevyRoutineContent(canonical);
      const parsed = parseHevyRoutineAny(raw);
      const { data: exercises, error: exErr } = await supabase
        .from('exercises')
        .select('id,name,slug')
        .limit(2000);
      if (exErr) throw exErr;
      const catalog = (exercises ?? []).map((e) => ({
        id: e.id as string,
        name: e.name as string,
        slug: e.slug as string,
      })) as ExerciseRow[];

      const { routineId, warnings } = await saveHevyShareRoutine(supabase, user.id, catalog, parsed);
      const msg =
        warnings.length > 0
          ? `Routine created.\n\n${warnings.slice(0, 8).join('\n')}`
          : 'Routine imported from Hevy.';
      Alert.alert('Done', msg, [
        { text: 'Open routine', onPress: () => router.replace(`/routines/${routineId}`) },
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="px-5 pt-16 pb-3 flex-row items-center gap-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-surface-card items-center justify-center"
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-white font-bold text-lg">Import from Hevy link</Text>
          <Text className="text-white/40 text-xs">Share URL → SuperReps routine</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-5"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="bg-surface-card border border-surface-border rounded-xl p-4 mb-4">
          <Text className="text-white/80 text-sm leading-5">
            Paste a Hevy share URL. We load it on the server with headless Chromium (your deployed{' '}
            <Text className="text-white/90 font-mono text-[11px]">/api/hevy-routine</Text>), then fall back to a
            text reader if needed. For iOS/Android, set{' '}
            <Text className="text-white/90 font-mono text-[11px]">EXPO_PUBLIC_SITE_URL</Text> to your production
            site so the app can call that API.
            Workout history CSV import lives in{' '}
            <Text className="text-brand-500 font-semibold">Profile → Import / Export</Text>.
          </Text>
        </View>

        <View className="flex-row gap-2 mb-2">
          <TouchableOpacity
            onPress={pasteUrl}
            className="bg-surface-card border border-surface-border rounded-xl px-4 py-3 flex-row items-center gap-2"
          >
            <Ionicons name="clipboard-outline" size={18} color={COLORS.primary} />
            <Text className="text-white font-semibold text-sm">Paste URL</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => void runPreview()}
            disabled={loadingPreview || !url.trim()}
            className={`flex-1 rounded-xl px-4 py-3 flex-row items-center justify-center gap-2 ${
              loadingPreview || !url.trim() ? 'bg-white/10' : 'bg-brand-600'
            }`}
          >
            {loadingPreview ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="eye-outline" size={18} color="white" />
                <Text className="text-white font-semibold text-sm">Preview</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text className="text-white/50 text-xs mb-1">Hevy routine URL</Text>
        <TextInput
          className="bg-surface-card border border-surface-border rounded-xl p-3 text-white text-sm mb-4"
          value={url}
          onChangeText={setUrl}
          placeholder="https://hevy.com/routine/…"
          placeholderTextColor={COLORS.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        {fetchError ? (
          <View className="bg-red-500/15 border border-red-500/30 rounded-xl p-3 mb-4">
            <Text className="text-red-300 text-sm">{fetchError}</Text>
          </View>
        ) : null}

        {previewTitle ? (
          <View className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-4 mb-3">
            <Text className="text-emerald-300 font-bold text-sm mb-1">{previewTitle}</Text>
            {previewNote ? <Text className="text-white/60 text-xs mb-2">{previewNote}</Text> : null}
            <Text className="text-white/80 text-xs font-mono" numberOfLines={12}>
              {previewExercises.join(' · ')}
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={() => void handleSave()}
          disabled={saving || !normalizeHevyRoutineUrl(url)}
          className={`rounded-xl py-4 items-center flex-row justify-center gap-2 ${
            saving || !normalizeHevyRoutineUrl(url) ? 'bg-white/10' : 'bg-brand-600'
          }`}
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="download-outline" size={20} color="white" />
              <Text className="text-white font-bold">Create routine in SuperReps</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
