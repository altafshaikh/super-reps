import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Platform, Alert, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import { COLORS } from '@/constants';
import type { MuscleGroup } from '@/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const EQUIPMENT_OPTIONS = [
  'Barbell', 'Dumbbells', 'Cables', 'Machine', 'Bodyweight',
  'Kettlebell', 'Bands', 'Smith Machine', 'EZ Bar', 'Trap Bar',
  'Pull-Up Bar', 'Dip Bars', 'TRX / Suspension', 'Plate', 'Other',
];

const MUSCLE_OPTIONS: { label: string; value: MuscleGroup }[] = [
  { label: 'Chest', value: 'chest' },
  { label: 'Back', value: 'back' },
  { label: 'Shoulders', value: 'shoulders' },
  { label: 'Biceps', value: 'biceps' },
  { label: 'Triceps', value: 'triceps' },
  { label: 'Forearms', value: 'forearms' },
  { label: 'Quads', value: 'quads' },
  { label: 'Hamstrings', value: 'hamstrings' },
  { label: 'Glutes', value: 'glutes' },
  { label: 'Calves', value: 'calves' },
  { label: 'Core', value: 'core' },
  { label: 'Full Body', value: 'full_body' },
];

const EXERCISE_TYPE_OPTIONS = [
  { label: 'Weight & Reps', value: 'weight_reps', desc: 'Barbell / dumbbell lifts' },
  { label: 'Bodyweight Reps', value: 'bodyweight_reps', desc: 'Pull-ups, push-ups' },
  { label: 'Weighted Bodyweight', value: 'bodyweight_weighted', desc: 'Weighted pull-up / dip' },
  { label: 'Duration', value: 'duration', desc: 'Plank, wall sit, warm-up' },
  { label: 'Distance & Duration', value: 'distance_duration', desc: 'Cycling, running, walking' },
  { label: 'Weight & Duration', value: 'weight_duration', desc: 'Farmer carry, sled push' },
];

const CATEGORY_FROM_MUSCLE: Record<MuscleGroup, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders',
  biceps: 'Arms', triceps: 'Arms', forearms: 'Arms',
  quads: 'Legs', hamstrings: 'Legs', glutes: 'Legs', calves: 'Legs',
  core: 'Core', full_body: 'Full Body',
};

// ─── Picker Components ───────────────────────────────────────────────────────

type SinglePickerProps = {
  visible: boolean;
  title: string;
  options: { label: string; value: string; desc?: string }[];
  selected: string;
  onSelect: (v: string) => void;
  onClose: () => void;
};

function SinglePicker({ visible, title, options, selected, onSelect, onClose }: SinglePickerProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={pk.overlay}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        <View style={pk.sheet}>
          <View style={pk.handle} />
          <Text style={pk.title}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            contentContainerStyle={{ paddingBottom: 40 }}
            renderItem={({ item }) => {
              const active = item.value === selected;
              return (
                <TouchableOpacity
                  style={pk.row}
                  onPress={() => { onSelect(item.value); onClose(); }}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[pk.label, active && pk.labelActive]}>{item.label}</Text>
                    {item.desc ? <Text style={pk.desc}>{item.desc}</Text> : null}
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={pk.sep} />}
          />
        </View>
      </View>
    </Modal>
  );
}

type MultiPickerProps = {
  visible: boolean;
  title: string;
  options: { label: string; value: string }[];
  selected: string[];
  onToggle: (v: string) => void;
  onClose: () => void;
};

function MultiPicker({ visible, title, options, selected, onToggle, onClose }: MultiPickerProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={pk.overlay}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        <View style={pk.sheet}>
          <View style={pk.handle} />
          <View style={pk.sheetHead}>
            <Text style={pk.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Text style={pk.doneBtn}>Done</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            contentContainerStyle={{ paddingBottom: 40 }}
            renderItem={({ item }) => {
              const active = selected.includes(item.value);
              return (
                <TouchableOpacity
                  style={pk.row}
                  onPress={() => onToggle(item.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[pk.label, active && pk.labelActive]}>{item.label}</Text>
                  <View style={[pk.check, active && pk.checkActive]}>
                    {active && <Ionicons name="checkmark" size={13} color={COLORS.bg} />}
                  </View>
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={pk.sep} />}
          />
        </View>
      </View>
    </Modal>
  );
}

const pk = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, maxHeight: '75%',
  },
  handle: {
    alignSelf: 'center', width: 36, height: 4,
    borderRadius: 2, backgroundColor: COLORS.surface3, marginBottom: 12,
  },
  sheetHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 4,
  },
  title: { color: COLORS.ink3, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 20, paddingBottom: 8 },
  doneBtn: { color: COLORS.primary, fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  label: { color: COLORS.ink2, fontSize: 16 },
  labelActive: { color: COLORS.ink, fontWeight: '600' },
  desc: { color: COLORS.ink3, fontSize: 12, marginTop: 2 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border },
  check: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: COLORS.surface3,
    alignItems: 'center', justifyContent: 'center',
  },
  checkActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
});

