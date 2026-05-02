interface WeightComparison {
  minKg: number;
  maxKg: number;
  label: string;
  emoji: string;
  unit: string;
}

const COMPARISONS: WeightComparison[] = [
  { minKg: 0,      maxKg: 20,    label: 'a bag of groceries',      emoji: '🛍️',  unit: 'bags' },
  { minKg: 20,     maxKg: 60,    label: 'a standard barbell',      emoji: '🏋️',  unit: 'barbells' },
  { minKg: 60,     maxKg: 120,   label: 'a large suitcase',        emoji: '🧳',  unit: 'suitcases' },
  { minKg: 120,    maxKg: 250,   label: 'a mountain bike',         emoji: '🚲',  unit: 'bikes' },
  { minKg: 250,    maxKg: 500,   label: 'a grand piano',           emoji: '🎹',  unit: 'pianos' },
  { minKg: 500,    maxKg: 1000,  label: 'a grizzly bear',          emoji: '🐻',  unit: 'grizzly bears' },
  { minKg: 1000,   maxKg: 2000,  label: 'a small car',             emoji: '🚗',  unit: 'small cars' },
  { minKg: 2000,   maxKg: 5000,  label: 'a pickup truck',          emoji: '🚛',  unit: 'pickup trucks' },
  { minKg: 5000,   maxKg: 15000, label: 'an African elephant',     emoji: '🐘',  unit: 'elephants' },
  { minKg: 15000,  maxKg: Infinity, label: 'a space shuttle tank', emoji: '🚀',  unit: 'shuttle tanks' },
];

export interface VolumeComparison {
  label: string;
  emoji: string;
  count: number;
  fullLabel: string;
}

export function getVolumeComparison(volumeKg: number): VolumeComparison {
  const match = COMPARISONS.find(c => volumeKg >= c.minKg && volumeKg < c.maxKg) ?? COMPARISONS[COMPARISONS.length - 1];
  const mid = (match.minKg + Math.min(match.maxKg === Infinity ? match.minKg * 2 : match.maxKg, match.minKg * 3)) / 2;
  const referenceKg = mid || 1;
  const count = Math.max(1, Math.round(volumeKg / referenceKg));
  const countLabel = count === 1 ? match.label : `${count} ${match.unit}`;
  return {
    label: match.label,
    emoji: match.emoji,
    count,
    fullLabel: `You lifted the weight of ${countLabel} ${match.emoji}`,
  };
}
