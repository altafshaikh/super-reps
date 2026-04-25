import { create } from 'zustand';
import type { AIRoutineJSON, Exercise } from '@/types';
import { generateRoutine } from '@/lib/ai';

type BuilderState = 'idle' | 'loading' | 'preview' | 'error';

interface AIStore {
  builderState: BuilderState;
  pendingRoutine: AIRoutineJSON | null;
  streamingText: string;
  errorMessage: string | null;
  generate: (prompt: string, exercises: Exercise[]) => Promise<void>;
  clearBuilder: () => void;
}

export const useAIStore = create<AIStore>((set) => ({
  builderState: 'idle',
  pendingRoutine: null,
  streamingText: '',
  errorMessage: null,

  generate: async (prompt, exercises) => {
    set({ builderState: 'loading', streamingText: '', errorMessage: null, pendingRoutine: null });
    try {
      const routine = await generateRoutine(prompt, exercises, (text) => {
        set({ streamingText: text });
      });
      set({ builderState: 'preview', pendingRoutine: routine, streamingText: '' });
    } catch (e) {
      set({
        builderState: 'error',
        errorMessage: e instanceof Error ? e.message : 'Something went wrong',
        streamingText: '',
      });
    }
  },

  clearBuilder: () => set({
    builderState: 'idle', pendingRoutine: null, streamingText: '', errorMessage: null,
  }),
}));