// ─── Field Row ───────────────────────────────────────────────────────────────

function FieldRow({
  label, value, placeholder = 'Select', onPress, optional = false,
}: {
  label: string; value?: string; placeholder?: string;
  onPress: () => void; optional?: boolean;
}) {
  return (
    <TouchableOpacity style={s.fieldRow} onPress={onPress} activeOpacity={0.7}>
      <View style={{ flex: 1 }}>
        <Text style={s.fieldLabel}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={[s.fieldValue, !value && s.fieldPlaceholder]}>
            {value || placeholder}
          </Text>
          {optional && !value && (
            <Text style={s.fieldOptional}>(optional)</Text>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.ink3} />
    </TouchableOpacity>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function CreateExerciseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUserStore();

  const [name, setName] = useState('');
  const [equipment, setEquipment] = useState<string[]>([]);
  const [primaryMuscle, setPrimaryMuscle] = useState<MuscleGroup | ''>('');
  const [otherMuscles, setOtherMuscles] = useState<MuscleGroup[]>([]);
  const [exerciseType, setExerciseType] = useState('');
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);

  const [showEquipment, setShowEquipment] = useState(false);
  const [showPrimary, setShowPrimary] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const [showType, setShowType] = useState(false);

  function toggleEquipment(v: string) {
    setEquipment(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  }

  function toggleOther(v: string) {
    const mg = v as MuscleGroup;
    setOtherMuscles(prev => prev.includes(mg) ? prev.filter(x => x !== mg) : [...prev, mg]);
  }

  function muscleLabel(v: MuscleGroup | '') {
    return MUSCLE_OPTIONS.find(m => m.value === v)?.label ?? '';
  }

  function typeLabel(v: string) {
    return EXERCISE_TYPE_OPTIONS.find(t => t.value === v)?.label ?? '';
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Missing name', 'Please enter an exercise name.');
      return;
    }
    if (!primaryMuscle) {
      Alert.alert('Missing muscle group', 'Please select a primary muscle group.');
      return;
    }

    setSaving(true);

    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const muscleGroups: MuscleGroup[] = primaryMuscle
      ? [primaryMuscle, ...otherMuscles.filter(m => m !== primaryMuscle)]
      : otherMuscles;
    const category = primaryMuscle ? (CATEGORY_FROM_MUSCLE[primaryMuscle] ?? 'Other') : 'Other';

    const { error } = await supabase.from('exercises').insert({
      name: name.trim(),
      slug,
      category,
      muscle_groups: muscleGroups,
      equipment: equipment.map(e => e.toLowerCase().replace(/\s+/g, '_')),
      exercise_type: exerciseType || null,
      instructions: instructions.trim() || '',
      is_custom: true,
      image_url: null,
      form_cues: null,
    });

    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    router.back();
  }

  const otherMuscleLabel = otherMuscles.length
    ? otherMuscles.map(m => muscleLabel(m)).join(', ')
    : undefined;

  const equipmentLabel = equipment.length ? equipment.join(', ') : undefined;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.ink} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Create Exercise</Text>
        <TouchableOpacity
          style={[s.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color={COLORS.bg} />
            : <Text style={s.saveBtnTxt}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {/* Image placeholder */}
        <View style={s.imageSection}>
          <TouchableOpacity
            style={s.imageCircle}
            onPress={() => Alert.alert('Coming soon', 'Image upload will be available in a future update.')}
            activeOpacity={0.8}
          >
            <Ionicons name="camera-outline" size={32} color={COLORS.ink3} />
          </TouchableOpacity>
          <Text style={s.addAsset}>Add Asset</Text>
        </View>

        {/* Name */}
        <View style={s.nameWrap}>
          <TextInput
            style={s.nameInput}
            placeholder="Exercise Name"
            placeholderTextColor={COLORS.ink3}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            returnKeyType="done"
            maxLength={80}
          />
        </View>
        <View style={s.divider} />

        {/* Fields */}
        <FieldRow
          label="Equipment"
          value={equipmentLabel}
          onPress={() => setShowEquipment(true)}
        />
        <View style={s.divider} />

        <FieldRow
          label="Primary Muscle Group"
          value={primaryMuscle ? muscleLabel(primaryMuscle) : undefined}
          onPress={() => setShowPrimary(true)}
        />
        <View style={s.divider} />

        <FieldRow
          label="Other Muscles"
          value={otherMuscleLabel}
          onPress={() => setShowOther(true)}
          optional
        />
        <View style={s.divider} />

        <FieldRow
          label="Exercise Type"
          value={exerciseType ? typeLabel(exerciseType) : undefined}
          onPress={() => setShowType(true)}
        />
        <View style={s.divider} />

        {/* Instructions — extra DB field */}
        <View style={s.instructionsWrap}>
          <Text style={s.fieldLabel}>Instructions</Text>
          <Text style={s.fieldOptional} > (optional)</Text>
          <TextInput
            style={s.instructionsInput}
            placeholder="Describe how to perform this exercise…"
            placeholderTextColor={COLORS.ink3}
            value={instructions}
            onChangeText={setInstructions}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            returnKeyType="default"
            maxLength={1000}
          />
        </View>
      </ScrollView>

      {/* Pickers */}
      <MultiPicker
        visible={showEquipment}
        title="Equipment"
        options={EQUIPMENT_OPTIONS.map(e => ({ label: e, value: e }))}
        selected={equipment}
        onToggle={toggleEquipment}
        onClose={() => setShowEquipment(false)}
      />

      <SinglePicker
        visible={showPrimary}
        title="Primary Muscle Group"
        options={MUSCLE_OPTIONS}
        selected={primaryMuscle}
        onSelect={(v) => setPrimaryMuscle(v as MuscleGroup)}
        onClose={() => setShowPrimary(false)}
      />

      <MultiPicker
        visible={showOther}
        title="Other Muscles"
        options={MUSCLE_OPTIONS.filter(m => m.value !== primaryMuscle)}
        selected={otherMuscles}
        onToggle={toggleOther}
        onClose={() => setShowOther(false)}
      />

      <SinglePicker
        visible={showType}
        title="Exercise Type"
        options={EXERCISE_TYPE_OPTIONS}
        selected={exerciseType}
        onSelect={setExerciseType}
        onClose={() => setShowType(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  headerTitle: { color: COLORS.ink, fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  saveBtn: {
    backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 9,
    borderRadius: 10, minWidth: 64, alignItems: 'center',
  },
  saveBtnTxt: { color: COLORS.bg, fontSize: 15, fontWeight: '700' },

  scroll: { paddingBottom: 60 },

  imageSection: { alignItems: 'center', paddingVertical: 28 },
  imageCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: COLORS.surface2,
    borderWidth: 1.5, borderColor: COLORS.surface3,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  addAsset: { color: COLORS.primary, fontSize: 15, fontWeight: '500' },

  nameWrap: { paddingHorizontal: 20, paddingVertical: 16 },
  nameInput: {
    color: COLORS.ink, fontSize: 18, fontWeight: '400',
    paddingVertical: 0,
  },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border },

  fieldRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  fieldLabel: { color: COLORS.ink, fontSize: 16, fontWeight: '600', marginBottom: 3 },
  fieldValue: { color: COLORS.primary, fontSize: 15 },
  fieldPlaceholder: { color: COLORS.primary },
  fieldOptional: { color: COLORS.ink3, fontSize: 14 },

  instructionsWrap: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, flexDirection: 'column' },
  instructionsInput: {
    color: COLORS.ink, fontSize: 15, lineHeight: 22,
    backgroundColor: COLORS.surface,
    borderRadius: 12, padding: 14, marginTop: 10,
    borderWidth: 1, borderColor: COLORS.border,
    minHeight: 110,
  },
});
