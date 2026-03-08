import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { TerminalButton } from '../../components/common/TerminalButton';

interface DiscoverRoom {
    id: string;
    name: string;
    host: { id: string; username: string };
    listeners: number;
    currentSong: { title: string; youtubeVideoId: string } | null;
    createdAt: string;
}

export const Discover: React.FC = () => {
    const [rooms, setRooms] = useState<DiscoverRoom[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const fetchRooms = async () => {
        try {
            const res = await api.get('/rooms/discover');
            setRooms(res.data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to fetch rooms');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRooms();
        // Poll every 10 seconds for live listener counts
        const interval = setInterval(fetchRooms, 10000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col w-full max-w-4xl mx-auto p-4 min-h-screen">

            {/* Top Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-term-accent tracking-widest">&gt; PUBLIC_ROOMS</h1>
                <TerminalButton variant="ghost" onClick={() => navigate('/dashboard')}>
                    [ return_to_dash ]
                </TerminalButton>
            </div>

            <div className="border border-term-border bg-term-panel p-6 flex-1">
                {error && (
                    <div className="mb-4 text-term-error bg-term-error/10 p-2 border border-term-error">
                        [ERROR] {error}
                    </div>
                )}

                {loading ? (
                    <div className="text-term-secondary animate-blink">&gt; SCANNING NETWORK...</div>
                ) : rooms.length === 0 ? (
                    <div className="text-term-secondary">&gt; NO ACTIVE PUBLIC ROOMS FOUND</div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {/* Header Row */}
                        <div className="grid grid-cols-[3fr_1fr_4fr_auto] gap-4 pb-2 border-b border-term-secondary text-sm text-term-secondary mb-2">
                            <span>ROOM_NAME</span>
                            <span>LISTENERS</span>
                            <span>NOW_PLAYING</span>
                            <span className="text-right">ACTION</span>
                        </div>

                        {/* Room Rows */}
                        {rooms.map(room => (
                            <div
                                key={room.id}
                                className="grid grid-cols-[3fr_1fr_4fr_auto] gap-4 items-center py-2 hover:bg-term-bg transition-colors"
                            >
                                <div className="font-bold text-term-text truncate">{room.name}</div>
                                <div className="text-term-accent">{room.listeners}</div>
                                <div className="text-term-secondary truncate">
                                    {room.currentSong ? room.currentSong.title : '[ idle ]'}
                                </div>
                                <div>
                                    <TerminalButton variant="primary" onClick={() => navigate(`/room/${room.id}`)}>
                                        JOIN
                                    </TerminalButton>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
};
