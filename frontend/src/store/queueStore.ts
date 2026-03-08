import { create } from 'zustand';

export interface QueueItem {
    id: string;
    youtubeVideoId: string;
    title: string;
    durationSeconds: number;
    addedByUserId: string;
    addedByUsername: string;
    position: number;
    status: 'queued' | 'playing' | 'played';
    isSystemAdded: boolean;
}

export interface HistoryItem {
    id: string;
    youtubeVideoId: string;
    title: string;
    addedByUserId: string;
    playedAt: string;
}

interface QueueState {
    queue: QueueItem[];
    history: HistoryItem[];
    setQueue: (queue: QueueItem[]) => void;
    setHistory: (history: HistoryItem[]) => void;
    addQueueItem: (item: QueueItem) => void;
    removeQueueItem: (id: string) => void;
}

export const useQueueStore = create<QueueState>((set) => ({
    queue: [],
    history: [],
    setQueue: (queue) => set({ queue }),
    setHistory: (history) => set({ history }),
    addQueueItem: (item) => set((state) => ({ queue: [...state.queue, item] })),
    removeQueueItem: (id) => set((state) => ({ queue: state.queue.filter(q => q.id !== id) })),
}));
