import React, { useEffect } from 'react';
import Animated, { useSharedValue, withTiming, withSpring, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Path, Text as SvgText, Line } from 'react-native-svg';
import { COLORS } from '@/constants';
import { useReduceMotion } from '@/context/MotionContext';

const CHART_H = 100;
const LABEL_H = 16;
const PAD = { l: 4, r: 4, t: 10, b: 0 };

interface LineChartProps {
  data: { label: string; value: number }[];
  width: number;
}

export function LineChart({ data, width }: LineChartProps) {
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const translateY = useSharedValue(reduceMotion ? 0 : 10);

  useEffect(() => {
    if (!reduceMotion) {
      opacity.value = withTiming(1, { duration: 400 });
      translateY.value = withSpring(0, { damping: 18, stiffness: 150 });
    }
  }, [reduceMotion]);

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!data.length) return null;

  const W = width - PAD.l - PAD.r;
  const H = CHART_H - PAD.t;
  const vals = data.map(d => d.value);
  const maxV = Math.max(...vals);
  const minV = Math.min(...vals) * 0.85;
  const range = maxV - minV || 1;

  const pts = data.map((d, i) => ({
    x: PAD.l + (data.length === 1 ? W / 2 : (i / (data.length - 1)) * W),
    y: PAD.t + H - ((d.value - minV) / range) * H,
    label: d.label,
  }));

  const segments = pts.slice(1).map((p, i) => {
    const prev = pts[i];
    const cx = (prev.x + p.x) / 2;
    return `C ${cx} ${prev.y} ${cx} ${p.y} ${p.x} ${p.y}`;
  });
  const linePath = pts.length > 1
    ? `M ${pts[0].x} ${pts[0].y} ${segments.join(' ')}`
    : null;

  return (
    <Animated.View style={wrapStyle}>
      <Svg width={width} height={CHART_H + LABEL_H}>
        {[0, 0.5, 1].map((t, i) => (
          <Line
            key={i}
            x1={PAD.l} x2={width - PAD.r}
            y1={PAD.t + H * (1 - t)} y2={PAD.t + H * (1 - t)}
            stroke={COLORS.border} strokeWidth="0.5"
          />
        ))}
        {linePath && (
          <Path
            d={linePath}
            fill="none"
            stroke={COLORS.ink}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {pts.map((p, i) => {
          const isCurrent = i === pts.length - 1;
          return (
            <Circle
              key={i}
              cx={p.x} cy={p.y}
              r={isCurrent ? 4 : 2.5}
              fill={isCurrent ? COLORS.ink : COLORS.bg}
              stroke={COLORS.ink}
              strokeWidth={isCurrent ? 0 : 1.5}
            />
          );
        })}
        {pts.map((p, i) => (
          <SvgText
            key={i}
            x={p.x} y={CHART_H + LABEL_H - 2}
            textAnchor="middle"
            fontSize="9"
            fill={i === pts.length - 1 ? COLORS.ink : COLORS.ink3}
            fontWeight={i === pts.length - 1 ? '700' : '400'}
          >
            {p.label}
          </SvgText>
        ))}
      </Svg>
    </Animated.View>
  );
}
