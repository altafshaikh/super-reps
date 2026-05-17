import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { Exercise } from '@/types';
import { COLORS } from '@/constants';

const MG_LABEL: Record<string, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  core: 'Core',
  full_body: 'Full Body',
};

function formatMuscle(m: string): string {
  return MG_LABEL[m] ?? m.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatEquipment(e: string): string {
  return e.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function primaryMuscle(ex: Exercise): string {
  const mg = ex.muscle_groups?.[0];
  return mg ? formatMuscle(mg) : ex.category ?? 'General';
}

type FilterPickerProps = {
  visible: boolean;
  title: string;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  onClose: () => void;
};

function FilterPicker({ visible, title, options, selected, onSelect, onClose }: FilterPickerProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={fp.overlay} activeOpacity={1} onPress={onClose}>
        <View style={fp.sheet}>
          <Text style={fp.title}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => item}
            renderItem={({ item }) => {
              const active = item === selected;
              return (
                <TouchableOpacity
                  style={fp.row}
                  onPress={() => { onSelect(item); onClose(); }}
                  activeOpacity={0.7}
                >
                  <Text style={[fp.label, active && fp.labelActive]}>{item}</Text>
                  {active && <Ionicons name="checkmark" size={18} color={COLORS.primary} />}
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={fp.sep} />}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const fp = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 20, paddingBottom: 40,
    maxHeight: '70%',
  },
  title: {
    color: COLORS.ink3, fontSize: 12, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase',
    paddingHorizontal: 20, marginBottom: 12,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  label: { color: COLORS.ink2, fontSize: 16 },
  labelActive: { color: COLORS.ink, fontWeight: '700' },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border },
});

type Props = {
  visible: boolean;
  onClose: () => void;
  onAddExercise: (exercise: Exercise) => void;
  onCreateExercise?: () => void;
};

export function ExerciseLibraryModal({ visible, onClose, onAddExercise, onCreateExercise }: Props) {
  const router = useRouter();
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [equipmentFilter, setEquipmentFilter] = useState('All Equipment');
  const [muscleFilter, setMuscleFilter] = useState('All Muscles');
  const [loading, setLoading] = useState(false);
  const [showEquipmentPicker, setShowEquipmentPicker] = useState(false);
  const [showMusclePicker, setShowMusclePicker] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('exercises').select('*').order('name').limit(800);
    setAllExercises((data ?? []) as Exercise[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (visible) {
      void load();
      setSearch('');
      setEquipmentFilter('All Equipment');
      setMuscleFilter('All Muscles');
    }
  }, [visible, load]);

  const equipmentOptions = useMemo(() => {
    const opts = new Set<string>();
    for (const e of allExercises) {
      for (const eq of (e.equipment ?? [])) {
        if (eq.trim()) opts.add(formatEquipment(eq.trim()));
      }
    }
    return ['All Equipment', ...[...opts].sort()];
  }, [allExercises]);

  const muscleOptions = useMemo(() => {
    const opts = new Set<string>();
    for (const e of allExercises) {
      for (const mg of (e.muscle_groups ?? [])) {
        if (mg) opts.add(formatMuscle(mg));
      }
    }
    return ['All Muscles', ...[...opts].sort()];
  }, [allExercises]);

  const filtered = useMemo(() => {
    let list = allExercises;
    if (equipmentFilter !== 'All Equipment') {
      list = list.filter((e) =>
        (e.equipment ?? []).some((eq) => formatEquipment(eq) === equipmentFilter)
      );
    }
    if (muscleFilter !== 'All Muscles') {
      list = list.filter((e) =>
        (e.muscle_groups ?? []).some((mg) => formatMuscle(mg) === muscleFilter)
      );
    }
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((e) => e.name.toLowerCase().includes(q));
    return list;
  }, [allExercises, equipmentFilter, muscleFilter, search]);

  const hasActiveFilter = equipmentFilter !== 'All Equipment' || muscleFilter !== 'All Muscles';
  const sectionLabel = search.trim() || hasActiveFilter ? 'Results' : 'All Exercises';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.sheet}>
        {/* Header */}
        <View style={s.head}>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={s.headSide}>
            <Text style={s.headAction}>Cancel</Text>
          </TouchableOpacity>
          <Text style={s.title}>Add Exercise</Text>
          <TouchableOpacity
            onPress={() => {
              onClose();
              if (onCreateExercise) {
                onCreateExercise();
              } else {
                router.push('/exercise/create');
              }
            }}
            hitSlop={12}
            style={[s.headSide, s.headRight]}
          >
            <Text style={s.headAction}>Create</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={s.searchWrap}>
          <Ionicons name="search" size={17} color={COLORS.ink3} style={s.searchIcon} />
          <TextInput
            style={s.search}
            placeholder="Search exercise"
            placeholderTextColor={COLORS.ink3}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color={COLORS.ink3} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter buttons */}
        <View style={s.filterRow}>
          <TouchableOpacity
            style={[s.filterBtn, equipmentFilter !== 'All Equipment' && s.filterBtnActive]}
            onPress={() => setShowEquipmentPicker(true)}
            activeOpacity={0.8}
          >
            <Text style={[s.filterTxt, equipmentFilter !== 'All Equipment' && s.filterTxtActive]} numberOfLines={1}>
              {equipmentFilter}
            </Text>
            <Ionicons
              name="chevron-down"
              size={14}
              color={equipmentFilter !== 'All Equipment' ? COLORS.ink : COLORS.ink2}
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.filterBtn, muscleFilter !== 'All Muscles' && s.filterBtnActive]}
            onPress={() => setShowMusclePicker(true)}
            activeOpacity={0.8}
          >
            <Text style={[s.filterTxt, muscleFilter !== 'All Muscles' && s.filterTxtActive]} numberOfLines={1}>
              {muscleFilter}
            </Text>
            <Ionicons
              name="chevron-down"
              size={14}
              color={muscleFilter !== 'All Muscles' ? COLORS.ink : COLORS.ink2}
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>
        </View>

        {/* Section label */}
        {!loading && (
          <Text style={s.sectionLabel}>{sectionLabel}</Text>
        )}

        {/* List */}
        {loading ? (
          <View style={s.center}>
            <Text style={s.muted}>Loading exercises…</Text>
          </View>
        ) : (
          <FlatList
            style={{ flex: 1 }}
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={s.sep} />}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.row}
                onPress={() => onAddExercise(item)}
                activeOpacity={0.7}
              >
                {/* Thumbnail */}
                <View style={s.thumb}>
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={s.thumbImg} resizeMode="contain" />
                  ) : (
                    <Ionicons name="barbell-outline" size={28} color={COLORS.ink4} />
                  )}
                </View>

                {/* Name + muscle */}
                <View style={s.info}>
                  <Text style={s.exName} numberOfLines={1}>{item.name}</Text>
                  <Text style={s.exMuscle} numberOfLines={1}>{primaryMuscle(item)}</Text>
                </View>

                {/* Chart icon */}
                <TouchableOpacity
                  style={s.chartBtn}
                  hitSlop={8}
                  onPress={() => {
                    onClose();
                    router.push(`/exercise/${item.id}`);
                  }}
                >
                  <Ionicons name="trending-up" size={16} color={COLORS.ink3} />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={[s.muted, { textAlign: 'center', marginTop: 40 }]}>
                No exercises match.
              </Text>
            }
          />
        )}
      </View>

      {/* Filter pickers */}
      <FilterPicker
        visible={showEquipmentPicker}
        title="Equipment"
        options={equipmentOptions}
        selected={equipmentFilter}
        onSelect={setEquipmentFilter}
        onClose={() => setShowEquipmentPicker(false)}
      />
      <FilterPicker
        visible={showMusclePicker}
        title="Muscle Group"
        options={muscleOptions}
        selected={muscleFilter}
        onSelect={setMuscleFilter}
        onClose={() => setShowMusclePicker(false)}
      />
    </Modal>
  );
}

const s = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: Platform.OS === 'ios' ? 12 : 16,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headSide: { minWidth: 60 },
  headRight: { alignItems: 'flex-end' },
  headAction: { color: COLORS.primary, fontSize: 16, fontWeight: '500' },
  title: { color: COLORS.ink, fontSize: 17, fontWeight: '700' },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  search: {
    flex: 1,
    color: COLORS.ink,
    fontSize: 15,
    paddingVertical: Platform.OS === 'ios' ? 11 : 9,
  },

  filterRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  filterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface2,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterBtnActive: {
    backgroundColor: COLORS.surface3,
    borderColor: COLORS.primary,
  },
  filterTxt: { color: COLORS.ink2, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  filterTxtActive: { color: COLORS.ink },

  sectionLabel: {
    color: COLORS.ink3,
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 16,
    marginBottom: 6,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginLeft: 76 },

  thumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: COLORS.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  thumbImg: { width: 52, height: 52 },

  info: { flex: 1, paddingRight: 8 },
  exName: { color: COLORS.ink, fontSize: 15, fontWeight: '700' },
  exMuscle: { color: COLORS.ink3, fontSize: 13, marginTop: 3 },

  chartBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: COLORS.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },

  muted: { color: COLORS.ink3, fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
