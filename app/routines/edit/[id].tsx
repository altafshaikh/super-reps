import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, StyleSheet, KeyboardAvoidingView,
  Platform, Modal, Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { supabase } from '@/lib/supabase';
import { COLORS, REST_TIMES } from '@/constants';
import { ExerciseLibraryModal } from '@/components/workouts/ExerciseLibraryModal';
import type { Exercise } from '@/types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface SetRow { weight_kg: string; reps: string }

interface EditableExercise {
  id: string;
  exercise_id: string;
  name: string;
  rows: SetRow[];
  notes: string;
  rest_seconds: number;
  superset_group: string | null;
  order_index: number;
  removed: boolean;
}

function fmtRest(s: number) {
  const m = Math.floor(s / 60);
  return `${m}min ${s % 60}s`;
}

function nextRest(current: number) {
  const idx = REST_TIMES.indexOf(current);
  return REST_TIMES[(idx + 1) % REST_TIMES.length];
}

// ── Bottom-sheet action menu ────────────────────────────────────────────────
function ExerciseMenu({
  visible, name, inSuperset,
  onClose, onReorder, onReplace, onSuperset, onRemove,
}: {
  visible: boolean; name: string; inSuperset: boolean;
  onClose: () => void; onReorder: () => void; onReplace: () => void;
  onSuperset: () => void; onRemove: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={menu.backdrop} onPress={onClose} />
      <View style={menu.sheet}>
        <View style={menu.handle} />
        <TouchableOpacity style={menu.row} onPress={() => { onClose(); onReorder(); }}>
          <Ionicons name="swap-vertical-outline" size={22} color={COLORS.ink} />
          <Text style={menu.rowTxt}>Reorder Exercises</Text>
        </TouchableOpacity>
        <View style={menu.sep} />
        <TouchableOpacity style={menu.row} onPress={() => { onClose(); onReplace(); }}>
          <Ionicons name="refresh-outline" size={22} color={COLORS.ink} />
          <Text style={menu.rowTxt}>Replace Exercise</Text>
        </TouchableOpacity>
        <View style={menu.sep} />
        <TouchableOpacity style={menu.row} onPress={() => { onClose(); onSuperset(); }}>
          <Ionicons name="add-outline" size={22} color={COLORS.ink} />
          <Text style={menu.rowTxt}>
            {inSuperset ? 'Remove From Superset' : 'Add To Superset'}
          </Text>
        </TouchableOpacity>
        <View style={menu.sep} />
        <TouchableOpacity style={menu.row} onPress={() => { onClose(); onRemove(); }}>
          <Ionicons name="close-outline" size={22} color={COLORS.red} />
          <Text style={[menu.rowTxt, { color: COLORS.red }]}>Remove Exercise</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ── Swipeable set row ───────────────────────────────────────────────────────
function SetRowItem({
  row, index, onChange, onDelete,
}: {
  row: SetRow; index: number;
  onChange: (patch: Partial<SetRow>) => void;
  onDelete: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);

  const renderRight = () => (
    <TouchableOpacity
      style={sr.deleteAction}
      onPress={() => { swipeRef.current?.close(); onDelete(); }}
    >
      <Text style={sr.deleteActionTxt}>Delete</Text>
    </TouchableOpacity>
  );

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRight} overshootRight={false}>
      <View style={[sr.row, index % 2 === 1 && sr.rowAlt]}>
        <Text style={sr.setNum}>{index + 1}</Text>
        <TextInput
          style={sr.cell}
          value={row.weight_kg}
          onChangeText={v => onChange({ weight_kg: v })}
          placeholder="–"
          placeholderTextColor={COLORS.ink3}
          keyboardType="decimal-pad"
          returnKeyType="next"
          textAlign="center"
        />
        <TextInput
          style={sr.cell}
          value={row.reps}
          onChangeText={v => onChange({ reps: v })}
          placeholder="–"
          placeholderTextColor={COLORS.ink3}
          keyboardType="number-pad"
          returnKeyType="done"
          textAlign="center"
        />
      </View>
    </Swipeable>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────
export default function EditRoutineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();

  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [name, setName]                   = useState('');
  const [scheduledDays, setScheduledDays] = useState<number[]>([]);
  const [exercises, setExercises]         = useState<EditableExercise[]>([]);
  const [menuFor, setMenuFor]             = useState<string | null>(null);
  const [showPicker, setShowPicker]       = useState(false);
  const [replaceFor, setReplaceFor]       = useState<string | null>(null); // exercise id to replace
  const [dayId, setDayId]                 = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('routines')
        .select(`*, days:routine_days(*, exercises:routine_exercises(*, exercise:exercises(*)))`)
        .eq('id', id)
        .single();

      if (data) {
        setName(data.name ?? '');
        setScheduledDays(Array.isArray(data.scheduled_days) ? data.scheduled_days : []);
        const all: EditableExercise[] = [];
        for (const day of data.days ?? []) {
          for (const re of day.exercises ?? []) {
            // Load per-set rows from sets_config.rows, else build from sets count
            const savedRows: SetRow[] = re.sets_config?.rows
              ? re.sets_config.rows.map((r: any) => ({
                  weight_kg: r.weight_kg ? String(r.weight_kg) : '',
                  reps:      r.reps      ? String(r.reps)      : '',
                }))
              : Array.from({ length: re.sets_config?.sets ?? re.sets ?? 1 }, () => ({ weight_kg: '', reps: '' }));

            all.push({
              id:             re.id,
              exercise_id:    re.exercise_id,
              name:           re.exercise?.name ?? 'Unknown',
              rows:           savedRows,
              notes:          re.notes ?? '',
              rest_seconds:   re.rest_seconds ?? 60,
              superset_group: re.sets_config?.superset_group ?? null,
              order_index:    re.order_index ?? 0,
              removed:        false,
            });
          }
        }
        setExercises(all.sort((a, b) => a.order_index - b.order_index));
        // Store the first day's id for adding new exercises
        if (data.days?.length > 0) setDayId(data.days[0].id);
      }
      setLoading(false);
    })();
  }, [id]);

  const updateEx = (exId: string, patch: Partial<EditableExercise>) =>
    setExercises(prev => prev.map(ex => ex.id === exId ? { ...ex, ...patch } : ex));

  const updateRow = (exId: string, rowIdx: number, patch: Partial<SetRow>) =>
    setExercises(prev => prev.map(ex => {
      if (ex.id !== exId) return ex;
      const rows = ex.rows.map((r, i) => i === rowIdx ? { ...r, ...patch } : r);
      return { ...ex, rows };
    }));

  const addSet = (exId: string) =>
    setExercises(prev => prev.map(ex =>
      ex.id === exId ? { ...ex, rows: [...ex.rows, { weight_kg: '', reps: '' }] } : ex
    ));

  const deleteSet = (exId: string, rowIdx: number) =>
    setExercises(prev => prev.map(ex => {
      if (ex.id !== exId || ex.rows.length <= 1) return ex;
      return { ...ex, rows: ex.rows.filter((_, i) => i !== rowIdx) };
    }));

  const handleAddExercise = async (exercise: Exercise) => {
    setShowPicker(false);
    if (!dayId) return;

    const nextOrder = exercises.filter(ex => !ex.removed).length;
    const { data, error } = await supabase
      .from('routine_exercises')
      .insert({
        routine_day_id: dayId,
        exercise_id:    exercise.id,
        order_index:    nextOrder,
        rest_seconds:   90,
        sets_config:    { rows: [{ weight_kg: 0, reps: 0 }] },
      })
      .select()
      .single();

    if (data) {
      setExercises(prev => [...prev, {
        id:             data.id,
        exercise_id:    exercise.id,
        name:           exercise.name,
        rows:           [{ weight_kg: '', reps: '' }],
        notes:          '',
        rest_seconds:   90,
        superset_group: null,
        order_index:    nextOrder,
        removed:        false,
      }]);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Name required'); return; }
    setSaving(true);

    const active  = exercises.filter(ex => !ex.removed);
    const removed = exercises.filter(ex => ex.removed);

    await Promise.all([
      supabase.from('routines').update({ name: name.trim(), scheduled_days: scheduledDays }).eq('id', id),
      ...active.map(ex => supabase.from('routine_exercises').update({
        notes:        ex.notes.trim() || null,
        rest_seconds: ex.rest_seconds,
        sets_config: {
          sets:           ex.rows.length,
          superset_group: ex.superset_group,
          rows: ex.rows.map(r => ({
            weight_kg: parseFloat(r.weight_kg) || 0,
            reps:      parseInt(r.reps, 10)    || 0,
          })),
        },
      }).eq('id', ex.id)),
      ...removed.map(ex => supabase.from('routine_exercises').delete().eq('id', ex.id)),
    ]);

    setSaving(false);
    router.back();
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={COLORS.primary} /></View>;

  const activeExercises = exercises.filter(ex => !ex.removed);
  const menuExercise    = exercises.find(ex => ex.id === menuFor) ?? null;

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/routines')}>
          <Text style={s.cancelTxt}>Cancel</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Edit Routine</Text>
        <TouchableOpacity
          style={[s.updateBtn, saving && { opacity: 0.5 }]}
          onPress={handleSave} disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={s.updateBtnTxt}>Update</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Routine name ── */}
        <TextInput
          style={s.routineName}
          value={name}
          onChangeText={setName}
          placeholder="Routine name"
          placeholderTextColor={COLORS.ink3}
          returnKeyType="done"
        />

        {/* ── Weekday scheduler ── */}
        <View style={s.weekdaySection}>
          <Text style={s.weekdayLabel}>Schedule</Text>
          <View style={s.weekdayRow}>
            {WEEKDAYS.map((day, idx) => {
              const active = scheduledDays.includes(idx);
              return (
                <TouchableOpacity
                  key={idx}
                  style={[s.dayBtn, active && s.dayBtnActive]}
                  onPress={() =>
                    setScheduledDays(prev =>
                      active ? prev.filter(d => d !== idx) : [...prev, idx].sort()
                    )
                  }
                >
                  <Text style={[s.dayBtnTxt, active && s.dayBtnTxtActive]}>{day}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Exercise cards ── */}
        {activeExercises.map(ex => (
          <View key={ex.id} style={s.exCard}>

            {/* Exercise header row */}
            <View style={s.exHeaderRow}>
              <View style={s.exThumb}>
                <Ionicons name="barbell-outline" size={18} color={COLORS.primary} />
              </View>
              <Text style={s.exName} numberOfLines={2}>{ex.name}</Text>
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => setMenuFor(ex.id)}
              >
                <Ionicons name="ellipsis-vertical" size={20} color={COLORS.ink2} />
              </TouchableOpacity>
            </View>

            {/* Superset badge */}
            {ex.superset_group && (
              <View style={s.supersetBadge}>
                <Text style={s.supersetBadgeTxt}>Superset</Text>
              </View>
            )}

            {/* Notes */}
            <TextInput
              style={s.notesInput}
              value={ex.notes}
              onChangeText={v => updateEx(ex.id, { notes: v })}
              placeholder="Add routine notes here"
              placeholderTextColor={COLORS.ink3}
              multiline
            />

            {/* Rest timer — tap to cycle */}
            <TouchableOpacity
              style={s.restRow}
              onPress={() => updateEx(ex.id, { rest_seconds: nextRest(ex.rest_seconds) })}
            >
              <Ionicons name="time-outline" size={15} color={COLORS.primary} />
              <Text style={s.restTxt}>Rest Timer: {fmtRest(ex.rest_seconds)}</Text>
            </TouchableOpacity>

            {/* SET / KG / REPS header */}
            <View style={s.tableHeader}>
              <Text style={s.thSet}>SET</Text>
              <Text style={s.thCell}>KG</Text>
              <View style={s.thRepsRow}>
                <Text style={s.thCell}>REPS</Text>
                <Ionicons name="caret-down" size={10} color={COLORS.ink3} />
              </View>
            </View>

            {/* Set rows (swipe left to delete) */}
            {ex.rows.map((row, i) => (
              <SetRowItem
                key={i}
                row={row}
                index={i}
                onChange={patch => updateRow(ex.id, i, patch)}
                onDelete={() => deleteSet(ex.id, i)}
              />
            ))}

            {/* + Add Set */}
            <TouchableOpacity style={s.addSetBtn} onPress={() => addSet(ex.id)}>
              <Ionicons name="add" size={16} color={COLORS.ink2} />
              <Text style={s.addSetTxt}>Add Set</Text>
            </TouchableOpacity>

          </View>
        ))}

        {/* + Add exercise */}
        <TouchableOpacity
          style={s.addExBtn}
          onPress={() => setShowPicker(true)}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={s.addExTxt}>Add exercise</Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ── Exercise library picker (add) ── */}
      <ExerciseLibraryModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onAddExercise={handleAddExercise}
      />

      {/* ── Exercise library picker (replace) ── */}
      <ExerciseLibraryModal
        visible={!!replaceFor}
        onClose={() => setReplaceFor(null)}
        onAddExercise={async (exercise) => {
          if (!replaceFor) return;
          await supabase.from('routine_exercises')
            .update({ exercise_id: exercise.id })
            .eq('id', replaceFor);
          setExercises(prev => prev.map(ex =>
            ex.id === replaceFor ? { ...ex, exercise_id: exercise.id, name: exercise.name } : ex
          ));
          setReplaceFor(null);
        }}
      />

      {/* ── Exercise action bottom sheet ── */}
      {menuExercise && (
        <ExerciseMenu
          visible={!!menuFor}
          name={menuExercise.name}
          inSuperset={!!menuExercise.superset_group}
          onClose={() => setMenuFor(null)}
          onReorder={() => Alert.alert('Reorder', 'Drag-to-reorder coming soon.')}
          onReplace={() => setReplaceFor(menuExercise.id)}
          onSuperset={() =>
            updateEx(menuExercise.id, {
              superset_group: menuExercise.superset_group ? null : 'A',
            })
          }
          onRemove={() =>
            Alert.alert('Remove Exercise', `Remove "${menuExercise.name}"?`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', style: 'destructive',
                onPress: () => updateEx(menuExercise.id, { removed: true }) },
            ])
          }
        />
      )}
    </KeyboardAvoidingView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14,
  },
  cancelTxt:   { color: COLORS.primary, fontSize: 16, fontWeight: '500' },
  headerTitle: { color: COLORS.ink, fontSize: 17, fontWeight: '600' },
  updateBtn:   { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8 },
  updateBtnTxt:{ color: '#fff', fontWeight: '700', fontSize: 15 },

  scroll: { paddingBottom: 40 },

  routineName: {
    fontSize: 22, fontWeight: '800', color: COLORS.ink,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.surface2,
    marginBottom: 8,
  },

  // Exercise card — no card background, like Hevy's flat layout
  exCard:      { paddingHorizontal: 16, marginBottom: 24 },
  exHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  exThumb:     {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.surface2, alignItems: 'center', justifyContent: 'center',
  },
  exName: { flex: 1, fontSize: 17, fontWeight: '700', color: COLORS.primary },

  supersetBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#7C3AED', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 4, marginBottom: 8,
  },
  supersetBadgeTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },

  notesInput: {
    fontSize: 14, color: COLORS.ink2, marginBottom: 10,
    paddingVertical: 0,
  },

  restRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  restTxt: { fontSize: 14, color: COLORS.primary, fontWeight: '500' },

  // Table header
  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.surface2,
  },
  thSet:    { width: 44, textAlign: 'center', fontSize: 11, fontWeight: '700', color: COLORS.ink3, letterSpacing: 1 },
  thCell:   { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: COLORS.ink3, letterSpacing: 1 },
  thRepsRow:{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },

  addSetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.surface, borderRadius: 10, paddingVertical: 13, marginTop: 2,
  },
  addSetTxt: { color: COLORS.ink2, fontSize: 14, fontWeight: '600' },

  // Weekday scheduler
  weekdaySection: {
    paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.surface2,
    marginBottom: 8,
  },
  weekdayLabel: { fontSize: 12, fontWeight: '700', color: COLORS.ink3, letterSpacing: 0.8, marginBottom: 10 },
  weekdayRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  dayBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.surface2,
  },
  dayBtnActive:    { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayBtnTxt:       { fontSize: 11, fontWeight: '700', color: COLORS.ink3 },
  dayBtnTxtActive: { color: '#fff' },

  addExBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 16,
    marginHorizontal: 16, marginTop: 8,
  },
  addExTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

// Set row styles
const sr = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, backgroundColor: '#000',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.surface2,
  },
  rowAlt: { backgroundColor: COLORS.surface },
  setNum: { width: 44, textAlign: 'center', fontSize: 16, fontWeight: '700', color: COLORS.ink },
  cell:   { flex: 1, fontSize: 16, fontWeight: '700', color: COLORS.ink, paddingVertical: 0 },
  deleteAction: {
    backgroundColor: COLORS.red, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 24,
  },
  deleteActionTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

// Menu styles
const menu = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 40, paddingTop: 12,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: COLORS.surface2, alignSelf: 'center', marginBottom: 16,
  },
  row:    { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 18, paddingHorizontal: 24 },
  rowTxt: { fontSize: 16, color: COLORS.ink, fontWeight: '500' },
  sep:    { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.surface2, marginLeft: 60 },
});
