import { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal, StyleSheet,
  Dimensions, Share, Linking, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withDelay, withTiming,
  FadeInDown, FadeIn,
} from 'react-native-reanimated';
import ConfettiCannon from 'react-native-confetti-cannon';
import { COLORS } from '@/constants';
import { useReduceMotion } from '@/context/MotionContext';
import { PressableScale } from '@/components/ui/PressableScale';
import { formatDurationClock, formatVolumeDisplay, formatWeight } from '@/lib/utils';
import { getVolumeComparison } from '@/lib/weight-comparisons';
import { HumanBodySVG } from '@/components/ui';
import type { SessionPR } from '@/lib/workout-pr';

const { width: SCREEN_W } = Dimensions.get('window');

const INSIGHTS = [
  'Every rep builds the foundation for tomorrow\'s lift.',
  'Consistency beats perfection — you showed up.',
  'Fatigue today is strength tomorrow.',
  'Progress is earned, not given.',
  'Another session in the bank. Keep stacking.',
];

function decodeParam(s: string | undefined, fallback = ''): string {
  if (!s || typeof s !== 'string') return fallback;
  try { return decodeURIComponent(s); } catch { return s; }
}

// ── Share Sheet ───────────────────────────────────────────────

interface ShareSheetProps {
  visible: boolean;
  onClose: () => void;
  routineName: string;
  durationSec: number;
  setCount: number;
  volumeKg: number;
  prs: SessionPR[];
}

