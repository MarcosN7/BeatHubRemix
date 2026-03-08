import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedSocket } from '../socket';
import { RoomStateService } from '../services/room-state.service';
import { RoomRepository } from '../repositories/room.repository';
import { QueueService } from '../services/queue.service';
import { QueueRepository } from '../repositories/queue.repository';
import { rateLimitService } from '../services/rate-limit.service';
import { ModerationService } from '../services/moderation.service';
import { presenceService } from '../services/presence.service';
import { prisma } from '../lib/prisma';
import { YouTubeService } from '../services/youtube.service';

const roomState = RoomStateService.getInstance();
const roomRepo = new RoomRepository();
const queueService = new QueueService();
const queueRepo = new QueueRepository();
const moderationService = new ModerationService();

export const registerRoomHandlers = (io: SocketIOServer, socket: AuthenticatedSocket) => {

    // --- JOIN ROOM ---
    socket.on('join_room', async (roomId: string, callback: (res: any) => void) => {
        try {
            const userId = socket.userId!;

            // 1. Check if user is banned (checks DB persistence)
            const isBanned = await moderationService.isUserBanned(roomId, userId);
            if (isBanned || roomState.isBanned(roomId, userId)) {
                return callback({ error: 'You are currently banned from this room' });
            }

            // 2. Fetch room & Validate
            const room = await roomRepo.findById(roomId);
            if (!room || room.status !== 'active') {
                return callback({ error: 'Room is inactive or does not exist' });
            }

            // 3. Clear any pending Host disconnection timers if the Host rejoined
            if (room.hostId === userId) {
                roomState.clearHostDisconnectTimer(roomId);
            }

            // 4. Join Socket.io Room network
            socket.join(roomId);

            // 5. Sync queue state strictly reading from Backend True State
            const queue = await queueService.getQueue(roomId);
            const playing = await queueRepo.getPlayingSong(roomId);

            socket.emit('queue_updated', queue);

            // 6. Sync playback state for late-joiner synchronization
            const playbackState = roomState.getPlaybackState(roomId);
            if (playing && playbackState.currentSongId) {
                socket.emit('play_song', {
                    song: playing,
                    startedAt: playbackState.startedAt,
                    isPlaying: playbackState.isPlaying
                });
                socket.emit('sync_state', playbackState);
            }

            // 7. Register presence
            await presenceService.heartbeat(roomId, userId);

            // Announce to others
            socket.to(roomId).emit('user_joined', { userId });
            callback({ success: true, room });

        } catch (error: any) {
            callback({ error: error.message });
        }
    });

    // --- DISCONNECT ---
    socket.on('disconnecting', async () => {
        const userId = socket.userId!;
        const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);

        for (const roomId of rooms) {
            await presenceService.removeUser(roomId, userId);

            try {
                // Remove the participant from the DB so the user list stays accurate
                await roomRepo.removeParticipant(roomId, userId);
            } catch (err) {
                // Ignore if participant was already removed (e.g. kicked)
            }

            // Emit user_left AFTER DB cleanup so re-fetch returns the correct list
            socket.to(roomId).emit('user_left', { userId });

            try {
                // Check if the room is now completely empty
                const activeListeners = await presenceService.getListenerCount(roomId);
                if (activeListeners === 0) {
                    console.log(`🗑️ Room ${roomId} is now empty. Deleting to save resources.`);
                    roomState.clearPlaybackState(roomId);
                    roomState.clearPlaybackTimer(roomId);
                    roomState.clearHostDisconnectTimer(roomId);
                    await roomRepo.deleteRoom(roomId);
                    continue; // Skip succession logic since the room is dead
                }

                const room = await roomRepo.findById(roomId);
                if (room && room.hostId === userId) {
                    console.log(`⚠️ Host ${userId} disconnected from room ${roomId}. Starting 60s succession timer.`);
                    roomState.setHostDisconnectTimer(roomId, async () => {
                        await executeHostSuccession(io, roomId, userId);
                    }, 60000); // 60 seconds
                }
            } catch (err) {
                console.error('Failed to handle disconnect or delete empty room:', err);
            }
        }
    });

    // --- KICK USER ---
    socket.on('kick_user', async ({ roomId, targetUserId }, callback: (res: any) => void) => {
        try {
            const myUserId = socket.userId!;

            // The service checks if `myUserId` is an ADMIN/HOST and throws if not.
            // It also inserts the 5 min DB RoomBan and removes them from room participants.
            await moderationService.kickUser(roomId, targetUserId, myUserId);

            // Force disconnect the target's sockets from this room
            const socketsInRoom = await io.in(roomId).fetchSockets();
            const targetSocket = socketsInRoom.find((s) => (s as unknown as AuthenticatedSocket).userId === targetUserId);
            if (targetSocket) {
                targetSocket.leave(roomId);
                io.to(targetSocket.id).emit('kicked', { roomId, reason: 'Kicked by moderator (5 minute ban)' });
            }

            // Announce kick
            io.to(roomId).emit('user_kicked', { userId: targetUserId, byId: myUserId });
            callback({ success: true });
        } catch (error: any) {
            callback({ error: error.message });
        }
    });

    // --- PROMOTE ADMIN ---
    socket.on('promote_admin', async ({ roomId, targetUserId }, callback: (res: any) => void) => {
        try {
            const myUserId = socket.userId!;
            const room = await roomRepo.findById(roomId);
            if (!room) return callback({ error: 'Room not found' });

            // Only HOST can promote
            if (room.hostId !== myUserId) {
                return callback({ error: 'Only the Host can promote users to Admin' });
            }

            // Important: Update DB state so future `room.participants.find` sees the new role
            const participantTarget = room.participants.find((p: any) => p.userId === targetUserId);
            if (!participantTarget) {
                return callback({ error: 'Target user is not in the room' });
            }

            await roomRepo.updateParticipantRole(roomId, targetUserId, 'ADMIN');

            io.to(roomId).emit('user_promoted', { userId: targetUserId, role: 'ADMIN' });
            callback({ success: true });
        } catch (error: any) {
            callback({ error: error.message });
        }
    });

    // --- VOTE SKIP ---
    socket.on('vote_skip', async (roomId: string, callback?: (res: any) => void) => {
        try {
            const userId = socket.userId!;

            if (rateLimitService.isMuted(userId)) {
                if (callback) callback({ error: 'You are muted and cannot vote.' });
                return;
            }

            const playingSong = await queueRepo.getPlayingSong(roomId);
            if (!playingSong) {
                if (callback) callback({ error: 'No song is currently playing' });
                return;
            }

            // 1. Host instantly skips
            const room = await roomRepo.findById(roomId);
            if (room && room.hostId === userId) {
                await queueService.playNext(roomId);
                if (callback) callback({ success: true });
                return;
            }

            // 2. Normal user / Admin vote logic
            // Prevent duplicate votes via DB unique constraint
            await moderationService.registerSkipVote(roomId, userId, playingSong.id);

            const activeSockets = await io.in(roomId).fetchSockets();
            const activeUserCount = activeSockets.length;
            const currentVotes = await moderationService.getTotalSkipVotes(playingSong.id);

            io.to(roomId).emit('skip_vote_updated', { currentVotes, outOf: activeUserCount });

            // Rule: skipVotes >= 50% of active users
            if (currentVotes >= Math.ceil(activeUserCount / 2)) {
                await queueService.playNext(roomId);
            }

            if (callback) callback({ success: true });

        } catch (error: any) {
            if (callback) callback({ error: error.message });
        }
    });

    // --- PLAYBACK CONTROL ---
    socket.on('playback_control', async ({ roomId, action }: { roomId: string, action: 'play' | 'pause' }) => {
        const myUserId = socket.userId!;
        const room = await roomRepo.findById(roomId);
        if (!room) return;

        const senderParticipant = room.participants.find((p: any) => p.userId === myUserId);
        if (!senderParticipant || (senderParticipant.role !== 'HOST' && senderParticipant.role !== 'ADMIN')) {
            return; // Silently ignore unauthorized playback attempts
        }

        if (action === 'pause') {
            roomState.pausePlaybackTimer(roomId);
            roomState.pauseSong(roomId);

            const state = roomState.getPlaybackState(roomId);
            io.to(roomId).emit('pause_song', {
                currentTime: state.currentTime,
                byId: myUserId
            });
        } else if (action === 'play') {
            roomState.resumePlaybackTimer(roomId, async () => {
                console.log(`⏱️ Song finished naturally in room ${roomId}. Auto-progressing queue.`);
                await queueService.playNext(roomId);
            });
            roomState.resumeSong(roomId);

            const state = roomState.getPlaybackState(roomId);
            io.to(roomId).emit('resume_song', {
                currentTime: state.currentTime,
                byId: myUserId
            });
        }
    });

    // --- SYNC STATE (Drift Correction) ---
    socket.on('sync_state', (roomId: string, callback?: (res: any) => void) => {
        const playbackState = roomState.getPlaybackState(roomId);
        if (callback) {
            callback(playbackState);
        } else {
            socket.emit('sync_state', playbackState);
        }
    });

    // --- SONG FINISHED (Frontend reports video ended) ---
    socket.on('song_finished', async (roomId: string, finishedSongId?: string, callback?: (res: any) => void) => {
        try {
            const playbackState = roomState.getPlaybackState(roomId);

            // Verify: only advance if a song is actually playing and is near completion
            if (!playbackState.currentSongId) {
                if (callback) callback({ error: 'No song is currently playing' });
                return;
            }

            // Verify the request applies to the currently playing song
            if (finishedSongId && playbackState.currentSongId !== finishedSongId) {
                if (callback) callback({ error: 'Song already finished or mismatch' });
                return;
            }

            // Allow a 3-second tolerance window
            const timeRemaining = playbackState.duration - playbackState.currentTime;
            if (timeRemaining > 3) {
                console.log(`⚠️ song_finished rejected: ${timeRemaining.toFixed(1)}s remaining`);
                if (callback) callback({ error: 'Song is not near completion' });
                return;
            }

            console.log(`🎵 song_finished accepted for room ${roomId}. Promoting next.`);
            await queueService.playNext(roomId);
            if (callback) callback({ success: true });
        } catch (error: any) {
            if (callback) callback({ error: error.message });
        }
    });

    // --- SMART ADD SONG ---
    socket.on('add_song', async ({ roomId, youtubeVideoId, title, durationSeconds }, callback) => {
        try {
            const myUserId = socket.userId!;

            // 1. Anti-Troll Rate Limit Check (Cooldowns & Spam Limits)
            const limitStatus = rateLimitService.recordSongAdd(myUserId);
            if (limitStatus.justMuted) {
                socket.emit('user_muted', { reason: 'Queue spam detected' });
            }

            if (limitStatus.error) {
                socket.emit('rate_limited', { action: 'add_song', message: limitStatus.error });
                return callback({ error: limitStatus.error });
            }

            // 2. Normalize Video ID & Fetch Metadata
            const videoId = YouTubeService.extractVideoId(youtubeVideoId);
            let finalTitle = title;
            let finalDuration = durationSeconds;

            if (!finalTitle || !finalDuration) {
                const metadata = await YouTubeService.getMetadata(videoId);
                finalTitle = finalTitle || metadata.title;
                finalDuration = finalDuration || metadata.durationSeconds;
            }

            // 3. Add via service logic (Checks max queue 50, user limit 5, duplicate protections)
            const addedSong = await queueService.addSong(roomId, myUserId, videoId, finalTitle, finalDuration);
            callback({ success: true, song: addedSong });

        } catch (error: any) {
            callback({ error: error.message });
        }
    });

    // --- REMOVE SONG ---
    socket.on('remove_song', async ({ roomId, songId }, callback) => {
        try {
            const myUserId = socket.userId!;
            if (rateLimitService.isMuted(myUserId)) {
                return callback({ error: 'You are muted and cannot remove songs.' });
            }

            const success = await queueService.removeSong(roomId, songId, myUserId);
            if (success) {
                callback({ success: true });
            } else {
                callback({ error: 'Song not found in queue or invalid room' });
            }
        } catch (error: any) {
            callback({ error: error.message });
        }
    });

    // --- CHAT MESSAGE ---
    socket.on('send_message', async ({ roomId, content }, callback) => {
        try {
            const myUserId = socket.userId!;

            // Apply chat ratelimits
            const limitStatus = rateLimitService.recordChatMessage(myUserId);
            if (limitStatus.justMuted) {
                socket.emit('user_muted', { reason: 'Chat spam detected' });
            }

            if (limitStatus.error) {
                socket.emit('rate_limited', { action: 'send_message', message: limitStatus.error });
                return callback({ error: limitStatus.error });
            }

            // Need user payload for chat emit
            const user = await prisma.user.findUnique({ where: { id: myUserId } });
            if (!user) throw new Error("User not found");

            io.to(roomId).emit('receive_message', {
                userId: myUserId,
                username: user.username,
                content,
                timestamp: new Date().toISOString()
            });

            if (callback) callback({ success: true });
        } catch (error: any) {
            callback({ error: error.message });
        }
    });

    // --- HEARTBEAT (Presence System) ---
    socket.on('heartbeat', async (roomId: string) => {
        const userId = socket.userId!;
        await presenceService.heartbeat(roomId, userId);
    });
};

