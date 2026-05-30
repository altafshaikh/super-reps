import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Alert, FlatList, Modal, ActivityIndicator, Platform, StyleSheet,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import { formatWeight, formatDurationClock } from '@/lib/utils';
import { generateId } from '@/lib/utils';
import { COLORS } from '@/constants';
import { ExerciseLibraryModal } from '@/components/workouts/ExerciseLibraryModal';
import type { Exercise } from '@/types';

type PickerMode = 'date' | 'time' | null;

function formatWhen(date: Date): string {
  return date.toLocaleString('en-US', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

const RPE_OPTIONS = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];

interface EditSet {
  id: string;
  isNew: boolean;
  deleted: boolean;
  exercise_id: string;
  set_index: number;
  set_type: 'working' | 'warmup' | 'drop' | 'failure';
  weight_kg: number;
  reps: number;
  rpe: number | null;
}

interface EditExercise {
  exercise_id: string;
  exercise_name: string;
  exercise_category: string;
  sets: EditSet[];
  deleted: boolean;
}

export default function EditWorkoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUserStore();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const [routineName, setRoutineName] = useState('');
  const [when, setWhen] = useState<Date>(new Date());
  const [durationSecs, setDurationSecs] = useState(0);
  const [notes, setNotes] = useState('');
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const webDateInputRef = useRef<any>(null);
  const [showDurationEditor, setShowDurationEditor] = useState(false);
  const [draftH, setDraftH] = useState('0');
  const [draftM, setDraftM] = useState('0');
  const [draftS, setDraftS] = useState('0');
  const [exercises, setExercises] = useState<EditExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (!user || !sessionId) return;
    void loadSession();
  }, [user, sessionId]);

  const loadSession = async () => {
    setLoading(true);
    const { data: session } = await supabase
      .from('workout_sessions')
      .select('routine_name, started_at, duration_seconds, notes')
      .eq('id', sessionId)
      .single();
    if (session) {
      setRoutineName(session.routine_name ?? 'Workout');
      setWhen(session.started_at ? new Date(session.started_at) : new Date());
      setDurationSecs(Number(session.duration_seconds) || 0);
      setNotes(session.notes ?? '');
    }

    const { data: sets } = await supabase
      .from('workout_sets')
      .select('id, exercise_id, set_index, set_type, weight_kg, reps, rpe, exercise:exercises(id, name, category)')
      .eq('session_id', sessionId)
      .order('set_index', { ascending: true });

    if (sets) {
      const byExercise = new Map<string, EditExercise>();
      for (const st of sets as any[]) {
        const exId = st.exercise_id;
        if (!byExercise.has(exId)) {
          byExercise.set(exId, {
            exercise_id: exId,
            exercise_name: st.exercise?.name ?? 'Exercise',
            exercise_category: st.exercise?.category ?? '',
            sets: [],
            deleted: false,
          });
        }
        byExercise.get(exId)!.sets.push({
          id: st.id,
          isNew: false,
          deleted: false,
          exercise_id: exId,
          set_index: st.set_index,
          set_type: st.set_type ?? 'working',
          weight_kg: Number(st.weight_kg) || 0,
          reps: Number(st.reps) || 0,
          rpe: st.rpe != null ? Number(st.rpe) : null,
        });
      }
      setExercises([...byExercise.values()]);
    }
    setLoading(false);
  };

  const updateSet = (exId: string, setId: string, updates: Partial<EditSet>) => {
    setExercises(prev => prev.map(ex => {
      if (ex.exercise_id !== exId) return ex;
      return { ...ex, sets: ex.sets.map(s => s.id === setId ? { ...s, ...updates } : s) };
    }));
  };

  const addSet = (exId: string) => {
    setExercises(prev => prev.map(ex => {
      if (ex.exercise_id !== exId) return ex;
      const last = [...ex.sets].reverse().find(s => !s.deleted);
      const newSet: EditSet = {
        id: generateId(),
        isNew: true,
        deleted: false,
        exercise_id: exId,
        set_index: ex.sets.filter(s => !s.deleted).length,
        set_type: 'working',
        weight_kg: last?.weight_kg ?? 0,
        reps: last?.reps ?? 0,
        rpe: null,
      };
      return { ...ex, sets: [...ex.sets, newSet] };
    }));
  };

  const removeSet = (exId: string, setId: string) => {
    setExercises(prev => prev.map(ex => {
      if (ex.exercise_id !== exId) return ex;
      return { ...ex, sets: ex.sets.map(s => s.id === setId ? { ...s, deleted: true } : s) };
    }));
  };

  const removeExercise = (exId: string) => {
    setExercises(prev => prev.map(ex => ex.exercise_id === exId ? { ...ex, deleted: true } : ex));
  };


  const addExercise = (exercise: Exercise) => {
    const already = exercises.find(ex => ex.exercise_id === exercise.id);
    if (already && already.deleted) {
      setExercises(prev => prev.map(ex => ex.exercise_id === exercise.id ? { ...ex, deleted: false } : ex));
    } else if (!already) {
      setExercises(prev => [...prev, {
        exercise_id: exercise.id,
        exercise_name: exercise.name,
        exercise_category: exercise.category,
        sets: [{
          id: generateId(), isNew: true, deleted: false,
          exercise_id: exercise.id, set_index: 0,
          set_type: 'working', weight_kg: 0, reps: 0, rpe: null,
        }],
        deleted: false,
      }]);
    }
    setShowPicker(false);
  };

  const handleSave = async () => {
    if (!user || !sessionId) return;
    setSaving(true);

    // Collect sets to delete (non-new sets marked deleted)
    const toDelete = exercises.flatMap(ex =>
      ex.sets.filter(s => s.deleted && !s.isNew).map(s => s.id)
    );
    if (toDelete.length > 0) {
      await supabase.from('workout_sets').delete().in('id', toDelete);
    }

    // Upsert remaining sets
    const toUpsert = exercises
      .filter(ex => !ex.deleted)
      .flatMap(ex => ex.sets.filter(s => !s.deleted).map((s, i) => ({
        id: s.id,
        session_id: sessionId,
        exercise_id: s.exercise_id,
        set_index: i,
        set_type: s.set_type,
        weight_kg: s.weight_kg,
        reps: s.reps,
        rpe: s.rpe,
        completed_at: new Date().toISOString(),
      })));

    if (toUpsert.length > 0) {
      await supabase.from('workout_sets').upsert(toUpsert, { onConflict: 'id' });
    }

    // Recalculate volume_total and update session metadata
    const volume = toUpsert.reduce((sum, s) => sum + s.weight_kg * s.reps, 0);
    const finishedAt = new Date(when.getTime() + durationSecs * 1000);
    await supabase.from('workout_sessions')
      .update({
        routine_name: routineName.trim() || null,
        volume_total: volume,
        started_at: when.toISOString(),
        finished_at: finishedAt.toISOString(),
        duration_seconds: durationSecs,
        notes: notes.trim() || null,
      })
      .eq('id', sessionId);

    setSaving(false);
    router.back();
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

  const handleCancel = () => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Discard changes?')) router.back();
      return;
    }
    Alert.alert('Discard changes?', 'Your edits won\'t be saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  if (loading) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={COLORS.blue} size="large" />
      </View>
    );
  }

  const visibleExercises = exercises.filter(ex => !ex.deleted);

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={handleCancel} style={s.cancelBtn}>
          <Text style={s.cancelTxt}>Cancel</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{routineName}</Text>
        <TouchableOpacity style={[s.saveBtn, saving && s.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color={COLORS.bg} size="small" /> : <Text style={s.saveTxt}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Session metadata */}
        <View style={s.metaCard}>
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>Name</Text>
            <TextInput
              style={s.nameInput}
              value={routineName}
              onChangeText={setRoutineName}
              placeholder="Workout name"
              placeholderTextColor={COLORS.ink4}
              returnKeyType="done"
            />
          </View>
          <View style={s.metaDivider} />
          <TouchableOpacity
            style={s.metaRow}
            onPress={() => {
              if (Platform.OS === 'web') {
                webDateInputRef.current?.showPicker?.();
                webDateInputRef.current?.click?.();
              } else {
                setPickerMode('date');
              }
            }}
            activeOpacity={0.7}
          >
            <View style={s.metaLabelRow}>
              <Text style={s.metaLabel}>When</Text>
              <Ionicons name="chevron-forward" size={12} color={COLORS.ink4} />
            </View>
            <Text style={s.metaValueBlue}>{formatWhen(when)}</Text>
          </TouchableOpacity>
          <View style={s.metaDivider} />
          <TouchableOpacity style={s.metaRow} onPress={() => {
            setDraftH(String(Math.floor(durationSecs / 3600)));
            setDraftM(String(Math.floor((durationSecs % 3600) / 60)));
            setDraftS(String(durationSecs % 60));
            setShowDurationEditor(true);
          }} activeOpacity={0.7}>
            <Text style={s.metaLabel}>Duration</Text>
            <Text style={s.metaValueBlue}>{formatDurationClock(durationSecs)}</Text>
          </TouchableOpacity>
          <View style={s.metaDivider} />
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>Notes</Text>
            <TextInput
              style={s.notesInput}
              placeholder="How did it go?"
              placeholderTextColor={COLORS.ink4}
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
            />
          </View>
        </View>

        {visibleExercises.map(ex => {
          const visibleSets = ex.sets.filter(s => !s.deleted);
          return (
            <View key={ex.exercise_id} style={s.exerciseBlock}>
              <View style={s.exHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.exName}>{ex.exercise_name}</Text>
                  <Text style={s.exCat}>{ex.exercise_category}</Text>
                </View>
                <TouchableOpacity onPress={() => {
                  Alert.alert('Remove exercise?', ex.exercise_name, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => removeExercise(ex.exercise_id) },
                  ]);
                }}>
                  <Ionicons name="close-circle-outline" size={20} color={COLORS.ink3} />
                </TouchableOpacity>
              </View>

              <View style={s.setsCard}>
                <View style={s.setsHeader}>
                  <Text style={[s.colHdr, { width: 32 }]}>Set</Text>
                  <Text style={[s.colHdr, { flex: 1, textAlign: 'center' }]}>kg</Text>
                  <Text style={[s.colHdr, { flex: 1, textAlign: 'center' }]}>Reps</Text>
                  <Text style={[s.colHdr, { width: 40, textAlign: 'center' }]}>RPE</Text>
                  <Text style={[s.colHdr, { width: 44 }]} />
                </View>
                {visibleSets.map((set, i) => (
                  <EditSetRow
                    key={set.id}
                    set={set}
                    index={i}
                    isLast={i === visibleSets.length - 1}
                    onUpdate={(updates) => updateSet(ex.exercise_id, set.id, updates)}
                    onRemove={() => removeSet(ex.exercise_id, set.id)}
                  />
                ))}
              </View>

              <TouchableOpacity style={s.addSetBtn} onPress={() => addSet(ex.exercise_id)}>
                <Text style={s.addSetTxt}>+ Add Set</Text>
              </TouchableOpacity>
              <Text style={s.tip}>Hold a set row to remove it</Text>
            </View>
          );
        })}

        <TouchableOpacity style={s.addExBtn} onPress={() => setShowPicker(true)}>
          <Ionicons name="add" size={22} color={COLORS.ink3} />
          <Text style={s.addExTxt}>Add Exercise</Text>
        </TouchableOpacity>
      </ScrollView>

      <ExerciseLibraryModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onAddExercise={addExercise}
      />

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
          <DateTimePicker value={when} mode="date" display="spinner" onChange={onDateChange} themeVariant="dark" />
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
          <DateTimePicker value={when} mode="time" display="spinner" onChange={onTimeChange} themeVariant="dark" />
        </View>
      )}
      {pickerMode === 'date' && Platform.OS === 'android' && (
        <DateTimePicker value={when} mode="date" display="default" onChange={onDateChange} />
      )}
      {pickerMode === 'time' && Platform.OS === 'android' && (
        <DateTimePicker value={when} mode="time" display="default" onChange={onTimeChange} />
      )}
      {Platform.OS === 'web' && React.createElement('input', {
        ref: webDateInputRef,
        type: 'datetime-local',
        style: { position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 },
        value: `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}T${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`,
        onChange: (e: any) => { if (e.target.value) setWhen(new Date(e.target.value)); },
      })}

      {/* Duration editor */}
      <Modal visible={showDurationEditor} transparent animationType="fade" onRequestClose={() => setShowDurationEditor(false)}>
        <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setShowDurationEditor(false)}>
          <TouchableOpacity activeOpacity={1} style={s.durationModal}>
            <Text style={s.durationModalTitle}>Edit Duration</Text>
            <View style={s.durationFields}>
              <View style={s.durationField}>
                <TextInput style={s.durationInput} keyboardType="number-pad" value={draftH} onChangeText={setDraftH} maxLength={2} selectTextOnFocus />
                <Text style={s.durationUnit}>h</Text>
              </View>
              <Text style={s.durationColon}>:</Text>
              <View style={s.durationField}>
                <TextInput style={s.durationInput} keyboardType="number-pad" value={draftM} onChangeText={setDraftM} maxLength={2} selectTextOnFocus />
                <Text style={s.durationUnit}>m</Text>
              </View>
              <Text style={s.durationColon}>:</Text>
              <View style={s.durationField}>
                <TextInput style={s.durationInput} keyboardType="number-pad" value={draftS} onChangeText={setDraftS} maxLength={2} selectTextOnFocus />
                <Text style={s.durationUnit}>s</Text>
              </View>
            </View>
            <View style={s.durationActions}>
              <TouchableOpacity style={s.durationCancel} onPress={() => setShowDurationEditor(false)}>
                <Text style={s.durationCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.durationConfirm} onPress={() => {
                const h = Math.max(0, parseInt(draftH) || 0);
                const m = Math.min(59, Math.max(0, parseInt(draftM) || 0));
                const sec = Math.min(59, Math.max(0, parseInt(draftS) || 0));
                setDurationSecs(h * 3600 + m * 60 + sec);
                setShowDurationEditor(false);
              }}>
                <Text style={s.durationConfirmTxt}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function EditSetRow({
  set, index, isLast, onUpdate, onRemove,
}: {
  set: EditSet;
  index: number;
  isLast: boolean;
  onUpdate: (updates: Partial<EditSet>) => void;
  onRemove: () => void;
}) {
  const [rpeExpanded, setRpeExpanded] = useState(false);

  return (
    <View>
      <TouchableOpacity
        activeOpacity={1}
        onLongPress={onRemove}
        style={[s.setRow, !isLast && s.setRowBorder]}
      >
        <Text style={s.setNum}>{index + 1}</Text>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <TextInput
            style={s.setInput}
            keyboardType="decimal-pad"
            value={set.weight_kg > 0 ? formatWeight(set.weight_kg) : ''}
            placeholder="0"
            placeholderTextColor={COLORS.ink3}
            onChangeText={v => onUpdate({ weight_kg: parseFloat(v) || 0 })}
          />
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <TextInput
            style={s.setInput}
            keyboardType="number-pad"
            value={set.reps > 0 ? String(set.reps) : ''}
            placeholder="0"
            placeholderTextColor={COLORS.ink3}
            onChangeText={v => onUpdate({ reps: parseInt(v) || 0 })}
          />
        </View>
        <TouchableOpacity
          style={[s.rpeToggle, set.rpe != null && s.rpeToggleActive]}
          onPress={() => setRpeExpanded(v => !v)}
        >
          <Text style={[s.rpeToggleTxt, set.rpe != null && s.rpeToggleTxtActive]}>
            {set.rpe != null ? String(set.rpe) : '+'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onRemove} style={s.removeBtn}>
          <Ionicons name="trash-outline" size={16} color={COLORS.ink3} />
        </TouchableOpacity>
      </TouchableOpacity>
      {rpeExpanded && (
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={s.rpePickerRow}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 6, paddingVertical: 6 }}
        >
          {RPE_OPTIONS.map(v => (
            <TouchableOpacity
              key={v}
              style={[s.rpePill, set.rpe === v && s.rpePillActive]}
              onPress={() => { onUpdate({ rpe: set.rpe === v ? null : v }); if (set.rpe !== v) setRpeExpanded(false); }}
            >
              <Text style={[s.rpePillTxt, set.rpe === v && s.rpePillTxtActive]}>{v}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  cancelBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  cancelTxt: { color: COLORS.ink3, fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.ink, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  saveBtn: { backgroundColor: COLORS.blue, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 },
  saveBtnDisabled: { opacity: 0.6 },
  saveTxt: { color: COLORS.bg, fontWeight: '800', fontSize: 14 },
  scroll: { paddingHorizontal: 14, paddingBottom: 100, paddingTop: 14, gap: 14 },
  exerciseBlock: { gap: 8 },
  exHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exName: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
  exCat: { fontSize: 12, color: COLORS.ink3 },
  setsCard: {
    backgroundColor: COLORS.surface2, borderWidth: 0.5, borderColor: COLORS.border, borderRadius: 14, overflow: 'hidden',
  },
  setsHeader: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.border,
  },
  colHdr: { color: COLORS.ink3, fontSize: 11, fontWeight: '600' },
  setRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, minHeight: 52,
  },
  setRowBorder: { borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  setNum: { width: 32, fontSize: 13, fontWeight: '700', color: COLORS.ink3, textAlign: 'center' },
  setInput: {
    backgroundColor: COLORS.surface3, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10,
    fontSize: 16, fontWeight: '700', color: COLORS.ink, textAlign: 'center', minWidth: 60,
  },
  rpeToggle: {
    width: 40, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface3, borderWidth: 0.5, borderColor: COLORS.border,
  },
  rpeToggleActive: { backgroundColor: COLORS.blueLight, borderColor: COLORS.blue },
  rpeToggleTxt: { fontSize: 12, fontWeight: '700', color: COLORS.ink3 },
  rpeToggleTxtActive: { color: COLORS.blue },
  removeBtn: { width: 44, alignItems: 'center', justifyContent: 'center' },
  rpePickerRow: { backgroundColor: COLORS.surface3, maxHeight: 46 },
  rpePill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: COLORS.surface2, borderWidth: 0.5, borderColor: COLORS.border,
  },
  rpePillActive: { backgroundColor: COLORS.blueLight, borderColor: COLORS.blue },
  rpePillTxt: { fontSize: 13, fontWeight: '600', color: COLORS.ink2 },
  rpePillTxtActive: { color: COLORS.blue, fontWeight: '700' },
  addSetBtn: { paddingVertical: 10, alignItems: 'center' },
  addSetTxt: { color: COLORS.blue, fontWeight: '700', fontSize: 14 },
  tip: { fontSize: 11, color: COLORS.ink3, textAlign: 'center', marginTop: -4 },
  addExBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 14, borderWidth: 0.5, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  addExTxt: { color: COLORS.ink3, fontWeight: '600', fontSize: 15 },
  pickerRoot: { flex: 1, backgroundColor: COLORS.bg },
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10,
  },
  pickerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.ink },
  pickerSearch: { paddingHorizontal: 20, paddingBottom: 10 },
  pickerInput: {
    backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 0.5, borderColor: COLORS.border,
    paddingVertical: 10, paddingHorizontal: 14, fontSize: 15, color: COLORS.ink,
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.border,
  },
  pickerExName: { fontSize: 15, fontWeight: '600', color: COLORS.ink },
  pickerExMeta: { fontSize: 12, color: COLORS.ink3, marginTop: 2 },

  // Session metadata card
  metaCard: {
    backgroundColor: COLORS.surface, borderRadius: 16,
    borderWidth: 0.5, borderColor: COLORS.border,
    overflow: 'hidden', marginBottom: 4,
  },
  metaRow: { paddingHorizontal: 16, paddingVertical: 14 },
  metaLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  metaLabel: { color: COLORS.ink3, fontSize: 12, fontWeight: '600' },
  metaValueBlue: { color: COLORS.blue, fontSize: 15, fontWeight: '500' },
  metaDivider: { height: 0.5, backgroundColor: COLORS.border },
  nameInput: {
    color: COLORS.ink, fontSize: 15, fontWeight: '500',
  },
  notesInput: {
    color: COLORS.ink, fontSize: 14, lineHeight: 20,
    minHeight: 56, marginTop: 2,
  },

  // Date/time picker sheet
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

  // Duration modal
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
