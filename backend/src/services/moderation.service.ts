import { ModerationRepository } from '../repositories/moderation.repository';
import { prisma } from '../lib/prisma';
import { RoomBan } from '@prisma/client';

export class ModerationService {
    private moderationRepository: ModerationRepository;

    constructor() {
        this.moderationRepository = new ModerationRepository();
    }

    async kickUser(roomId: string, targetUserId: string, requestingUserId: string): Promise<RoomBan> {
        // Enforce permissions: Must be HOST or ADMIN to kick someone
        const requester = await prisma.roomParticipant.findUnique({
            where: { userId_roomId: { userId: requestingUserId, roomId } }
        });

        if (!requester || (requester.role !== 'HOST' && requester.role !== 'ADMIN')) {
            throw new Error('Insufficient permissions to kick users.');
        }

        // Apply a 5 minute ban
        const ban = await this.moderationRepository.banUser(roomId, targetUserId, 5);

        // Remove them from active participants immediately
        await prisma.roomParticipant.delete({
            where: { userId_roomId: { userId: targetUserId, roomId } }
        });

        return ban;
    }

    async isUserBanned(roomId: string, userId: string): Promise<boolean> {
        return this.moderationRepository.isUserBanned(roomId, userId);
    }

    async registerSkipVote(roomId: string, userId: string, queueItemId: string): Promise<{ success: boolean }> {
        // This will reject duplicate votes completely via DB uniqueness constraints
        const success = await this.moderationRepository.addSkipVote(roomId, userId, queueItemId);
        if (!success) {
            throw new Error('You have already voted to skip this song.');
        }
        return { success: true };
    }

    async getTotalSkipVotes(queueItemId: string): Promise<number> {
        return this.moderationRepository.getSkipVoteCount(queueItemId);
    }
}
