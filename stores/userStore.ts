import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { User } from '@/types';
import { supabase } from '@/lib/supabase';

const REVIEW_TEXT_KEY = 'ai_review_text';
const REVIEW_DATA_KEY = 'ai_review_data_key';

/**
 * Platform-safe key/value storage. SecureStore works on iOS/Android but on
 * web it throws `getValueWithKeyAsync is not a function`. Mirror the pattern
 * from `lib/supabase.ts`: localStorage on web, SecureStore on native.
 *
 * All errors are swallowed — failing to read/write the AI-review cache should
 * never crash the app or block profile load.
 */
const kv = {
  get(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window === 'undefined') return Promise.resolve(null);
        return Promise.resolve(window.localStorage.getItem(key));
      }
      return SecureStore.getItemAsync(key).catch(() => null);
    } catch {
      return Promise.resolve(null);
    }
  },
  set(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
        return Promise.resolve();
      }
      return SecureStore.setItemAsync(key, value).then(() => undefined).catch(() => undefined);
    } catch {
      return Promise.resolve();
    }
  },
  delete(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') window.localStorage.removeItem(key);
        return Promise.resolve();
      }
      return SecureStore.deleteItemAsync(key).then(() => undefined).catch(() => undefined);
    } catch {
      return Promise.resolve();
    }
  },
};

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
    void kv.set(REVIEW_TEXT_KEY, text);
    void kv.set(REVIEW_DATA_KEY, dataKey);
  },
  clearAIReview: () => {
    set({ aiReview: null, aiReviewDataKey: null });
    void kv.delete(REVIEW_TEXT_KEY);
    void kv.delete(REVIEW_DATA_KEY);
  },
  loadPersistedAIReview: async () => {
    const [text, dataKey] = await Promise.all([
      kv.get(REVIEW_TEXT_KEY),
      kv.get(REVIEW_DATA_KEY),
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
