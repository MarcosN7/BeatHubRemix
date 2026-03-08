import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TerminalInput } from '../../components/common/TerminalInput';
import { TerminalButton } from '../../components/common/TerminalButton';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export const Dashboard: React.FC = () => {
    const [createName, setCreateName] = useState('');
    const [joinId, setJoinId] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const username = useAuthStore(state => state.username);
    const logout = useAuthStore(state => state.logout);

    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!createName.trim()) return;
        setError(null);
        setLoading(true);
        try {
            const res = await api.post('/rooms', { name: createName });
            navigate(`/room/${res.data.id}`);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to create room');
            setLoading(false);
        }
    };

    const handleJoinRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinId.trim()) return;
        navigate(`/room/${joinId.trim()}`);
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="flex flex-col w-full max-w-4xl mx-auto p-4 min-h-screen">

            {/* Top Bar */}
            <div className="flex justify-between items-center border border-term-border bg-term-panel p-4 mb-8">
                <div>
                    <h1 className="text-xl font-bold tracking-widest text-term-accent">BeatHub Terminal</h1>
                    <p className="text-sm text-term-secondary">user: {username} | status: connected</p>
                </div>
                <div className="flex gap-4">
                    <TerminalButton variant="ghost" onClick={() => navigate('/discover')}>
                        [ discover_rooms ]
                    </TerminalButton>
                    <TerminalButton variant="ghost" onClick={handleLogout}>
                        [ logout ]
                    </TerminalButton>
                </div>
            </div>

            {error && (
                <div className="mb-8 p-4 border border-term-error text-term-error bg-term-error/10">
                    [ERROR] {error}
                </div>
            )}

            {/* Main Action Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* Create Room Panel */}
                <div className="border border-term-border bg-term-panel p-6">
                    <h2 className="text-term-accent mb-6 font-bold">&gt; create-room</h2>
                    <form onSubmit={handleCreateRoom} className="flex flex-col gap-4">
                        <TerminalInput
                            label="room name"
                            value={createName}
                            onChange={(e) => setCreateName(e.target.value)}
                            placeholder="my awesome room"
                            commandPrompt
                            required
                        />
                        <div className="mt-4">
                            <TerminalButton type="submit" disabled={loading} fullWidth>
                                {loading ? 'INITIALIZING...' : '> EXECUTE'}
                            </TerminalButton>
                        </div>
                    </form>
                </div>

                {/* Join Room Panel */}
                <div className="border border-term-border bg-term-panel p-6">
                    <h2 className="text-term-accent mb-6 font-bold">&gt; join-room [ID]</h2>
                    <form onSubmit={handleJoinRoom} className="flex flex-col gap-4">
                        <TerminalInput
                            label="room code"
                            value={joinId}
                            onChange={(e) => setJoinId(e.target.value)}
                            placeholder="uuid-here..."
                            commandPrompt
                            required
                        />
                        <div className="mt-4">
                            <TerminalButton type="submit" variant="secondary" disabled={loading} fullWidth>
                                &gt; EXECUTE
                            </TerminalButton>
                        </div>
                    </form>
                </div>

            </div>

            <div className="mt-auto pt-8 pb-4 text-center text-term-secondary text-sm">
                <p>System Online. Awaiting commands.</p>
            </div>

        </div>
    );
};
