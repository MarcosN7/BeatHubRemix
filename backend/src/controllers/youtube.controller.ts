import { Request, Response } from 'express';
import { YouTubeService } from '../services/youtube.service';

export class YoutubeController {
    public search = async (req: Request, res: Response): Promise<void> => {
        try {
            const query = req.query.q as string;
            if (!query) {
                res.status(400).json({ error: 'Search query "q" is required' });
                return;
            }

            const results = await YouTubeService.search(query);
            res.json(results);
        } catch (error: any) {
            console.error('YouTube search proxy error:', error);
            res.status(500).json({ error: 'Failed to proxy YouTube search', details: error.message });
        }
    };
}
