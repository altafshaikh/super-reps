import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Alert, FlatList, Modal, ActivityIndicator, Platform, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import { formatWeight } from '@/lib/utils';
import { generateId } from '@/lib/utils';
import { COLORS } from '@/constants';
import type { Exercise } from '@/types';

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
  const [exercises, setExercises] = useState<EditExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user || !sessionId) return;
    void loadSession();
  }, [user, sessionId]);

  const loadSession = async () => {
    setLoading(true);
    const { data: session } = await supabase
      .from('workout_sessions')
      .select('routine_name')
      .eq('id', sessionId)
      .single();
    if (session) setRoutineName(session.routine_name ?? 'Workout');

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

  const fetchExercises = useCallback(async (q: string) => {
    const query = supabase.from('exercises').select('*').limit(40);
    if (q) query.ilike('name', `%${q}%`);
    const { data } = await query;
    setAllExercises((data ?? []) as Exercise[]);
  }, []);

  useEffect(() => {
    if (showPicker) fetchExercises('');
  }, [showPicker]);

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
    setSearch('');
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

    // Recalculate volume_total
    const volume = toUpsert.reduce((sum, s) => sum + s.weight_kg * s.reps, 0);
    await supabase.from('workout_sessions')
      .update({ volume_total: volume })
      .eq('id', sessionId);

    setSaving(false);
    router.back();
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

      <Modal visible={showPicker} animationType="slide" presentationStyle="pageSheet">
        <View style={s.pickerRoot}>
          <View style={s.pickerHeader}>
            <Text style={s.pickerTitle}>Add Exercise</Text>
            <TouchableOpacity onPress={() => setShowPicker(false)}>
              <Ionicons name="close" size={24} color={COLORS.ink3} />
            </TouchableOpacity>
          </View>
          <View style={s.pickerSearch}>
            <TextInput
              style={s.pickerInput}
              placeholder="Search exercises…"
              placeholderTextColor={COLORS.ink3}
              value={search}
              onChangeText={q => { setSearch(q); fetchExercises(q); }}
            />
          </View>
          <FlatList
            data={allExercises}
            keyExtractor={e => e.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={s.pickerRow} onPress={() => addExercise(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.pickerExName}>{item.name}</Text>
                  <Text style={s.pickerExMeta}>{item.category} · {item.muscle_groups?.join(', ')}</Text>
                </View>
                <Ionicons name="add-circle-outline" size={22} color={COLORS.blue} />
              </TouchableOpacity>
            )}
          />
        </View>
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
});
