/**
 * Chat summariser — Q10 M2 + F2.
 *
 * Fires once when a chat hits the 2k token cap and needs to be migrated to a new
 * chat. Reads the full transcript, emits a structured summary that:
 *   - Replaces history in the new chat's system message (preserving continuity)
 *   - Becomes the closed-chat row's `summary` field (for the chat list preview)
 *   - Carries forward decisions, key facts, and open questions
 *
 * 8B call, ~300-500 tokens out. Cheap enough to run synchronously on migration.
 */

import Groq from 'groq-sdk';
import type { ChatMessage } from '@/lib/ai';
import type { IntentName } from './token-accountant';

const client = new Groq({
  apiKey: process.env.EXPO_PUBLIC_GROQ_API_KEY?.trim() || 'gsk_placeholder_for_build_without_env',
  dangerouslyAllowBrowser: true,
});

const SUMMARY_MODEL = 'llama-3.1-8b-instant';

export interface ChatSummaryF2 {
  title: string;
  intent: IntentName;
  decisions: string[];
  open_questions: string[];
  key_facts: string[];
  outcome: 'routine_saved' | 'in_progress' | 'abandoned';
}

const FALLBACK: ChatSummaryF2 = {
  title: 'Continued conversation',
  intent: 'chat',
  decisions: [],
  open_questions: [],
  key_facts: [],
  outcome: 'in_progress',
};

const SYSTEM_PROMPT = `You compress a fitness-coaching chat transcript into a tight JSON summary so a follow-up chat can resume without re-reading every message.

Output ONLY this JSON shape, no prose:
{
  "title": "3-6 word noun phrase, e.g. '4-day upper/lower build'",
  "intent": "build|analyze|readiness|form|chat",
  "decisions": ["short imperative phrases of choices made", ...],
  "open_questions": ["things still being decided", ...],
  "key_facts": ["user-specific facts mentioned (injuries, equipment limits, goals, preferences)", ...],
  "outcome": "routine_saved" | "in_progress" | "abandoned"
}

Rules:
- decisions: only concrete decisions, max 6 items
- key_facts: only things specific to THIS user, not generic training advice, max 5 items
- open_questions: only if the conversation was actively unresolved, max 3 items
- outcome="routine_saved" only if a routine was actually saved (mentioned by name)
- Be terse — every item < 12 words`;

/**
 * Summarise a chat transcript. Returns a permissive fallback on any failure so
 * the migration never blocks the user from continuing.
 */
export async function summariseChat(
  messages: ChatMessage[],
  intentHint?: IntentName,
): Promise<ChatSummaryF2> {
  if (messages.length === 0) return FALLBACK;

  const transcript = messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  try {
    const completion = await client.chat.completions.create({
      model: SUMMARY_MODEL,
      max_tokens: 500,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content:
            (intentHint ? `Likely intent: ${intentHint}\n\n` : '') +
            `Transcript:\n\n${transcript}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart === -1) return FALLBACK;

    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as Partial<ChatSummaryF2>;

    return {
      title: typeof parsed.title === 'string' && parsed.title.trim()
        ? parsed.title.trim().slice(0, 80)
        : FALLBACK.title,
      intent: (['build','analyze','readiness','form','chat'] as const).includes(parsed.intent as IntentName)
        ? (parsed.intent as IntentName)
        : (intentHint ?? FALLBACK.intent),
      decisions: Array.isArray(parsed.decisions)
        ? parsed.decisions.filter(d => typeof d === 'string').slice(0, 6)
        : [],
      open_questions: Array.isArray(parsed.open_questions)
        ? parsed.open_questions.filter(q => typeof q === 'string').slice(0, 3)
        : [],
      key_facts: Array.isArray(parsed.key_facts)
        ? parsed.key_facts.filter(f => typeof f === 'string').slice(0, 5)
        : [],
      outcome:
        parsed.outcome === 'routine_saved' || parsed.outcome === 'abandoned'
          ? parsed.outcome
          : 'in_progress',
    };
  } catch {
    return FALLBACK;
  }
}

/**
 * Render a structured summary into a single system-message string for the next
 * chat's system prompt. Keeps the new chat aware of what was agreed earlier
 * without dragging the full transcript.
 */
export function summaryToSystemMessage(s: ChatSummaryF2): string {
  const lines: string[] = [`Continued from previous chat: "${s.title}".`];
  if (s.key_facts.length) {
    lines.push('Known about the user: ' + s.key_facts.join('; ') + '.');
  }
  if (s.decisions.length) {
    lines.push('Decisions so far: ' + s.decisions.join('; ') + '.');
  }
  if (s.open_questions.length) {
    lines.push('Open: ' + s.open_questions.join('; ') + '.');
  }
  return lines.join(' ');
}