function ShareSheet({ visible, onClose, routineName, durationSec, setCount, volumeKg, prs }: ShareSheetProps) {
  const insets = useSafeAreaInsets();
  const [slide, setSlide] = useState(0);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const volComp = getVolumeComparison(volumeKg);

  // Muscle groups trained (derived from PR exercise names as fallback — real muscles need exercise data)
  const trainedMuscles: string[] = prs.length > 0 ? [] : [];

  const buildShareText = () => {
    const dur = formatDurationClock(durationSec);
    const vol = formatVolumeDisplay(volumeKg);
    let text = `💪 Just crushed ${routineName}!\n⏱ ${dur} · ${setCount} sets · ${vol} total volume\n`;
    if (prs.length > 0) {
      text += `\n🏆 PRs hit:\n`;
      for (const pr of prs) {
        text += `  ${pr.exerciseName}: ${formatWeight(pr.weightKg)} kg (+${formatWeight(pr.improvementKg)} kg)\n`;
      }
    }
    text += `\nTracked with SuperReps 🏋️`;
    return text;
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(buildShareText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = () => {
    Share.share({ message: buildShareText(), title: `${routineName} — SuperReps` });
  };

  const handleInstagram = () => {
    Linking.openURL('instagram://app').catch(() => {
      Linking.openURL('https://instagram.com');
    });
  };

  const handleTwitter = () => {
    const text = encodeURIComponent(buildShareText().slice(0, 280));
    Linking.openURL(`twitter://post?message=${text}`).catch(() => {
      Linking.openURL(`https://x.com/intent/post?text=${text}`);
    });
  };

  const SLIDES = [
    {
      key: 'muscle_map',
      render: () => (
        <View style={sh.slide}>
          <Text style={sh.slideTitle}>Muscles Trained</Text>
          <View style={sh.bodyWrap}>
            <HumanBodySVG trainedMuscles={trainedMuscles} size={140} />
          </View>
          <View style={sh.statsRow}>
            <View style={sh.statCell}>
              <Text style={sh.statVal}>{formatDurationClock(durationSec)}</Text>
              <Text style={sh.statLab}>Duration</Text>
            </View>
            <View style={sh.statCell}>
              <Text style={sh.statVal}>{setCount}</Text>
              <Text style={sh.statLab}>Sets</Text>
            </View>
            <View style={sh.statCell}>
              <Text style={sh.statVal}>{formatVolumeDisplay(volumeKg)}</Text>
              <Text style={sh.statLab}>Volume</Text>
            </View>
          </View>
          <Text style={sh.slideBrand}>SuperReps</Text>
        </View>
      ),
    },
    {
      key: 'weight_comparison',
      render: () => (
        <View style={sh.slide}>
          <Text style={sh.slideTitle}>Volume Lifted</Text>
          <Text style={sh.bigEmoji}>{volComp.emoji}</Text>
          <Text style={sh.bigStat}>{formatVolumeDisplay(volumeKg)}</Text>
          <Text style={sh.compLabel}>{volComp.fullLabel}</Text>
          <Text style={sh.slideBrand}>SuperReps</Text>
        </View>
      ),
    },
    {
      key: 'rep_map',
      render: () => (
        <View style={sh.slide}>
          <Text style={sh.slideTitle}>Total Sets</Text>
          <Text style={sh.bigEmoji}>🔁</Text>
          <Text style={sh.bigStat}>{setCount}</Text>
          <Text style={sh.compLabel}>
            {setCount >= 20 ? 'Elite volume session 🔥' :
             setCount >= 12 ? 'Solid work today 💪' :
             'Quality over quantity ✅'}
          </Text>
          <Text style={sh.slideBrand}>SuperReps</Text>
        </View>
      ),
    },
    {
      key: 'best_set',
      render: () => {
        const topPr = prs[0];
        return (
          <View style={sh.slide}>
            <Text style={sh.slideTitle}>Best Set</Text>
            <Text style={sh.bigEmoji}>🏆</Text>
            {topPr ? (
              <>
                <Text style={sh.bestSetName} numberOfLines={2}>{topPr.exerciseName}</Text>
                <Text style={sh.bestSetWeight}>{formatWeight(topPr.weightKg)} kg</Text>
                <View style={sh.prBadge}>
                  <Text style={sh.prBadgeTxt}>+{formatWeight(topPr.improvementKg)} kg PR</Text>
                </View>
              </>
            ) : (
              <Text style={sh.compLabel}>Keep logging to track your bests!</Text>
            )}
            <Text style={sh.slideBrand}>SuperReps</Text>
          </View>
        );
      },
    },
    {
      key: 'workout_details',
      render: () => (
        <View style={sh.slide}>
          <Text style={sh.slideTitle}>{routineName}</Text>
          <View style={sh.detailRow}>
            <Ionicons name="time-outline" size={14} color={COLORS.ink3} />
            <Text style={sh.detailTxt}>{formatDurationClock(durationSec)}</Text>
          </View>
          <View style={sh.detailRow}>
            <Ionicons name="barbell-outline" size={14} color={COLORS.ink3} />
            <Text style={sh.detailTxt}>{setCount} sets completed</Text>
          </View>
          <View style={sh.detailRow}>
            <Ionicons name="trending-up-outline" size={14} color={COLORS.ink3} />
            <Text style={sh.detailTxt}>{formatVolumeDisplay(volumeKg)} total volume</Text>
          </View>
          {prs.map((pr, i) => (
            <View key={i} style={sh.prRow}>
              <Text style={sh.prName} numberOfLines={1}>{pr.exerciseName}</Text>
              <Text style={sh.prWt}>{formatWeight(pr.weightKg)} kg</Text>
            </View>
          ))}
          <Text style={sh.slideBrand}>SuperReps</Text>
        </View>
      ),
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={sh.overlay}>
        <TouchableOpacity style={sh.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[sh.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={sh.handle} />
          <Text style={sh.sheetTitle}>Share Workout</Text>

          {/* Slide carousel */}
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={e => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_W - 32));
              setSlide(idx);
            }}
            style={sh.carousel}
            contentContainerStyle={{ gap: 0 }}
          >
            {SLIDES.map(s => (
              <View key={s.key} style={{ width: SCREEN_W - 32 }}>
                {s.render()}
              </View>
            ))}
          </ScrollView>

          {/* Dots */}
          <View style={sh.dots}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[sh.dot, i === slide && sh.dotActive]} />
            ))}
          </View>

          {/* Share targets */}
          <View style={sh.targets}>
            <TouchableOpacity style={sh.target} onPress={handleCopy}>
              <View style={[sh.targetIcon, { backgroundColor: `${COLORS.blue}22` }]}>
                <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={22} color={COLORS.blue} />
              </View>
              <Text style={sh.targetLbl}>{copied ? 'Copied!' : 'Copy'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={sh.target} onPress={handleNativeShare}>
              <View style={[sh.targetIcon, { backgroundColor: `${COLORS.green}22` }]}>
                <Ionicons name="share-outline" size={22} color={COLORS.green} />
              </View>
              <Text style={sh.targetLbl}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={sh.target} onPress={handleInstagram}>
              <View style={[sh.targetIcon, { backgroundColor: '#E1306C22' }]}>
                <Ionicons name="logo-instagram" size={22} color="#E1306C" />
              </View>
              <Text style={sh.targetLbl}>Instagram</Text>
            </TouchableOpacity>
            <TouchableOpacity style={sh.target} onPress={handleTwitter}>
              <View style={[sh.targetIcon, { backgroundColor: `${COLORS.ink3}22` }]}>
                <Ionicons name="logo-twitter" size={22} color={COLORS.ink2} />
              </View>
              <Text style={sh.targetLbl}>Twitter</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={sh.closeBtn} onPress={onClose}>
            <Text style={sh.closeBtnTxt}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const sh = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  handle: { width: 36, height: 4, borderRadius: 99, backgroundColor: COLORS.border, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: COLORS.ink, textAlign: 'center', marginBottom: 12 },

  carousel: { maxHeight: 280 },
  slide: {
    marginHorizontal: 16, backgroundColor: COLORS.surface2, borderRadius: 20,
    borderWidth: 0.5, borderColor: COLORS.border,
    padding: 20, alignItems: 'center', minHeight: 240, justifyContent: 'center',
  },
  slideTitle: { fontSize: 12, fontWeight: '800', color: COLORS.ink3, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 },
  slideBrand: { position: 'absolute', bottom: 12, right: 16, fontSize: 10, color: COLORS.ink3, fontWeight: '700' },

  bodyWrap: { marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 20 },
  statCell: { alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '900', color: COLORS.ink },
  statLab: { fontSize: 10, color: COLORS.ink3, marginTop: 2, textTransform: 'uppercase' },

  bigEmoji: { fontSize: 52, marginBottom: 8 },
  bigStat: { fontSize: 32, fontWeight: '900', color: COLORS.ink, marginBottom: 6 },
  compLabel: { fontSize: 13, color: COLORS.ink2, textAlign: 'center', lineHeight: 18 },

  bestSetName: { fontSize: 18, fontWeight: '700', color: COLORS.ink, textAlign: 'center', marginBottom: 6 },
  bestSetWeight: { fontSize: 34, fontWeight: '900', color: COLORS.blue },
  prBadge: { backgroundColor: `${COLORS.green}22`, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99, marginTop: 8 },
  prBadgeTxt: { color: COLORS.green, fontWeight: '700', fontSize: 13 },

  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, alignSelf: 'stretch' },
  detailTxt: { color: COLORS.ink2, fontSize: 14 },
  prRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', marginTop: 4 },
  prName: { color: COLORS.ink, fontSize: 13, flex: 1, marginRight: 8 },
  prWt: { color: COLORS.green, fontWeight: '700', fontSize: 13 },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10, marginBottom: 16 },
  dot: { width: 6, height: 6, borderRadius: 99, backgroundColor: COLORS.surface3 },
  dotActive: { backgroundColor: COLORS.blue, width: 18 },

  targets: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 20, marginBottom: 16 },
  target: { alignItems: 'center', gap: 6 },
  targetIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  targetLbl: { fontSize: 11, color: COLORS.ink2, fontWeight: '600' },

  closeBtn: { marginHorizontal: 16, backgroundColor: COLORS.ink, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  closeBtnTxt: { color: COLORS.bg, fontWeight: '800', fontSize: 15 },
});

