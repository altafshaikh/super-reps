import { create } from 'zustand';
import type { User } from '@/types';
import { supabase } from '@/lib/supabase';

interface UserStore {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  fetchProfile: (userId: string) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<{ error: { message: string; code?: string; details?: string } | null }>;
  signOut: () => Promise<void>;
}

export const useUserStore = create<UserStore>((set, get) => ({
  user: null,
  loading: false,

  setUser: (user) => set({ user }),

  fetchProfile: async (userId) => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!error && data && session?.user?.id === userId) {
      set({ user: data as User });
    }
    set({ loading: false });
  },

  updateProfile: async (updates) => {
    const { user } = get();
    if (!user) return { error: { message: 'Not signed in.' } };
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();
    if (!error && data) set({ user: data as User });
    return { error: error ? { message: error.message, code: error.code, details: error.details } : null };
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      set({ user: null });
    }
  },
}));
