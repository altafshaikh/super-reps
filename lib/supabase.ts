import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Non-empty defaults so `expo export` / SSR can bundle without env (e.g. CI). Set real values in production. */
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
  'https://placeholder-not-configured.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDI2NjIyMDAsImV4cCI6MTk1Nzk4MjIwMH0.EcHOCWLGfIBYI4oXL67K5hTaJFAudDnLurTmFFXN0WU';

/** In-memory session during web SSR / static export (no `window`). */
const ssrMemory = new Map<string, string>();

function createWebAuthStorage() {
  return {
    getItem: (key: string) =>
      Promise.resolve(
        typeof window !== 'undefined'
          ? window.localStorage.getItem(key)
          : (ssrMemory.get(key) ?? null),
      ),
    setItem: (key: string, value: string) => {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
      else ssrMemory.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key);
      else ssrMemory.delete(key);
      return Promise.resolve();
    },
  };
}

const authStorage =
  Platform.OS === 'web'
    ? createWebAuthStorage()
    : {
        getItem: (key: string) => SecureStore.getItemAsync(key),
        setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
        removeItem: (key: string) => SecureStore.deleteItemAsync(key),
      };

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
