import { QueueRepository } from '../repositories/queue.repository';
import { HistoryRepository } from '../repositories/history.repository';
import { RoomStateService } from './room-state.service';
import { RecommendationService } from './recommendation.service';
import { getIo } from '../socket';
import { QueueItem } from '@prisma/client';

export class QueueService {
    private queueRepo: QueueRepository;
    private historyRepo: HistoryRepository;
    private roomState: RoomStateService;
    private recommendations: RecommendationService;

    constructor() {
        this.queueRepo = new QueueRepository();
        this.historyRepo = new HistoryRepository();
        this.roomState = RoomStateService.getInstance();
        this.recommendations = new RecommendationService();
    }

    /**
     * Attempts to add a song. If successful, broadcasts 'song_added'.
     * If there is nothing currently playing, it automatically auto-plays the queue.
     */
    async addSong(roomId: string, userId: string, youtubeVideoId: string, title: string, durationSeconds: number): Promise<QueueItem> {
        // The repository ensures atomic limit enforcing and duplicate protecting.
        const song = await this.queueRepo.addSong({
            roomId,
            userId,
            youtubeVideoId,
            title,
            duration: durationSeconds
        });

        const io = getIo();
        io.to(roomId).emit('song_added', song);

        // Check if anything is playing
        const currentlyPlaying = await this.queueRepo.getPlayingSong(roomId);
        if (!currentlyPlaying) {
            // Auto start queue since it was empty
            await this.playNext(roomId);
        }

        return song;
    }

    /**
     * Promotes the next queued song to 'playing', updating the database and the backend memory timer.
     * Broadcasts 'play_song' containing the new song data and sync timestamps.
     */
    async playNext(roomId: string): Promise<void> {
        if (this.roomState.isTransitioning(roomId)) return;
        this.roomState.setTransitioning(roomId, true);

        try {
            // 1. Record the current playing song in history before promoting
            const currentPlaying = await this.queueRepo.getPlayingSong(roomId);
            if (currentPlaying) {
                await this.historyRepo.recordPlay(
                    roomId,
                    currentPlaying.youtubeVideoId,
                    currentPlaying.title,
                    currentPlaying.addedByUserId
                ).catch(err => console.error('History record failed:', err.message));
            }

            // 2. Promote next song
            const nextSong = await this.queueRepo.promoteNextSong(roomId);
            const io = getIo();

            if (nextSong) {
                // Initialize synchronized playback state
                this.roomState.startSong(roomId, nextSong.youtubeVideoId, nextSong.duration);
                const playbackState = this.roomState.getPlaybackState(roomId);

                // Broadcast the next track with sync data
                io.to(roomId).emit('play_song', {
                    song: nextSong,
                    startedAt: playbackState.startedAt,
                    isPlaying: true
                });

                // Backend safety timer — auto-progress when song should be done
                this.roomState.setPlaybackTimer(roomId, nextSong.duration * 1000, async () => {
                    console.log(`⏱️ Song finished naturally in room ${roomId}. Auto-progressing queue.`);
                    try {
                        await this.playNext(roomId);
                    } catch (err) {
                        console.error(`Safety timer auto-progression failed for room ${roomId}:`, err);
                    }
                });

                // 3. Check if recommendations are needed (async, non-blocking)
                this.recommendations.checkAndFill(roomId, nextSong.youtubeVideoId)
                    .catch(err => console.error('Recommendation check failed:', err.message));
            } else {
                // Queue is empty — clear playback state and notify clients
                this.roomState.clearPlaybackState(roomId);
                this.roomState.clearPlaybackTimer(roomId);
                io.to(roomId).emit('queue_empty');
            }

            this.roomState.setTransitioning(roomId, false);
        } catch (err) {
            this.roomState.setTransitioning(roomId, false);
            throw err;
        }
    }

    /**
     * Removes a queued song (if authorized/matching criteria)
     */
    async removeSong(roomId: string, songId: string, requestUserId: string): Promise<boolean> {
        const success = await this.queueRepo.removeSong(roomId, songId, requestUserId);
        if (success) {
            const io = getIo();
            io.to(roomId).emit('song_removed', songId);
        }
        return success;
    }

    /**
     * Returns the full pending queue for clients joining dynamically
     */
    async getQueue(roomId: string): Promise<QueueItem[]> {
        return this.queueRepo.getQueue(roomId);
    }
}
