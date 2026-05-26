import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User } from '@/types';
import { supabase } from '@/lib/supabase';

const REVIEW_TEXT_KEY = 'ai_review_text';
const REVIEW_DATA_KEY = 'ai_review_data_key';

interface UserStore {
  user: User | null;
  loading: boolean;
  /** Set when session exists but `public.users` has no row — show on login, then clear. */
  signInBlockedMessage: string | null;
  aiReview: string | null;
  aiReviewDataKey: string | null;   // "<sessionCount>:<roundedTotalVolume>"
  setUser: (user: User | null) => void;
  clearSignInBlockedMessage: () => void;
  setAIReview: (text: string, dataKey: string) => void;
  clearAIReview: () => void;
  loadPersistedAIReview: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<{ error: { message: string; code?: string; details?: string } | null }>;
  signOut: () => Promise<void>;
}

const NO_PROFILE_MESSAGE =
  'No SuperReps account found for this sign-in. Create an account first, or use the email you signed up with.';

export const useUserStore = create<UserStore>((set, get) => ({
  user: null,
  loading: false,
  signInBlockedMessage: null,
  aiReview: null,
  aiReviewDataKey: null,

  setUser: (user) => set({ user }),
  clearSignInBlockedMessage: () => set({ signInBlockedMessage: null }),
  setAIReview: (text, dataKey) => {
    set({ aiReview: text, aiReviewDataKey: dataKey });
    SecureStore.setItemAsync(REVIEW_TEXT_KEY, text).catch(() => {});
    SecureStore.setItemAsync(REVIEW_DATA_KEY, dataKey).catch(() => {});
  },
  clearAIReview: () => {
    set({ aiReview: null, aiReviewDataKey: null });
    SecureStore.deleteItemAsync(REVIEW_TEXT_KEY).catch(() => {});
    SecureStore.deleteItemAsync(REVIEW_DATA_KEY).catch(() => {});
  },
  loadPersistedAIReview: async () => {
    const [text, dataKey] = await Promise.all([
      SecureStore.getItemAsync(REVIEW_TEXT_KEY),
      SecureStore.getItemAsync(REVIEW_DATA_KEY),
    ]);
    if (text && dataKey) set({ aiReview: text, aiReviewDataKey: dataKey });
  },

  fetchProfile: async (userId) => {
    set({ loading: true });
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user || session.user.id !== userId) {
      set({ loading: false });
      return;
    }

    const { data: row, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      set({ loading: false });
      return;
    }

    if (!row) {
      try {
        await supabase.auth.signOut();
      } finally {
        set({
          user: null,
          loading: false,
          signInBlockedMessage: NO_PROFILE_MESSAGE,
        });
      }
      return;
    }

    set({ user: row as User, loading: false });
    get().loadPersistedAIReview();
  },

  updateProfile: async (updates) => {
    const { user } = get();
    if (!user) return { error: { message: 'Not signed in.' } };
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id)
      .select()
      .maybeSingle();
    if (!error && data) set({ user: data as User });
    if (error) {
      return { error: { message: error.message, code: error.code, details: error.details } };
    }
    if (!data) {
      return { error: { message: 'Profile not found. Try signing in again.' } };
    }
    return { error: null };
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      set({ user: null, signInBlockedMessage: null });
    }
  },
}));
