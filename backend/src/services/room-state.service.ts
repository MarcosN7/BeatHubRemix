interface BannedUser {
    userId: string;
    expiresAt: number;
}

interface RoomState {
    skipVotes: Set<string>;
    bannedUsers: BannedUser[];
    hostDisconnectTimer?: NodeJS.Timeout;

    // Playback timers
    playbackTimer?: NodeJS.Timeout;
    playbackStartTimeMs?: number;
    remainingDurationMs?: number;
    isPaused?: boolean;
    isTransitioning?: boolean;

    // --- Synchronized Playback State ---
    currentSongId?: string;
    isPlaying: boolean;
    startedAt?: number;          // server timestamp (ms) when playback started/resumed
    pauseOffset: number;         // seconds into the song when paused
    currentSongDuration: number; // total duration in seconds
}

export class RoomStateService {
    private static instance: RoomStateService;
    private states: Map<string, RoomState>;

    private constructor() {
        this.states = new Map();
    }

    public static getInstance(): RoomStateService {
        if (!RoomStateService.instance) {
            RoomStateService.instance = new RoomStateService();
        }
        return RoomStateService.instance;
    }

    private getOrCreateState(roomId: string): RoomState {
        if (!this.states.has(roomId)) {
            this.states.set(roomId, {
                skipVotes: new Set(),
                bannedUsers: [],
                isPlaying: false,
                pauseOffset: 0,
                currentSongDuration: 0,
                isTransitioning: false
            });
        }
        return this.states.get(roomId)!;
    }

    public setTransitioning(roomId: string, isTransitioning: boolean) {
        const state = this.getOrCreateState(roomId);
        state.isTransitioning = isTransitioning;
    }

    public isTransitioning(roomId: string): boolean {
        const state = this.states.get(roomId);
        return state?.isTransitioning === true;
    }

    // --- Moderation (Bans) ---
    public banUser(roomId: string, userId: string, durationMinutes: number = 5) {
        const state = this.getOrCreateState(roomId);
        const expiresAt = Date.now() + durationMinutes * 60 * 1000;

        // Remove existing ban if any
        state.bannedUsers = state.bannedUsers.filter(b => b.userId !== userId);
        state.bannedUsers.push({ userId, expiresAt });
    }

    public isBanned(roomId: string, userId: string): boolean {
        const state = this.states.get(roomId);
        if (!state) return false;

        const ban = state.bannedUsers.find(b => b.userId === userId);
        if (!ban) return false;

        if (Date.now() > ban.expiresAt) {
            // Ban expired, clean it up
            state.bannedUsers = state.bannedUsers.filter(b => b.userId !== userId);
            return false;
        }

        return true;
    }

    // --- Skip Voting ---
    public addSkipVote(roomId: string, userId: string) {
        const state = this.getOrCreateState(roomId);
        state.skipVotes.add(userId);
    }

    public removeSkipVote(roomId: string, userId: string) {
        const state = this.states.get(roomId);
        if (state) {
            state.skipVotes.delete(userId);
        }
    }

    public getSkipVotesCount(roomId: string): number {
        const state = this.states.get(roomId);
        return state ? state.skipVotes.size : 0;
    }

    public clearSkipVotes(roomId: string) {
        const state = this.states.get(roomId);
        if (state) {
            state.skipVotes.clear();
        }
    }

    // --- Host Disconnect Timers ---
    public setHostDisconnectTimer(roomId: string, callback: () => void, delayMs: number = 60000) {
        const state = this.getOrCreateState(roomId);
        this.clearHostDisconnectTimer(roomId); // Ensure no overlapping timers
        state.hostDisconnectTimer = setTimeout(() => {
            callback();
        }, delayMs);
    }

    public clearHostDisconnectTimer(roomId: string) {
        const state = this.states.get(roomId);
        if (state && state.hostDisconnectTimer) {
            clearTimeout(state.hostDisconnectTimer);
            state.hostDisconnectTimer = undefined;
        }
    }

    // --- Playback Timers ---
    public setPlaybackTimer(roomId: string, durationMs: number, onComplete: () => void) {
        const state = this.getOrCreateState(roomId);
        this.clearPlaybackTimer(roomId);

        state.isPaused = false;
        state.remainingDurationMs = durationMs;
        state.playbackStartTimeMs = Date.now();

        state.playbackTimer = setTimeout(() => {
            this.clearPlaybackTimer(roomId);
            onComplete();
        }, durationMs);
    }