// ── Main Screen ───────────────────────────────────────────────

export default function WorkoutCompleteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    routineName?: string;
    durationSec?: string;
    setCount?: string;
    volumeKg?: string;
    prsJson?: string;
  }>();

  useEffect(() => {
    if (!params.durationSec) {
      router.replace('/(tabs)');
    }
  }, []);

  const routineName = decodeParam(params.routineName, 'Workout');
  const durationSec = Number(params.durationSec) || 0;
  const setCount = Number(params.setCount) || 0;
  const volumeKg = Number(params.volumeKg) || 0;

  const prs: SessionPR[] = (() => {
    const raw = decodeParam(params.prsJson);
    if (!raw) return [];
    try { return JSON.parse(raw) as SessionPR[]; } catch { return []; }
  })();

  const insight = useRef(INSIGHTS[Math.floor(Math.random() * INSIGHTS.length)]).current;
  const [shareVisible, setShareVisible] = useState(false);
  const reduceMotion = useReduceMotion();
  const confettiRef = useRef<any>(null);

  const trophyScale = useSharedValue(0);
  const trophyRotate = useSharedValue(-0.3);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    trophyScale.value = withSpring(1, { damping: 8, stiffness: 180 });
    trophyRotate.value = withSpring(0, { damping: 10, stiffness: 150 });
    contentOpacity.value = withDelay(200, withTiming(1, { duration: 300 }));
    if (prs.length > 0 && !reduceMotion && Platform.OS !== 'web') {
      setTimeout(() => confettiRef.current?.start(), 500);
    }
  }, []);

  const trophyStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: trophyScale.value },
      { rotate: `${trophyRotate.value}rad` },
    ],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  return (
    <View style={[s.root, { paddingBottom: insets.bottom + 16 }]}>
      {prs.length > 0 && Platform.OS !== 'web' && (
        <ConfettiCannon
          ref={confettiRef}
          count={80}
          origin={{ x: SCREEN_W / 2, y: -10 }}
          colors={[COLORS.blue, COLORS.green, '#FFFFFF', COLORS.amber]}
          fadeOut
          autoStart={false}
        />
      )}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 32 }]}
      >
        <View style={s.heroSection}>
          <Animated.View style={[s.trophyWrap, trophyStyle]}>
            <Ionicons name="trophy" size={64} color="#EAB308" />
          </Animated.View>
          <Text style={s.doneTitle}>Workout Complete!</Text>
          <Text style={s.doneSubtitle}>{routineName}</Text>
        </View>

        <Animated.View style={contentStyle}>
          <View style={s.statsCard}>
            <View style={s.statCell}>
              <Text style={s.statVal}>{formatDurationClock(durationSec)}</Text>
              <Text style={s.statLab}>Duration</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statCell}>
              <Text style={s.statVal}>{setCount}</Text>
              <Text style={s.statLab}>Sets</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statCell}>
              <Text style={s.statVal}>{formatVolumeDisplay(volumeKg)}</Text>
              <Text style={s.statLab}>Volume</Text>
            </View>
          </View>

          {prs.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>{prs.length} NEW PR{prs.length > 1 ? 'S' : ''} 🎉</Text>
              {prs.map((pr, i) => (
                <Animated.View
                  key={i}
                  entering={reduceMotion ? FadeIn.duration(1) : FadeInDown.delay(i * 80).springify()}
                >
                  <View style={[s.prRow, i < prs.length - 1 && s.prRowBorder]}>
                    <Text style={s.prName} numberOfLines={1}>{pr.exerciseName}</Text>
                    <View style={s.prRight}>
                      <Text style={s.prWeight}>{formatWeight(pr.weightKg)} kg</Text>
                      <View style={s.prBadge}>
                        <Text style={s.prBadgeText}>+{formatWeight(pr.improvementKg)} kg</Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>
              ))}
            </View>
          )}

          <View style={s.insightCard}>
            <View style={s.insightBar} />
            <View style={s.insightBody}>
              <Text style={s.insightLabel}>COACH</Text>
              <Text style={s.insightText}>{insight}</Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      <Animated.View style={[s.actions, contentStyle]}>
        <PressableScale onPress={() => setShareVisible(true)} haptic={false}>
          <View style={s.shareBtn}>
            <Ionicons name="share-outline" size={18} color={COLORS.ink} style={{ marginRight: 6 }} />
            <Text style={s.shareBtnTxt}>Share Workout</Text>
          </View>
        </PressableScale>
        <PressableScale onPress={() => router.replace('/(tabs)')}>
          <View style={s.doneBtn}>
            <Text style={s.doneBtnTxt}>Back to Home</Text>
          </View>
        </PressableScale>
      </Animated.View>

      <ShareSheet
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
        routineName={routineName}
        durationSec={durationSec}
        setCount={setCount}
        volumeKg={volumeKg}
        prs={prs}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 20, gap: 14 },

  heroSection: { alignItems: 'center', marginBottom: 8 },
  trophyWrap: { marginBottom: 14 },
  doneTitle: { fontSize: 28, fontWeight: '900', color: COLORS.ink, textAlign: 'center' },
  doneSubtitle: { fontSize: 14, color: COLORS.ink3, marginTop: 4 },

  statsCard: {
    flexDirection: 'row', backgroundColor: COLORS.surface,
    borderRadius: 18, borderWidth: 0.5, borderColor: COLORS.border, overflow: 'hidden',
  },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: 18 },
  statDivider: { width: 0.5, backgroundColor: COLORS.border },
  statVal: { fontSize: 22, fontWeight: '900', color: COLORS.ink },
  statLab: { fontSize: 10, color: COLORS.ink3, fontWeight: '700', letterSpacing: 0.8, marginTop: 3, textTransform: 'uppercase' },

  section: {
    backgroundColor: COLORS.surface, borderRadius: 18,
    borderWidth: 0.5, borderColor: COLORS.border, overflow: 'hidden',
  },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: COLORS.green, letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  prRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14 },
  prRowBorder: { borderBottomWidth: 0.5, borderBottomColor: COLORS.border, paddingBottom: 12, marginBottom: 2 },
  prName: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.ink, marginRight: 10 },
  prRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prWeight: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
  prBadge: { backgroundColor: `${COLORS.green}22`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, borderWidth: 0.5, borderColor: `${COLORS.green}55` },
  prBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.green },

  insightCard: {
    flexDirection: 'row', backgroundColor: COLORS.surface,
    borderRadius: 18, borderWidth: 0.5, borderColor: COLORS.border, overflow: 'hidden',
  },
  insightBar: { width: 3, backgroundColor: COLORS.blue },
  insightBody: { flex: 1, paddingHorizontal: 14, paddingVertical: 14 },
  insightLabel: { fontSize: 10, fontWeight: '800', color: COLORS.ink3, letterSpacing: 1, marginBottom: 5 },
  insightText: { fontSize: 14, color: COLORS.ink, lineHeight: 20, fontWeight: '500' },

  actions: { paddingHorizontal: 20, gap: 10 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: COLORS.border, borderRadius: 16,
    paddingVertical: 14, backgroundColor: COLORS.surface,
  },
  shareBtnTxt: { color: COLORS.ink, fontWeight: '700', fontSize: 15 },
  doneBtn: { backgroundColor: COLORS.ink, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  doneBtnTxt: { color: COLORS.bg, fontWeight: '800', fontSize: 15 },
});
