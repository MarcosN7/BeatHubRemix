import { prisma } from '../lib/prisma';
import { presenceService } from './presence.service';
import { RoomStateService } from './room-state.service';

const roomState = RoomStateService.getInstance();

/**
 * Periodic background service that purges empty rooms from the database.
 * Handles edge cases where the socket `disconnecting` event never fires
 * (e.g., browser crash, network drop, server restart).
 */
export class RoomCleanupService {
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private static instance: RoomCleanupService;

    private constructor() { }

    static getInstance(): RoomCleanupService {
        if (!RoomCleanupService.instance) {
            RoomCleanupService.instance = new RoomCleanupService();
        }
        return RoomCleanupService.instance;
    }

    /**
     * Run once at startup: delete all rooms that have zero presence.
     * This catches stale rooms left behind by previous server sessions.
     */
    async purgeStaleRooms(): Promise<void> {
        try {
            const activeRooms = await prisma.room.findMany({
                where: { status: 'active' },
                select: { id: true, name: true }
            });

            let purged = 0;
            for (const room of activeRooms) {
                const listeners = await presenceService.getListenerCount(room.id);
                if (listeners === 0) {
                    console.log(`🧹 Startup purge: deleting stale room "${room.name}" (${room.id})`);
                    roomState.clearPlaybackState(room.id);
                    roomState.clearPlaybackTimer(room.id);
                    roomState.clearHostDisconnectTimer(room.id);
                    await prisma.room.delete({ where: { id: room.id } });
                    purged++;
                }
            }

            if (purged > 0) {
                console.log(`🧹 Startup purge complete: removed ${purged} stale room(s).`);
            } else {
                console.log(`🧹 Startup purge: no stale rooms found.`);
            }
        } catch (err) {
            console.error('Startup room purge failed:', err);
        }
    }

    /**
     * Start a recurring sweep that runs every `intervalMs` milliseconds.
     * Each sweep checks all active rooms and deletes any with 0 listeners.
     */
    start(intervalMs: number = 60_000): void {
        // Run an immediate sweep, then schedule recurring
        this.sweep();
        this.intervalId = setInterval(() => this.sweep(), intervalMs);
        console.log(`🔄 Room cleanup sweep scheduled every ${intervalMs / 1000}s`);
    }

    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    private async sweep(): Promise<void> {
        try {
            const activeRooms = await prisma.room.findMany({
                where: { status: 'active' },
                select: { id: true, name: true }
            });

            for (const room of activeRooms) {
                const listeners = await presenceService.getListenerCount(room.id);
                if (listeners === 0) {
                    console.log(`🧹 Sweep: deleting empty room "${room.name}" (${room.id})`);
                    roomState.clearPlaybackState(room.id);
                    roomState.clearPlaybackTimer(room.id);
                    roomState.clearHostDisconnectTimer(room.id);
                    await prisma.room.delete({ where: { id: room.id } });
                }
            }
        } catch (err) {
            console.error('Room cleanup sweep error:', err);
        }
    }
}
