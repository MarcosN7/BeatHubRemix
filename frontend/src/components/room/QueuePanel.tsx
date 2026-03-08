import React, { useState } from 'react';
import { socket } from '../../services/socket';
import { api } from '../../services/api';
import { useRoomStore } from '../../store/roomStore';
import { useQueueStore } from '../../store/queueStore';
import { TerminalInput } from '../common/TerminalInput';

interface SearchResult {
    videoId: string;
    title: string;
    durationSeconds: number;
    thumbnailUrl?: string;
}

export const QueuePanel: React.FC = () => {
    const [songQuery, setSongQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);

    const roomId = useRoomStore(state => state.currentRoom?.id);
    const queue = useQueueStore(state => state.queue);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!songQuery.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const res = await api.get(`/youtube/search?q=${encodeURIComponent(songQuery)}`);
            setSearchResults(res.data);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleAddSong = (result: SearchResult) => {
        if (!socket || !roomId) return;
        setAddError(null);

        socket.emit('add_song', {
            roomId,
            youtubeVideoId: result.videoId,
            title: result.title,
            durationSeconds: result.durationSeconds
        }, (res: any) => {
            if (res?.error) {
                console.warn('Add song failed:', res.error);
                setAddError(res.error);
            } else {
                setSearchResults([]);
                setSongQuery('');
            }
        });
    };

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="mb-2 text-term-accent font-bold tracking-widest border-b border-term-border pb-1 flex justify-between">
                <span>&gt; SONG_QUEUE</span>
                <span className="text-term-secondary font-normal">
                    {searchResults.length > 0 ? '[ SEARCH_RESULTS ]' : `[ ${queue.length} TRACKS ]`}
                </span>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-2 pr-2 mb-4">
                {addError && (
                    <div className="text-term-error text-xs border border-term-error p-2 mb-2 bg-term-error/10">
                        [ERROR] {addError}
                    </div>
                )}

                {isSearching && (
                    <div className="text-term-secondary text-sm italic py-4 animate-blink">
                        [ Searching YouTube databases... ]
                    </div>
                )}

                {!isSearching && searchResults.length > 0 ? (
                    <>
                        <button
                            className="text-term-secondary hover:text-term-accent text-sm text-left mb-2 transition-colors border-b border-term-border pb-1"
                            onClick={() => {
                                setSearchResults([]);
                                setSongQuery('');
                            }}
                        >
                            &lt; [ Return to queue ]
                        </button>
                        {searchResults.map((result) => (
                            <div
                                key={result.videoId}
                                className="flex border border-term-border p-2 bg-term-bg/50 hover:bg-term-panel transition-colors cursor-pointer group"
                                onClick={() => handleAddSong(result)}
                            >
                                {result.thumbnailUrl && (
                                    <img
                                        src={result.thumbnailUrl}
                                        alt={result.title}
                                        className="w-16 h-12 object-cover mr-3 border border-term-border opacity-70 group-hover:opacity-100 transition-opacity"
                                    />
                                )}
                                <div className="flex flex-col justify-between flex-1 min-w-0">
                                    <span className="text-term-text truncate font-bold text-sm" dangerouslySetInnerHTML={{ __html: result.title }} />
                                    <span className="text-term-secondary text-xs">{formatDuration(result.durationSeconds)}</span>
                                </div>
                            </div>
                        ))}
                    </>
                ) : !isSearching && queue.length === 0 ? (
                    <div className="text-term-secondary text-sm italic py-4">
                        [ No upcoming tracks. Add a song below. ]
                    </div>
                ) : !isSearching && queue.length > 0 ? (
                    queue.map((song, idx) => (
                        <div key={song.id} className="flex flex-col border border-term-border p-2 bg-term-bg/50 group">
                            <div className="flex justify-between items-start">
                                <span className="text-term-text truncate max-w-[80%] font-bold">
                                    {idx + 1}. {song.title}
                                </span>
                                <span className="text-term-secondary text-xs">{formatDuration((song as any).duration || song.durationSeconds)}</span>
                            </div>
                            <div className="flex justify-between items-end mt-2">
                                <span className="text-term-secondary text-xs">
                                    added_by: {song.isSystemAdded ? 'SYSTEM' : song.addedByUsername}
                                </span>
                            </div>
                        </div>
                    ))
                ) : null}
            </div>

            <form onSubmit={handleSearch} className="mt-auto">
                <TerminalInput
                    value={songQuery}
                    onChange={(e) => setSongQuery(e.target.value)}
                    placeholder="search youtube videos..."
                    commandPrompt
                />
            </form>
        </div>
    );
};
