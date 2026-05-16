import { create } from 'zustand';
import type { AIRoutineJSON, Exercise } from '@/types';
import { generateRoutine } from '@/lib/ai';
import type { RoutineUserContext } from '@/lib/ai';

export type BuilderState = 'idle' | 'chatting' | 'thinking' | 'loading' | 'preview' | 'error';

interface AIStore {
  builderState: BuilderState;
  pendingRoutine: AIRoutineJSON | null;
  streamingText: string;
  errorMessage: string | null;
  generate: (prompt: string, exercises: Exercise[], userContext?: RoutineUserContext, importMode?: boolean) => Promise<void>;
  clearBuilder: () => void;
  setBuilderState: (state: BuilderState) => void;
  setStreamingText: (text: string) => void;
}

export const useAIStore = create<AIStore>((set) => ({
  builderState: 'idle',
  pendingRoutine: null,
  streamingText: '',
  errorMessage: null,

  generate: async (prompt, exercises, userContext, importMode = false) => {
    set({ builderState: 'loading', streamingText: '', errorMessage: null, pendingRoutine: null });
    try {
      const routine = await generateRoutine(prompt, exercises, (text) => {
        set({ streamingText: text });
      }, userContext, importMode);
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

  setBuilderState: (state) => set({ builderState: state }),
  setStreamingText: (text) => set({ streamingText: text }),
}));
