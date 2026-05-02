import { useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView,
  Image, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants';
import type { Exercise } from '@/types';

interface Props {
  exerciseId: string | null;
  onClose: () => void;
}

export function ExerciseDetailSheet({ exerciseId, onClose }: Props) {
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    if (!exerciseId) { setExercise(null); return; }
    setLoading(true);
    setImgLoaded(false);
    supabase
      .from('exercises')
      .select('*')
      .eq('id', exerciseId)
      .single()
      .then(({ data }) => {
        setExercise(data as Exercise ?? null);
        setLoading(false);
      });
  }, [exerciseId]);

  return (
    <Modal
      visible={exerciseId !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />

          {loading || !exercise ? (
            <View style={s.loadWrap}>
              <ActivityIndicator color={COLORS.blue} size="large" />
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
              {/* Image */}
              <View style={s.imgWrap}>
                {exercise.image_url ? (
                  <>
                    {!imgLoaded && (
                      <View style={[StyleSheet.absoluteFillObject, s.imgSkeleton]}>
                        <ActivityIndicator color={COLORS.ink3} />
                      </View>
                    )}
                    <Image
                      source={{ uri: exercise.image_url }}
                      style={s.img}
                      resizeMode="cover"
                      onLoad={() => setImgLoaded(true)}
                    />
                  </>
                ) : (
                  <View style={[s.img, s.imgFallback]}>
                    <Ionicons name="barbell-outline" size={48} color={COLORS.ink3} />
                  </View>
                )}
              </View>

              {/* Name */}
              <Text style={s.name}>{exercise.name}</Text>
              <Text style={s.category}>{exercise.category}</Text>

              {/* Muscles */}
              {exercise.muscle_groups.length > 0 && (
                <View style={s.section}>
                  <Text style={s.sectionLabel}>Primary Muscles</Text>
                  <View style={s.pillRow}>
                    {exercise.muscle_groups.map(m => (
                      <View key={m} style={s.pill}>
                        <Text style={s.pillTxt}>{m.replace(/_/g, ' ')}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Equipment */}
              {exercise.equipment.length > 0 && (
                <View style={s.section}>
                  <Text style={s.sectionLabel}>Equipment</Text>
                  <Text style={s.bodyText}>{exercise.equipment.join(', ')}</Text>
                </View>
              )}

              {/* Form cues */}
              {exercise.form_cues && exercise.form_cues.length > 0 && (
                <View style={s.section}>
                  <Text style={s.sectionLabel}>Form Cues</Text>
                  {exercise.form_cues.slice(0, 3).map((cue, i) => (
                    <View key={i} style={s.cueRow}>
                      <Text style={s.cueBullet}>•</Text>
                      <Text style={s.cueText}>{cue}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          )}

          <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={s.closeBtnTxt}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 0,
  },
  handle: { width: 36, height: 4, borderRadius: 99, backgroundColor: COLORS.border, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  loadWrap: { height: 200, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  imgWrap: { borderRadius: 16, overflow: 'hidden', marginBottom: 16, height: 200, backgroundColor: COLORS.surface2 },
  img: { width: '100%', height: 200 },
  imgSkeleton: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface2 },
  imgFallback: { alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 22, fontWeight: '900', color: COLORS.ink, marginBottom: 4 },
  category: { fontSize: 13, color: COLORS.ink3, marginBottom: 16 },
  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: COLORS.ink3, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { backgroundColor: COLORS.blueLight, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  pillTxt: { fontSize: 12, fontWeight: '600', color: COLORS.blue, textTransform: 'capitalize' },
  bodyText: { fontSize: 14, color: COLORS.ink2, lineHeight: 20 },
  cueRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  cueBullet: { fontSize: 14, color: COLORS.blue, marginTop: 2 },
  cueText: { fontSize: 14, color: COLORS.ink2, lineHeight: 20, flex: 1 },
  closeBtn: {
    backgroundColor: COLORS.ink, margin: 16, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  closeBtnTxt: { color: COLORS.bg, fontWeight: '800', fontSize: 15 },
});
