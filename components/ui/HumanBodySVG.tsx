import Svg, { G, Ellipse, Rect, Path } from 'react-native-svg';
import { View } from 'react-native';
import { COLORS } from '@/constants';

interface Props {
  trainedMuscles: string[];
  size?: number;
}

const ACTIVE = COLORS.blue;
const DIM = COLORS.surface3;

function fill(trained: string[], ...keys: string[]) {
  if (keys.includes('full_body') && trained.includes('full_body')) return ACTIVE;
  return keys.some(k => trained.includes(k)) ? ACTIVE : DIM;
}

// Front-view body schematic at 60×140 viewBox
function FrontBody({ trained }: { trained: string[] }) {
  const f = (...k: string[]) => fill(trained, ...k, 'full_body');
  return (
    <Svg width={60} height={140} viewBox="0 0 60 140">
      {/* Head */}
      <Ellipse cx={30} cy={11} rx={9} ry={11} fill={DIM} />
      {/* Neck */}
      <Rect x={26} y={21} width={8} height={6} fill={DIM} />
      {/* Left shoulder */}
      <Ellipse cx={13} cy={34} rx={8} ry={7} fill={f('shoulders')} />
      {/* Right shoulder */}
      <Ellipse cx={47} cy={34} rx={8} ry={7} fill={f('shoulders')} />
      {/* Chest */}
      <Path d="M19 28 Q30 23 41 28 L43 48 Q30 53 17 48 Z" fill={f('chest')} />
      {/* Core / abs */}
      <Rect x={20} y={48} width={20} height={22} rx={2} fill={f('core')} />
      {/* Left bicep */}
      <Rect x={5} y={42} width={7} height={18} rx={3} fill={f('biceps')} />
      {/* Right bicep */}
      <Rect x={48} y={42} width={7} height={18} rx={3} fill={f('biceps')} />
      {/* Left forearm */}
      <Rect x={4} y={61} width={6} height={16} rx={3} fill={f('forearms')} />
      {/* Right forearm */}
      <Rect x={50} y={61} width={6} height={16} rx={3} fill={f('forearms')} />
      {/* Hip / pelvis */}
      <Path d="M19 70 Q30 67 41 70 L42 78 Q30 80 18 78 Z" fill={DIM} />
      {/* Left quad */}
      <Rect x={17} y={78} width={11} height={32} rx={4} fill={f('quads')} />
      {/* Right quad */}
      <Rect x={32} y={78} width={11} height={32} rx={4} fill={f('quads')} />
      {/* Left knee */}
      <Ellipse cx={22} cy={112} rx={5} ry={4} fill={DIM} />
      {/* Right knee */}
      <Ellipse cx={37} cy={112} rx={5} ry={4} fill={DIM} />
      {/* Left calf (front visible) */}
      <Rect x={18} y={116} width={9} height={22} rx={4} fill={f('calves')} />
      {/* Right calf (front visible) */}
      <Rect x={33} y={116} width={9} height={22} rx={4} fill={f('calves')} />
    </Svg>
  );
}

// Back-view body schematic at 60×140 viewBox
function BackBody({ trained }: { trained: string[] }) {
  const f = (...k: string[]) => fill(trained, ...k, 'full_body');
  return (
    <Svg width={60} height={140} viewBox="0 0 60 140">
      {/* Head */}
      <Ellipse cx={30} cy={11} rx={9} ry={11} fill={DIM} />
      {/* Neck */}
      <Rect x={26} y={21} width={8} height={6} fill={DIM} />
      {/* Left shoulder */}
      <Ellipse cx={13} cy={34} rx={8} ry={7} fill={f('shoulders')} />
      {/* Right shoulder */}
      <Ellipse cx={47} cy={34} rx={8} ry={7} fill={f('shoulders')} />
      {/* Upper back / traps */}
      <Path d="M18 26 Q30 22 42 26 L43 44 Q30 46 17 44 Z" fill={f('back')} />
      {/* Mid / lower back */}
      <Rect x={19} y={44} width={22} height={24} rx={2} fill={f('back')} />
      {/* Left tricep */}
      <Rect x={5} y={40} width={7} height={20} rx={3} fill={f('triceps')} />
      {/* Right tricep */}
      <Rect x={48} y={40} width={7} height={20} rx={3} fill={f('triceps')} />
      {/* Left forearm */}
      <Rect x={4} y={61} width={6} height={16} rx={3} fill={f('forearms')} />
      {/* Right forearm */}
      <Rect x={50} y={61} width={6} height={16} rx={3} fill={f('forearms')} />
      {/* Glutes */}
      <Path d="M18 68 Q30 64 42 68 L43 82 Q30 85 17 82 Z" fill={f('glutes')} />
      {/* Left hamstring */}
      <Rect x={17} y={82} width={11} height={28} rx={4} fill={f('hamstrings')} />
      {/* Right hamstring */}
      <Rect x={32} y={82} width={11} height={28} rx={4} fill={f('hamstrings')} />
      {/* Left knee */}
      <Ellipse cx={22} cy={112} rx={5} ry={4} fill={DIM} />
      {/* Right knee */}
      <Ellipse cx={37} cy={112} rx={5} ry={4} fill={DIM} />
      {/* Left calf */}
      <Rect x={18} y={116} width={9} height={22} rx={4} fill={f('calves')} />
      {/* Right calf */}
      <Rect x={33} y={116} width={9} height={22} rx={4} fill={f('calves')} />
    </Svg>
  );
}

export function HumanBodySVG({ trainedMuscles, size = 140 }: Props) {
  const scale = size / 140;
  return (
    <View style={{ flexDirection: 'row', gap: 16 * scale, alignItems: 'center' }}>
      <View style={{ transform: [{ scale }] }}>
        <FrontBody trained={trainedMuscles} />
      </View>
      <View style={{ transform: [{ scale }] }}>
        <BackBody trained={trainedMuscles} />
      </View>
    </View>
  );
}
