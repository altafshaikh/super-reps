import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
} from 'react-native';
import { COLORS } from '@/constants';
import { SRBottomSheet } from './SRBottomSheet';
import { SRPill } from './SRPill';
import { SRDivider } from './SRDivider';

interface Exercise {
  slug: string;
  name: string;
  muscle: string;
  equip: string;
  sets: string;
  reps: string;
}

const CATALOG: Exercise[] = [
  { slug:'bench-press',       name:'Bench Press',        muscle:'Chest',     equip:'Barbell',    sets:'3–5',  reps:'4–8'    },
  { slug:'incline-db-press',  name:'Incline DB Press',   muscle:'Chest',     equip:'Dumbbell',   sets:'3–4',  reps:'8–12'   },
  { slug:'cable-fly',         name:'Cable Fly',           muscle:'Chest',     equip:'Cable',      sets:'3',    reps:'12–15'  },
  { slug:'chest-dips',        name:'Chest Dips',          muscle:'Chest',     equip:'Bodyweight', sets:'3',    reps:'8–12'   },
  { slug:'db-bench',          name:'DB Flat Press',       muscle:'Chest',     equip:'Dumbbell',   sets:'3',    reps:'10–12'  },
  { slug:'pull-up',           name:'Pull-ups',            muscle:'Back',      equip:'Bodyweight', sets:'4',    reps:'5–8'    },
  { slug:'barbell-row',       name:'Barbell Row',         muscle:'Back',      equip:'Barbell',    sets:'4',    reps:'5–8'    },
  { slug:'cable-row',         name:'Seated Cable Row',    muscle:'Back',      equip:'Cable',      sets:'3',    reps:'10–12'  },
  { slug:'lat-pulldown',      name:'Lat Pulldown',        muscle:'Back',      equip:'Cable',      sets:'3–4',  reps:'8–12'   },
  { slug:'db-row',            name:'DB Row',              muscle:'Back',      equip:'Dumbbell',   sets:'3',    reps:'10–12'  },
  { slug:'squat',             name:'Back Squat',          muscle:'Legs',      equip:'Barbell',    sets:'4–5',  reps:'4–6'    },
  { slug:'deadlift',          name:'Deadlift',            muscle:'Legs',      equip:'Barbell',    sets:'4',    reps:'3–5'    },
  { slug:'leg-press',         name:'Leg Press',           muscle:'Legs',      equip:'Machine',    sets:'3',    reps:'10–12'  },
  { slug:'romanian-deadlift', name:'Romanian DL',         muscle:'Legs',      equip:'Barbell',    sets:'3',    reps:'8–10'   },
  { slug:'leg-curl',          name:'Leg Curl',            muscle:'Legs',      equip:'Machine',    sets:'3–4',  reps:'10–12'  },
  { slug:'lunges',            name:'Walking Lunges',      muscle:'Legs',      equip:'Dumbbell',   sets:'3',    reps:'12 ea'  },
  { slug:'leg-extension',     name:'Leg Extension',       muscle:'Legs',      equip:'Machine',    sets:'3',    reps:'15–20'  },
  { slug:'calf-raises',       name:'Calf Raises',         muscle:'Legs',      equip:'Machine',    sets:'4',    reps:'15–20'  },
  { slug:'overhead-press',    name:'OHP',                 muscle:'Shoulders', equip:'Barbell',    sets:'4',    reps:'5–7'    },
  { slug:'lateral-raise',     name:'Lateral Raise',       muscle:'Shoulders', equip:'Dumbbell',   sets:'3–4',  reps:'12–15'  },
  { slug:'face-pulls',        name:'Face Pulls',          muscle:'Shoulders', equip:'Cable',      sets:'3',    reps:'15–20'  },
  { slug:'arnold-press',      name:'Arnold Press',        muscle:'Shoulders', equip:'Dumbbell',   sets:'3',    reps:'10–12'  },
  { slug:'bicep-curl',        name:'Bicep Curl',          muscle:'Arms',      equip:'Dumbbell',   sets:'3',    reps:'10–12'  },
  { slug:'hammer-curl',       name:'Hammer Curl',         muscle:'Arms',      equip:'Dumbbell',   sets:'3',    reps:'10–12'  },
  { slug:'tricep-dips',       name:'Tricep Dips',         muscle:'Arms',      equip:'Bodyweight', sets:'3',    reps:'10–12'  },
  { slug:'skull-crushers',    name:'Skull Crushers',      muscle:'Arms',      equip:'Barbell',    sets:'3',    reps:'8–12'   },
  { slug:'cable-curl',        name:'Cable Curl',          muscle:'Arms',      equip:'Cable',      sets:'3',    reps:'10–15'  },
  { slug:'plank',             name:'Plank',               muscle:'Core',      equip:'Bodyweight', sets:'3',    reps:'30–60s' },
  { slug:'ab-wheel',          name:'Ab Wheel',            muscle:'Core',      equip:'Equipment',  sets:'3',    reps:'8–12'   },
  { slug:'hanging-leg-raise', name:'Hanging Leg Raise',   muscle:'Core',      equip:'Bodyweight', sets:'3',    reps:'10–15'  },
  { slug:'cable-crunch',      name:'Cable Crunch',        muscle:'Core',      equip:'Cable',      sets:'3',    reps:'15–20'  },
];

