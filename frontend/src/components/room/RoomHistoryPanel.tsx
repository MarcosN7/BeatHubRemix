import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useRoomStore } from '../../store/roomStore';
import { useQueueStore } from '../../store/queueStore';

export const RoomHistoryPanel: React.FC = () => {
    const roomId = useRoomStore((state: any) => state.currentRoom?.id);
    const history = useQueueStore((state: any) => state.history);
    const setHistory = useQueueStore((state: any) => state.setHistory);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!roomId) return;
            setLoading(true);
            try {
                const res = await api.get(`/rooms/${roomId}/history`);
                setHistory(res.data);
            } catch (err) {
                console.error('Failed to fetch history', err);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
        // Poll every 30s as a fallback
        const interval = setInterval(fetchHistory, 30000);
        return () => clearInterval(interval);
    }, [roomId, setHistory]);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="mb-2 text-term-accent font-bold tracking-widest border-b border-term-border pb-1">
                &gt; ROOM_HISTORY
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-2 pr-2">
                {loading && history.length === 0 ? (
                    <div className="text-term-secondary animate-blink">[ fetching records... ]</div>
                ) : history.length === 0 ? (
                    <div className="text-term-secondary text-sm italic">[ No history available ]</div>
                ) : (
                    history.map((item: any) => (
                        <div key={item.id} className="text-xs border-b border-term-border border-dashed pb-1">
                            <div className="text-term-secondary mb-1">
                                [{new Date(item.playedAt).toLocaleTimeString()}] via {item.addedByUser?.username || item.addedByUserId}
                            </div>
                            <div className="text-term-text truncate">{item.youtubeVideoId} - {item.title || 'Unknown Title'}</div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
