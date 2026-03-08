import { create } from 'zustand';

export interface PlaybackState {
    currentSongId: string | null;
    startedAt: number | null;
    pauseOffset: number;
    isPlaying: boolean;
}

interface PlaybackStore extends PlaybackState {
    setPlaybackState: (state: Partial<PlaybackState>) => void;
    clearPlaybackState: () => void;
}

export const usePlaybackStore = create<PlaybackStore>((set) => ({
    currentSongId: null,
    startedAt: null,
    pauseOffset: 0,
    isPlaying: false,

    setPlaybackState: (newState) => set((state) => ({ ...state, ...newState })),
    clearPlaybackState: () => set({ currentSongId: null, startedAt: null, pauseOffset: 0, isPlaying: false })
}));
