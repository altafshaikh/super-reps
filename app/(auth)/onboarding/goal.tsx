import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useUserStore } from '@/stores/userStore';
import { GOAL_OPTIONS } from '@/constants';
import type { Goal } from '@/types';

export default function OnboardingGoal() {
  const router = useRouter();
  const { updateProfile } = useUserStore();
  const [selected, setSelected] = useState<Goal | null>(null);

  const handleNext = async () => {
    if (!selected) return;
    await updateProfile({ goal: selected });
    router.push('/(auth)/onboarding/level');
  };

  return (
    <View className="flex-1 bg-surface">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6 pt-16">
        <View className="mb-2">
          <Text className="text-white/40 text-sm font-medium tracking-widest uppercase">Step 1 of 3</Text>
        </View>
        <Text className="text-3xl font-bold text-white mt-2 mb-2">What's your main goal?</Text>
        <Text className="text-white/50 text-base mb-8">This helps the AI build the right programme for you.</Text>

        <View className="gap-3">
          {GOAL_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setSelected(opt.value as Goal)}
              className={`rounded-xl p-4 border flex-row items-center gap-4 ${
                selected === opt.value
                  ? 'bg-brand-600/20 border-brand-500'
                  : 'bg-surface-card border-surface-border'
              }`}
            >
              <Text className="text-3xl">{opt.emoji}</Text>
              <View className="flex-1">
                <Text className={`font-bold text-base ${selected === opt.value ? 'text-brand-500' : 'text-white'}`}>
                  {opt.label}
                </Text>
                <Text className="text-white/50 text-sm mt-0.5">{opt.desc}</Text>
              </View>
              {selected === opt.value && (
                <View className="w-5 h-5 rounded-full bg-brand-500 items-center justify-center">
                  <Text className="text-white text-xs font-bold">✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View className="px-6 pb-10 pt-4">
        <TouchableOpacity
          onPress={handleNext}
          disabled={!selected}
          className={`rounded-xl py-4 items-center ${selected ? 'bg-brand-600' : 'bg-surface-card'}`}
        >
          <Text className={`font-bold text-base ${selected ? 'text-white' : 'text-white/30'}`}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
