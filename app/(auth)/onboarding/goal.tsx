import { View, Text, TouchableOpacity, ScrollView, StyleSheet, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { useUserStore } from '@/stores/userStore';
import { GOAL_OPTIONS, COLORS } from '@/constants';
import type { Goal } from '@/types';

export default function OnboardingGoal() {
  const router = useRouter();
  const { updateProfile, user } = useUserStore();
  const [selected, setSelected] = useState<Goal | null>(null);

  useEffect(() => {
    if (user?.goal) setSelected(user.goal);
  }, [user?.goal]);

  const handleNext = async () => {
    if (!selected) return;
    await updateProfile({ goal: selected });
    router.push('/(auth)/onboarding/level');
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.step}>Step 1 of 3</Text>
        <Text style={s.title}>What's your main goal?</Text>
        <Text style={s.subtitle}>This helps the AI build the right programme for you.</Text>

        <View style={s.options}>
          {GOAL_OPTIONS.map(opt => {
            const active = selected === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setSelected(opt.value as Goal)}
                style={[s.option, active && s.optionActive]}
                activeOpacity={0.8}
              >
                <Text style={s.optionEmoji}>{opt.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.optionLabel, active && { color: COLORS.blue }]}>{opt.label}</Text>
                  <Text style={s.optionDesc}>{opt.desc}</Text>
                </View>
                {active ? (
                  <View style={s.checkmark}>
                    <Text style={{ color: COLORS.bg, fontSize: 11, fontWeight: '700' }}>✓</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
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
  step: { fontSize: 11, color: COLORS.ink3, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: COLORS.ink, marginBottom: 8 },
  subtitle: { fontSize: 15, color: COLORS.ink3, marginBottom: 28, lineHeight: 22 },
  options: { gap: 10 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.surface, borderWidth: 0.5, borderColor: COLORS.border,
    borderRadius: 16, padding: 16,
  },
  optionActive: { borderColor: COLORS.blue, backgroundColor: COLORS.blueLight },
  optionEmoji: { fontSize: 28 },
  optionLabel: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  optionDesc: { fontSize: 13, color: COLORS.ink3, marginTop: 2 },
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
