export const EQUIPMENT_OPTIONS = [
  { label: 'Barbell', value: 'barbell' },
  { label: 'Dumbbells', value: 'dumbbells' },
  { label: 'Cables / Machine', value: 'cables' },
  { label: 'Pull-up Bar', value: 'pullup_bar' },
  { label: 'Resistance Bands', value: 'bands' },
  { label: 'Bodyweight Only', value: 'bodyweight' },
  { label: 'Kettlebells', value: 'kettlebells' },
];

export const GOAL_OPTIONS = [
  { label: 'Build Muscle', value: 'hypertrophy', emoji: '💪', desc: 'Maximize muscle size and definition' },
  { label: 'Get Stronger', value: 'strength', emoji: '🏋️', desc: 'Increase maximal strength and power' },
  { label: 'Lose Fat / Tone', value: 'recomp', emoji: '🔥', desc: 'Build muscle while losing fat' },
  { label: 'Improve Endurance', value: 'endurance', emoji: '🏃', desc: 'Increase stamina and conditioning' },
];

export const LEVEL_OPTIONS = [
  { label: 'Beginner', value: 'beginner', desc: 'Less than 1 year of consistent training' },
  { label: 'Intermediate', value: 'intermediate', desc: '1–3 years of consistent training' },
  { label: 'Advanced', value: 'advanced', desc: '3+ years of consistent training' },
];

export const QUICK_PROMPTS = [
  'Push Pull Legs (PPL) 6 day — barbell, dumbbells, cables & machines',
  'Upper Lower 4 day — strength focus, main compounds',
  'Full Body 3 day — beginner friendly',
  'Bro Split 5 day — classic bodybuilding split',
  'Home Workout — dumbbells, bands, or bodyweight',
];

/** Split "Title — detail" for Quick Picks UI (uses em dash U+2014). */
export function quickPromptParts(line: string): { title: string; subtitle?: string } {
  const sep = ' — ';
  const i = line.indexOf(sep);
  if (i === -1) return { title: line };
  return {
    title: line.slice(0, i).trim(),
    subtitle: line.slice(i + sep.length).trim(),
  };
}

export const COLORS = {
  bg: '#0F172A',
  surface: '#1E293B',
  surface2: '#293548',
  surface3: '#334155',
  border: 'rgba(255,255,255,0.07)',
  borderMid: 'rgba(255,255,255,0.12)',
  ink: '#F1F5F9',
  ink2: '#CBD5E1',
  ink3: '#64748B',
  ink4: '#334155',
  blue: '#60A5FA',
  blueLight: '#1E3A5F',
  green: '#34D399',
  greenLight: '#064E3B',
  amber: '#FCD34D',
  amberLight: '#451A03',
  red: '#F87171',
  redLight: '#450A0A',
  // legacy aliases
  card: '#1E293B',
  primary: '#60A5FA',
  primaryDark: '#3B82F6',
  success: '#34D399',
  warning: '#FCD34D',
  error: '#F87171',
  text: '#F1F5F9',
  textMuted: '#CBD5E1',
  textDim: '#64748B',
};

export const REST_TIMES = [30, 60, 90, 120, 180, 240];
