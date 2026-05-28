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

  // Build a profile block so the worker knows what it already has and never
  // asks for it. Each line is short on purpose — these are budget tokens.
  const profileLines: string[] = [];
  if (userContext?.goal) profileLines.push(`Goal on file: ${userContext.goal}`);
  if (userContext?.level) profileLines.push(`Level on file: ${userContext.level}`);
  if (userContext?.equipment?.length)
    profileLines.push(`Equipment on file: ${userContext.equipment.join(', ')}`);
  const profileBlock = profileLines.length
    ? `\nWhat you already know about this user (don't re-ask):\n${profileLines.map(l => `- ${l}`).join('\n')}\n`
    : '';

  const systemPrompt = `You are SuperReps AI — a no-fluff personal trainer. Be terse and decisive.
${profileBlock}
ALWAYS respond with JSON in EXACTLY one of these three shapes (no other format permitted):

{"action":"generate","prompt":"<one-paragraph programme spec: goal, days/week, equipment, level if known, plus any must-include or must-avoid that the user volunteered>"}

{"action":"import","prompt":"<the user's verbatim pasted workout>"}

{"action":"ask","question":"<one short bundled question, ≤25 words, asking for ALL missing required fields at once>"}

DECISION RULES (apply in order, pick the first match):
1. User pasted a structured workout from another app → action=import.
2. You have goal + days/week + equipment (extracted from this message OR listed in profile above) → action=generate. Must-include / must-avoid lists are OPTIONAL; do NOT ask about them. Generate immediately.
3. Otherwise → action=ask. Bundle all missing required fields into one short question. Never ask one at a time.

EXAMPLES (study these carefully):

USER: "Build me a 4-day upper/lower hypertrophy program, intermediate, barbell + dumbbells only."
→ {"action":"generate","prompt":"4-day upper/lower hypertrophy split for an intermediate lifter with barbell and dumbbells only."}

USER: "make me a routine"
→ {"action":"ask","question":"What's your goal (strength / hypertrophy / fat loss), how many days a week can you train, and what equipment do you have?"}

USER (profile has goal=hypertrophy, equipment=dumbbells): "I can train 3 days a week"
→ {"action":"generate","prompt":"3-day full-body hypertrophy routine, dumbbells only."}

USER pasted a long list of "Bench Press 3x8, Pull-ups 3x10..."
→ {"action":"import","prompt":"Bench Press 3x8, Pull-ups 3x10, ..."}

Never output anything outside the JSON. Never add preamble. Never wrap the JSON in markdown code fences.

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
    max_tokens: 350,
    temperature: 0.2,
    stream: true,
    // Hard-enforce JSON via response_format. With this on, Groq will only
    // accept valid JSON output — drastically improves rule following because
    // the model can't ramble or recite an apology.
    response_format: { type: 'json_object' },
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? '';
    fullText += delta;
    onChunk?.(fullText);
  }

  // The new schema uses `action` instead of `type`. We still accept the legacy
  // `type` field for backwards-compatibility during the transition (in case a
  // cached system prompt produces the old shape).
  const trimmed = fullText.trim();
  try {
    const parsed = JSON.parse(trimmed) as {
      action?: string;
      type?: string;
      prompt?: string;
      question?: string;
    };
    const action = parsed.action ?? parsed.type;
    if (action === 'import' && parsed.prompt) {
      return { type: 'import', prompt: parsed.prompt };
    }
    if (action === 'generate' && parsed.prompt) {
      return { type: 'generate', prompt: parsed.prompt };
    }
    if (action === 'ask' && parsed.question) {
      return { type: 'message', text: parsed.question };
    }
    if (action === 'message' && parsed.prompt) {
      return { type: 'message', text: parsed.prompt };
    }
  } catch {
    // Fall through to treating the raw text as a message — should be rare with
    // response_format=json_object enforced server-side.
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
  context?: {
    thisWeekCount: number;
    prevWeekSessions: { date: string; exercises: string[]; volume: number }[];
    streak?: number;
    prCount?: number;
    totalSessions?: number;
  },
): Promise<string> {
  const thisWeekCount = context?.thisWeekCount ?? sessions.length;

  let userContent: string;

  if (thisWeekCount === 0) {
    const lines = ['The user logged zero workouts this week. Do not suggest rest — they need encouragement to get back to training.'];
    if (context?.streak) lines.push(`Their current streak is ${context.streak} days.`);
    if (context?.totalSessions) lines.push(`They have ${context.totalSessions} total sessions logged — they are an active lifter who hit a low week, not a beginner.`);
    userContent = lines.join(' ');
  } else {
    const thisWeekSummary = sessions
      .map(s => `${s.date}: ${s.exercises.join(', ')} — volume ${s.volume}kg`)
      .join('\n');

    const prevWeekSummary = context?.prevWeekSessions?.length
      ? context.prevWeekSessions
          .map(s => `${s.date}: ${s.exercises.join(', ')} — volume ${s.volume}kg`)
          .join('\n')
      : null;

    const lines = [
      `This week the user logged ${thisWeekCount} session(s):`,
      thisWeekSummary,
    ];
    if (prevWeekSummary) {
      lines.push(`\nPrevious week's sessions (for comparison):`);
      lines.push(prevWeekSummary);
    }
    if (context?.streak) lines.push(`\nCurrent training streak: ${context.streak} day(s).`);
    if (context?.prCount) lines.push(`Personal records set (all time): ${context.prCount}.`);
    if (context?.totalSessions) lines.push(`Total lifetime sessions logged: ${context.totalSessions}.`);
    lines.push(
      `\nCritical rule: if ${thisWeekCount} sessions is lower than the previous week, do NOT default to "rest" advice — they already had fewer sessions. Encourage them to train more. Only suggest rest if volume per session is clearly elevated and recovery is needed.`,
    );
    userContent = lines.join('\n');
  }

  const completion = await client.chat.completions.create({
    model: ROUTINE_MODEL,
    max_tokens: 400,
    temperature: 0.5,
    messages: [
      {
        role: 'system',
        content:
          'You are a personal trainer. Respond with plain text only — no markdown, no bullet symbols, no headings. At most 3 short sentences for a mobile app card. Never suggest rest when the user has already had a low-activity week.',
      },
      {
        role: 'user',
        content: userContent,
      },
    ],
  });

  return completion.choices[0]?.message?.content ?? '';
}
