export interface RateLimitState {
    songAddTimestamps: number[];
    chatMessageTimestamps: number[];
    spamStrikes: number;
    blockedUntil: number; // 30s temporary block
    mutedUntil: number;   // 10m auto-moderation mute
}

export class RateLimitService {
    // Map of userId -> RateLimitState
    private userStates = new Map<string, RateLimitState>();

    private readonly MAX_SONGS_PER_MIN = 3;
    private readonly SONG_COOLDOWN_MS = 10 * 1000;
    private readonly MAX_CHAT_PER_10S = 5;

    private readonly BLOCK_DURATION_MS = 30 * 1000;
    private readonly MUTE_DURATION_MS = 10 * 60 * 1000;
    private readonly STRIKES_FOR_MUTE = 5;

    private getUserState(userId: string): RateLimitState {
        if (!this.userStates.has(userId)) {
            this.userStates.set(userId, {
                songAddTimestamps: [],
                chatMessageTimestamps: [],
                spamStrikes: 0,
                blockedUntil: 0,
                mutedUntil: 0
            });
        }
        return this.userStates.get(userId)!;
    }

    private cleanOldTimestamps(timestamps: number[], maxAgeMs: number) {
        const now = Date.now();
        return timestamps.filter(ts => now - ts < maxAgeMs);
    }

    private applyStrike(userId: string, state: RateLimitState): { isMuted: boolean } {
        state.spamStrikes += 1;
        state.blockedUntil = Date.now() + this.BLOCK_DURATION_MS;

        if (state.spamStrikes >= this.STRIKES_FOR_MUTE) {
            state.mutedUntil = Date.now() + this.MUTE_DURATION_MS;
            state.spamStrikes = 0; // reset strikes after muting
            return { isMuted: true };
        }
        return { isMuted: false };
    }

    /**
     * Checks if a user is currently muted by auto-moderation.
     */
    public isMuted(userId: string): boolean {
        const state = this.getUserState(userId);
        return Date.now() < state.mutedUntil;
    }

    /**
     * Records a song addition attempt. 
     * Throws an error if rate limited, on cooldown, or muted.
     * Returns { muted: true } if the attempt just triggered an auto-mute.
     */
    public recordSongAdd(userId: string): { justMuted: boolean, error?: string } {
        const state = this.getUserState(userId);
        const now = Date.now();

        if (this.isMuted(userId)) {
            return { justMuted: false, error: 'You are muted and cannot add songs.' };
        }

        if (now < state.blockedUntil) {
            const strikeResult = this.applyStrike(userId, state);
            return {
                justMuted: strikeResult.isMuted,
                error: `You are temporarily blocked from interacting. Please wait ${Math.ceil((state.blockedUntil - now) / 1000)}s.`
            };
        }

        // 1. Cooldown Check (10 seconds between additions)
        if (state.songAddTimestamps.length > 0) {
            const lastAdd = state.songAddTimestamps[state.songAddTimestamps.length - 1];
            if (now - lastAdd < this.SONG_COOLDOWN_MS) {
                const strikeResult = this.applyStrike(userId, state);
                const action = strikeResult.isMuted ? 'muted for 10 minutes' : 'blocked for 30s';
                return {
                    justMuted: strikeResult.isMuted,
                    error: `Queue spam detected. You are adding songs too fast. You have been ${action}.`
                };
            }
        }

        // 2. Rate Limit Check (3 per minute)
        state.songAddTimestamps = this.cleanOldTimestamps(state.songAddTimestamps, 60 * 1000);
        if (state.songAddTimestamps.length >= this.MAX_SONGS_PER_MIN) {
            const strikeResult = this.applyStrike(userId, state);
            const action = strikeResult.isMuted ? 'muted for 10 minutes' : 'blocked for 30s';
            return {
                justMuted: strikeResult.isMuted,
                error: `Queue limit reached (max 3/min). You have been ${action}.`
            };
        }

        // Record successful attempt
        state.songAddTimestamps.push(now);
        return { justMuted: false };
    }

    /**
     * Records a chat message. 
     * Throws an error if rate limited or muted.
     * Returns { muted: true } if the attempt just triggered an auto-mute.
     */
    public recordChatMessage(userId: string): { justMuted: boolean, error?: string } {
        const state = this.getUserState(userId);
        const now = Date.now();

        if (this.isMuted(userId)) {
            return { justMuted: false, error: 'You are muted and cannot send messages.' };
        }

        if (now < state.blockedUntil) {
            const strikeResult = this.applyStrike(userId, state);
            return {
                justMuted: strikeResult.isMuted,
                error: `You are temporarily blocked from interacting. Please wait ${Math.ceil((state.blockedUntil - now) / 1000)}s.`
            };
        }

        state.chatMessageTimestamps = this.cleanOldTimestamps(state.chatMessageTimestamps, 10 * 1000);
        if (state.chatMessageTimestamps.length >= this.MAX_CHAT_PER_10S) {
            const strikeResult = this.applyStrike(userId, state);
            return {
                justMuted: strikeResult.isMuted,
                error: strikeResult.isMuted ? 'Chat spam detected. You have been muted for 10 minutes.' : 'Chat spam detected. You have been blocked for 30s.'
            };
        }

        state.chatMessageTimestamps.push(now);
        return { justMuted: false };
    }
}

export const rateLimitService = new RateLimitService();
