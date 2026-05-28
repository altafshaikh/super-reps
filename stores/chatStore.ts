/**
 * chatStore — multi-chat persistence (Q10 T1 + W1).
 *
 * State model:
 *   - `chats[]` is the chat-list sidebar (recent first), loaded on mount.
 *   - `activeChatId` is the currently open chat.
 *   - `activeMessages` is the visible transcript for the active chat.
 *   - `activeTokenCount` is our running estimate of transcript tokens (the budget
 *     enforced by the 2k cap is *transcript* tokens, not full-prompt tokens —
 *     intent data is fetched fresh each turn and isn't part of the chat).
 *
 * All writes go through Supabase. Each chat is a single row with a JSONB
 * `messages` array; appends rewrite the whole blob, which is fine because the
 * 2k cap keeps each row's blob under ~10KB.
 *
 * The store does NOT call the LLM. Orchestration (classify → worker → append →
 * maybe migrate) lives in the AI tab so this stays a clean state container.
 */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { ChatMessage } from '@/lib/ai';
import { estimateTokens } from '@/lib/ai/token-accountant';
import {
  summariseChat,
  summaryToSystemMessage,
  type ChatSummaryF2,
} from '@/lib/ai/summarize';
import type { IntentName } from '@/lib/ai/token-accountant';

/** Transcript token cap before we force an invisible migration to a new chat. */
export const CHAT_HARD_LIMIT = 2000;
/** Soft warning threshold — UI shows a banner once we cross this. */
export const CHAT_SOFT_LIMIT = 1800;

export interface ChatRow {
  id: string;
  user_id: string;
  title: string | null;
  messages: ChatMessage[];
  token_count: number;
  summary: ChatSummaryF2 | null;
  parent_chat: string | null;
  intent_hint: IntentName | null;
  created_at: string;
  updated_at: string;
}

interface ChatStore {
  /** Recent-first list, just enough columns to render the sidebar. */
  chats: Pick<ChatRow, 'id' | 'title' | 'updated_at' | 'intent_hint' | 'summary'>[];

  activeChatId: string | null;
  activeMessages: ChatMessage[];
  activeTokenCount: number;
  activeIntent: IntentName | null;

  loading: boolean;
  /** Surface-level error for the chat-shell (load failed, migration failed). */
  error: string | null;

  // ── lifecycle ─────────────────────────────────────────────
  loadChats: () => Promise<void>;
  openChat: (id: string) => Promise<void>;
  newChat: (opts?: { intentHint?: IntentName; systemMessage?: string }) => Promise<string | null>;
  clearActive: () => void;

  // ── writes ────────────────────────────────────────────────
  appendMessage: (msg: ChatMessage) => Promise<void>;
  setTitle: (id: string, title: string) => Promise<void>;
  setIntent: (intent: IntentName) => Promise<void>;

  // ── migration (Q10 W1) ────────────────────────────────────
  /** True once the active transcript has crossed CHAT_SOFT_LIMIT. UI uses this for the banner. */
  nearLimit: () => boolean;
  /** True once the active transcript has crossed CHAT_HARD_LIMIT. */
  atLimit: () => boolean;
  /**
   * Close the active chat with a summary and spawn a child chat. Used by the
   * tab right before sending the message that would have overflowed. Returns
   * the new chat's id, or null on failure (chat stays open, caller may retry).
   */
  migrate: () => Promise<string | null>;

  // ── export ───────────────────────────────────────────────
  /**
   * Fetch a chat by id and return it formatted as markdown. Caller is
   * responsible for clipboard / share dispatch. Returns null on failure.
   */
  exportChatAsMarkdown: (id: string) => Promise<string | null>;
}

/**
 * Supabase's typed select needs string-literal types to infer the row shape.
 * Concatenating constants degrades it to `string` and the result becomes
 * `GenericStringError`. We declare each shape inline as a `const` literal.
 */
