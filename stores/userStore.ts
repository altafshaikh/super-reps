import { create } from 'zustand';
import type { User } from '@/types';
import { supabase } from '@/lib/supabase';

interface UserStore {
  user: User | null;
  loading: boolean;
  /** Set when session exists but `public.users` has no row — show on login, then clear. */
  signInBlockedMessage: string | null;
  setUser: (user: User | null) => void;
  clearSignInBlockedMessage: () => void;
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

  setUser: (user) => set({ user }),

  clearSignInBlockedMessage: () => set({ signInBlockedMessage: null }),

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