    public pausePlaybackTimer(roomId: string) {
        const state = this.states.get(roomId);
        if (state && state.playbackTimer && !state.isPaused) {
            clearTimeout(state.playbackTimer);
            state.playbackTimer = undefined;
            state.isPaused = true;

            const elapsed = Date.now() - (state.playbackStartTimeMs || Date.now());
            state.remainingDurationMs = Math.max(0, (state.remainingDurationMs || 0) - elapsed);
        }
    }

    public resumePlaybackTimer(roomId: string, onComplete: () => void) {
        const state = this.states.get(roomId);
        if (state && state.isPaused && state.remainingDurationMs && state.remainingDurationMs > 0) {
            state.isPaused = false;
            state.playbackStartTimeMs = Date.now();

            state.playbackTimer = setTimeout(() => {
                this.clearPlaybackTimer(roomId);
                onComplete();
            }, state.remainingDurationMs);
        }
    }

    public clearPlaybackTimer(roomId: string) {
        const state = this.states.get(roomId);
        if (state && state.playbackTimer) {
            clearTimeout(state.playbackTimer);
            state.playbackTimer = undefined;
            state.remainingDurationMs = 0;
            state.isPaused = false;
        }
    }

    // --- General Cleanup ---
    public clearState(roomId: string) {
        this.clearHostDisconnectTimer(roomId);
        this.clearPlaybackTimer(roomId);
        this.states.delete(roomId);
    }

    // ============================
    // SYNCHRONIZED PLAYBACK STATE
    // ============================

    /**
     * Called when a new song starts playing.
     * Resets all sync fields to the beginning of the track.
     */
    public startSong(roomId: string, songId: string, durationSeconds: number) {
        const state = this.getOrCreateState(roomId);
        state.currentSongId = songId;
        state.isPlaying = true;
        state.startedAt = Date.now();
        state.pauseOffset = 0;
        state.currentSongDuration = durationSeconds;
    }

    /**
     * Called when the host/admin pauses playback.
     * Freezes `pauseOffset` at the current elapsed time.
     */
    public pauseSong(roomId: string) {
        const state = this.states.get(roomId);
        if (!state || !state.isPlaying || !state.startedAt) return;

        state.pauseOffset = (Date.now() - state.startedAt) / 1000;
        state.isPlaying = false;
        state.startedAt = undefined;
    }

    /**
     * Called when the host/admin resumes playback.
     * Recalculates `startedAt` so that `now - startedAt` equals the pauseOffset.
     */
    public resumeSong(roomId: string) {
        const state = this.states.get(roomId);
        if (!state || state.isPlaying) return;

        state.startedAt = Date.now() - (state.pauseOffset * 1000);
        state.isPlaying = true;
    }

    /**
     * Returns the current playback state for sync purposes.
     * `currentTime` is computed on-the-fly from server timestamps.
     */
    public getPlaybackState(roomId: string): {
        currentSongId: string | null;
        isPlaying: boolean;
        currentTime: number;
        duration: number;
        startedAt?: number;
    } {
        const state = this.states.get(roomId);
        if (!state || !state.currentSongId) {
            return { currentSongId: null, isPlaying: false, currentTime: 0, duration: 0, startedAt: undefined };
        }

        let currentTime: number;
        if (state.isPlaying && state.startedAt) {
            currentTime = (Date.now() - state.startedAt) / 1000;
        } else {
            currentTime = state.pauseOffset;
        }

        return {
            currentSongId: state.currentSongId,
            isPlaying: state.isPlaying,
            currentTime: Math.max(0, currentTime),
            duration: state.currentSongDuration,
            startedAt: state.startedAt
        };
    }

    /**
     * Clears the sync playback state when the queue is empty.
     */
    public clearPlaybackState(roomId: string) {
        const state = this.states.get(roomId);
        if (state) {
            state.currentSongId = undefined;
            state.isPlaying = false;
            state.startedAt = undefined;
            state.pauseOffset = 0;
            state.currentSongDuration = 0;
        }
    }
}
