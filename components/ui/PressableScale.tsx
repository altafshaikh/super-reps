import React from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const SPRING = { mass: 0.3, damping: 20, stiffness: 300 };

interface PressableScaleProps {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: boolean;
  children: React.ReactNode;
}

export function PressableScale({ onPress, style, disabled, haptic = true, children }: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[animStyle, style]}>
      <Pressable
        disabled={disabled}
        onPressIn={() => { scale.value = withSpring(0.96, SPRING); }}
        onPressOut={() => { scale.value = withSpring(1, SPRING); }}
        onPress={() => {
          if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress?.();
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
