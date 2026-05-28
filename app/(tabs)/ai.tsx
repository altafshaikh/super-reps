/**
 * AI Coach — unified chat surface for build / analyze / readiness / form / chat.
 *
 * This tab is the single LLM surface in the app. Entry-point CTAs from other
 * screens (workouts, routines) push here with `?intent=build` so the coach
 * skips the clarifier and goes straight into routine-building. From the tab
 * directly, the coach asks the user what they want on the first ambiguous turn.
 *
 * Architecture (see grilling Q4-Q11):
 *   - Q4 D: hybrid classifier + intent-scoped workers
 *   - Q5 D: per-intent token budgets via TokenAccountant (used by workers)
 *   - Q8 P1: parallel tool calls (n/a in v1 — no tool fan-out yet)
 *   - Q10: multi-chat persistence in Supabase (`chats` table), 2k soft cap with
 *     invisible migration to a child chat seeded by an 8B summary
 *   - Q11: friendly errors — never silent retries, never quality fallbacks
 *
 * V1 scope:
 *   - Build intent: full flow (port of existing conductConversation +
 *     generateRoutine), preview card, save to DB
 *   - Analyze / readiness / form / chat: graceful stub — the coach honestly
 *     says it can't do that yet AND offers what it CAN help with
 *   - Multi-chat sidebar with new-chat button and chat history
 *   - 2k cap banner + auto-migration
 *   - Classifier-driven clarification chips when intent is ambiguous
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  StyleSheet,
  StatusBar,
  Modal,
  Pressable,
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useReduceMotion } from '@/context/MotionContext';
import { supabase } from '@/lib/supabase';
import { useAIStore } from '@/stores/aiStore';
import { useUserStore } from '@/stores/userStore';
import { useChatStore, CHAT_SOFT_LIMIT, CHAT_HARD_LIMIT } from '@/stores/chatStore';
import { COLORS } from '@/constants';
import type { AIRoutineJSON, Exercise } from '@/types';
import {
  conductConversation,
  type RoutineUserContext,
  type ChatMessage,
} from '@/lib/ai';
import { classifyIntent } from '@/lib/ai/classifier';
import { estimateTokens, type IntentName } from '@/lib/ai/token-accountant';
import Groq from 'groq-sdk';

const SCREEN_BG = '#0a0c14';
const AI_CARD = '#141824';
const AI_BUBBLE = '#1a1e2e';

const groqClient = new Groq({
  apiKey: process.env.EXPO_PUBLIC_GROQ_API_KEY?.trim() || 'gsk_placeholder_for_build_without_env',
  dangerouslyAllowBrowser: true,
});

// Default intent-aware intro shown above the empty chat state.
const INTROS: Record<IntentName | 'unhinted', string> = {
  build:
    "Let's build your programme. Tell me your goal, how many days you can train, and what equipment you have — or paste a workout from another app to import it.",
  analyze:
    "I can talk through your training — though full analytics are still in progress. For now ask me anything and I'll work with what I know.",
  readiness:
    "Tell me how you feel today and what's on your plan — I'll help you decide if it's a green light, a deload, or a rest day.",
  form:
    "Ask me about exercise technique, alternatives for an injury, or how to fix a sticking point.",
  chat:
    "I'm your training coach. Ask anything — programming, nutrition basics, form, motivation.",
  unhinted:
    "Hi — I'm your training coach. Tell me what you'd like to work on today.",
};

// Clarification chips offered when the classifier flags the first message as ambiguous.
const CLARIFICATION_CHIPS: { label: string; intent: IntentName }[] = [
  { label: 'Build a routine', intent: 'build' },
  { label: 'Analyze my workouts', intent: 'analyze' },
  { label: "Today's training", intent: 'readiness' },
  { label: 'Form / technique', intent: 'form' },
];

const QUICK_PROMPTS_BUILD: { label: string; prompt: string }[] = [
  { label: 'Build from scratch', prompt: 'I want to build a new workout programme from scratch.' },
  { label: 'Import my plan', prompt: 'I want to import my current workout plan from another app.' },
  { label: '3 days a week', prompt: 'I can only train 3 days a week and want a balanced programme.' },
  { label: 'Legs & glutes', prompt: 'I want a programme that heavily prioritises leg and glute development.' },
];

function dayBadgeLabel(day: { name: string }): string {
  const m = day.name.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i);
  if (m) return m[1].charAt(0).toUpperCase() + m[1].slice(1, 3).toLowerCase();
  const t = day.name.trim();
  if (t.length <= 4) return t.toUpperCase();
  return t.slice(0, 3).toUpperCase();
}

/**
 * Lightweight user context fed to every general-coach call so the reply is
 * personalised (goal, level, equipment) rather than generic boilerplate.
 * Heavier history (recent sessions, PRs, muscle distribution) is loaded only
 * for the build intent via `loadExercisesAndContext` because it costs a
 * larger query and most non-build intents don't need it.
 */
interface GeneralCoachContext {
  goal?: string | null;
  level?: string | null;
  equipment?: string[] | null;
}

