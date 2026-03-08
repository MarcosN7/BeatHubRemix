import React, { useEffect, useRef, useState } from 'react';
import YouTube, { type YouTubeEvent, type YouTubePlayer } from 'react-youtube';
import { socket } from '../../services/socket';
import { useRoomStore } from '../../store/roomStore';
import { usePlaybackStore } from '../../store/playbackStore';
import { useQueueStore } from '../../store/queueStore';
import { useAuthStore } from '../../store/authStore';

export const PlayerPanel: React.FC = () => {
    const roomId = useRoomStore(state => state.currentRoom?.id);
    const hostId = useRoomStore(state => (state.currentRoom as any)?.hostId ?? (state.currentRoom as any)?.host?.id);
    const currentUserId = useAuthStore(state => state.userId);
    const playback = usePlaybackStore();
    const removeQueueItem = useQueueStore(state => state.removeQueueItem);
    const playerRef = useRef<YouTubePlayer | null>(null);
    const [playerReady, setPlayerReady] = useState(false);
    const [skipVotes, setSkipVotes] = useState<{ currentVotes: number; outOf: number } | null>(null);

    const amIHost = currentUserId === hostId;

    // Sync state received from server every 10s
    useEffect(() => {
        if (!socket || !roomId) return;

        const interval = setInterval(() => {
            socket?.emit('sync_state', roomId, (serverState: any) => {
                if (!serverState || !serverState.isPlaying || !playerRef.current || !playerReady) return;

                const serverCurrentTime = (Date.now() - serverState.startedAt) / 1000;
                const localCurrentTime = playerRef.current.getCurrentTime();

                // Drift correction: if off by more than 1s, force seek
                if (Math.abs(serverCurrentTime - localCurrentTime) > 1.5) {
                    console.warn(`[Drift Correction] Server: ${serverCurrentTime.toFixed(1)}s, Local: ${localCurrentTime.toFixed(1)}s -> Seeking`);
                    playerRef.current.seekTo(serverCurrentTime, true);
                }
            });
        }, 10000);

        return () => clearInterval(interval);
    }, [roomId, playerReady]);

    // Handle Play/Pause/Resume from server events
    useEffect(() => {
        if (!socket) return;

        const onPlaySong = (data: any) => {
            playback.setPlaybackState({
                currentSongId: data.song.youtubeVideoId,
                startedAt: data.startedAt,
                pauseOffset: 0,
                isPlaying: true
            });
            // When a song starts playing, it is moved from pending queue to active playback, so we remove it from the UI queue
            removeQueueItem(data.song.id);
            // Reset skip votes for the new song
            setSkipVotes(null);
        };

        const onPauseSong = (data: any) => {
            playback.setPlaybackState({
                isPlaying: false,
                pauseOffset: data.pauseOffset
            });
            playerRef.current?.pauseVideo();
        };

        const onResumeSong = (data: any) => {
            playback.setPlaybackState({
                isPlaying: true,
                startedAt: data.startedAt
            });
            // Force seek to the exact server time on resume
            const targetTime = (Date.now() - data.startedAt) / 1000;
            playerRef.current?.seekTo(targetTime, true);
            playerRef.current?.playVideo();
        };

        const onQueueEmpty = () => {
            playback.clearPlaybackState();
        };

        const onSkipVoteUpdated = (data: { currentVotes: number; outOf: number }) => {
            setSkipVotes(data);
        };

        socket?.on('play_song', onPlaySong);
        socket?.on('pause_song', onPauseSong);
        socket?.on('resume_song', onResumeSong);
        socket?.on('queue_empty', onQueueEmpty);
        socket?.on('skip_vote_updated', onSkipVoteUpdated);

        return () => {
            socket?.off('play_song', onPlaySong);
            socket?.off('pause_song', onPauseSong);
            socket?.off('resume_song', onResumeSong);
            socket?.off('queue_empty', onQueueEmpty);
            socket?.off('skip_vote_updated', onSkipVoteUpdated);
        };
    }, [playback]);

    const onReady = (event: YouTubeEvent) => {
        playerRef.current = event.target;
        setPlayerReady(true);
    };

    const onStateChange = (event: YouTubeEvent) => {
        const isPausedLocally = event.data === YouTube.PlayerState.PAUSED;
        const isEndedLocally = event.data === YouTube.PlayerState.ENDED;

        if (isPausedLocally && playback.isPlaying) {
            event.target.playVideo();
        }

        if (isEndedLocally && playback.currentSongId && roomId) {
            socket?.emit('song_finished', roomId, playback.currentSongId);
        }
    };

    const handleSkip = () => {
        if (!socket || !roomId) return;
        socket.emit('vote_skip', roomId, (res: any) => {
            if (res?.error) {
                console.warn('Skip failed:', res.error);
            }
        });
    };

    const opts = {
        height: '100%',
        width: '100%',
        playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
        },
    };

    return (
        <div className="flex flex-col h-full overflow-hidden relative">
            <div className="mb-2 text-term-accent font-bold tracking-widest border-b border-term-border pb-1">
                &gt; MEDIA_STREAM
            </div>

            <div className="flex-1 w-full bg-black border border-term-border relative flex items-center justify-center">
                {!playback.currentSongId ? (
                    <div className="text-term-secondary animate-blink">
                        [ waiting for media input ]
                    </div>
                ) : (
                    <div className="absolute inset-0 w-full h-full">
                        <YouTube
                            videoId={playback.currentSongId}
                            opts={opts}
                            onReady={onReady}
                            onStateChange={onStateChange}
                            className="w-full h-full pointer-events-none"
                            iframeClassName="w-full h-full"
                        />
                    </div>
                )}
            </div>

            <div className="mt-2 text-sm flex justify-between items-center text-term-secondary border-t border-term-border pt-1">
                <span>STATUS: {playback.isPlaying ? 'PLAYING' : 'READY'}</span>

                <div className="flex items-center gap-3">
                    {skipVotes && (
                        <span className="text-term-secondary text-xs">
                            SKIP: {skipVotes.currentVotes}/{skipVotes.outOf}
                        </span>
                    )}
                    {playback.currentSongId && (
                        <button
                            onClick={handleSkip}
                            className="text-term-accent hover:text-term-bg hover:bg-term-accent border border-term-accent px-2 text-xs transition-colors"
                        >
                            {amIHost ? 'FORCE SKIP' : 'VOTE SKIP'}
                        </button>
                    )}
                </div>

                <span className="text-term-accent">
                    {playback.currentSongId
                        ? `ID: ${playback.currentSongId}`
                        : 'NO SIGNAL'}
                </span>
            </div>
        </div>
    );
};
