import Groq from 'groq-sdk';
import { z } from 'zod';
import type { AIRoutineJSON, Exercise } from '@/types';

const client = new Groq({
  apiKey: process.env.EXPO_PUBLIC_GROQ_API_KEY?.trim() || 'gsk_placeholder_for_build_without_env',
  dangerouslyAllowBrowser: true,
});

export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type ConversationResult =
  | { type: 'message'; text: string }
  | { type: 'generate'; prompt: string }
  | { type: 'import'; prompt: string };

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

export async function conductConversation(
  messages: ChatMessage[],
  exercises: Exercise[],
  userContext?: RoutineUserContext,
  onChunk?: (text: string) => void,
): Promise<ConversationResult> {
  const exerciseList = exercises
    .map(e => `${e.slug}|${e.name}|${e.category}`)
    .join('\n');

  const systemPrompt = `You are SuperReps AI — a personal trainer having a focused conversation to build the perfect workout programme.

IMPORT DETECTION (check user's FIRST message only):
If the message contains a structured workout copied from another fitness app (exercise names with sets/reps listed out), respond ONLY with valid JSON:
{"type":"import","prompt":"<copy the user's message verbatim>"}

QUESTIONNAIRE MODE (for fresh builds):
Ask exactly one focused question per turn. Collect in this order:
1. Goal (strength, hypertrophy/muscle growth, fat loss, general fitness)
2. Days per week available for training
3. Equipment (full gym, dumbbells only, home, bodyweight only)
4. Experience level (beginner, intermediate, advanced)
5. Specific exercises they MUST include — ask this explicitly, don't assume
6. Exercises to avoid (injuries, dislikes)

When you have enough to build a complete programme (at minimum: goal + days + exercise preferences), respond ONLY with valid JSON:
{"type":"generate","prompt":"<comprehensive programme description including every collected detail: goal, days, equipment, level, required exercises, exercises to avoid>"}

Otherwise respond with your next question as plain conversational text (1-3 sentences max). Do NOT include JSON in conversational replies.

Available exercise library (slug|name|category):
${exerciseList}`;

  const groqMessages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  let fullText = '';
  const stream = await client.chat.completions.create({
    model: ROUTINE_MODEL,
    messages: groqMessages,
    max_tokens: 600,
    temperature: 0.5,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? '';
    fullText += delta;
    onChunk?.(fullText);
  }

  const trimmed = fullText.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.type === 'import' && parsed.prompt) return { type: 'import', prompt: parsed.prompt };
      if (parsed.type === 'generate' && parsed.prompt) return { type: 'generate', prompt: parsed.prompt };
    } catch {
      // not valid JSON — treat as message
    }
  }
  return { type: 'message', text: trimmed };
}

