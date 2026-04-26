import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { COLORS } from '@/constants';

interface SRSectionLabelProps {
  children: string;
  action?: string;
  onAction?: () => void;
}

export function SRSectionLabel({ children, action, onAction }: SRSectionLabelProps) {
  return (
    <View style={{
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8,
    }}>
      <Text style={{
        fontSize: 11, color: COLORS.ink3, fontWeight: '700',
        textTransform: 'uppercase', letterSpacing: 1.2,
      }}>
        {children}
      </Text>
      {action ? (
        <TouchableOpacity onPress={onAction}>
          <Text style={{ fontSize: 12, color: COLORS.ink3 }}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
