import { View, Text, TouchableOpacity, ScrollView, StyleSheet, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { useUserStore } from '@/stores/userStore';
import { LEVEL_OPTIONS, COLORS } from '@/constants';
import type { Level } from '@/types';

export default function OnboardingLevel() {
  const router = useRouter();
  const { updateProfile, user } = useUserStore();
  const [selected, setSelected] = useState<Level | null>(null);

  useEffect(() => {
    if (user?.level) setSelected(user.level);
  }, [user?.level]);

  const handleNext = async () => {
    if (!selected) return;
    await updateProfile({ level: selected });
    router.push('/(auth)/onboarding/equipment');
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.step}>Step 2 of 3</Text>
        <Text style={s.title}>Training experience?</Text>
        <Text style={s.subtitle}>The AI scales intensity and complexity to your level.</Text>

        <View style={s.options}>
          {LEVEL_OPTIONS.map(opt => {
            const active = selected === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setSelected(opt.value as Level)}
                style={[s.option, active && s.optionActive]}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[s.optionLabel, active && { color: COLORS.blue }]}>{opt.label}</Text>
                  {active ? (
                    <View style={s.checkmark}>
                      <Text style={{ color: COLORS.bg, fontSize: 11, fontWeight: '700' }}>✓</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={s.optionDesc}>{opt.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          testID="onboarding-level-continue"
          onPress={handleNext}
          disabled={!selected}
          style={[s.continueBtn, !selected && s.continueBtnDisabled]}
          activeOpacity={0.85}
        >
          <Text style={[s.continueBtnText, !selected && { color: COLORS.ink3 }]}>Continue</Text>
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
  options: { gap: 10 },
  option: {
    backgroundColor: COLORS.surface, borderWidth: 0.5, borderColor: COLORS.border,
    borderRadius: 16, padding: 18,
  },
  optionActive: { borderColor: COLORS.blue, backgroundColor: COLORS.blueLight },
  optionLabel: { fontSize: 18, fontWeight: '700', color: COLORS.ink },
  optionDesc: { fontSize: 13, color: COLORS.ink3, marginTop: 4 },
  checkmark: {
    width: 22, height: 22, borderRadius: 99,
    backgroundColor: COLORS.blue,
    alignItems: 'center', justifyContent: 'center',
  },
  footer: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12 },
  continueBtn: {
    backgroundColor: COLORS.ink, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  continueBtnDisabled: { backgroundColor: COLORS.surface2 },
  continueBtnText: { color: COLORS.bg, fontWeight: '700', fontSize: 16 },
});
