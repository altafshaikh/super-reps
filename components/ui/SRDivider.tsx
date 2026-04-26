import React from 'react';
import { View } from 'react-native';
import { COLORS } from '@/constants';

export function SRDivider({ indent = 0 }: { indent?: number }) {
  return (
    <View style={{ height: 0.5, backgroundColor: COLORS.border, marginLeft: indent }} />
  );
}
