import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redis: Redis;

try {
    redis = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,        // Don't block startup if Redis is unavailable
        retryStrategy(times) {
            if (times > 5) return null; // Stop retrying after 5 attempts
            return Math.min(times * 200, 2000);
        }
    });

    redis.on('connect', () => console.log('🔴 Redis connected'));
    redis.on('error', (err) => console.warn('⚠️ Redis error (non-fatal):', err.message));
} catch (err) {
    console.warn('⚠️ Redis not available. Falling back to in-memory presence.');
    redis = null as any;
}

export { redis };

/**
 * Returns true if Redis is connected and usable.
 */
export function isRedisAvailable(): boolean {
    return redis && redis.status === 'ready';
}
