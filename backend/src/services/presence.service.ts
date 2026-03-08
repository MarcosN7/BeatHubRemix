import { redis, isRedisAvailable } from '../lib/redis';

const PRESENCE_TTL = 45;  // seconds — user considered offline if no heartbeat for 45s
const PREFIX = 'presence';

/**
 * Presence system backed by Redis TTL keys.
 * Falls back to in-memory Map when Redis is unavailable.
 */
export class PresenceService {
    private static instance: PresenceService;
    private fallbackMap = new Map<string, Set<string>>(); // roomId -> Set<userId>

    private constructor() { }

    public static getInstance(): PresenceService {
        if (!PresenceService.instance) {
            PresenceService.instance = new PresenceService();
        }
        return PresenceService.instance;
    }

    /**
     * Refresh a user's heartbeat. Call every 15 seconds from the client.
     */
    async heartbeat(roomId: string, userId: string): Promise<void> {
        if (isRedisAvailable()) {
            await redis.setex(`${PREFIX}:${roomId}:${userId}`, PRESENCE_TTL, Date.now().toString());
        } else {
            this.fallbackSet(roomId, userId);
        }
    }

    /**
     * Remove a user's presence (on disconnect or leave).
     */
    async removeUser(roomId: string, userId: string): Promise<void> {
        if (isRedisAvailable()) {
            await redis.del(`${PREFIX}:${roomId}:${userId}`);
        } else {
            this.fallbackMap.get(roomId)?.delete(userId);
        }
    }

    /**
     * Get list of online user IDs in a room.
     */
    async getOnlineUsers(roomId: string): Promise<string[]> {
        if (isRedisAvailable()) {
            const keys = await redis.keys(`${PREFIX}:${roomId}:*`);
            return keys.map(k => k.split(':').pop()!);
        } else {
            return Array.from(this.fallbackMap.get(roomId) || []);
        }
    }

    /**
     * Get listener count for a room.
     */
    async getListenerCount(roomId: string): Promise<number> {
        const users = await this.getOnlineUsers(roomId);
        return users.length;
    }

    private fallbackSet(roomId: string, userId: string) {
        if (!this.fallbackMap.has(roomId)) {
            this.fallbackMap.set(roomId, new Set());
        }
        this.fallbackMap.get(roomId)!.add(userId);
    }
}

export const presenceService = PresenceService.getInstance();
