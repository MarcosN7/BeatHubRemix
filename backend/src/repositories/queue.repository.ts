import { Prisma, QueueItem } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class QueueRepository {
    async addSong(data: {
        roomId: string;
        youtubeVideoId: string;
        title: string;
        duration: number;
        userId: string;
    }, maxRetries = 7): Promise<QueueItem> {
        let attempts = 0;
        while (attempts < maxRetries) {
            try {
                return await prisma.$transaction(async (tx) => {
                    // 1. Check Room Limit (count active songs: queued + playing)
                    const roomQueueCount = await tx.queueItem.count({
                        where: { roomId: data.roomId, status: { in: ['queued', 'playing'] } }
                    });
                    if (roomQueueCount >= 50) {
                        throw new Error('Room queue limit reached (50 songs)');
                    }

                    // 2. Check User Limit (count active songs: queued + playing)
                    const userQueueCount = await tx.queueItem.count({
                        where: { roomId: data.roomId, addedByUserId: data.userId, status: { in: ['queued', 'playing'] } }
                    });
                    if (userQueueCount >= 5) {
                        throw new Error('User queue limit reached (5 songs)');
                    }

                    // 3. Duplicate Protection
                    const duplicate = await tx.queueItem.findFirst({
                        where: {
                            roomId: data.roomId,
                            youtubeVideoId: data.youtubeVideoId,
                            status: { in: ['queued', 'playing'] }
                        }
                    });
                    if (duplicate) {
                        throw new Error('This song is already in the queue');
                    }

                    // 4. Calculate Position (Highest queued/playing position + 1)
                    const highestPosItem = await tx.queueItem.findFirst({
                        where: { roomId: data.roomId },
                        orderBy: { position: 'desc' }
                    });
                    const nextPosition = highestPosItem ? highestPosItem.position + 1 : 1;

                    // 5. Create
                    return tx.queueItem.create({
                        data: {
                            roomId: data.roomId,
                            youtubeVideoId: data.youtubeVideoId,
                            title: data.title,
                            duration: data.duration,
                            addedByUserId: data.userId,
                            position: nextPosition,
                            status: 'queued'
                        }
                    });
                }, {
                    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
                });
            } catch (error: any) {
                // If it's a write conflict (P2034) and we have retries left, jitter and retry
                if (error.code === 'P2034' && attempts < maxRetries - 1) {
                    attempts++;
                    await new Promise(r => setTimeout(r, Math.random() * 200));
                    continue;
                }
                throw error; // Throw other constraints instantly (Limits/Duplicates)
            }
        }
        throw new Error('System overloaded. Could not enqueue song.');
    }

    async getQueue(roomId: string): Promise<QueueItem[]> {
        return prisma.queueItem.findMany({
            where: { roomId, status: 'queued' },
            orderBy: { position: 'asc' }
        });
    }

    async getPlayingSong(roomId: string): Promise<QueueItem | null> {
        return prisma.queueItem.findFirst({
            where: { roomId, status: 'playing' }
        });
    }

    async promoteNextSong(roomId: string): Promise<QueueItem | null> {
        return prisma.$transaction(async (tx) => {
            // Mark current playing as played
            await tx.queueItem.updateMany({
                where: { roomId, status: 'playing' },
                data: { status: 'played' }
            });

            // Find next song
            const nextSong = await tx.queueItem.findFirst({
                where: { roomId, status: 'queued' },
                orderBy: { position: 'asc' }
            });

            if (!nextSong) return null;

            // Mark next song as playing
            return tx.queueItem.update({
                where: { id: nextSong.id },
                data: { status: 'playing' }
            });
        }, {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        });
    }

    async removeSong(roomId: string, songId: string, requestUserId: string): Promise<boolean> {
        const item = await prisma.queueItem.findUnique({ where: { id: songId } });
        if (!item || item.roomId !== roomId || item.status !== 'queued') return false;

        // Either the person who added it, or we assume a check happens in the service layer for HOST/ADMIN
        // For atomic safety, we just delete it based on ID. The Authorization check should live above this.
        await prisma.queueItem.delete({ where: { id: songId } });
        return true;
    }
}
