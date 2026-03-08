import { Router } from 'express';
import { YoutubeController } from '../controllers/youtube.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const youtubeController = new YoutubeController();

// Only authenticated users can proxy search requests
router.get('/search', authMiddleware, youtubeController.search);

export default router;