export async function generateRoutine(
  userPrompt: string,
  exercises: Exercise[],
  onChunk?: (text: string) => void,
  userContext?: RoutineUserContext,
  importMode = false,
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

  const importSystemPrompt = `You are SuperReps AI — an expert personal trainer.
The user is importing a workout from another app. Create an EXACT copy.

CRITICAL RULES:
- Preserve every exercise, the exact order, sets, and rep ranges as given
- Map each exercise name to the closest matching slug from the provided library
- Do NOT add or remove exercises, do NOT reorder them
- Do NOT apply progressive overload or muscle-balance logic — copy faithfully
- Include rest days (empty exercises array, name = "Rest") where indicated
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
}`;

  const standardSystemPrompt = `You are SuperReps AI — an expert personal trainer.
Generate a complete workout programme as valid JSON.
Rules:
- Follow the user's requested exercises exactly — do NOT substitute or omit any exercise they specified
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
}`;

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: importMode ? importSystemPrompt : standardSystemPrompt,
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

// ── Readiness / home-screen status message ───────────────────────────────────

export interface ReadinessContext {
  todayLabel: string;            // e.g. "Sunday, May 17"
  sessions: {
    date: string;                // YYYY-MM-DD
    routineName: string | null;
    volume: number;              // kg
    durationMinutes: number;
  }[];
  scheduledDays: {               // all weekdays the routine covers
    weekdayName: string;         // e.g. "Monday"
    dayName: string;             // e.g. "Push Day"
    muscleGroups: string[];
  }[];
  weekDaysTrained: string[];     // YYYY-MM-DD of sessions this Mon–today
  weekDaysScheduled: string[];   // YYYY-MM-DD of scheduled days this Mon–today
}

/** Returns { label, color } where color is one of: green | amber | blue | muted */
export async function getReadinessMessage(
  ctx: ReadinessContext,
): Promise<{ label: string; color: 'green' | 'amber' | 'blue' | 'muted' }> {
  // Build a compact plain-text brief for the LLM
  const last = ctx.sessions[0];
  const lastLine = last
    ? `Last workout: ${last.routineName ?? 'Ad-hoc'} on ${last.date} — ${last.volume}kg volume, ${last.durationMinutes} min`
    : 'No previous workouts logged.';

  const weekTrained = ctx.weekDaysTrained.length;
  const weekScheduled = ctx.weekDaysScheduled.length;
  const skippedDates = ctx.weekDaysScheduled.filter(d => !ctx.weekDaysTrained.includes(d));

  // Map skipped dates back to scheduled day info
  const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const skippedDetails = skippedDates.map(dateStr => {
    const wd = WEEKDAYS[new Date(dateStr).getDay()];
    const info = ctx.scheduledDays.find(s => s.weekdayName === wd);
    return info
      ? `${wd} (${info.dayName} — ${info.muscleGroups.join(', ')})`
      : wd;
  });

  // Muscle group coverage this week
  const trainedNames = ctx.sessions
    .filter(s => ctx.weekDaysTrained.includes(s.date))
    .map(s => s.routineName ?? 'Ad-hoc');

  const allScheduledMuscles = ctx.scheduledDays.flatMap(d => d.muscleGroups);
  const trainedMuscles = ctx.scheduledDays
    .filter(d => ctx.weekDaysTrained.some(
      date => WEEKDAYS[new Date(date).getDay()] === d.weekdayName
    ))
    .flatMap(d => d.muscleGroups);
  const untrainedMuscles = [...new Set(allScheduledMuscles.filter(m => !trainedMuscles.includes(m)))];

  const brief = [
    `Today: ${ctx.todayLabel}`,
    lastLine,
    `This week: ${weekTrained} session(s) trained out of ${weekScheduled} scheduled so far (${trainedNames.join(', ') || 'none'}).`,
    skippedDetails.length
      ? `Skipped this week: ${skippedDetails.join('; ')}.`
      : 'No skipped sessions this week.',
    untrainedMuscles.length
      ? `Muscle groups not yet hit this week: ${untrainedMuscles.join(', ')}.`
      : 'All scheduled muscle groups covered this week.',
  ].join('\n');

  const completion = await client.chat.completions.create({
    model: COACH_MODEL,
    max_tokens: 60,
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content:
          'You are a sharp, honest personal trainer writing a single-line status message for a fitness app home screen. ' +
          'Rules: plain text only, no markdown, no emojis, max 15 words, present tense, second person ("you"). ' +
          'Be specific about skipped muscle groups or missed sessions when relevant. ' +
          'Do NOT say "great consistency" unless they have trained 4+ days this week. ' +
          'Respond ONLY with a JSON object on one line: {"label":"...","tone":"green|amber|blue|muted"} ' +
          'where tone reflects: green=on-track/strong week, amber=warning/fatigue/heavy, blue=returning/low frequency, muted=long gap/just starting.',
      },
      {
        role: 'user',
        content: brief,
      },
    ],
  });

  try {
    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    const parsed = JSON.parse(raw) as { label: string; tone: string };
    const toneMap: Record<string, 'green' | 'amber' | 'blue' | 'muted'> = {
      green: 'green', amber: 'amber', blue: 'blue', muted: 'muted',
    };
    return {
      label: parsed.label ?? 'Ready to train — let\'s go.',
      color: toneMap[parsed.tone] ?? 'blue',
    };
  } catch {
    return { label: 'Ready to train — let\'s go.', color: 'blue' };
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
