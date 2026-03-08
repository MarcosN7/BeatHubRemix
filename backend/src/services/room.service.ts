import { RoomRepository } from '../repositories/room.repository';
import { presenceService } from './presence.service';
import { Room } from '@prisma/client';

export class RoomService {
    private roomRepository: RoomRepository;

    constructor() {
        this.roomRepository = new RoomRepository();
    }

    async createRoom(data: { name: string; hostId: string }) {
        const { name, hostId } = data;

        // Create the room and set the host
        const room = await this.roomRepository.create({
            name,
            host: {
                connect: { id: hostId }
            },
            // Automatically add the host as the first participant
            participants: {
                create: {
                    user: { connect: { id: hostId } },
                    role: 'HOST'
                }
            }
        });

        return room;
    }

    async getActiveRooms() {
        return this.roomRepository.findAllActive();
    }

    async joinRoom(roomId: string, userId: string) {
        const room = await this.roomRepository.findById(roomId);

        if (!room) {
            throw new Error('Room not found');
        }

        if (room.status !== 'active') {
            throw new Error('This room is no longer active');
        }

        // Room.participants now contains the relation entity containing userId
        const isAlreadyParticipant = (room as any).participants.some((p: any) => p.userId === userId);
        if (isAlreadyParticipant) {
            // User is already in the room, simply return the room state
            return room;
        }

        return this.roomRepository.addParticipant(roomId, userId);
    }

    /**
     * Discovery endpoint: Returns public rooms enriched with live listener counts.
     */
    async discoverRooms() {
        const rooms = await this.roomRepository.findPublicRoomsForDiscovery();

        // Enrich with live presence counts
        const enriched = await Promise.all(rooms.map(async (room) => {
            const listeners = await presenceService.getListenerCount(room.id);
            return {
                id: room.id,
                name: room.name,
                host: room.host,
                listeners,
                currentSong: room.queue[0] || null,
                createdAt: room.createdAt
            };
        }));

        // Sort by live listeners (presence-based) and filter out empty rooms
        const activeOnly = enriched.filter(r => r.listeners > 0);
        activeOnly.sort((a, b) => b.listeners - a.listeners);

        return activeOnly;
    }
}
