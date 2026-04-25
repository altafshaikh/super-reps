import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useUserStore } from '@/stores/userStore';
import { EQUIPMENT_OPTIONS } from '@/constants';

export default function OnboardingEquipment() {
  const router = useRouter();
  const { updateProfile } = useUserStore();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

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
    <View className="flex-1 bg-surface">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6 pt-16">
        <TouchableOpacity onPress={() => router.back()} className="mb-4">
          <Text className="text-brand-500 text-base">← Back</Text>
        </TouchableOpacity>
        <View className="mb-2">
          <Text className="text-white/40 text-sm font-medium tracking-widest uppercase">Step 3 of 3</Text>
        </View>
        <Text className="text-3xl font-bold text-white mt-2 mb-2">Available equipment?</Text>
        <Text className="text-white/50 text-base mb-8">Select all that apply. The AI builds programmes around what you have.</Text>

        <View className="flex-row flex-wrap gap-3">
          {EQUIPMENT_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => toggle(opt.value)}
              className={`rounded-xl px-4 py-3 border ${
                selected.includes(opt.value)
                  ? 'bg-brand-600 border-brand-500'
                  : 'bg-surface-card border-surface-border'
              }`}
            >
              <Text className={`font-medium ${selected.includes(opt.value) ? 'text-white' : 'text-white/70'}`}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View className="px-6 pb-10 pt-4">
        <TouchableOpacity
          onPress={handleFinish}
          disabled={selected.length === 0 || loading}
          className={`rounded-xl py-4 items-center ${selected.length > 0 ? 'bg-brand-600' : 'bg-surface-card'}`}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className={`font-bold text-base ${selected.length > 0 ? 'text-white' : 'text-white/30'}`}>
              Get Started
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
