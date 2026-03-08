import { prisma } from '../lib/prisma';

export class HistoryRepository {
    /**
     * Record a song that was just played into the room history.
     */
    async recordPlay(roomId: string, youtubeVideoId: string, title: string, addedByUserId: string) {
        return prisma.roomHistory.create({
            data: {
                roomId,
                youtubeVideoId,
                title,
                addedByUserId
            }
        });
    }

    /**
     * Get the play history for a room, most recent first.
     */
    async getHistory(roomId: string, limit: number = 50) {
        const history = await prisma.roomHistory.findMany({
            where: { roomId },
            orderBy: { playedAt: 'desc' },
            take: limit
        });

        const userIds = [...new Set(history.map(h => h.addedByUserId))];
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, username: true }
        });

        const userMap = new Map(users.map(u => [u.id, u.username]));

        return history.map(item => ({
            ...item,
            addedByUser: {
                id: item.addedByUserId,
                username: userMap.get(item.addedByUserId) || (item.addedByUserId === 'system-recommendation' ? 'System' : 'Unknown User')
            }
        }));
    }
}