/**
 * Executes the Host succession logic when the host disconnects for > 60s
 */
async function executeHostSuccession(io: SocketIOServer, roomId: string, oldHostId: string) {
    try {
        const roomRepo = new RoomRepository();
        const room = await roomRepo.findById(roomId);
        if (!room || room.status !== 'active') return;

        // If host rejoined within 60s, the timer was natively cleared, but verify just in case
        const activeSockets = await io.in(roomId).fetchSockets();
        const hostStillInRoom = activeSockets.some((s) => (s as unknown as AuthenticatedSocket).userId === oldHostId);
        if (hostStillInRoom) return; // False alarm

        console.log(`🔄 Executing Host Succession for Room: ${roomId}`);

        // Succession Logic: 1. Oldest Admin -> 2. Oldest User
        // Filter out the old host just to be safe
        const candidates = room.participants.filter((p: any) => p.userId !== oldHostId);
        if (candidates.length === 0) {
            console.log(`Room ${roomId} is empty. Succession aborted.`);
            return;
        }

        // Sort by joinedAt (Oldest first)
        candidates.sort((a: any, b: any) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());

        const oldestAdmin = candidates.find((c: any) => c.role === 'ADMIN');
        const nextHost = oldestAdmin || candidates[0]; // fallback to oldest user

        console.log(`👑 New Host assigned: ${nextHost.userId} (${nextHost.role})`);
        io.to(roomId).emit('host_transferred', { oldHostId, newHostId: nextHost.userId });

        // NOTE: In production you would update the `Room.hostId` and `RoomParticipant.role` in the DB

    } catch (error) {
        console.error('Succession Error:', error);
    }
}
