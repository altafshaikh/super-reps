import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { useUserStore } from '@/stores/userStore';
import { EQUIPMENT_OPTIONS, COLORS } from '@/constants';

export default function OnboardingEquipment() {
  const router = useRouter();
  const { updateProfile, user } = useUserStore();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setSelected(user.equipment ?? []);
  }, [user?.id]);

  const toggle = (val: string) => {
    setSelected(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val],
    );
  };

  const handleFinish = async () => {
    if (selected.length === 0) return;
    setLoading(true);
    await updateProfile({ equipment: selected });
    setLoading(false);
    router.replace('/(tabs)');
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.step}>Step 3 of 3</Text>
        <Text style={s.title}>Available equipment?</Text>
        <Text style={s.subtitle}>Select all that apply. The AI builds programmes around what you have.</Text>

        <View style={s.chips}>
          {EQUIPMENT_OPTIONS.map(opt => {
            const active = selected.includes(opt.value);
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => toggle(opt.value)}
                style={[s.chip, active && s.chipActive]}
                activeOpacity={0.8}
              >
                <Text style={[s.chipText, active && { color: COLORS.bg }]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          onPress={handleFinish}
          disabled={selected.length === 0 || loading}
          style={[s.finishBtn, selected.length === 0 && s.finishBtnDisabled]}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.bg} />
          ) : (
            <Text style={[s.finishBtnText, selected.length === 0 && { color: COLORS.ink3 }]}>
              Get Started
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 64, paddingBottom: 20, flexGrow: 1 },
  back: { marginBottom: 16 },
  backText: { color: COLORS.blue, fontSize: 15 },
  step: { fontSize: 11, color: COLORS.ink3, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: COLORS.ink, marginBottom: 8 },
  subtitle: { fontSize: 15, color: COLORS.ink3, marginBottom: 28, lineHeight: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 18,
    backgroundColor: COLORS.surface, borderWidth: 0.5, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.ink, borderColor: COLORS.ink },
  chipText: { fontSize: 14, fontWeight: '600', color: COLORS.ink2 },
  footer: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12 },
  finishBtn: {
    backgroundColor: COLORS.ink, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  finishBtnDisabled: { backgroundColor: COLORS.surface2 },
  finishBtnText: { color: COLORS.bg, fontWeight: '700', fontSize: 16 },
});
