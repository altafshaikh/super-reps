import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { House, Barbell, Robot, User } from 'phosphor-react-native';
import { COLORS } from '@/constants';
import { useReduceMotion } from '@/context/MotionContext';

const SCREEN_W = Dimensions.get('window').width;
const TAB_BAR_H_PAD = 6;
const PILL_W = 60;
const PILL_H = 40;
const SPRING = { mass: 0.3, damping: 20, stiffness: 200 };
const PILL_COLOR = 'rgba(96,165,250,0.12)';

const TABS = [
  { id: 'index',    label: 'Home',     Icon: House },
  { id: 'workouts', label: 'Workouts', Icon: Barbell },
  { id: 'ai',       label: 'AI Build', Icon: Robot },
  { id: 'profile',  label: 'Profile',  Icon: User },
];

interface SRTabBarProps {
  state: any;
  navigation: any;
}

export function SRTabBar({ state, navigation }: SRTabBarProps) {
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
