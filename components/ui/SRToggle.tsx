import React from 'react';
import { View, TouchableOpacity, Animated } from 'react-native';
import { COLORS } from '@/constants';

export function SRToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onChange(!value)}
      style={{
        width: 44, height: 26, borderRadius: 99,
        backgroundColor: value ? COLORS.ink : COLORS.surface2,
        justifyContent: 'center',
        paddingHorizontal: 3,
      }}
    >
      <View style={{
        width: 20, height: 20, borderRadius: 99,
        backgroundColor: value ? COLORS.bg : COLORS.ink3,
        alignSelf: value ? 'flex-end' : 'flex-start',
        shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
      }} />
    </TouchableOpacity>
  );
}
