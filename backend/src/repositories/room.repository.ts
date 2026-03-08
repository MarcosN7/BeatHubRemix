import { Room, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class RoomRepository {
    /**
     * Creates a new room and sets the creator as the host.
     */
    async create(data: Prisma.RoomCreateInput): Promise<Room> {
        return prisma.room.create({ data });
    }

    /**
     * Fetches all active rooms, including basic host details.
     */
    async findAllActive(): Promise<Room[]> {
        return prisma.room.findMany({
            where: { status: 'active' },
            include: {
                host: {
                    select: { id: true, username: true } // Return safe host fields
                },
                _count: {
                    select: { participants: true } // Count participants avoiding over-fetching
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * Finds a room by its ID.
     */
    async findById(id: string) {
        return prisma.room.findUnique({
            where: { id },
            include: {
                host: { select: { id: true, username: true } },
                participants: {
                    include: { user: { select: { id: true, username: true } } }
                }
            }
        });
    }

    /**
     * Connects a user to a room's participant list with the default USER role.
     * Uses upsert wrapped in a try-catch to handle the Prisma race condition
     * where two concurrent upserts both attempt to CREATE simultaneously.
     */
    async addParticipant(roomId: string, userId: string): Promise<Room> {
        try {
            await prisma.roomParticipant.upsert({
                where: {
                    userId_roomId: { userId, roomId }
                },
                update: {}, // If user is already in the room, just keep them
                create: {
                    userId,
                    roomId,
                    role: 'USER'
                }
            });
        } catch (err: any) {
            // P2002 = Unique constraint violation — the participant was already created
            // by a concurrent request (HTTP join + socket join race). Safe to ignore.
            if (err.code !== 'P2002') {
                throw err;
            }
        }

        const room = await prisma.room.findUnique({
            where: { id: roomId },
            include: {
                host: { select: { id: true, username: true } },
                participants: {
                    include: { user: { select: { id: true, username: true } } }
                }
            }
        });

        if (!room) throw new Error('Room not found after adding participant');
        return room;
    }

    /**
     * Updates an existing participant's role within a room.
     */
    async updateParticipantRole(roomId: string, userId: string, newRole: 'HOST' | 'ADMIN' | 'USER'): Promise<void> {
        await prisma.roomParticipant.update({
            where: {
                userId_roomId: { userId, roomId }
            },
            data: { role: newRole }
        });
    }

    /**
     * Removes a participant from a room (on disconnect or leave).
     */
    async removeParticipant(roomId: string, userId: string): Promise<void> {
        await prisma.roomParticipant.delete({
            where: {
                userId_roomId: { userId, roomId }
            }
        });
    }

    /**
     * Fetches public active rooms for the discovery page, sorted by listener count.
     * Includes current playing song and participant count.
     */
    async findPublicRoomsForDiscovery() {
        return prisma.room.findMany({
            where: {
                status: 'active',
                isPublic: true
            },
            select: {
                id: true,
                name: true,
                createdAt: true,
                host: {
                    select: { id: true, username: true }
                },
                _count: {
                    select: { participants: true }
                },
                queue: {
                    where: { status: 'playing' },
                    select: {
                        title: true,
                        youtubeVideoId: true
                    },
                    take: 1
                }
            },
            orderBy: {
                participants: { _count: 'desc' }
            }
        });
    }

    /**
     * Deletes a room and cascades its related items (participants, queue, bans, history)
     */
    async deleteRoom(roomId: string): Promise<void> {
        await prisma.room.delete({
            where: { id: roomId }
        });
    }
}
