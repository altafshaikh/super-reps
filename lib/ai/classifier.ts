/**
 * Intent classifier — Q4 D (hybrid: 8B classifier + intent-scoped workers).
 *
 * One cheap 8B call returns an intent label, a confidence score, and an explicit
 * `ambiguous` flag. The UI uses the flag to render clarification chips instead
 * of guessing wrong and wasting a 70B worker call.
 *
 * Cost ≈ 100-200 input tokens + ~30 output tokens per first-turn classification.
 * Skipped entirely when entry-point context supplies an intent hint (?intent=build).
 */

import Groq from 'groq-sdk';
import type { IntentName } from './token-accountant';

const client = new Groq({
  apiKey: process.env.EXPO_PUBLIC_GROQ_API_KEY?.trim() || 'gsk_placeholder_for_build_without_env',
  dangerouslyAllowBrowser: true,
});

const CLASSIFIER_MODEL = 'llama-3.1-8b-instant';

export interface ClassifyResult {
  intent: IntentName;
  /** 0-1. Below 0.6 we treat as ambiguous regardless of `ambiguous` flag. */
  confidence: number;
  /** Set by the model when the message could plausibly be two+ intents. */
  ambiguous: boolean;
  /** Diagnostic — why this intent was chosen. */
  reason?: string;
}

const SYSTEM_PROMPT = `You classify a user's first message in a fitness coaching chat into ONE of these intents:

- "build": user wants to create, modify, or import a workout routine/programme
- "analyze": user wants to look at their past training (trends, volume, PRs, what they're neglecting)
- "readiness": user wants advice about today's session (should I train, what to focus on, am I recovered)
- "form": user wants exercise technique advice or substitution suggestions
- "chat": general fitness Q&A that doesn't fit the above (nutrition basics, motivation, programming theory)

Respond ONLY with a single line of JSON:
{"intent":"build|analyze|readiness|form|chat","confidence":0.0-1.0,"ambiguous":true|false,"reason":"short phrase"}

Rules:
- confidence >= 0.8 only if the message clearly indicates one intent
- ambiguous: true when the message reasonably fits two or more intents (e.g. "how's my bench going" could be analyze OR build follow-up)
- Never invent intents outside the list above`;

const FALLBACK: ClassifyResult = {
  intent: 'chat',
  confidence: 0.3,
  ambiguous: true,
  reason: 'classifier unavailable',
};

/**
 * Classify a single user message. Designed for first-turn routing only — once a
 * chat has an `intent_hint`, stay in it across subsequent turns instead of
 * re-classifying.
 *
 * Returns a fallback (chat + ambiguous) on any error, so the caller can still
 * surface clarification chips rather than dead-ending.
 */
export async function classifyIntent(userMessage: string): Promise<ClassifyResult> {
  try {
    const completion = await client.chat.completions.create({
      model: CLASSIFIER_MODEL,
      max_tokens: 80,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage.slice(0, 500) },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) return FALLBACK;

    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as Partial<ClassifyResult>;

    const intent = (parsed.intent ?? 'chat') as IntentName;
    const allowed: IntentName[] = ['build', 'analyze', 'readiness', 'form', 'chat'];
    if (!allowed.includes(intent)) return FALLBACK;

    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.5)));
    const ambiguous = Boolean(parsed.ambiguous) || confidence < 0.6;

    return {
      intent,
      confidence,
      ambiguous,
      reason: typeof parsed.reason === 'string' ? parsed.reason : undefined,
    };
  } catch {
    return FALLBACK;
  }
}
