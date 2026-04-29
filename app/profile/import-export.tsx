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
import {
  previewHevyCsv,
  importHevyCsvWorkouts,
  type HevyPreview,
  type ImportHevyProgress,
} from '@/lib/import-hevy-workouts';

function hevyImportPhaseLabel(phase: ImportHevyProgress['phase']): string {
  switch (phase) {
    case 'checking':
      return 'Checking for existing workout…';
    case 'building_sets':
      return 'Resolving exercises and building sets…';
    case 'inserting_sets':
      return 'Saving sets to the database…';
    default:
      return '';
  }
}

function pickCsvFileWeb(onRead: (text: string) => void) {
  if (typeof document === 'undefined') return;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv,text/csv,text/plain,.txt';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const t = typeof reader.result === 'string' ? reader.result : '';
      onRead(t);
    };
    reader.readAsText(file);
  };
  input.click();
}

/** Hevy CSV workout history import (past sessions). Routines from share links live under Routines → Import from Hevy link. */
export default function ProfileImportExportScreen() {
  const router = useRouter();
  const { user } = useUserStore();
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<HevyPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportHevyProgress | null>(null);

  const runPreview = useCallback((text: string) => {
    setCsvText(text);
    const p = previewHevyCsv(text);
    if (!p.ok) {
      setPreview(null);
      setPreviewError(p.message);
      return;
    }
    setPreviewError(null);
    setPreview(p.preview);
  }, []);

  const pasteFromClipboard = async () => {
    try {
      const t = await Clipboard.getStringAsync();
      if (!t?.trim()) {
        Alert.alert('Clipboard empty', 'Copy your Hevy export CSV first, then tap Paste again.');
        return;
      }
      runPreview(t);
    } catch {
      Alert.alert('Clipboard', 'Could not read the clipboard.');
    }
  };

  const handleImport = async () => {
    if (!user || !csvText.trim()) return;
    setImporting(true);
    setImportProgress(null);
    try {
      const { data: exercises, error: exErr } = await supabase
        .from('exercises')
        .select('id,name,slug')
        .limit(2000);
      if (exErr) throw exErr;
      const catalog = (exercises ?? []).map((e) => ({
        id: e.id as string,
        name: e.name as string,
        slug: e.slug as string,
      }));
      const result = await importHevyCsvWorkouts(
        supabase,
        user.id,
        csvText,
        catalog,
        (p) => setImportProgress(p),
      );
      const lines = [
        `Workouts imported: ${result.sessionsImported}`,
        `Skipped (already in SuperReps): ${result.sessionsSkipped}`,
        `Sets saved: ${result.setsWritten}`,
        `New custom exercises: ${result.customExercisesCreated}`,
      ];
      if (result.warnings.length) lines.push('', result.warnings.slice(0, 5).join('\n'));
      Alert.alert('Import finished', lines.join('\n'), [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setImporting(false);
      setImportProgress(null);
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
          <Text className="text-white font-bold text-lg">Import / Export</Text>
          <Text className="text-white/40 text-xs">Hevy workout CSV → past sessions in SuperReps</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-5"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="bg-surface-card border border-surface-border rounded-xl p-4 mb-4">
          <Text className="text-white/80 text-sm leading-5">
            Import your workout history from Hevy’s CSV export (not routine share links — use{' '}
            <Text className="text-brand-500 font-semibold">Routines → Import from Hevy link</Text> for those).
            {'\n\n'}
            In Hevy: Settings → Export data → Export workouts (CSV).{'\n\n'}
            Each row should include title, start_time, exercise_title, set_index, reps, and weight_lbs or
            weight_kg. Timed-only and cardio rows (duration_seconds, distance_km) are preserved, along
            with workout description and set notes, after you run supabase/migration-workout-sets-hevy-columns.sql
            in the Supabase SQL editor if your database was created from an older schema.{'\n\n'}
            Workouts that match an existing session (same name and start time) are skipped.
          </Text>
        </View>

        <View className="flex-row flex-wrap gap-2 mb-3">
          <TouchableOpacity
            onPress={pasteFromClipboard}
            className="bg-surface-card border border-surface-border rounded-xl px-4 py-3 flex-row items-center gap-2"
          >
            <Ionicons name="clipboard-outline" size={18} color={COLORS.primary} />
            <Text className="text-white font-semibold text-sm">Paste CSV</Text>
          </TouchableOpacity>
          {Platform.OS === 'web' ? (
            <TouchableOpacity
              onPress={() => pickCsvFileWeb(runPreview)}
              className="bg-brand-600 rounded-xl px-4 py-3 flex-row items-center gap-2"
            >
              <Ionicons name="document-attach-outline" size={18} color="white" />
              <Text className="text-white font-semibold text-sm">Choose file</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Text className="text-white/50 text-xs mb-1">CSV contents (optional — paste or choose file)</Text>
        <TextInput
          className="bg-surface-card border border-surface-border rounded-xl p-3 text-white text-xs font-mono mb-4"
          style={{ minHeight: 120, textAlignVertical: 'top' }}
          multiline
          value={csvText}
          onChangeText={runPreview}
          placeholder="Paste CSV here…"
          placeholderTextColor={COLORS.textDim}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {previewError ? (
          <View className="bg-red-500/15 border border-red-500/30 rounded-xl p-3 mb-4">
            <Text className="text-red-300 text-sm">{previewError}</Text>
          </View>
        ) : null}

        {preview && !previewError ? (
          <View className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-4 mb-4">
            <Text className="text-emerald-300 font-bold text-sm mb-2">Preview</Text>
            <Text className="text-white/80 text-sm">Workouts: {preview.sessionCount}</Text>
            <Text className="text-white/80 text-sm">Sets (rows): {preview.setCount}</Text>
            <Text className="text-white/80 text-sm">Date range: {preview.dateRangeLabel}</Text>
          </View>
        ) : null}

        {importing && !importProgress ? (
          <View className="bg-surface-card border border-surface-border rounded-xl p-4 mb-4 flex-row items-center gap-3">
            <ActivityIndicator color={COLORS.primary} />
            <Text className="text-white/70 text-sm flex-1">Loading exercise catalog…</Text>
          </View>
        ) : null}

        {importing && importProgress ? (
          <View className="bg-surface-card border border-surface-border rounded-xl p-4 mb-4">
            <Text className="text-white font-semibold text-sm mb-1">
              Workout {importProgress.currentSession} of {importProgress.totalSessions}
            </Text>
            <Text className="text-white/70 text-xs mb-2" numberOfLines={2}>
              {importProgress.currentTitle}
            </Text>
            <Text className="text-white/45 text-xs mb-3">{hevyImportPhaseLabel(importProgress.phase)}</Text>
            <View className="h-2 rounded-full bg-white/10 overflow-hidden mb-3">
              <View
                className="h-2 rounded-full bg-brand-600"
                style={{ width: `${Math.round(importProgress.fraction * 100)}%` }}
              />
            </View>
            <Text className="text-white/50 text-xs">
              Imported {importProgress.sessionsImported} · Skipped {importProgress.sessionsSkipped} · Sets{' '}
              {importProgress.setsWritten}
              {importProgress.customExercisesCreated > 0
                ? ` · New exercises ${importProgress.customExercisesCreated}`
                : ''}
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={handleImport}
          disabled={importing || !preview || !!previewError}
          className={`rounded-xl py-4 items-center flex-row justify-center gap-2 ${
            importing || !preview || previewError ? 'bg-white/10' : 'bg-brand-600'
          }`}
        >
          {importing ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={20} color="white" />
              <Text className="text-white font-bold">Import workouts</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
