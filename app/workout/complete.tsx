import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants';

export default function WorkoutCompleteScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-surface items-center justify-center px-6">
      <View className="items-center mb-10">
        <View className="w-24 h-24 rounded-full bg-green-500/20 items-center justify-center mb-6">
          <Ionicons name="checkmark-circle" size={56} color={COLORS.success} />
        </View>
        <Text className="text-white text-3xl font-bold text-center">Workout Complete!</Text>
        <Text className="text-white/50 text-base text-center mt-2">
          Great work. Your session has been saved.
        </Text>
      </View>

      <View className="w-full gap-3">
        <TouchableOpacity
          className="bg-brand-600 rounded-xl py-4 items-center"
          onPress={() => router.replace('/(tabs)')}
        >
          <Text className="text-white font-bold text-base">Back to Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="border border-surface-border rounded-xl py-4 items-center"
          onPress={() => router.replace('/(tabs)/progress')}
        >
          <Text className="text-white/70 font-medium text-base">View Progress</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
