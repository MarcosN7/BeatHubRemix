import axios from 'axios';
import { QueueRepository } from '../repositories/queue.repository';
import { getIo } from '../socket';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const SYSTEM_USER_ID = 'system-recommendation';

export class RecommendationService {
    private queueRepo: QueueRepository;
    private lastFetchPerRoom = new Map<string, number>(); // roomId -> timestamp
    private readonly COOLDOWN_MS = 60 * 1000; // Don't fetch more than once per minute

    constructor() {
        this.queueRepo = new QueueRepository();
    }

    /**
     * Checks if queue needs recommendations and auto-fills if conditions are met.
     * Called after playNext() completes.
     */
    async checkAndFill(roomId: string, currentVideoId?: string): Promise<void> {
        if (!YOUTUBE_API_KEY) {
            console.log('⚠️ YOUTUBE_API_KEY not set — skipping recommendations');
            return;
        }

        // Cooldown — avoid spamming YouTube API
        const lastFetch = this.lastFetchPerRoom.get(roomId) || 0;
        if (Date.now() - lastFetch < this.COOLDOWN_MS) return;

        // Check queue length
        const queue = await this.queueRepo.getQueue(roomId);
        if (queue.length >= 3) return; // Queue is healthy, no action needed

        const songsToAdd = 3 - queue.length;
        if (!currentVideoId) return;

        console.log(`🎵 Queue is low (${queue.length}). Fetching ${songsToAdd} recommendations...`);
        this.lastFetchPerRoom.set(roomId, Date.now());

        try {
            const related = await this.fetchRelatedVideos(currentVideoId, songsToAdd + 2);

            // Filter out songs already in queue or currently playing
            const existingIds = new Set(queue.map(q => q.youtubeVideoId));
            const candidates = related.filter(v => !existingIds.has(v.videoId));

            const io = getIo();
            let added = 0;

            for (const video of candidates.slice(0, songsToAdd)) {
                try {
                    await this.queueRepo.addSong({
                        roomId,
                        youtubeVideoId: video.videoId,
                        title: `🤖 ${video.title}`,
                        duration: video.duration || 240, // Default 4 min if unknown
                        userId: SYSTEM_USER_ID
                    });
                    added++;
                } catch (err: any) {
                    // Skip duplicates or limit errors silently
                    continue;
                }
            }

            if (added > 0) {
                const updatedQueue = await this.queueRepo.getQueue(roomId);
                io.to(roomId).emit('queue_updated', updatedQueue);
                console.log(`🤖 Added ${added} recommended songs to room ${roomId}`);
            }
        } catch (err: any) {
            console.error('Recommendation fetch failed:', err.message);
        }
    }

    /**
     * Fetch related videos from YouTube Data API v3.
     */
    private async fetchRelatedVideos(videoId: string, maxResults: number): Promise<Array<{
        videoId: string;
        title: string;
        duration?: number;
    }>> {
        // Use search endpoint for related videos
        const searchUrl = `https://www.googleapis.com/youtube/v3/search`;
        const searchRes = await axios.get(searchUrl, {
            params: {
                part: 'snippet',
                relatedToVideoId: videoId,
                type: 'video',
                videoCategoryId: '10', // Music category
                maxResults,
                key: YOUTUBE_API_KEY
            }
        });

        const items = searchRes.data.items || [];

        return items.map((item: any) => ({
            videoId: item.id.videoId,
            title: item.snippet.title,
            duration: undefined // YouTube search doesn't return duration; using default
        }));
    }
}
