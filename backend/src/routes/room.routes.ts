import { Router } from 'express';
import { RoomController } from '../controllers/room.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const roomController = new RoomController();

// Public discovery endpoint (must be ABOVE /:id routes)
router.get('/discover', roomController.discoverRooms);

// Only authenticated users can create rooms
router.post('/', authMiddleware, roomController.createRoom);

// Publicly viewable rooms
router.get('/', roomController.getRooms);

// Room history (public)
router.get('/:id/history', roomController.getRoomHistory);

// Only authenticated users can join rooms
router.post('/:id/join', authMiddleware, roomController.joinRoom);

export default router;
