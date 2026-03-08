import axios from 'axios';

export interface YouTubeMetadata {
    videoId: string;
    title: string;
    durationSeconds: number;
    thumbnailUrl?: string;
}

export class YouTubeService {
    private static readonly YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

    /**
     * Extracts the video ID from various YouTube URL formats.
     */
    static extractVideoId(input: string): string {
        try {
            const url = new URL(input);
            if (url.hostname === 'youtu.be') {
                return url.pathname.slice(1);
            }
            if (url.hostname.includes('youtube.com')) {
                if (url.pathname === '/watch') {
                    return url.searchParams.get('v') || input;
                }
                if (url.pathname.startsWith('/embed/')) {
                    return url.pathname.split('/')[2];
                }
                if (url.pathname.startsWith('/v/')) {
                    return url.pathname.split('/')[2];
                }
            }
            return input; // Assume it's already an ID if no match
        } catch (e) {
            return input; // Not a URL, assume it's an ID
        }
    }

    /**
     * Fetches metadata for a YouTube video.
     * Falls back to default values if API key is missing or request fails.
     */
    static async getMetadata(videoId: string): Promise<YouTubeMetadata> {
        const fallback: YouTubeMetadata = {
            videoId,
            title: `Track: ${videoId}`,
            durationSeconds: 240 // Default 4 minutes
        };

        if (!this.YOUTUBE_API_KEY) {
            console.log('⚠️ YOUTUBE_API_KEY not set — using fallback metadata');
            return fallback;
        }

        try {
            const url = `https://www.googleapis.com/youtube/v3/videos`;
            const res = await axios.get(url, {
                params: {
                    part: 'snippet,contentDetails',
                    id: videoId,
                    key: this.YOUTUBE_API_KEY
                }
            });

            const items = res.data.items || [];
            if (items.length === 0) return fallback;

            const item = items[0];
            const title = item.snippet.title;
            const isoDuration = item.contentDetails.duration;
            const durationSeconds = this.parseISODuration(isoDuration);

            return {
                videoId,
                title,
                durationSeconds,
                thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url
            };
        } catch (error: any) {
            console.error('YouTube metadata fetch failed:', error.message);
            return fallback;
        }
    }

    /**
     * Searches YouTube for videos matching a query, returning up to 10 results.
     */
    static async search(query: string): Promise<YouTubeMetadata[]> {
        if (!this.YOUTUBE_API_KEY) {
            console.log('⚠️ YOUTUBE_API_KEY not set — search will return empty array');
            return [];
        }

        try {
            // First, get the search results (list of video IDs)
            const searchUrl = `https://www.googleapis.com/youtube/v3/search`;
            const searchRes = await axios.get(searchUrl, {
                params: {
                    part: 'snippet',
                    type: 'video',
                    q: query,
                    maxResults: 10,
                    key: this.YOUTUBE_API_KEY
                }
            });

            const searchItems = searchRes.data.items || [];
            if (searchItems.length === 0) return [];

            const videoIds = searchItems.map((item: any) => item.id.videoId).join(',');

            // Second, fetch durations and better thumbnails
            const videosUrl = `https://www.googleapis.com/youtube/v3/videos`;
            const videosRes = await axios.get(videosUrl, {
                params: {
                    part: 'contentDetails,snippet',
                    id: videoIds,
                    key: this.YOUTUBE_API_KEY
                }
            });

            const items = videosRes.data.items || [];
            return items.map((item: any): YouTubeMetadata => {
                const title = item.snippet.title;
                const thumbnailUrl = item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url;
                const isoDuration = item.contentDetails.duration;
                const durationSeconds = this.parseISODuration(isoDuration);

                return {
                    videoId: item.id,
                    title,
                    durationSeconds,
                    thumbnailUrl
                };
            });
        } catch (error: any) {
            console.error('YouTube search proxy failed:', error.message);
            throw new Error('Failed to retrieve search results');
        }
    }

    /**
     * Converts ISO 8601 duration (e.g., PT4M3S) to seconds.
     */
    private static parseISODuration(duration: string): number {
        const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
        const matches = duration.match(regex);
        if (!matches) return 240;

        const hours = parseInt(matches[1] || '0');
        const minutes = parseInt(matches[2] || '0');
        const seconds = parseInt(matches[3] || '0');

        return hours * 3600 + minutes * 60 + seconds;
    }
}
