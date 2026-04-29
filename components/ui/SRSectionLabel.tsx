import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { COLORS } from '@/constants';

interface SRSectionLabelProps {
  children: string;
  action?: string;
  onAction?: () => void;
  action2?: string;
  onAction2?: () => void;
}

export function SRSectionLabel({ children, action, onAction, action2, onAction2 }: SRSectionLabelProps) {
  return (
    <View style={{
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8,
    }}>
      <Text style={{
        fontSize: 11, color: COLORS.ink3, fontWeight: '700',
        textTransform: 'uppercase', letterSpacing: 1.2,
        flex: 1,
        marginRight: 8,
      }}>
        {children}
      </Text>
      {(action || action2) ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {action ? (
            <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ fontSize: 13, color: COLORS.blue, fontWeight: '600' }}>{action}</Text>
            </TouchableOpacity>
          ) : null}
          {action2 ? (
            <TouchableOpacity onPress={onAction2} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ fontSize: 13, color: COLORS.blue, fontWeight: '600' }}>{action2}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
