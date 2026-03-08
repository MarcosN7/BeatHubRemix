import { create } from 'zustand';

export interface ChatMessage {
    id?: string;
    userId: string;
    username: string;
    content: string;
    timestamp: string;
    isSystem?: boolean;
}

interface ChatState {
    messages: ChatMessage[];
    addMessage: (msg: ChatMessage) => void;
    clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
    messages: [],
    addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
    clearMessages: () => set({ messages: [] }),
}));
