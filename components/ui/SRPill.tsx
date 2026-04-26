import React from 'react';
import { Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { COLORS } from '@/constants';

type PillSize = 'xs' | 'sm' | 'md';

interface SRPillProps {
  label: string;
  active?: boolean;
  green?: boolean;
  amber?: boolean;
  red?: boolean;
  ghost?: boolean;
  muted?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  size?: PillSize;
}

export function SRPill({
  label, active, green, amber, red, ghost, muted,
  onPress, style, size = 'sm',
}: SRPillProps) {
  let bg = COLORS.surface2;
  let color = COLORS.ink2;
  let borderColor = 'transparent';

  if (active) { bg = COLORS.ink; color = COLORS.bg; }
  if (green)  { bg = COLORS.greenLight; color = COLORS.green; }
  if (amber)  { bg = COLORS.amberLight; color = COLORS.amber; }
  if (red)    { bg = COLORS.redLight;   color = COLORS.red; }
  if (ghost)  { bg = 'transparent'; color = COLORS.ink3; borderColor = COLORS.border; }
  if (muted)  { bg = COLORS.surface; color = COLORS.ink3; }

  const fs = size === 'xs' ? 10 : size === 'sm' ? 12 : 13;
  const px = size === 'xs' ? 8  : size === 'sm' ? 12 : 14;
  const py = size === 'xs' ? 3  : size === 'sm' ? 5  : 7;

  const containerStyle: ViewStyle = {
    backgroundColor: bg,
    borderRadius: 99,
    paddingHorizontal: px,
    paddingVertical: py,
    borderWidth: 0.5,
    borderColor,
    alignSelf: 'flex-start',
    ...style,
  };

  const content = (
    <Text style={{ fontSize: fs, fontWeight: '600', color }}>{label}</Text>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.75} onPress={onPress} style={containerStyle}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={containerStyle}>{content}</View>;
}