/**
 * Worker for non-build intents (analyze, readiness, form, chat).
 *
 * Design notes after user feedback:
 *  - "Too textual" → hard cap responses at 3 sentences (max_tokens reduced from
 *    600 to 280; system prompt now demands terse output).
 *  - "Generic / non-personalised" → user profile is injected into the system
 *    prompt and the model is explicitly told to USE it. Previously we passed
 *    `userContext` nowhere for non-build intents.
 *  - Stubs trimmed to one short sentence each — the model is no longer told
 *    to recite an apology paragraph for analyze.
 */
async function callGeneralCoach(
  messages: ChatMessage[],
  intent: IntentName,
  userContext: GeneralCoachContext | null,
  onChunk?: (text: string) => void,
): Promise<string> {
  const stubPreamble: Partial<Record<IntentName, string>> = {
    analyze:
      "Note: full workout-history tools aren't wired yet. If the user asks a question that would need their session data, say so briefly (one short sentence) and pivot to what you CAN do — talk through their goal, suggest routine tweaks, discuss form. Never recite a long apology.",
    readiness:
      "Help the user decide about today's session. Ask one quick clarifying question if you need it (how they feel, what's planned). Then give a direct call: train as planned, lighter, swap focus, or rest.",
    form:
      "Answer the form / technique / substitution question directly. Concrete cues they can use on their next set. No throat-clearing.",
    chat:
      "Answer general fitness questions directly — programming, nutrition basics, training principles. No filler.",
  };

  // Profile block — kept tight on tokens. Only emit lines with actual data.
  const profileBits: string[] = [];
  if (userContext?.goal)     profileBits.push(`goal=${userContext.goal}`);
  if (userContext?.level)    profileBits.push(`level=${userContext.level}`);
  if (userContext?.equipment?.length) profileBits.push(`equipment=${userContext.equipment.join(',')}`);
  const profileLine = profileBits.length
    ? `\nUSER (use this when relevant — never re-ask): ${profileBits.join(' · ')}\n`
    : '';

  const systemPrompt =
    `You are SuperReps Coach — sharp, honest, brief.${profileLine}\n` +
    (stubPreamble[intent] ?? stubPreamble.chat) +
    `\n\nHARD FORMAT RULES (these override style):\n` +
    `- MAXIMUM 60 WORDS. Count them. Going over is a failure.\n` +
    `- 2-3 sentences. No more.\n` +
    `- Plain text only. No markdown, no bullets, no emoji.\n` +
    `- Start with the answer. No "Great question", no "Let me think", no recap of the user's message.\n` +
    `- When profile is relevant, reference it briefly. When not, ignore it.\n` +
    `- For analyze intent: if you can't help directly, one sentence saying so + one sentence offering a concrete alternative. Total 2 sentences MAX. Do not list everything you CAN do — name one.`;

  const stream = await groqClient.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    // Hard ceiling, deliberately tight. ~1.5 tokens/word → 90 tokens ≈ 60
    // words ≈ 3 short sentences. Forces brevity even when the model wants
    // to ramble. Going higher consistently produced 80-100 word replies in
    // testing despite explicit "≤60 words" instructions.
    max_tokens: 90,
    temperature: 0.3,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ],
  });

  let full = '';
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? '';
    full += delta;
    onChunk?.(full);
  }
  return full.trim();
}

