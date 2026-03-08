import { Prisma, RoomBan } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class ModerationRepository {

    /**
     * Creates a room ban for a user, expiring after a set duration.
     * Throws an error if the user is a host (cannot kick the host).
     */
    async banUser(roomId: string, userId: string, durationMinutes: number = 5): Promise<RoomBan> {
        return prisma.$transaction(async (tx) => {
            // Ensure the user being banned isn't the HOST
            const participant = await tx.roomParticipant.findUnique({
                where: { userId_roomId: { userId, roomId } }
            });

            if (participant?.role === 'HOST') {
                throw new Error('Cannot kick the room host.');
            }

            const bannedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);

            // Upsert ban to update expiration if they're kicked again
            const existingBan = await tx.roomBan.findFirst({
                where: { roomId, userId }
            });

            if (existingBan) {
                return tx.roomBan.update({
                    where: { id: existingBan.id },
                    data: { bannedUntil }
                });
            }

            return tx.roomBan.create({
                data: {
                    roomId,
                    userId,
                    bannedUntil
                }
            });
        });
    }

    /**
     * Checks if a user currently has an active ban preventing them from joining.
     */
    async isUserBanned(roomId: string, userId: string): Promise<boolean> {
        const ban = await prisma.roomBan.findFirst({
            where: {
                roomId,
                userId,
                bannedUntil: { gt: new Date() } // ban is still active
            }
        });

        return !!ban;
    }

    // Skip Vote Tracking
    async addSkipVote(roomId: string, userId: string, queueItemId: string): Promise<boolean> {
        try {
            await prisma.skipVote.create({
                data: { roomId, userId, queueItemId }
            });
            return true;
        } catch (error: any) {
            // P2002 is Prisma's unique constraint violation code
            if (error.code === 'P2002') {
                return false; // User already voted
            }
            throw error;
        }
    }

    async getSkipVoteCount(queueItemId: string): Promise<number> {
        return prisma.skipVote.count({
            where: { queueItemId }
        });
    }
}
