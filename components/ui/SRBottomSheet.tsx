import React from 'react';
import {
  View, Text, TouchableOpacity, Modal, Pressable,
  ScrollView, StyleSheet, Platform,
} from 'react-native';
import { COLORS } from '@/constants';
import { SRDivider } from './SRDivider';

interface SRBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export function SRBottomSheet({ visible, onClose, children, title }: SRBottomSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: COLORS.surface2 }]} />
        </View>
        {/* Title row */}
        {title ? (
          <>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: COLORS.ink }]}>{title}</Text>
              <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: COLORS.surface2 }]}>
                <Text style={{ color: COLORS.ink3, fontSize: 12, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>
            <SRDivider />
          </>
        ) : null}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    borderWidth: 0.5,
    borderBottomWidth: 0,
    borderColor: COLORS.borderMid,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 99,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
