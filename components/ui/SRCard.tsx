import React from 'react';
import { View, TouchableOpacity, ViewStyle } from 'react-native';
import { COLORS } from '@/constants';

interface SRCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  pad?: number;
}

export function SRCard({ children, style, onPress, pad = 0 }: SRCardProps) {
  const cardStyle: ViewStyle = {
    backgroundColor: COLORS.surface,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 20,
    overflow: 'hidden',
    padding: pad,
    ...style,
  };

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={cardStyle}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}
