import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { COLORS } from '@/constants';

function IconHome({ active }: { active: boolean }) {
  const c = active ? COLORS.ink : COLORS.ink3;
  const sw = active ? 2 : 1.5;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1v-9.5z"
        stroke={c} strokeWidth={sw}
        fill={active ? c : 'none'} fillOpacity={active ? 0.08 : 0}
      />
      <Path d="M9 21V13h6v8" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </Svg>
  );
}

function IconLog({ active }: { active: boolean }) {
  const c = active ? COLORS.ink : COLORS.ink3;
  const sw = active ? 2 : 1.5;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect
        x={4} y={3} width={16} height={18} rx={3}
        stroke={c} strokeWidth={sw}
        fill={active ? c : 'none'} fillOpacity={active ? 0.08 : 0}
      />
      <Path d="M8 8h8M8 12h6M8 16h4" stroke={c} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function IconAI({ active }: { active: boolean }) {
  const c = active ? COLORS.ink : COLORS.ink3;
  const sw = active ? 2 : 1.5;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C8.7 2 6 4.5 6 7.5c0 1.8.9 3.4 2.3 4.4L7.5 15l3.5-1.5c.3.1.6.1 1 .1 3.3 0 6-2.5 6-5.5S15.3 2 12 2z"
        stroke={c} strokeWidth={sw}
        fill={active ? c : 'none'} fillOpacity={active ? 0.08 : 0}
      />
      <Circle cx={9.5} cy={7.5} r={1} fill={c} />
      <Circle cx={12} cy={7.5} r={1} fill={c} />
      <Circle cx={14.5} cy={7.5} r={1} fill={c} />
      <Path
        d="M7.5 15c-2.8 1.2-4.5 3.2-4.5 5.5h18c0-2.3-1.7-4.3-4.5-5.5"
        stroke={c} strokeWidth={1.5} strokeLinecap="round"
      />
    </Svg>
  );
}

function IconProfile({ active }: { active: boolean }) {
  const c = active ? COLORS.ink : COLORS.ink3;
  const sw = active ? 2 : 1.5;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle
        cx={12} cy={8} r={4}
        stroke={c} strokeWidth={sw}
        fill={active ? c : 'none'} fillOpacity={active ? 0.08 : 0}
      />
      <Path d="M4 21c0-3.5 3.6-6 8-6s8 2.5 8 6" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </Svg>
  );
}

const TABS = [
  { id: 'index',    label: 'Home',     Icon: IconHome },
  { id: 'workouts', label: 'Workouts', Icon: IconLog },
  { id: 'ai',       label: 'AI',       Icon: IconAI },
  { id: 'profile',  label: 'Profile',  Icon: IconProfile },
];

interface SRTabBarProps {
  state: any;
  navigation: any;
}

export function SRTabBar({ state, navigation }: SRTabBarProps) {
  return (
    <View style={styles.container}>
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
            onPress={onPress}
            activeOpacity={0.7}
            style={styles.tab}
          >
            <Icon active={active} />
            <Text style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>
              {label}
            </Text>
            <View style={[styles.dot, { backgroundColor: active ? COLORS.ink : 'transparent' }]} />
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
    paddingHorizontal: 6,
    paddingTop: 4,
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
    color: COLORS.ink,
  },
  labelInactive: {
    fontWeight: '400',
    color: COLORS.ink3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 99,
  },
});
