import React, { useEffect } from 'react';
import Animated, { useSharedValue, withDelay, withTiming, useAnimatedProps } from 'react-native-reanimated';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { COLORS } from '@/constants';
import { useReduceMotion } from '@/context/MotionContext';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const CHART_H = 100;
const LABEL_H = 16;

interface BarChartProps {
  data: { label: string; value: number }[];
  width: number;
}

function AnimatedBar({
  x, targetBarH, barW, isCurrent, delayMs,
}: {
  x: number;
  targetBarH: number;
  barW: number;
  isCurrent: boolean;
  delayMs: number;
}) {
  const reduceMotion = useReduceMotion();
  const barH = useSharedValue(reduceMotion ? targetBarH : 0);

  useEffect(() => {
    if (!reduceMotion) {
      barH.value = withDelay(delayMs, withTiming(targetBarH, { duration: 400 }));
    } else {
      barH.value = targetBarH;
    }
  }, [targetBarH, reduceMotion]);

  const animProps = useAnimatedProps(() => ({
    y: CHART_H - barH.value,
    height: Math.max(barH.value, 0),
  }));

  return (
    <AnimatedRect
      animatedProps={animProps}
      x={x}
      width={barW}
      rx={3}
      fill={isCurrent ? COLORS.blue : COLORS.ink3}
      fillOpacity={isCurrent ? 1 : 0.3}
    />
  );
}

export function BarChart({ data, width }: BarChartProps) {
  if (!data.length) return null;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const gap = 4;
  const barW = (width - gap * (data.length - 1)) / data.length;

  return (
    <Svg width={width} height={CHART_H + LABEL_H}>
      {data.map((d, i) => {
        const barH = Math.max((d.value / maxVal) * CHART_H, d.value > 0 ? 2 : 0);
        const x = i * (barW + gap);
        const isCurrent = i === data.length - 1;
        return (
          <React.Fragment key={i}>
            <AnimatedBar
              x={x}
              targetBarH={barH}
              barW={barW}
              isCurrent={isCurrent}
              delayMs={i * 40}
            />
            <SvgText
              x={x + barW / 2}
              y={CHART_H + LABEL_H - 2}
              textAnchor="middle"
              fontSize="9"
              fill={isCurrent ? COLORS.ink : COLORS.ink3}
              fontWeight={isCurrent ? '700' : '400'}
            >
              {d.label}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
