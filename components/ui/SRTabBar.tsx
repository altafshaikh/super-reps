import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { House } from 'phosphor-react-native/src/icons/House';
import { Barbell } from 'phosphor-react-native/src/icons/Barbell';
import { Robot } from 'phosphor-react-native/src/icons/Robot';
import { User } from 'phosphor-react-native/src/icons/User';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants';
import { useReduceMotion } from '@/context/MotionContext';
import { useWorkoutStore } from '@/stores/workoutStore';
import { formatDuration } from '@/lib/utils';

const SCREEN_W = Dimensions.get('window').width;
const TAB_BAR_H_PAD = 6;
const PILL_W = 64;
const PILL_H = 48;
const SPRING = { mass: 0.3, damping: 20, stiffness: 200 };
const PILL_COLOR = 'rgba(96,165,250,0.12)';

const TABS = [
  { id: 'index',    label: 'Home',     Icon: House },
  { id: 'workouts', label: 'Workouts', Icon: Barbell },
  { id: 'ai',       label: 'AI Build', Icon: Robot },
  { id: 'profile',  label: 'Profile',  Icon: User },
];

function MinimizedWorkoutBar() {
  const router = useRouter();
  const { routineName, startedAt, expandWorkout, resetWorkout } = useWorkoutStore();
  const [elapsed, setElapsed] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const tick = setInterval(() => {
      if (startedAt) setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [startedAt]);

  useEffect(() => {
    return () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); };
  }, []);

  const handleExpand = () => {
    expandWorkout();
    router.push('/workout/active');
  };

  const handleTrashPress = () => {
    if (confirming) {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      resetWorkout();
    } else {
      setConfirming(true);
      confirmTimer.current = setTimeout(() => setConfirming(false), 3000);
    }
  };

  const handleCancelDiscard = () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirming(false);
  };

  return (
    <View style={mStyles.bar}>
      {confirming ? (
        <>
          <Text style={mStyles.confirmText}>Discard workout?</Text>
          <TouchableOpacity style={mStyles.cancelBtn} onPress={handleCancelDiscard}>
            <Text style={mStyles.cancelBtnText}>Keep</Text>
          </TouchableOpacity>
          <TouchableOpacity style={mStyles.discardConfirmBtn} onPress={handleTrashPress}>
            <Text style={mStyles.discardConfirmText}>Discard</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TouchableOpacity style={mStyles.expandBtn} onPress={handleExpand} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-up" size={20} color={COLORS.ink2} />
          </TouchableOpacity>
          <TouchableOpacity style={mStyles.center} onPress={handleExpand} activeOpacity={0.7}>
            <View style={mStyles.titleRow}>
              <View style={mStyles.greenDot} />
              <Text style={mStyles.workoutLabel}>Workout</Text>
              <Text style={mStyles.elapsed}>{formatDuration(elapsed)}</Text>
            </View>
            <Text style={mStyles.routineName} numberOfLines={1}>
              {routineName ?? 'Quick Workout'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={mStyles.discardBtn} onPress={handleTrashPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={20} color={COLORS.red} />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

interface SRTabBarProps {
  state: any;
  navigation: any;
}

export function SRTabBar({ state, navigation }: SRTabBarProps) {
  const { isActive, isMinimized } = useWorkoutStore();
  const reduceMotion = useReduceMotion();
  const tabW = (SCREEN_W - TAB_BAR_H_PAD * 2) / 4;

  const activeTabIdx = TABS.findIndex((tab) => {
    const routeIndex = state.routes.findIndex((r: any) => r.name === tab.id);
    return routeIndex !== -1 && state.index === routeIndex;
  });

  const pillX = useSharedValue(
    activeTabIdx >= 0 ? TAB_BAR_H_PAD + activeTabIdx * tabW + (tabW - PILL_W) / 2 : TAB_BAR_H_PAD
  );

  useEffect(() => {
    const target = activeTabIdx >= 0
      ? TAB_BAR_H_PAD + activeTabIdx * tabW + (tabW - PILL_W) / 2
      : pillX.value;
    pillX.value = reduceMotion ? target : withSpring(target, SPRING);
  }, [activeTabIdx, tabW, reduceMotion]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pillX.value }] }));

  return (
    <View>
      {isActive && isMinimized && <MinimizedWorkoutBar />}
      <View style={styles.container}>
      {/* Sliding pill — absolutely positioned behind tabs */}
      <Animated.View style={[styles.pill, pillStyle]} pointerEvents="none" />

      {TABS.map(({ id, label, Icon }, idx) => {
        const routeIndex = state.routes.findIndex((r: any) => r.name === id);
        const active = state.index === routeIndex && routeIndex !== -1;

        const onPress = () => {
          if (routeIndex === -1) return;
          const event = navigation.emit({
            type: 'tabPress',
            target: state.routes[routeIndex]?.key,
            canPreventDefault: true,
          });
          if (!active && !event.defaultPrevented) {
            navigation.navigate(id);
          }
        };

        return (
          <TouchableOpacity
            key={id}
            testID={`tab-${id}`}
            onPress={onPress}
            activeOpacity={0.7}
            style={styles.tab}
          >
            <Icon
              size={22}
              color={active ? COLORS.blue : COLORS.ink3}
              weight={active ? 'fill' : 'regular'}
            />
            <Text style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 68 + (Platform.OS === 'ios' ? 20 : 0),
    backgroundColor: COLORS.bg,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: TAB_BAR_H_PAD,
    paddingTop: 4,
  },
  pill: {
    position: 'absolute',
    top: 4,
    left: 0,
    width: PILL_W,
    height: PILL_H,
    borderRadius: 99,
    backgroundColor: PILL_COLOR,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.1,
  },
  labelActive: {
    fontWeight: '700',
    color: COLORS.blue,
  },
  labelInactive: {
    fontWeight: '400',
    color: COLORS.ink3,
  },
});

const mStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  expandBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.green,
  },
  workoutLabel: {
    color: COLORS.ink,
    fontWeight: '700',
    fontSize: 15,
  },
  elapsed: {
    color: COLORS.ink2,
    fontSize: 14,
    fontWeight: '500',
  },
  routineName: {
    color: COLORS.ink3,
    fontSize: 12,
    fontWeight: '400',
  },
  discardBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    color: COLORS.ink2,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    marginLeft: 10,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginRight: 6,
  },
  cancelBtnText: {
    color: COLORS.ink2,
    fontSize: 13,
    fontWeight: '500',
  },
  discardConfirmBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.red,
    marginRight: 6,
  },
  discardConfirmText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
