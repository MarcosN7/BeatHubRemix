import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { connectSocket, disconnectSocket, socket } from '../../services/socket';
import { useRoomStore } from '../../store/roomStore';
import { useQueueStore } from '../../store/queueStore';
import { useChatStore } from '../../store/chatStore';
import { usePlaybackStore } from '../../store/playbackStore';

// UI Pieces
import { PlayerPanel } from '../../components/room/PlayerPanel';
import { QueuePanel } from '../../components/room/QueuePanel';
import { ChatPanel } from '../../components/room/ChatPanel';
import { UsersPanel } from '../../components/room/UsersPanel';
import { RoomHistoryPanel } from '../../components/room/RoomHistoryPanel';

export const MusicRoom: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Zustand Actions
    const setCurrentRoom = useRoomStore(state => state.setCurrentRoom);
    const setQueue = useQueueStore(state => state.setQueue);
    const setHistory = useQueueStore(state => state.setHistory);
    const addQueueItem = useQueueStore(state => state.addQueueItem);
    const removeQueueItem = useQueueStore(state => state.removeQueueItem);
    const addMessage = useChatStore(state => state.addMessage);
    const clearMessages = useChatStore(state => state.clearMessages);
    const clearPlaybackState = usePlaybackStore(state => state.clearPlaybackState);

    useEffect(() => {
        if (!id) {
            navigate('/dashboard');
            return;
        }

        // Wipe ghost state from any previous room
        setQueue([]);
        setHistory([]);
        clearMessages();
        clearPlaybackState();

        const initRoom = async () => {
            try {
                // 1. Fetch Room Auth & Status
                const res = await api.post(`/rooms/${id}/join`);
                setCurrentRoom(res.data);

                // 2. Connect Realtime Transport
                const s = connectSocket();
                if (!s) throw new Error('Failed to connect to realtime server');

                // 3. Request Room Join locally on socket
                s.emit('join_room', id, (response: any) => {
                    if (response.error) {
                        setError(response.error);
                        setLoading(false);
                    } else {
                        console.log('[Room] Joined successfully', response.room.name);
                        setLoading(false);
                    }
                });

                // Register heartbeat protocol
                const hbId = setInterval(() => {
                    s.emit('heartbeat', id);
                }, 15000);

                return () => {
                    clearInterval(hbId);
                    disconnectSocket();
                    setCurrentRoom(null);
                    setQueue([]);
                    setHistory([]);
                    clearMessages();
                    clearPlaybackState();
                };

            } catch (err: any) {
                setError(err.response?.data?.error || err.message);
                setLoading(false);
            }
        };

        let cleanupFn: (() => void) | void;
        initRoom().then(fn => {
            cleanupFn = fn;
        });

        return () => {
            if (cleanupFn) cleanupFn();
        };
    }, [id, navigate, setCurrentRoom]);

    // Handle Socket Events (Register only once when loading finishes)
    useEffect(() => {
        if (!socket || loading) return;

        const onQueueUpdated = (queueData: any[]) => setQueue(queueData);
        const onReceiveMessage = (msg: any) => addMessage(msg);
        const onUserJoined = (data: any) => addMessage({ userId: 'system', username: 'SYSTEM', content: `User ${data.userId.substring(0, 6)} joined.`, isSystem: true, timestamp: new Date().toISOString() });
        const onUserLeft = (data: any) => addMessage({ userId: 'system', username: 'SYSTEM', content: `User ${data.userId.substring(0, 6)} disconnected.`, isSystem: true, timestamp: new Date().toISOString() });

        // Auth & error broadcasts
        const onRateLimited = (data: any) => setError(`[ANTI-SPAM] ${data.message}`);

        socket.on('queue_updated', onQueueUpdated);
        socket.on('song_added', addQueueItem);
        socket.on('song_removed', removeQueueItem);
        socket.on('receive_message', onReceiveMessage);
        socket.on('user_joined', onUserJoined);
        socket.on('user_left', onUserLeft);
        socket.on('rate_limited', onRateLimited);

        return () => {
            socket?.off('queue_updated', onQueueUpdated);
            socket?.off('song_added', addQueueItem);
            socket?.off('song_removed', removeQueueItem);
            socket?.off('receive_message', onReceiveMessage);
            socket?.off('user_joined', onUserJoined);
            socket?.off('user_left', onUserLeft);
            socket?.off('rate_limited', onRateLimited);
        };
    }, [loading, setQueue, addQueueItem, removeQueueItem, addMessage]);

    if (loading) {
        return <div className="p-8 animate-blink text-term-accent">&gt; ESTABLISHING SECURE CONNECTION TO ROOM...</div>;
    }

    if (error) {
        return (
            <div className="p-8 flex flex-col items-start gap-4">
                <div className="text-term-error border border-term-error bg-term-error/10 p-4">
                    [CRITICAL FAILURE] {error}
                </div>
                <button className="text-term-secondary hover:text-term-text underline" onClick={() => navigate('/dashboard')}>
                    &gt; return_to_dashboard
                </button>
            </div>
        );
    }

    const roomName = useRoomStore.getState().currentRoom?.name || 'Unknown Room';

    return (
        <div className="flex flex-col h-screen w-full max-w-7xl mx-auto p-4 gap-4">

            {/* Room Header */}
            <div className="border border-term-border bg-term-panel p-2 flex justify-between items-center px-4">
                <div>
                    <span className="text-term-secondary">ROOM: </span>
                    <span className="text-term-accent font-bold truncate">{roomName}</span>
                </div>
                <div>
                    <button className="text-term-secondary hover:text-term-error text-sm" onClick={() => navigate('/dashboard')}>
                        [ leave_room ]
                    </button>
                </div>
            </div>

            {/* Grid Layout */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-[3fr_1fr] grid-rows-[auto_1fr] gap-4 min-h-0">

                {/* Top Left: Player Panel */}
                <div className="border border-term-border bg-term-panel row-span-1 lg:col-start-1 lg:col-end-2 p-4 min-h-[50vh]">
                    <PlayerPanel />
                </div>

                {/* Bottom Left: Queue & History (split horizontally) */}
                <div className="row-span-1 lg:col-start-1 lg:col-end-2 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
                    <div className="border border-term-border bg-term-panel p-4 flex flex-col min-h-0 h-64 md:h-80">
                        <QueuePanel />
                    </div>
                    <div className="border border-term-border bg-term-panel p-4 flex flex-col min-h-0 h-64 md:h-80">
                        <RoomHistoryPanel />
                    </div>
                </div>

                {/* Right Sidebar: Users & Chat */}
                <div className="lg:row-start-1 lg:row-span-2 lg:col-start-2 lg:col-end-3 grid grid-rows-[auto_1fr] gap-4 min-h-0">
                    <div className="border border-term-border bg-term-panel p-4 h-64 lg:h-auto">
                        <UsersPanel />
                    </div>
                    <div className="border border-term-border bg-term-panel p-4 flex flex-col min-h-0 h-64 lg:h-auto">
                        <ChatPanel />
                    </div>
                </div>

            </div>

        </div>
    );
};
