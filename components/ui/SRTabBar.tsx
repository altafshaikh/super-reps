import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle } from 'react-native-svg';
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

/** Barbell / dumbbell — reads clearly at tab size vs. a generic “log” journal. */
function IconWorkouts({ active }: { active: boolean }) {
  const c = active ? COLORS.ink : COLORS.ink3;
  const sw = active ? 2 : 1.5;
  const fill = active ? c : 'none';
  const fo = active ? 0.08 : 0;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle
        cx={7.5} cy={12} r={4}
        stroke={c} strokeWidth={sw}
        fill={fill} fillOpacity={fo}
      />
      <Path
        d="M11.5 12h5"
        stroke={c} strokeWidth={sw} strokeLinecap="round"
      />
      <Circle
        cx={16.5} cy={12} r={4}
        stroke={c} strokeWidth={sw}
        fill={fill} fillOpacity={fo}
      />
    </Svg>
  );
}

/** Chat bubble — matches AI Builder conversational tab. */
function IconAI({ active }: { active: boolean }) {
  const c = active ? COLORS.ink : COLORS.ink3;
  return (
    <Ionicons
      name={active ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
      size={22}
      color={c}
    />
  );
}

function IconProgress({ active }: { active: boolean }) {
  const c = active ? COLORS.ink : COLORS.ink3;
  const sw = active ? 2 : 1.5;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 17l4-5 4 3 4-6 4 3"
        stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      />
      <Path d="M3 21h18" stroke={c} strokeWidth={sw} strokeLinecap="round" />
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
  { id: 'workouts', label: 'Workouts', Icon: IconWorkouts },
  { id: 'ai',       label: 'AI Build', Icon: IconAI },
  { id: 'progress', label: 'Progress', Icon: IconProgress },
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
            testID={`tab-${id}`}
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
