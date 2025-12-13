import { create } from 'zustand';

interface EditorState {
  code: string;
  language: string;
  setCode: (code: string) => void;
  setLanguage: (language: string) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  code: '',
  language: 'javascript',
  setCode: (code) => set({ code }),
  setLanguage: (language) => set({ language }),
}));








