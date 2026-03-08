import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useRoomStore } from '../../store/roomStore';
import { useAuthStore } from '../../store/authStore';
import { socket } from '../../services/socket';

export const UsersPanel: React.FC = () => {
    const roomId = useRoomStore(state => state.currentRoom?.id);
    const [participants, setParticipants] = useState<any[]>([]);
    const currentUserId = useAuthStore(state => state.userId);
    const hostId = useRoomStore(state => state.currentRoom?.host.id);

    const fetchParticipants = async () => {
        if (!roomId) return;
        try {
            // Polling participants from API since socket doesn't push the full list on change yet
            // It's better to add a specific endpoint for this, but for now we filter active rooms if needed,
            // actually, the current backend /rooms/:id doesn't exist. Let's use the local state + user_joined/left events
            // Wait, we can fetch room details from POST /rooms/:id/join which returns the room with participants!
            const joinRes = await api.post(`/rooms/${roomId}/join`);
            setParticipants(joinRes.data.participants || []);
        } catch (err) {
            console.error('Failed to fetch participants', err);
        }
    };

    useEffect(() => {
        fetchParticipants();

        if (socket) {
            socket.on('user_joined', fetchParticipants);
            socket.on('user_left', fetchParticipants);
            return () => {
                socket?.off('user_joined', fetchParticipants);
                socket?.off('user_left', fetchParticipants);
            };
        }
    }, [roomId, socket]);

    const amIHost = currentUserId === hostId;

    const handleKick = (targetUserId: string) => {
        if (!socket || !roomId) return;
        socket.emit('kick_user', roomId, targetUserId);
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="mb-2 text-term-accent font-bold tracking-widest border-b border-term-border pb-1">
                &gt; CONNECTED_USERS
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto min-h-0 pr-2">
                {participants.map((p, idx) => {
                    const isMe = p.userId === currentUserId;
                    const isHost = p.role === 'HOST';

                    return (
                        <div key={idx} className="flex justify-between items-center text-sm group">
                            <div>
                                <span className="w-12 inline-block text-term-secondary">
                                    {isHost ? 'host' : p.role.toLowerCase()}
                                </span>
                                <span className={`ml-2 ${isMe ? 'text-term-accent font-bold' : 'text-term-text'}`}>
                                    {p.user.username} {isMe ? '(you)' : ''}
                                </span>
                            </div>

                            {amIHost && !isHost && !isMe && (
                                <button
                                    onClick={() => handleKick(p.userId)}
                                    className="hidden group-hover:block text-term-error hover:underline text-xs"
                                >
                                    [kick]
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
