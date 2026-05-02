import Groq from 'groq-sdk';
import type { ActiveExercise } from '@/types';

const client = new Groq({
  apiKey: process.env.EXPO_PUBLIC_GROQ_API_KEY?.trim() || 'gsk_placeholder_for_build_without_env',
  dangerouslyAllowBrowser: true,
});

const COACH_MODEL = 'llama-3.1-8b-instant';

export type CoachTriggerEvent = 'WEIGHT_DROP' | 'THIRD_SET' | 'HALFWAY';

export interface UserProfile {
  name?: string;
  goal?: string;
  level?: string;
}

export interface RecentSessionSummary {
  date: string;
  volume: number;
  exercises: string[];
}

export interface SessionState {
  exercises: ActiveExercise[];
  totalSets: number;
  completedSets: number;
}

export interface ExerciseHistory {
  exerciseId: string;
  lastWeightKg: number;
}

// ── Trigger detection ─────────────────────────────────────────

export function detectTrigger(
  exerciseId: string,
  setIndex: number,
  currentWeightKg: number,
  state: SessionState,
  history: ExerciseHistory[],
): CoachTriggerEvent | null {
  // HALFWAY: exactly when half of total sets are done
  if (state.totalSets > 0 && state.completedSets === Math.floor(state.totalSets / 2)) {
    return 'HALFWAY';
  }

  // THIRD_SET: completing the 3rd set (index 2) of this exercise
  if (setIndex === 2) {
    return 'THIRD_SET';
  }

  // WEIGHT_DROP: current weight is less than last session for this exercise
  const hist = history.find(h => h.exerciseId === exerciseId);
  if (hist && currentWeightKg > 0 && currentWeightKg < hist.lastWeightKg) {
    return 'WEIGHT_DROP';
  }

  return null;
}

// ── Pre-generation ────────────────────────────────────────────

export async function generateCoachingQueue(
  routineName: string | null,
  userProfile: UserProfile,
  recentSessions: RecentSessionSummary[],
): Promise<string[]> {
  const sessionSummary = recentSessions.length
    ? recentSessions.slice(-3).map(s => `${s.date}: ${s.volume}kg volume`).join(', ')
    : 'no recent sessions';

  const prompt = `You are a supportive, concise fitness coach.
Generate exactly 6 short coaching messages (1–2 sentences each) for a workout session.
User: ${userProfile.name ?? 'Athlete'}, goal: ${userProfile.goal ?? 'general fitness'}, level: ${userProfile.level ?? 'intermediate'}.
Routine: ${routineName ?? 'general workout'}.
Recent training: ${sessionSummary}.
Output only a JSON array of strings: ["message1", "message2", ...]`;

  try {
    const res = await client.chat.completions.create({
      model: COACH_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
      temperature: 0.8,
    });
    const text = res.choices[0]?.message?.content ?? '[]';
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed.filter((m): m is string => typeof m === 'string') : [];
  } catch {
    return [];
  }
}

// ── Trigger-based ─────────────────────────────────────────────

export async function generateTriggerMessage(
  event: CoachTriggerEvent,
  currentSession: SessionState,
  exerciseHistory: ExerciseHistory[],
): Promise<string> {
  const contextMap: Record<CoachTriggerEvent, string> = {
    WEIGHT_DROP: 'The user lowered their weight on a set compared to last session. Acknowledge it positively — lighter weight with better form is smart training.',
    THIRD_SET: 'The user just completed their 3rd set. They are fatigued but pushing through. Give a focused, energetic push.',
    HALFWAY: `The user is halfway through the workout (${currentSession.completedSets} of ${currentSession.totalSets} sets). Celebrate progress and motivate them to finish strong.`,
  };

  const prompt = `You are a fitness coach mid-workout. Write a single short coaching message (1 sentence, max 20 words).
Context: ${contextMap[event]}
Message:`;

  try {
    const res = await client.chat.completions.create({
      model: COACH_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 60,
      temperature: 0.9,
    });
    return res.choices[0]?.message?.content?.trim() ?? '';
  } catch {
    return '';
  }
}
