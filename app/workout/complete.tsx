import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Platform, Alert, Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useUserStore } from '@/stores/userStore';
import { supabase } from '@/lib/supabase';
import { formatDurationClock, formatVolumeDisplay } from '@/lib/utils';
import { fetchHistoricalMaxWeightByExercise, findAllSessionPRs } from '@/lib/workout-pr';

function decodeParam(s: string | undefined, fallback = ''): string {
  if (!s || typeof s !== 'string') return fallback;
  try { return decodeURIComponent(s); } catch { return s; }
}

function timeOfDayWorkoutName(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Morning Workout 💪';
  if (h >= 12 && h < 17) return 'Afternoon Workout 💪';
  if (h >= 17 && h < 21) return 'Evening Workout 💪';
  return 'Night Workout 💪';
}

function formatWhen(date: Date): string {
  return date.toLocaleString('en-US', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

type PickerMode = 'date' | 'time' | null;

export default function WorkoutCompleteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    routineName?: string;
    durationSec?: string;
    setCount?: string;
    volumeKg?: string;
  }>();

  const {
    exercises, startedAt, sessionId, routineId,
    routineName: storeRoutineName, resetWorkout,
  } = useWorkoutStore();
  const { user } = useUserStore();

  const routineName = decodeParam(params.routineName, storeRoutineName ?? timeOfDayWorkoutName());
  const durationSec = Number(params.durationSec) || 0;
  const setCount = Number(params.setCount) || 0;
  const volumeKg = Number(params.volumeKg) || 0;

  const [when, setWhen] = useState<Date>(startedAt ?? new Date());
  const [durationSecs, setDurationSecs] = useState(durationSec);
  const [showDurationEditor, setShowDurationEditor] = useState(false);
  const [draftH, setDraftH] = useState(String(Math.floor(durationSec / 3600)));
  const [draftM, setDraftM] = useState(String(Math.floor((durationSec % 3600) / 60)));
  const [draftS, setDraftS] = useState(String(durationSec % 60));
  const [description, setDescription] = useState('');
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [saving, setSaving] = useState(false);

  const handleDiscard = () => {
    Alert.alert('Discard Workout?', 'This workout will not be saved.', [
      { text: 'Keep Going', style: 'cancel' },
      {
        text: 'Discard', style: 'destructive', onPress: () => {
          resetWorkout();
          router.replace('/(tabs)');
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (!user || !sessionId || saving) return;
    setSaving(true);
    try {
      const now = new Date();
      const exerciseIds = [...new Set(exercises.map(e => e.exercise.id))];
      const historicalMax = await fetchHistoricalMaxWeightByExercise(user.id, exerciseIds);
      findAllSessionPRs(exercises, historicalMax); // computed for future use

      const setsToInsert: any[] = [];
      for (const ex of exercises) {
        for (const set of ex.sets.filter(s => s.completed)) {
          setsToInsert.push({
            session_id: sessionId,
            exercise_id: ex.exercise.id,
            set_index: set.set_index,
            set_type: set.set_type,
            weight_kg: set.weight_kg,
            reps: set.reps,
            rpe: set.rpe,
            duration_seconds: set.duration_seconds,
            notes: ex.notes || null,
            completed_at: now.toISOString(),
          });
        }
      }

      const { error: sessionErr } = await supabase.from('workout_sessions').insert({
        id: sessionId,
        user_id: user.id,
        routine_id: routineId,
        routine_name: routineName,
        started_at: when.toISOString(),
        finished_at: now.toISOString(),
        duration_seconds: durationSecs,
        volume_total: volumeKg,
        notes: description.trim() || null,
      });

      if (sessionErr) {
        Alert.alert('Error', sessionErr.message ?? 'Could not save workout.');
        setSaving(false);
        return;
      }

      if (setsToInsert.length > 0) {
        await supabase.from('workout_sets').insert(setsToInsert);
      }

      resetWorkout();
      router.replace('/(tabs)');
    } catch {
      setSaving(false);
    }
  };

  const onDateChange = (_: any, date?: Date) => {
    if (!date) { setPickerMode(null); return; }
    setWhen(prev => {
      const next = new Date(prev);
      next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      return next;
    });
    if (Platform.OS === 'android') setPickerMode('time');
  };

  const onTimeChange = (_: any, date?: Date) => {
    setPickerMode(null);
    if (!date) return;
    setWhen(prev => {
      const next = new Date(prev);
      next.setHours(date.getHours(), date.getMinutes());
      return next;
    });
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={COLORS.ink} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Save Workout</Text>
        <TouchableOpacity style={[s.saveBtn, saving && s.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
          <Text style={s.saveBtnTxt}>{saving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Workout name */}
        <Text style={s.workoutName}>{routineName}</Text>

        {/* Stats row */}
        <View style={s.statsRow}>
          <TouchableOpacity style={s.statItem} onPress={() => {
            setDraftH(String(Math.floor(durationSecs / 3600)));
            setDraftM(String(Math.floor((durationSecs % 3600) / 60)));
            setDraftS(String(durationSecs % 60));
            setShowDurationEditor(true);
          }} activeOpacity={0.7}>
            <Text style={s.statLabel}>Duration</Text>
            <Text style={s.statValueBlue}>{formatDurationClock(durationSecs)}</Text>
          </TouchableOpacity>
          <View style={s.statItem}>
            <Text style={s.statLabel}>Volume</Text>
            <Text style={s.statValue}>{formatVolumeDisplay(volumeKg)}</Text>
          </View>
          <View style={s.statItem}>
            <Text style={s.statLabel}>Sets</Text>
            <Text style={s.statValue}>{setCount}</Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* When */}
        <TouchableOpacity style={s.row} onPress={() => setPickerMode('date')} activeOpacity={0.7}>
          <Text style={s.rowLabel}>When</Text>
          <Text style={s.rowValueBlue}>{formatWhen(when)}</Text>
        </TouchableOpacity>

        <View style={s.divider} />

        {/* Description */}
        <View style={s.descSection}>
          <Text style={s.rowLabel}>Description</Text>
          <TextInput
            style={s.descInput}
            placeholder="How did your workout go? Leave some notes here..."
            placeholderTextColor={COLORS.ink4}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />
        </View>

        <View style={s.divider} />

        {/* Discard */}
        <TouchableOpacity style={s.discardRow} onPress={handleDiscard}>
          <Text style={s.discardTxt}>Discard Workout</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Date/time pickers */}
      {pickerMode === 'date' && Platform.OS === 'ios' && (
        <View style={[s.pickerSheet, { paddingBottom: insets.bottom }]}>
          <View style={s.pickerToolbar}>
            <TouchableOpacity onPress={() => setPickerMode(null)}>
              <Text style={s.pickerCancel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPickerMode('time')}>
              <Text style={s.pickerDone}>Next →</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={when}
            mode="date"
            display="spinner"
            onChange={onDateChange}
            themeVariant="dark"
          />
        </View>
      )}
      {pickerMode === 'time' && Platform.OS === 'ios' && (
        <View style={[s.pickerSheet, { paddingBottom: insets.bottom }]}>
          <View style={s.pickerToolbar}>
            <TouchableOpacity onPress={() => setPickerMode('date')}>
              <Text style={s.pickerCancel}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPickerMode(null)}>
              <Text style={s.pickerDone}>Done</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={when}
            mode="time"
            display="spinner"
            onChange={onTimeChange}
            themeVariant="dark"
          />
        </View>
      )}
      {pickerMode === 'date' && Platform.OS === 'android' && (
        <DateTimePicker value={when} mode="date" display="default" onChange={onDateChange} />
      )}
      {pickerMode === 'time' && Platform.OS === 'android' && (
        <DateTimePicker value={when} mode="time" display="default" onChange={onTimeChange} />
      )}

      {/* Duration editor modal */}
      <Modal
        visible={showDurationEditor}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDurationEditor(false)}
      >
        <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setShowDurationEditor(false)}>
          <TouchableOpacity activeOpacity={1} style={s.durationModal}>
            <Text style={s.durationModalTitle}>Edit Duration</Text>
            <View style={s.durationFields}>
              <View style={s.durationField}>
                <TextInput
                  style={s.durationInput}
                  keyboardType="number-pad"
                  value={draftH}
                  onChangeText={setDraftH}
                  maxLength={2}
                  selectTextOnFocus
                />
                <Text style={s.durationUnit}>h</Text>
              </View>
              <Text style={s.durationColon}>:</Text>
              <View style={s.durationField}>
                <TextInput
                  style={s.durationInput}
                  keyboardType="number-pad"
                  value={draftM}
                  onChangeText={setDraftM}
                  maxLength={2}
                  selectTextOnFocus
                />
                <Text style={s.durationUnit}>m</Text>
              </View>
              <Text style={s.durationColon}>:</Text>
              <View style={s.durationField}>
                <TextInput
                  style={s.durationInput}
                  keyboardType="number-pad"
                  value={draftS}
                  onChangeText={setDraftS}
                  maxLength={2}
                  selectTextOnFocus
                />
                <Text style={s.durationUnit}>s</Text>
              </View>
            </View>
            <View style={s.durationActions}>
              <TouchableOpacity style={s.durationCancel} onPress={() => setShowDurationEditor(false)}>
                <Text style={s.durationCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.durationConfirm}
                onPress={() => {
                  const h = Math.max(0, parseInt(draftH) || 0);
                  const m = Math.min(59, Math.max(0, parseInt(draftM) || 0));
                  const sec = Math.min(59, Math.max(0, parseInt(draftS) || 0));
                  setDurationSecs(h * 3600 + m * 60 + sec);
                  setShowDurationEditor(false);
                }}
              >
                <Text style={s.durationConfirmTxt}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.border,
  },
  headerTitle: { color: COLORS.ink, fontWeight: '700', fontSize: 17 },
  saveBtn: {
    backgroundColor: COLORS.blue, borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 9,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnTxt: { color: 'white', fontWeight: '700', fontSize: 15 },

  scroll: { paddingHorizontal: 20, paddingTop: 24 },

  workoutName: { color: COLORS.ink, fontWeight: '800', fontSize: 26, marginBottom: 20 },

  statsRow: { flexDirection: 'row', gap: 0, marginBottom: 20 },
  statItem: { flex: 1 },
  statLabel: { color: COLORS.ink3, fontSize: 12, fontWeight: '500', marginBottom: 3 },
  statValue: { color: COLORS.ink, fontWeight: '700', fontSize: 17 },
  statValueBlue: { color: COLORS.blue, fontWeight: '700', fontSize: 17 },

  divider: { height: 0.5, backgroundColor: COLORS.border, marginVertical: 2 },

  row: { paddingVertical: 18 },
  rowLabel: { color: COLORS.ink3, fontSize: 13, fontWeight: '500', marginBottom: 4 },
  rowValueBlue: { color: COLORS.blue, fontSize: 16, fontWeight: '500' },

  descSection: { paddingVertical: 18 },
  descInput: {
    color: COLORS.ink, fontSize: 15, lineHeight: 22,
    marginTop: 6, minHeight: 80,
  },

  discardRow: { paddingVertical: 24, alignItems: 'center' },
  discardTxt: { color: COLORS.red, fontWeight: '600', fontSize: 16 },

  pickerSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.surface,
    borderTopWidth: 0.5, borderTopColor: COLORS.border,
  },
  pickerToolbar: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4,
  },
  pickerCancel: { color: COLORS.ink2, fontSize: 16, fontWeight: '500' },
  pickerDone: { color: COLORS.blue, fontWeight: '700', fontSize: 16 },

  // Duration editor
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  durationModal: {
    backgroundColor: COLORS.surface, borderRadius: 20,
    paddingHorizontal: 24, paddingVertical: 24, width: 300,
  },
  durationModalTitle: {
    color: COLORS.ink, fontWeight: '700', fontSize: 17,
    textAlign: 'center', marginBottom: 20,
  },
  durationFields: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  durationField: { alignItems: 'center', gap: 4 },
  durationInput: {
    backgroundColor: COLORS.surface2, color: COLORS.ink,
    fontWeight: '700', fontSize: 26, textAlign: 'center',
    width: 62, borderRadius: 10, paddingVertical: 10,
    borderWidth: 0.5, borderColor: COLORS.border,
  },
  durationUnit: { color: COLORS.ink3, fontSize: 12, fontWeight: '600' },
  durationColon: { color: COLORS.ink2, fontSize: 24, fontWeight: '700', marginBottom: 16 },
  durationActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  durationCancel: {
    flex: 1, backgroundColor: COLORS.surface2, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
  },
  durationCancelTxt: { color: COLORS.ink2, fontWeight: '600', fontSize: 15 },
  durationConfirm: {
    flex: 1, backgroundColor: COLORS.blue, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
  },
  durationConfirmTxt: { color: 'white', fontWeight: '700', fontSize: 15 },
});
