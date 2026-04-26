import React from 'react';
import { View, Text } from 'react-native';
import { COLORS } from '@/constants';

interface SRMetricProps {
  label: string;
  value: string | number;
  unit?: string;
}

export function SRMetric({ label, value, unit }: SRMetricProps) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text style={{ color: COLORS.ink, lineHeight: 30 }}>
        <Text style={{ fontSize: 30, fontWeight: '900', letterSpacing: -0.3 }}>
          {value}
        </Text>
        {unit ? (
          <Text style={{ fontSize: 14, fontWeight: '500', color: COLORS.ink2 }}>{unit}</Text>
        ) : null}
      </Text>
      <Text style={{
        fontSize: 10, color: COLORS.ink3, fontWeight: '700',
        textTransform: 'uppercase', letterSpacing: 0.9, textAlign: 'center',
      }}>
        {label}
      </Text>
    </View>
  );
}