const MUSCLE_FILTERS = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];

interface ExerciseCatalogProps {
  visible: boolean;
  onClose: () => void;
  onAdd?: (ex: Exercise) => void;
}

export function ExerciseCatalog({ visible, onClose, onAdd }: ExerciseCatalogProps) {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState('All');
  const [added, setAdded] = useState<Record<string, boolean>>({});

  const results = CATALOG.filter(
    ex => (muscle === 'All' || ex.muscle === muscle) &&
          ex.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleAdd = (ex: Exercise) => {
    setAdded(a => ({ ...a, [ex.slug]: true }));
    onAdd?.(ex);
  };

  return (
    <SRBottomSheet visible={visible} onClose={onClose} title="Exercise Library">
      <View style={styles.filterArea}>
        {/* Search */}
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={`Search ${CATALOG.length} exercises…`}
          placeholderTextColor={COLORS.ink3}
          style={styles.searchInput}
        />
        {/* Muscle filters */}
        <View style={styles.filterRow}>
          {MUSCLE_FILTERS.map(m => (
            <SRPill key={m} label={m} active={muscle === m} onPress={() => setMuscle(m)} size="xs" style={{ marginRight: 5 }} />
          ))}
        </View>
        <SRDivider />
      </View>

      <View style={{ paddingBottom: 40 }}>
        {results.length === 0 ? (
          <Text style={styles.empty}>No exercises found</Text>
        ) : null}
        {results.map((ex, i) => (
          <View key={ex.slug}>
            {i > 0 && <SRDivider indent={16} />}
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.exName}>{ex.name}</Text>
                <Text style={styles.exMeta}>
                  {ex.muscle} · {ex.equip} · {ex.sets}×{ex.reps}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleAdd(ex)}
                style={[styles.addBtn, added[ex.slug] ? styles.addBtnAdded : null]}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: added[ex.slug] ? COLORS.green : COLORS.ink2 }}>
                  {added[ex.slug] ? '✓ Added' : '+ Add'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </SRBottomSheet>
  );
}

const styles = StyleSheet.create({
  filterArea: { padding: 12, paddingBottom: 0 },
  searchInput: {
    height: 38, borderRadius: 11, borderWidth: 0.5, borderColor: COLORS.border,
    backgroundColor: COLORS.surface, paddingLeft: 14, paddingRight: 12,
    fontSize: 13, color: COLORS.ink, marginBottom: 10,
  },
  filterRow: { flexDirection: 'row', marginBottom: 10, flexWrap: 'nowrap' },
  row: {
    padding: 10, paddingHorizontal: 16, flexDirection: 'row',
    alignItems: 'center', gap: 10,
  },
  exName: { fontSize: 14, fontWeight: '600', color: COLORS.ink },
  exMeta: { fontSize: 11, color: COLORS.ink3, marginTop: 1 },
  addBtn: {
    height: 30, paddingHorizontal: 12, borderRadius: 8,
    borderWidth: 0.5, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtnAdded: {
    borderColor: COLORS.green, backgroundColor: COLORS.greenLight,
  },
  empty: {
    textAlign: 'center', padding: 32, fontSize: 14, color: COLORS.ink3,
  },
});
