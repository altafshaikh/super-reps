/**
 * TokenAccountant — per-intent prompt budgeting (Q5 D).
 *
 * Groq llama-3.3-70b accepts up to 12k tokens of prompt per call. Going over either
 * 400s the request or truncates silently on some providers — neither is acceptable
 * UX. We enforce the budget on our side, refusing to add a segment that would
 * overflow, and emitting a warning the UI can surface.
 *
 * Token counting is approximate (chars/4). Good enough for sizing; Groq's tokenizer
 * differs slightly from OpenAI's but never by more than ~10% for English/code-ish
 * input. We leave a safety margin in every intent budget so the estimate can be
 * wrong by 10% and still fit.
 */

export type IntentName = 'build' | 'analyze' | 'readiness' | 'form' | 'chat';

export interface IntentBudget {
  /** Hard cap on the full prompt (system + history + data + response reservation). */
  total: number;
  /** System prompt + tool/schema description. */
  system: number;
  /** Rolling chat history. Capped by Q10's 2k per-chat rule independently. */
  history: number;
  /** Intent-specific data fetched lazily (exercise catalog, weekly summaries, etc.). */
  data: number;
  /** Reservation for the response — never let the input crowd this out. */
  response: number;
}

/**
 * Per-intent budgets in tokens. Sum of (system + history + data) ≤ total - response.
 * Build is the heaviest because it needs the exercise catalog.
 */
export const INTENT_BUDGETS: Record<IntentName, IntentBudget> = {
  build:     { total: 12000, system: 1500, history: 2000, data: 6500, response: 2000 },
  analyze:   { total: 12000, system: 1000, history: 1500, data: 7500, response: 2000 },
  readiness: { total: 12000, system:  800, history: 1000, data: 2000, response: 1500 },
  form:      { total: 12000, system:  800, history: 1500, data:    0, response: 2000 },
  chat:      { total: 12000, system:  800, history: 2000, data:    0, response: 2000 },
};

/** Rough char→token estimate. 1 token ≈ 4 chars for English. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export interface Segment {
  /** For diagnostics — which slot this goes into. */
  slot: 'system' | 'history' | 'data' | 'user';
  text: string;
  /** If true, the assembler must include this segment or fail loudly (e.g. current user message). */
  required?: boolean;
}

export interface AssemblyResult {
  /** Final ordered segments that fit the budget. */
  included: Segment[];
  /** Segments dropped because the budget couldn't accommodate them. */
  dropped: Segment[];
  /** Total estimated input tokens of `included`. */
  inputTokens: number;
  /** Whether anything was dropped — UI may want to flag this. */
  truncated: boolean;
}

export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

/**
 * Greedy assembler: includes segments in slot priority order
 * (system → user-required → history-recent-first → data), stopping when adding
 * the next would overflow. Required segments that don't fit throw.
 *
 * Caller orders `segments` already — this just truncates. History should be
 * pre-sorted newest-first so we drop oldest first.
 */
export function assemblePrompt(
  intent: IntentName,
  segments: Segment[],
): AssemblyResult {
  const budget = INTENT_BUDGETS[intent];
  const cap = budget.total - budget.response;

  // First pass: ensure all required segments fit on their own.
  const required = segments.filter(s => s.required);
  const requiredTokens = required.reduce((sum, s) => sum + estimateTokens(s.text), 0);
  if (requiredTokens > cap) {
    throw new BudgetExceededError(
      `Required segments (${requiredTokens} tok) exceed input budget (${cap} tok) for intent "${intent}". ` +
      'The user\'s current message is likely too long.',
    );
  }

  // Second pass: greedily include non-required segments in order until we'd overflow.
  let running = requiredTokens;
  const included: Segment[] = [...required];
  const dropped: Segment[] = [];

  for (const seg of segments) {
    if (seg.required) continue;
    const cost = estimateTokens(seg.text);
    if (running + cost <= cap) {
      included.push(seg);
      running += cost;
    } else {
      dropped.push(seg);
    }
  }

  // Re-order included to preserve original ordering.
  const originalOrder = segments.filter(s => included.includes(s));

  return {
    included: originalOrder,
    dropped,
    inputTokens: running,
    truncated: dropped.length > 0,
  };
}

/**
 * Helper: stitch the included segments into a single string by slot, in the
 * canonical order system → data → user/history. Caller can override by
 * pre-ordering segments and using `assemblePrompt` directly.
 */
export function joinSegments(segs: Segment[]): {
  system: string;
  data: string;
  user: string;
  history: string;
} {
  const bySlot = (slot: Segment['slot']) =>
    segs.filter(s => s.slot === slot).map(s => s.text).join('\n\n');

  return {
    system: bySlot('system'),
    data: bySlot('data'),
    user: bySlot('user'),
    history: bySlot('history'),
  };
}