export default function AITab() {
  const router = useRouter();
  const params = useLocalSearchParams<{ intent?: string }>();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { user } = useUserStore();
  const {
    builderState,
    pendingRoutine,
    errorMessage,
    generate,
    clearBuilder,
    setBuilderState,
  } = useAIStore();

  const chats = useChatStore(s => s.chats);
  const activeChatId = useChatStore(s => s.activeChatId);
  const activeMessages = useChatStore(s => s.activeMessages);
  const activeTokenCount = useChatStore(s => s.activeTokenCount);
  const activeIntent = useChatStore(s => s.activeIntent);
  const chatStoreError = useChatStore(s => s.error);
  const loadChats = useChatStore(s => s.loadChats);
  const openChat = useChatStore(s => s.openChat);
  const newChat = useChatStore(s => s.newChat);
  const appendMessage = useChatStore(s => s.appendMessage);
  const setTitle = useChatStore(s => s.setTitle);
  const setIntent = useChatStore(s => s.setIntent);
  const migrate = useChatStore(s => s.migrate);
  const exportChatAsMarkdown = useChatStore(s => s.exportChatAsMarkdown);

  const [prompt, setPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [aiStreamText, setAiStreamText] = useState('');
  const [llmError, setLlmError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [ambiguousClarify, setAmbiguousClarify] = useState(false);
  /**
   * Intent the user picked from the empty-state chips before sending anything.
   * No chat exists yet (we defer creation to the first send), so this is a
   * pure local hint that flows into handleSend / framing. Cleared on send.
   */
  const [pickedIntent, setPickedIntent] = useState<IntentName | null>(null);
  const lastGenerationPrompt = useRef('');
  const cachedExercises = useRef<Exercise[]>([]);
  const cachedUserContext = useRef<RoutineUserContext>({});
  const reduceMotion = useReduceMotion();

  /**
   * Lightweight profile context built once from `user`. Mirrored into the
   * build worker's `userContext` so `conductConversation` can skip questions
   * for fields we already know.
   */
  const generalContext: GeneralCoachContext = useMemo(() => ({
    goal: user?.goal ?? null,
    level: user?.level ?? null,
    equipment: user?.equipment ?? null,
  }), [user?.goal, user?.level, user?.equipment]);

  /** Resolve the intent that should drive UI framing and the next worker call. */
  const effectiveIntent: IntentName | 'unhinted' =
    activeIntent ?? pickedIntent ?? (params.intent as IntentName | undefined) ?? 'unhinted';

  const scrollToEnd = useCallback(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [builderState, activeMessages.length, pendingRoutine, aiStreamText, scrollToEnd]);

  // Load chat list once on mount.
  useEffect(() => {
    if (user) void loadChats();
  }, [user, loadChats]);

  // We deliberately do NOT create a chat just because the user landed on the
  // tab — that would litter the history drawer with empty "Untitled" rows
  // every time someone glances at the Coach. `handleSend` lazily creates a
  // chat on the first real send. The `?intent=` hint still flows through via
  // `params.intent` for intro framing and first-message routing.

  const resetSession = useCallback(() => {
    clearBuilder();
    setPrompt('');
    setAiStreamText('');
    setLlmError(null);
    setAmbiguousClarify(false);
    setPickedIntent(null);
    lastGenerationPrompt.current = '';
  }, [clearBuilder]);

  /** Open or start a chat from the sidebar. */
  const handleSelectChat = useCallback(async (id: string) => {
    resetSession();
    await openChat(id);
    setShowHistory(false);
  }, [openChat, resetSession]);

  const handleNewChat = useCallback(async () => {
    resetSession();
    await newChat();
    setShowHistory(false);
  }, [newChat, resetSession]);

  /** Copy a chat's transcript to the clipboard as markdown. */
  const handleExportChat = useCallback(async (id: string) => {
    const md = await exportChatAsMarkdown(id);
    if (!md) {
      Alert.alert("Couldn't export", 'Please try again in a moment.');
      return;
    }
    await Clipboard.setStringAsync(md);
    Alert.alert('Copied', 'Chat copied to clipboard as markdown.');
  }, [exportChatAsMarkdown]);

  /** Build-intent context loader. Only runs when we know we're building. */
  const loadExercisesAndContext = async () => {
    if (cachedExercises.current.length > 0) return;

    const [exercisesRes, sessionsRes, setsRes] = await Promise.all([
      supabase.from('exercises').select('*').limit(150),
      user ? supabase
        .from('workout_sessions')
        .select('started_at, routine_name, volume_total')
        .eq('user_id', user.id)
        .not('finished_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(7) : Promise.resolve({ data: null }),
      // workout_sets has no user_id — user attribution lives on the parent
      // workout_sessions row. Join via `workout_sessions!inner` and filter on
      // the joined column. Without `!inner` PostgREST returns sets with null
      // sessions, which `eq` then silently keeps.
      user ? supabase
        .from('workout_sets')
        .select('exercise_id, weight_kg, exercises(name, muscle_groups), workout_sessions!inner(user_id)')
        .eq('workout_sessions.user_id', user.id)
        .limit(500) : Promise.resolve({ data: null }),
    ]);

    cachedExercises.current = (exercisesRes.data ?? []) as Exercise[];

    // Seed userContext with profile so the build worker knows goal/level/
    // equipment from turn 1 and never asks for them.
    const userContext: RoutineUserContext = {
      goal: user?.goal ?? undefined,
      level: user?.level ?? undefined,
      equipment: user?.equipment ?? undefined,
    };
    if (sessionsRes.data?.length) {
      userContext.recentSessions = sessionsRes.data.map((s: any) => ({
        date: s.started_at.slice(0, 10),
        routineName: s.routine_name ?? 'Workout',
        volumeKg: Number(s.volume_total ?? 0),
      }));
    }
    if (setsRes.data?.length) {
      const muscleCounts: Record<string, number> = {};
      const exerciseMaxes: Record<string, { name: string; max: number }> = {};
      for (const row of setsRes.data as any[]) {
        const muscles: string[] = row.exercises?.muscle_groups ?? [];
        for (const m of muscles) muscleCounts[m] = (muscleCounts[m] ?? 0) + 1;
        const exId = row.exercise_id;
        const w = Number(row.weight_kg);
        if (!exerciseMaxes[exId] || w > exerciseMaxes[exId].max) {
          exerciseMaxes[exId] = { name: row.exercises?.name ?? exId, max: w };
        }
      }
      userContext.topMuscles = Object.entries(muscleCounts)
        .sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([muscle, count]) => ({ muscle, count }));
      userContext.topPRs = Object.values(exerciseMaxes)
        .sort((a, b) => b.max - a.max).slice(0, 5)
        .map(p => ({ exerciseName: p.name, weightKg: p.max }));
    }
    cachedUserContext.current = userContext;
  };

  /** Title an unnamed chat from the first user message. Truncated to 50 chars. */
  const ensureTitle = useCallback(async (firstUserText: string) => {
    if (!activeChatId) return;
    const existing = chats.find(c => c.id === activeChatId);
    if (existing?.title) return;
    const fallback = firstUserText.trim().slice(0, 50);
    if (fallback) void setTitle(activeChatId, fallback);
  }, [activeChatId, chats, setTitle]);

  /** Send a message. Handles classifier on turn 1, migration near limit, and
   *  routes to the appropriate worker for the chosen intent. */
  const handleSend = useCallback(async (overridePrompt?: string) => {
    const text = (overridePrompt ?? prompt).trim();
    if (!text) return;
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to chat with the coach.');
      return;
    }

    setPrompt('');
    setLlmError(null);
    setAmbiguousClarify(false);

    // Ensure we have an active chat. Pre-tap of an intent chip (pickedIntent)
    // wins over the URL ?intent= hint, since the user just expressed a fresh
    // intent within the surface itself.
    const seedIntent =
      pickedIntent ?? (params.intent as IntentName | undefined) ?? undefined;
    let chatId = activeChatId;
    if (!chatId) {
      const created = await newChat({ intentHint: seedIntent });
      chatId = created;
      if (!chatId) return; // chatStore already surfaced the error
    }

    // 2k cap (Q10 W1): if adding this message would cross the hard limit, migrate first.
    const projected = activeTokenCount + estimateTokens(text);
    if (projected >= CHAT_HARD_LIMIT) {
      const newId = await migrate();
      if (!newId) return; // migration failed; user can tap "New chat"
    }

    const newUserMsg: ChatMessage = { role: 'user', content: text };
    await appendMessage(newUserMsg);
    void ensureTitle(text);

    // First-turn intent resolution.
    let intent: IntentName | null = activeIntent;
    if (!intent) {
      // Trust an explicit hint (chip tap or ?intent= URL) over running the
      // classifier — the user already told us what they want.
      const hint = seedIntent;
      if (hint && ['build', 'analyze', 'readiness', 'form', 'chat'].includes(hint)) {
        intent = hint;
        void setIntent(hint);
      } else {
        setBuilderState('thinking');
        const cls = await classifyIntent(text);
        if (cls.ambiguous) {
          setBuilderState('idle');
          setAmbiguousClarify(true);
          await appendMessage({
            role: 'assistant',
            content: "Quick check — what would you like help with?",
          });
          return;
        }
        intent = cls.intent;
        void setIntent(cls.intent);
      }
    }
    // Clear the local picked-intent hint once consumed.
    setPickedIntent(null);

    setBuilderState(intent === 'build' ? 'thinking' : 'thinking');
    setAiStreamText('');

    try {
      if (intent === 'build') {
        await loadExercisesAndContext();
        const fullHistory: ChatMessage[] = [...activeMessages, newUserMsg];
        const result = await conductConversation(
          fullHistory,
          cachedExercises.current,
          cachedUserContext.current,
          (chunk) => setAiStreamText(chunk),
        );
        setAiStreamText('');

        if (result.type === 'message') {
          await appendMessage({ role: 'assistant', content: result.text });
          setBuilderState('chatting');
        } else {
          const confirmText = result.type === 'import'
            ? "Got it — importing your workout now. Matching exercises from your library…"
            : "Perfect, I have everything I need. Building your programme now…";
          await appendMessage({ role: 'assistant', content: confirmText });
          lastGenerationPrompt.current = result.prompt;
          await generate(
            result.prompt,
            cachedExercises.current,
            cachedUserContext.current,
            result.type === 'import',
          );
        }
      } else {
        // analyze / readiness / form / chat — general coach reply.
        const fullHistory: ChatMessage[] = [...activeMessages, newUserMsg];
        const text = await callGeneralCoach(
          fullHistory,
          intent,
          generalContext,
          (chunk) => setAiStreamText(chunk),
        );
        setAiStreamText('');
        await appendMessage({ role: 'assistant', content: text });
        setBuilderState('chatting');
      }
    } catch (e) {
      setAiStreamText('');
      setBuilderState('idle');
      setLlmError(
        'Your coach is offline right now. Please try again in a moment.',
      );
    }
  }, [
    prompt, user, activeChatId, activeTokenCount, activeIntent, activeMessages,
    params.intent, pickedIntent, newChat, migrate, appendMessage, ensureTitle, setIntent,
    setBuilderState, generate, generalContext,
  ]);

  /** Tap-through for the clarification chips. */
  const handleClarify = useCallback(async (chosen: IntentName) => {
    if (!activeChatId) return;
    await setIntent(chosen);
    setAmbiguousClarify(false);
    // Re-run with the same last user message — find it in the transcript.
    const lastUser = [...activeMessages].reverse().find(m => m.role === 'user');
    if (lastUser) void handleSend(lastUser.content);
  }, [activeChatId, activeMessages, setIntent, handleSend]);

  /** Save a generated routine (build intent only). Unchanged from previous AI tab. */
  const handleSave = async () => {
    if (!pendingRoutine || !user) return;
    setSaving(true);
    const promptForSave = lastGenerationPrompt.current;
    try {
      const { data: routineRow, error: routineErr } = await supabase
        .from('routines')
        .insert({
          user_id: user.id,
          name: pendingRoutine.name,
          description: pendingRoutine.description,
          created_by_ai: true,
          ai_prompt: promptForSave,
        })
        .select()
        .single();
      if (routineErr) throw routineErr;

      for (const day of pendingRoutine.days) {
        const { data: dayRow, error: dayErr } = await supabase
          .from('routine_days')
          .insert({ routine_id: routineRow.id, day_index: day.day_index, name: day.name })
          .select()
          .single();
        if (dayErr) throw dayErr;

        for (let i = 0; i < day.exercises.length; i++) {
          const ex = day.exercises[i];
          const { data: exerciseRow } = await supabase
            .from('exercises')
            .select('id')
            .eq('slug', ex.exercise_slug)
            .single();
          if (!exerciseRow) continue;
          await supabase.from('routine_exercises').insert({
            routine_day_id: dayRow.id,
            exercise_id: exerciseRow.id,
            order_index: i,
            sets_config: { sets: ex.sets, rep_range: ex.rep_range, rir: ex.rir },
            rest_seconds: ex.rest_seconds,
            notes: ex.notes ?? null,
          });
        }
      }

      clearBuilder();
      Alert.alert('Saved!', `"${pendingRoutine.name}" added to your routines.`, [
        { text: 'Go to Workouts', onPress: () => router.push('/(tabs)/workouts') },
        { text: 'OK' },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to save routine. Please try again.');
    }
    setSaving(false);
  };

  const isProcessing = builderState === 'thinking' || builderState === 'loading';
  const showRoutineCard = builderState === 'preview' && pendingRoutine;
  const showSoftLimit =
    activeTokenCount >= CHAT_SOFT_LIMIT && activeTokenCount < CHAT_HARD_LIMIT;

  const introCopy = INTROS[effectiveIntent] ?? INTROS.unhinted;
  const subtitle = useMemo(() => {
    const i = activeIntent ?? pickedIntent ?? (params.intent as IntentName | undefined);
    if (i === 'build')     return 'Building a routine';
    if (i === 'analyze')   return 'Reviewing your training';
    if (i === 'readiness') return "Today's session";
    if (i === 'form')      return 'Form & technique';
    return 'Your training coach';
  }, [activeIntent, pickedIntent, params.intent]);

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" />
      <View style={[s.flex, { backgroundColor: SCREEN_BG }]}>
        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={s.pageTitle}>Coach</Text>
            <Text style={s.modelLine}>{subtitle}</Text>
          </View>
          <View style={s.headerActions}>
            <TouchableOpacity
              testID="coach-history-btn"
              onPress={() => setShowHistory(true)}
              style={s.iconBtn}
              hitSlop={10}
            >
              <Ionicons name="time-outline" size={20} color={COLORS.ink2} />
            </TouchableOpacity>
            <TouchableOpacity
              testID="coach-new-chat-btn"
              onPress={handleNewChat}
              style={s.iconBtn}
              hitSlop={10}
            >
              <Ionicons name="add" size={22} color={COLORS.ink2} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={s.flex}
          contentContainerStyle={[s.scrollContent, { paddingBottom: 12 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToEnd}
        >
          {/* Intent-aware intro */}
          {activeMessages.length === 0 && (
            <Animated.View
              entering={reduceMotion ? FadeIn.duration(1) : FadeInDown.duration(250).springify()}
              style={s.aiBubbleWrap}
            >
              <View style={s.aiBubble}>
                <Text style={s.aiBubbleText}>{introCopy}</Text>
              </View>
            </Animated.View>
          )}

          {/*
           * Intent-clarify chips, shown on the empty state when the intent
           * isn't already known. Gives the user an at-a-glance menu of what
           * the coach handles, and a one-tap shortcut that skips the
           * classifier round-trip on the first message.
           *
           * Hidden once a message exists, an intent is set, or an entry-point
           * hint (`?intent=...`) is already biasing the surface.
           */}
          {activeMessages.length === 0 && effectiveIntent === 'unhinted' && (
            <Animated.View
              entering={reduceMotion ? FadeIn.duration(1) : FadeInDown.duration(280).springify()}
              style={s.clarifyWrap}
            >
              {CLARIFICATION_CHIPS.map(chip => (
                <TouchableOpacity
                  key={chip.intent}
                  testID={`coach-intro-chip-${chip.intent}`}
                  style={s.clarifyChip}
                  onPress={() => setPickedIntent(chip.intent)}
                  activeOpacity={0.8}
                >
                  <Text style={s.clarifyChipText}>{chip.label}</Text>
                </TouchableOpacity>
              ))}
            </Animated.View>
          )}

          {/* Conversation transcript */}
          {activeMessages.map((msg, i) =>
            msg.role === 'user' ? (
              <Animated.View
                key={i}
                entering={reduceMotion ? FadeIn.duration(1) : FadeInDown.duration(220).springify()}
                style={s.userBubbleWrap}
              >
                <View style={s.userBubble}>
                  <Text style={s.userBubbleText}>{msg.content}</Text>
                </View>
              </Animated.View>
            ) : (
              <Animated.View
                key={i}
                entering={reduceMotion ? FadeIn.duration(1) : FadeInDown.duration(220).springify()}
                style={s.aiBubbleWrap}
              >
                <View style={s.aiBubble}>
                  <Text style={s.aiBubbleText}>{msg.content}</Text>
                </View>
              </Animated.View>
            ),
          )}

          {/* Ambiguous-intent clarification chips */}
          {ambiguousClarify && (
            <Animated.View
              entering={reduceMotion ? FadeIn.duration(1) : FadeInDown.duration(250).springify()}
              style={s.clarifyWrap}
            >
              {CLARIFICATION_CHIPS.map(chip => (
                <TouchableOpacity
                  key={chip.intent}
                  style={s.clarifyChip}
                  onPress={() => handleClarify(chip.intent)}
                  activeOpacity={0.8}
                >
                  <Text style={s.clarifyChipText}>{chip.label}</Text>
                </TouchableOpacity>
              ))}
            </Animated.View>
          )}

          {/* Streaming AI reply */}
          {(builderState === 'thinking' || builderState === 'loading') ? (
            <Animated.View
              entering={reduceMotion ? FadeIn.duration(1) : FadeInDown.duration(250).springify()}
              style={s.aiBubbleWrap}
            >
              <View style={s.aiBubble}>
                {aiStreamText ? (
                  <Text style={s.aiBubbleText}>{aiStreamText}</Text>
                ) : (
                  <View style={s.typingBubble}>
                    <ActivityIndicator color={COLORS.ink2} size="small" />
                    <Text style={s.typingText}>
                      {builderState === 'loading' ? 'Building your programme…' : 'Thinking…'}
                    </Text>
                  </View>
                )}
              </View>
            </Animated.View>
          ) : null}

          {/* LLM-down error (Q11 simplified) */}
          {llmError ? (
            <Animated.View
              entering={reduceMotion ? FadeIn.duration(1) : FadeInDown.duration(250).springify()}
              style={s.aiBubbleWrap}
            >
              <View style={[s.aiBubble, s.errorBubble]}>
                <Text style={s.errorBubbleText}>{llmError}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setLlmError(null);
                    const lastUser = [...activeMessages].reverse().find(m => m.role === 'user');
                    if (lastUser) void handleSend(lastUser.content);
                  }}
                  style={s.retryChip}
                >
                  <Text style={s.retryChipText}>Retry</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          ) : null}

          {/* Chat-store-level error (load/save) */}
          {chatStoreError && !llmError ? (
            <View style={[s.aiBubble, s.errorBubble, { marginTop: 8 }]}>
              <Text style={s.errorBubbleText}>{chatStoreError}</Text>
            </View>
          ) : null}

          {/* Build-intent generation result */}
          {showRoutineCard && pendingRoutine ? (
            <Animated.View
              entering={reduceMotion ? FadeIn.duration(1) : FadeInDown.duration(300).springify()}
            >
              <RoutineChatCard
                routine={pendingRoutine}
                onSave={handleSave}
                onDiscard={resetSession}
                saving={saving}
              />
            </Animated.View>
          ) : null}

          {/* Build-intent generation failed via the routine builder pipeline */}
          {builderState === 'error' && errorMessage ? (
            <Animated.View
              entering={reduceMotion ? FadeIn.duration(1) : FadeInDown.duration(250).springify()}
              style={s.aiBubbleWrap}
            >
              <View style={[s.aiBubble, s.errorBubble]}>
                <Text style={s.errorBubbleText}>{errorMessage}</Text>
                <TouchableOpacity onPress={resetSession} style={s.retryChip}>
                  <Text style={s.retryChipText}>Try again</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          ) : null}
        </ScrollView>

        {/* Soft-limit banner (Q10 W1) */}
        {showSoftLimit ? (
          <View style={s.softLimitBanner}>
            <Ionicons name="information-circle-outline" size={14} color={COLORS.amber} />
            <Text style={s.softLimitText}>
              You're near this chat's limit — your next message will start a new chat.
            </Text>
          </View>
        ) : null}

        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {/* Quick-prompt chips only shown when build intent on a fresh chat */}
          {(effectiveIntent === 'build') && activeMessages.length === 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chipsRow}
              keyboardShouldPersistTaps="handled"
            >
              {QUICK_PROMPTS_BUILD.map((chip) => (
                <TouchableOpacity
                  key={chip.label}
                  style={s.chip}
                  onPress={() => setPrompt(chip.prompt)}
                  activeOpacity={0.75}
                >
                  <Text style={s.chipText}>{chip.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={s.composerRow}>
            <TextInput
              testID="coach-composer-input"
              style={s.composerInput}
              placeholder={activeMessages.length === 0 ? 'Tell me what you want to work on…' : 'Reply…'}
              placeholderTextColor={COLORS.ink3}
              value={prompt}
              onChangeText={setPrompt}
              multiline
              maxLength={4000}
              editable={!isProcessing && builderState !== 'preview'}
            />
            <TouchableOpacity
              testID="coach-send-btn"
              style={[
                s.sendBtn,
                (!prompt.trim() || isProcessing || builderState === 'preview') && s.sendBtnDisabled,
              ]}
              onPress={() => void handleSend()}
              disabled={!prompt.trim() || isProcessing || builderState === 'preview'}
              activeOpacity={0.85}
            >
              {isProcessing ? (
                <ActivityIndicator color={SCREEN_BG} size="small" />
              ) : (
                <Ionicons name="arrow-forward" size={22} color={SCREEN_BG} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Chat history drawer */}
      <Modal
        visible={showHistory}
        animationType="slide"
        transparent
        onRequestClose={() => setShowHistory(false)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setShowHistory(false)}>
          <Pressable style={[s.modalSheet, { paddingTop: insets.top + 12 }]} onPress={() => {}}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Your chats</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={COLORS.ink2} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.newChatBtn} onPress={handleNewChat} activeOpacity={0.85}>
              <Ionicons name="add-circle-outline" size={18} color={COLORS.ink} />
              <Text style={s.newChatBtnText}>New chat</Text>
            </TouchableOpacity>

            <ScrollView style={s.sheetList} contentContainerStyle={{ paddingBottom: 24 }}>
              {chats.length === 0 ? (
                <Text style={s.sheetEmpty}>
                  Your previous chats will appear here.
                </Text>
              ) : (
                chats.map(c => (
                  <View key={c.id} style={[s.chatRow, c.id === activeChatId && s.chatRowActive]}>
                    {/* Tap the body to open; the export button is its own
                        target so the user can copy without changing focus. */}
                    <TouchableOpacity
                      style={s.chatRowBody}
                      onPress={() => void handleSelectChat(c.id)}
                      activeOpacity={0.7}
                    >
                      <View style={s.chatRowIcon}>
                        <Ionicons
                          name={c.summary ? 'archive-outline' : 'chatbubble-outline'}
                          size={16}
                          color={COLORS.ink3}
                        />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.chatRowTitle} numberOfLines={1}>
                          {c.title ?? 'Untitled chat'}
                        </Text>
                        <Text style={s.chatRowMeta}>
                          {c.intent_hint ?? 'general'} ·{' '}
                          {new Date(c.updated_at).toLocaleDateString()}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID={`coach-export-${c.id}`}
                      style={s.chatRowAction}
                      onPress={() => void handleExportChat(c.id)}
                      hitSlop={10}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="share-outline" size={18} color={COLORS.ink3} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function RoutineChatCard({
  routine,
  onSave,
  onDiscard,
  saving,
}: {
  routine: AIRoutineJSON;
  onSave: () => void;
  onDiscard: () => void;
  saving: boolean;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <View style={s.routineCard}>
      <View style={s.routineCardHeader}>
        <Text style={s.routineModelTag}>SUPERREPS COACH</Text>
        <View style={s.daysBadge}>
          <Text style={s.daysBadgeText}>{routine.days_per_week}d/wk</Text>
        </View>
      </View>
      <Text style={s.routineCardTitle}>{routine.name}</Text>
      <Text style={s.routineCardDesc} numberOfLines={3}>
        {routine.description}
      </Text>

      <View style={s.dayList}>
        {routine.days.map((day, i) => (
          <View key={`${day.day_index}-${i}`}>
            {i > 0 ? <View style={s.dayDivider} /> : null}
            <TouchableOpacity
              style={s.dayRow}
              activeOpacity={0.75}
              onPress={() => setExpanded(expanded === day.day_index ? null : day.day_index)}
            >
              <View style={s.dayBadge}>
                <Text style={s.dayBadgeText}>{dayBadgeLabel(day)}</Text>
              </View>
              <View style={s.dayRowText}>
                <Text style={s.dayRowTitle} numberOfLines={1}>
                  {day.name}
                </Text>
                <Text style={s.dayRowSub}>
                  {day.exercises.length > 0 ? `${day.exercises.length} exercises` : 'Rest day'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.ink3} />
            </TouchableOpacity>
            {expanded === day.day_index && day.exercises.length > 0 ? (
              <View style={s.dayExpanded}>
                {day.exercises.map((ex, j) => (
                  <View key={j}>
                    {j > 0 ? <View style={s.exDivider} /> : null}
                    <View style={s.exRow}>
                      <Text style={s.exName} numberOfLines={2}>
                        {ex.exercise_slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </Text>
                      <Text style={s.exSets}>
                        {ex.sets}×{ex.rep_range}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </View>

      {routine.progression ? (
        <View style={s.progressionBlock}>
          <Text style={s.progressionLabel}>Progression</Text>
          <Text style={s.progressionBody}>{routine.progression}</Text>
        </View>
      ) : null}

      <View style={s.cardActions}>
        <TouchableOpacity
          onPress={onSave}
          disabled={saving}
          style={s.saveRoutineBtn}
          activeOpacity={0.88}
        >
          {saving ? (
            <ActivityIndicator color={SCREEN_BG} />
          ) : (
            <Text style={s.saveRoutineBtnText}>Save Routine</Text>
          )}
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={onDiscard} style={s.discardLink} hitSlop={12}>
        <Text style={s.discardLinkText}>Discard</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: SCREEN_BG },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  pageTitle: { fontSize: 26, fontWeight: '800', color: COLORS.ink, letterSpacing: -0.3 },
  modelLine: { fontSize: 12, color: COLORS.ink3, marginTop: 4, letterSpacing: 0.2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: AI_BUBBLE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },
  aiBubbleWrap: { alignItems: 'flex-start', marginBottom: 12 },
  aiBubble: {
    maxWidth: '92%',
    backgroundColor: AI_BUBBLE,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  aiBubbleText: { fontSize: 15, color: COLORS.ink2, lineHeight: 22 },
  userBubbleWrap: { alignItems: 'flex-end', marginBottom: 12 },
  userBubble: {
    maxWidth: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  userBubbleText: { fontSize: 15, color: SCREEN_BG, lineHeight: 22, fontWeight: '500' },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typingText: { fontSize: 14, color: COLORS.ink3, fontWeight: '600' },
  errorBubble: { borderColor: 'rgba(248,113,113,0.35)' },
  errorBubbleText: { color: COLORS.red, fontSize: 14, lineHeight: 20 },
  retryChip: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(248,113,113,0.15)',
  },
  retryChipText: { color: COLORS.red, fontSize: 13, fontWeight: '700' },
  clarifyWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    marginLeft: 4,
  },
  clarifyChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: AI_BUBBLE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(96,165,250,0.35)',
  },
  clarifyChipText: { fontSize: 13, fontWeight: '600', color: COLORS.blue },
  softLimitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(252,211,77,0.10)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(252,211,77,0.30)',
  },
  softLimitText: { flex: 1, fontSize: 12, color: COLORS.amber, lineHeight: 16 },
  routineCard: {
    backgroundColor: AI_CARD,
    borderRadius: 20,
    padding: 18,
    marginTop: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.borderMid,
  },
  routineCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  routineModelTag: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.ink3,
    letterSpacing: 0.8,
  },
  daysBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  daysBadgeText: { fontSize: 11, fontWeight: '800', color: COLORS.ink2, letterSpacing: 0.3 },
  routineCardTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.ink,
    letterSpacing: -0.8,
    marginBottom: 6,
  },
  routineCardDesc: { fontSize: 13, color: COLORS.ink3, lineHeight: 19 },
  dayList: { marginTop: 16, borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.2)' },
  dayDivider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
  },
  dayBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeText: { fontSize: 11, fontWeight: '800', color: COLORS.ink, letterSpacing: 0.2 },
  dayRowText: { flex: 1, minWidth: 0 },
  dayRowTitle: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  dayRowSub: { fontSize: 12, color: COLORS.ink3, marginTop: 2 },
  dayExpanded: { backgroundColor: 'rgba(0,0,0,0.25)', paddingBottom: 4 },
  exDivider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginLeft: 68 },
  exRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    paddingLeft: 68,
  },
  exName: { flex: 1, fontSize: 13, color: COLORS.ink2, paddingRight: 8 },
  exSets: { fontSize: 13, fontWeight: '700', color: COLORS.blue },
  progressionBlock: { marginTop: 14, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  progressionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.ink3,
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  progressionBody: { fontSize: 13, color: COLORS.ink2, lineHeight: 19 },
  cardActions: { marginTop: 18, gap: 10 },
  saveRoutineBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveRoutineBtnText: { color: SCREEN_BG, fontWeight: '800', fontSize: 16 },
  discardLink: { alignItems: 'center', marginTop: 8, paddingVertical: 6 },
  discardLinkText: { fontSize: 13, color: COLORS.ink3, fontWeight: '600' },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    backgroundColor: SCREEN_BG,
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  chipsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 10, paddingHorizontal: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: AI_BUBBLE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.ink2 },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 4 },
  composerInput: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderRadius: 16,
    backgroundColor: AI_BUBBLE,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.ink,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: COLORS.ink4, opacity: 0.45 },

  // Chat history modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: SCREEN_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 24,
    maxHeight: '85%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.borderMid,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 14,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: COLORS.ink },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: AI_BUBBLE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    marginBottom: 14,
  },
  newChatBtnText: { color: COLORS.ink, fontSize: 14, fontWeight: '700' },
  sheetList: { flex: 1 },
  sheetEmpty: {
    color: COLORS.ink3,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 32,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
  chatRowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 6,
    minWidth: 0,
  },
  chatRowActive: { backgroundColor: AI_BUBBLE },
  chatRowAction: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  chatRowIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatRowTitle: { fontSize: 14, fontWeight: '600', color: COLORS.ink },
  chatRowMeta: { fontSize: 12, color: COLORS.ink3, marginTop: 2, textTransform: 'capitalize' },
});
