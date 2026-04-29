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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  full_body: 'Full body',
};

function formatMuscle(m: string): string {
  return MG_LABEL[m] ?? m.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function exerciseSubtitle(ex: Exercise): string {
  const mg =
    (ex.muscle_groups ?? []).map(formatMuscle).slice(0, 2).join(' · ') || ex.category || 'General';
  const eq =
    (ex.equipment ?? []).map((e) => e.replace(/_/g, ' ')).slice(0, 2).join(', ') || 'Bodyweight';
  return `${mg} · ${eq}`;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onAddExercise: (exercise: Exercise) => void;
};

export function ExerciseLibraryModal({ visible, onClose, onAddExercise }: Props) {
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(false);

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
      setFilter('All');
    }
  }, [visible, load]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const e of allExercises) {
      if (e.category?.trim()) cats.add(e.category.trim());
    }
    return ['All', ...[...cats].sort((a, b) => a.localeCompare(b))];
  }, [allExercises]);

  const filtered = useMemo(() => {
    let list = allExercises;
    if (filter !== 'All') list = list.filter((e) => (e.category ?? '').trim() === filter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((e) => e.name.toLowerCase().includes(q));
    return list;
  }, [allExercises, filter, search]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.sheet}>
        <View style={s.handle} />
        <View style={s.head}>
          <Text style={s.title}>Exercise Library</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={s.closeBtn}>
            <Ionicons name="close" size={26} color={COLORS.ink2} />
          </TouchableOpacity>
        </View>

        <View style={s.searchWrap}>
          <Ionicons name="search" size={18} color={COLORS.ink3} style={s.searchIcon} />
          <TextInput
            style={s.search}
            placeholder={`Search ${allExercises.length || '…'} exercises`}
            placeholderTextColor={COLORS.ink3}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipsRow}
          keyboardShouldPersistTaps="handled"
        >
          {categories.map((c) => {
            const on = filter === c;
            return (
              <TouchableOpacity
                key={c}
                onPress={() => setFilter(c)}
                style={[s.chip, on ? s.chipOn : s.chipOff]}
                activeOpacity={0.85}
              >
                <Text style={[s.chipTxt, on && s.chipTxtOn]}>{c}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

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
              <View style={s.row}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={s.exName}>{item.name}</Text>
                  <Text style={s.exSub} numberOfLines={2}>
                    {exerciseSubtitle(item)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={s.addBtn}
                  onPress={() => onAddExercise(item)}
                  activeOpacity={0.8}
                >
                  <Text style={s.addBtnTxt}>+ Add</Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              <Text style={[s.muted, { textAlign: 'center', marginTop: 32 }]}>No exercises match.</Text>
            }
          />
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.surface3,
    marginBottom: 8,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.ink },
  closeBtn: { padding: 4 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  search: {
    flex: 1,
    color: COLORS.ink,
    fontSize: 15,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  },
  chipsRow: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipOn: { backgroundColor: COLORS.ink },
  chipOff: { backgroundColor: COLORS.surface2 },
  chipTxt: { fontSize: 13, fontWeight: '700', color: COLORS.ink2 },
  chipTxtOn: { color: COLORS.bg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginLeft: 20 },
  exName: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  exSub: { fontSize: 12, color: COLORS.ink3, marginTop: 4, lineHeight: 17 },
  addBtn: {
    backgroundColor: COLORS.surface2,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  addBtnTxt: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  muted: { color: COLORS.ink3, fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