const SIDEBAR_FIELDS = 'id, title, updated_at, intent_hint, summary' as const;
const FULL_FIELDS = 'id, title, updated_at, intent_hint, summary, messages, token_count' as const;

export const useChatStore = create<ChatStore>((set, get) => ({
  chats: [],
  activeChatId: null,
  activeMessages: [],
  activeTokenCount: 0,
  activeIntent: null,
  loading: false,
  error: null,

  loadChats: async () => {
    set({ loading: true, error: null });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      set({ chats: [], loading: false });
      return;
    }

    const { data, error } = await supabase
      .from('chats')
      .select(SIDEBAR_FIELDS)
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      // An empty chat list is a valid first-load state, and the most common
      // cause of an error here is the migration not being run yet (PGRST205 /
      // 42P01 / 404 from PostgREST). We log silently rather than alarming the
      // user — they'll find out when they try to send a message.
      console.warn('chatStore.loadChats:', error.message ?? error);
      set({ loading: false, chats: [], error: null });
      return;
    }
    set({ chats: (data ?? []) as unknown as ChatStore['chats'], loading: false });
  },

  openChat: async (id) => {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('chats')
      .select('id, messages, token_count, intent_hint')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      set({ loading: false, error: 'Could not open that chat.' });
      return;
    }

    set({
      activeChatId: data.id,
      activeMessages: (data.messages ?? []) as ChatMessage[],
      activeTokenCount: data.token_count ?? 0,
      activeIntent: (data.intent_hint ?? null) as IntentName | null,
      loading: false,
    });
  },

  newChat: async ({ intentHint, systemMessage } = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      set({ error: 'You need to be signed in.' });
      return null;
    }

    // If a continuation summary is provided, seed it as a system-role message
    // so the worker sees it on turn 1 of the new chat.
    const initialMessages: ChatMessage[] = systemMessage
      ? [{ role: 'assistant', content: systemMessage }]
      : [];
    const initialTokens = initialMessages.reduce(
      (sum, m) => sum + estimateTokens(m.content),
      0,
    );

    const { data, error } = await supabase
      .from('chats')
      .insert({
        user_id: session.user.id,
        title: null,
        messages: initialMessages,
        token_count: initialTokens,
        intent_hint: intentHint ?? null,
      })
      .select(FULL_FIELDS)
      .single();

    if (error || !data) {
      set({ error: 'Could not start a new chat.' });
      return null;
    }

    const row = data as unknown as ChatRow;

    set(state => ({
      chats: [
        {
          id: row.id,
          title: row.title,
          updated_at: row.updated_at,
          intent_hint: row.intent_hint,
          summary: row.summary,
        },
        ...state.chats,
      ],
      activeChatId: row.id,
      activeMessages: (row.messages ?? []) as ChatMessage[],
      activeTokenCount: row.token_count ?? 0,
      activeIntent: (row.intent_hint ?? null) as IntentName | null,
      error: null,
    }));

    return row.id;
  },

  clearActive: () => {
    set({
      activeChatId: null,
      activeMessages: [],
      activeTokenCount: 0,
      activeIntent: null,
    });
  },

  appendMessage: async (msg) => {
    const id = get().activeChatId;
    if (!id) return;

    const nextMessages = [...get().activeMessages, msg];
    const nextTokens = get().activeTokenCount + estimateTokens(msg.content);

    // Optimistic update — the UI shouldn't wait for the network round-trip
    // before showing the user's own bubble or streaming the assistant reply.
    set({ activeMessages: nextMessages, activeTokenCount: nextTokens });

    const { error } = await supabase
      .from('chats')
      .update({ messages: nextMessages, token_count: nextTokens })
      .eq('id', id);

    if (error) {
      // Persistence failed but the in-memory state is still valid. Surface a
      // soft error; the next message will try the same write again.
      set({ error: 'Chat couldn\'t save — your message is still here, but it may not appear in history later.' });
    } else {
      // Refresh the sidebar entry's updated_at so it floats to the top.
      set(state => ({
        chats: state.chats.map(c =>
          c.id === id ? { ...c, updated_at: new Date().toISOString() } : c,
        ),
      }));
    }
  },

  setTitle: async (id, title) => {
    set(state => ({
      chats: state.chats.map(c => (c.id === id ? { ...c, title } : c)),
    }));
    await supabase.from('chats').update({ title }).eq('id', id);
  },

  setIntent: async (intent) => {
    const id = get().activeChatId;
    if (!id) return;
    // Mirror the change into the sidebar list so the chat's intent badge
    // updates immediately, not on the next loadChats() round trip.
    set(state => ({
      activeIntent: intent,
      chats: state.chats.map(c =>
        c.id === id ? { ...c, intent_hint: intent } : c,
      ),
    }));
    await supabase.from('chats').update({ intent_hint: intent }).eq('id', id);
  },

  nearLimit: () => get().activeTokenCount >= CHAT_SOFT_LIMIT,
  atLimit:   () => get().activeTokenCount >= CHAT_HARD_LIMIT,

  migrate: async () => {
    const id = get().activeChatId;
    const messages = get().activeMessages;
    const intentHint = get().activeIntent ?? undefined;
    if (!id || messages.length === 0) return null;

    // 1) Summarise the closing chat with an 8B call.
    const summary = await summariseChat(messages, intentHint);

    // 2) Close the old chat by persisting the summary.
    await supabase
      .from('chats')
      .update({ summary })
      .eq('id', id);

    set(state => ({
      chats: state.chats.map(c => (c.id === id ? { ...c, summary } : c)),
    }));

    // 3) Spawn a child chat seeded with the summary as a system message.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const systemMsg = summaryToSystemMessage(summary);
    const initialMessages: ChatMessage[] = [
      { role: 'assistant', content: systemMsg },
    ];
    const initialTokens = estimateTokens(systemMsg);

    const { data, error } = await supabase
      .from('chats')
      .insert({
        user_id: session.user.id,
        title: summary.title + ' (cont.)',
        messages: initialMessages,
        token_count: initialTokens,
        intent_hint: summary.intent,
        parent_chat: id,
      })
      .select(FULL_FIELDS)
      .single();

    if (error || !data) {
      // Old chat was closed but child failed — old chat is unusable now (over
      // limit). Surface error; user can hit "New chat" to start fresh.
      set({ error: 'Couldn\'t continue automatically. Tap "New chat" to keep going.' });
      return null;
    }

    const row = data as unknown as ChatRow;

    set(state => ({
      chats: [
        {
          id: row.id,
          title: row.title,
          updated_at: row.updated_at,
          intent_hint: row.intent_hint,
          summary: row.summary,
        },
        ...state.chats,
      ],
      activeChatId: row.id,
      activeMessages: (row.messages ?? []) as ChatMessage[],
      activeTokenCount: row.token_count ?? 0,
      activeIntent: (row.intent_hint ?? null) as IntentName | null,
    }));

    return row.id;
  },

  exportChatAsMarkdown: async (id) => {
    const { data, error } = await supabase
      .from('chats')
      .select('title, messages, created_at, intent_hint')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;

    const row = data as unknown as {
      title: string | null;
      messages: ChatMessage[];
      created_at: string;
      intent_hint: string | null;
    };

    const title = row.title?.trim() || 'SuperReps Coach chat';
    const date = new Date(row.created_at).toLocaleString();
    const intent = row.intent_hint ? ` · _${row.intent_hint}_` : '';

    const lines: string[] = [
      `# ${title}`,
      ``,
      `_${date}${intent}_`,
      ``,
      `---`,
      ``,
    ];

    for (const m of row.messages ?? []) {
      const who = m.role === 'user' ? '**You**' : '**Coach**';
      lines.push(who);
      lines.push('');
      lines.push(m.content.trim());
      lines.push('');
    }

    lines.push('---');
    lines.push('_Exported from SuperReps Coach_');

    return lines.join('\n');
  },
}));
