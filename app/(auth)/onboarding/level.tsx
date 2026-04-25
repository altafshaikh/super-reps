import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useUserStore } from '@/stores/userStore';
import { LEVEL_OPTIONS } from '@/constants';
import type { Level } from '@/types';

export default function OnboardingLevel() {
  const router = useRouter();
  const { updateProfile } = useUserStore();
  const [selected, setSelected] = useState<Level | null>(null);

  const handleNext = async () => {
    if (!selected) return;
    await updateProfile({ level: selected });
    router.push('/(auth)/onboarding/equipment');
  };

  return (
    <View className="flex-1 bg-surface">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6 pt-16">
        <TouchableOpacity onPress={() => router.back()} className="mb-4">
          <Text className="text-brand-500 text-base">← Back</Text>
        </TouchableOpacity>
        <View className="mb-2">
          <Text className="text-white/40 text-sm font-medium tracking-widest uppercase">Step 2 of 3</Text>
        </View>
        <Text className="text-3xl font-bold text-white mt-2 mb-2">Training experience?</Text>
        <Text className="text-white/50 text-base mb-8">The AI scales intensity and complexity to your level.</Text>

        <View className="gap-3">
          {LEVEL_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setSelected(opt.value as Level)}
              className={`rounded-xl p-5 border ${
                selected === opt.value
                  ? 'bg-brand-600/20 border-brand-500'
                  : 'bg-surface-card border-surface-border'
              }`}
            >
              <View className="flex-row items-center justify-between">
                <Text className={`font-bold text-lg ${selected === opt.value ? 'text-brand-500' : 'text-white'}`}>
                  {opt.label}
                </Text>
                {selected === opt.value && (
                  <View className="w-5 h-5 rounded-full bg-brand-500 items-center justify-center">
                    <Text className="text-white text-xs font-bold">✓</Text>
                  </View>
                )}
              </View>
              <Text className="text-white/50 text-sm mt-1">{opt.desc}</Text>
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
