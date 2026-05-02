import Groq from 'groq-sdk';
import { z } from 'zod';
import type { AIRoutineJSON, Exercise } from '@/types';

const client = new Groq({
  apiKey: process.env.EXPO_PUBLIC_GROQ_API_KEY?.trim() || 'gsk_placeholder_for_build_without_env',
  dangerouslyAllowBrowser: true,
});

// Models
const ROUTINE_MODEL = 'llama-3.3-70b-versatile';   // best quality for programme generation
const COACH_MODEL   = 'llama-3.1-8b-instant';       // fast + cheap for real-time coaching

// Zod schema for AI routine output validation
const AIRoutineSchema = z.object({
  name: z.string(),
  description: z.string(),
  days_per_week: z.number().int().min(1).max(7),
  goal: z.enum(['hypertrophy', 'strength', 'endurance', 'recomp']),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  days: z.array(z.object({
    day_index: z.number().int().min(0),
    name: z.string(),
    exercises: z.array(z.object({
      exercise_slug: z.string(),
      sets: z.number().int().min(1).max(10),
      rep_range: z.string(),
      rir: z.number().int().min(0).max(4),
      rest_seconds: z.number().int().min(30).max(300),
      notes: z.string().optional(),
    })),
  })),
  progression: z.string(),
  deload_week: z.number().int().min(4).max(12),
});

export type RoutineUserContext = {
  goal?: string;
  level?: string;
  equipment?: string[];
  recentSessions?: { date: string; routineName: string; volumeKg: number }[];
  topMuscles?: { muscle: string; count: number }[];
  topPRs?: { exerciseName: string; weightKg: number }[];
};

export async function generateRoutine(
  userPrompt: string,
  exercises: Exercise[],
  onChunk?: (text: string) => void,
  userContext?: RoutineUserContext,
): Promise<AIRoutineJSON> {
  const exerciseList = exercises
    .map(e => `${e.slug}|${e.name}|${e.category}|${e.equipment.join(',')}`)
    .join('\n');

  const contextLines: string[] = [];
  if (userContext?.goal) contextLines.push(`Goal: ${userContext.goal}`);
  if (userContext?.level) contextLines.push(`Training level: ${userContext.level}`);
  if (userContext?.equipment?.length) contextLines.push(`Equipment: ${userContext.equipment.join(', ')}`);
  if (userContext?.recentSessions?.length) {
    contextLines.push('Recent sessions (last 7):');
    userContext.recentSessions.slice(0, 7).forEach(s =>
      contextLines.push(`  ${s.date}: ${s.routineName} — ${s.volumeKg}kg`));
  }
  if (userContext?.topMuscles?.length) {
    contextLines.push(`Top trained muscles: ${userContext.topMuscles.slice(0, 5).map(m => m.muscle).join(', ')}`);
  }
  if (userContext?.topPRs?.length) {
    contextLines.push(`Top PRs: ${userContext.topPRs.slice(0, 5).map(p => `${p.exerciseName} ${p.weightKg}kg`).join(', ')}`);
  }
  const contextBlock = contextLines.length > 0 ? `\nUser profile:\n${contextLines.join('\n')}\n` : '';

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `You are SuperReps AI — an expert personal trainer.
Generate a complete workout programme as valid JSON.
Rules:
- Use progressive overload principles
- Balance muscle groups appropriately
- Include rest days (exercises array empty, name = "Rest")
- Only use exercise slugs from the provided library
- Return ONLY valid JSON — no markdown, no explanation

JSON schema:
{
  "name": string,
  "description": string,
  "days_per_week": number,
  "goal": "hypertrophy"|"strength"|"endurance"|"recomp",
  "level": "beginner"|"intermediate"|"advanced",
  "days": [{ "day_index": number, "name": string, "exercises": [{ "exercise_slug": string, "sets": number, "rep_range": string, "rir": number, "rest_seconds": number, "notes"?: string }] }],
  "progression": string,
  "deload_week": number
}`,
    },
    {
      role: 'user',
      content: `Exercise library (slug|name|category|equipment):\n${exerciseList}\n${contextBlock}\nGenerate a workout programme for: ${userPrompt}`,
    },
  ];

  let fullText = '';

  const stream = await client.chat.completions.create({
    model: ROUTINE_MODEL,
    messages,
    max_tokens: 3000,
    temperature: 0.4,
    stream: true,
    response_format: { type: 'json_object' },
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? '';
    fullText += delta;
    onChunk?.(fullText);
  }

  const parsed = AIRoutineSchema.safeParse(JSON.parse(fullText));
  if (!parsed.success) {
    console.error('AI validation error:', parsed.error);
    throw new Error('AI returned invalid routine structure. Please try again.');
  }
  return parsed.data as AIRoutineJSON;
}

export async function getCoachAdvice(
  exerciseName: string,
  currentSets: { weight_kg: number; reps: number; rpe: number | null }[],
  history: { weight_kg: number; reps: number }[],
  onChunk: (text: string) => void,
): Promise<void> {
  const setsDesc = currentSets
    .map((s, i) => `Set ${i + 1}: ${s.weight_kg}kg × ${s.reps} reps${s.rpe ? ` @ RPE ${s.rpe}` : ''}`)
    .join(', ');
  const histDesc = history.slice(-4).map(s => `${s.weight_kg}kg × ${s.reps}`).join(', ');

  const stream = await client.chat.completions.create({
    model: COACH_MODEL,
    max_tokens: 150,
    temperature: 0.7,
    stream: true,
    messages: [
      {
        role: 'user',
        content: `Exercise: ${exerciseName}
Today's sets: ${setsDesc}
Recent history: ${histDesc || 'no history yet'}
Give a short practical tip for my next set — weight suggestion, form cue, or motivation. 2 sentences max.`,
      },
    ],
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? '';
    if (delta) onChunk(delta);
  }
}

export async function getWeeklyReview(
  sessions: { date: string; exercises: string[]; volume: number }[],
): Promise<string> {
  const summary = sessions
    .map(s => `${s.date}: ${s.exercises.join(', ')} — volume ${s.volume}kg`)
    .join('\n');

  const completion = await client.chat.completions.create({
    model: ROUTINE_MODEL,
    max_tokens: 400,
    temperature: 0.5,
    messages: [
      {
        role: 'system',
        content:
          'You are a personal trainer. Respond with plain text only — no markdown, no bullet symbols, no headings. At most 3 short sentences for a mobile app card.',
      },
      {
        role: 'user',
        content: `Past week of training:\n${summary}\n\nGive one concise weekly takeaway: volume trend, progression, and one actionable tip (rest or next session).`,
      },
    ],
  });

  return completion.choices[0]?.message?.content ?? '';
}
