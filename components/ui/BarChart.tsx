import React from 'react';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { COLORS } from '@/constants';

const CHART_H = 100;
const LABEL_H = 16;

interface BarChartProps {
  data: { label: string; value: number }[];
  width: number;
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
            <Rect
              x={x}
              y={CHART_H - barH}
              width={barW}
              height={barH}
              rx={3}
              fill={isCurrent ? COLORS.blue : COLORS.ink3}
              fillOpacity={isCurrent ? 1 : 0.3}
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
