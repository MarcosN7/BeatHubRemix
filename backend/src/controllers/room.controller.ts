import { Request, Response } from 'express';
import { RoomService } from '../services/room.service';
import { HistoryRepository } from '../repositories/history.repository';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware';

const createRoomSchema = z.object({
    name: z.string().min(3).max(50),
});

export class RoomController {
    private roomService: RoomService;
    private historyRepo: HistoryRepository;

    constructor() {
        this.roomService = new RoomService();
        this.historyRepo = new HistoryRepository();
    }

    public createRoom = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            if (!req.userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const { name } = createRoomSchema.parse(req.body);
            const room = await this.roomService.createRoom({
                name,
                hostId: req.userId,
            });

            res.status(201).json(room);
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ error: 'Validation failed', details: error.issues });
            } else {
                res.status(400).json({ error: error.message });
            }
        }
    };

    public getRooms = async (req: Request, res: Response): Promise<void> => {
        try {
            const rooms = await this.roomService.getActiveRooms();
            res.status(200).json(rooms);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    };

    public joinRoom = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            if (!req.userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const { id } = req.params;

            if (!id) {
                res.status(400).json({ error: 'Room ID is required' });
                return;
            }

            const room = await this.roomService.joinRoom(id, req.userId);
            res.status(200).json(room);
        } catch (error: any) {
            if (error.message === 'Room not found') {
                res.status(404).json({ error: error.message });
            } else {
                res.status(400).json({ error: error.message });
            }
        }
    };

    /**
     * GET /rooms/discover — Public rooms sorted by listener count
     */
    public discoverRooms = async (req: Request, res: Response): Promise<void> => {
        try {
            const rooms = await this.roomService.discoverRooms();
            res.status(200).json(rooms);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    };

    /**
     * GET /rooms/:id/history — Play history for a room
     */
    public getRoomHistory = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const history = await this.historyRepo.getHistory(id, 50);
            res.status(200).json(history);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    };
}
