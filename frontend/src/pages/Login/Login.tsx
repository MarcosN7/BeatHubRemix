import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { TerminalInput } from '../../components/common/TerminalInput';
import { TerminalButton } from '../../components/common/TerminalButton';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export const Login: React.FC = () => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const setAuth = useAuthStore((state) => state.setAuth);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (isRegistering) {
                await api.post('/auth/register', { username, email, password });
                // Auto login after register
                const res = await api.post('/auth/login', { email, password });
                setAuth(res.data.token, res.data.user.id, res.data.user.username);
            } else {
                const res = await api.post('/auth/login', { email, password });
                setAuth(res.data.token, res.data.user.id, res.data.user.username);
            }
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen w-full max-w-md mx-auto p-4 relative">
            <div className="w-full border border-term-border bg-term-bg p-8 shadow-2xl relative overflow-hidden">
                {/* Decorative terminal top bar elements */}
                <div className="absolute top-0 left-0 w-full h-1 bg-term-accent"></div>
                <div className="absolute top-3 right-4 flex gap-2 opacity-50">
                    <div className="w-2 h-2 bg-term-secondary"></div>
                    <div className="w-2 h-2 bg-term-secondary"></div>
                    <div className="w-2 h-2 bg-term-secondary"></div>
                </div>

                <div className="mb-10 text-center">
                    <h1 className="text-3xl font-bold text-term-text mb-2 tracking-widest">
                        BEATHUB<span className="text-term-accent">_</span>v2
                    </h1>
                    <p className="text-term-secondary text-sm">realtime collaborative music rooms</p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                    <div className="grid grid-cols-[100px_1fr] items-center gap-2">
                        <span className="text-term-secondary text-right">email:</span>
                        <TerminalInput
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="user@domain.com"
                            required
                        />
                    </div>

                    {isRegistering && (
                        <div className="grid grid-cols-[100px_1fr] items-center gap-2">
                            <span className="text-term-secondary text-right">username:</span>
                            <TerminalInput
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="your alias"
                                required
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-[100px_1fr] items-center gap-2">
                        <span className="text-term-secondary text-right">password:</span>
                        <TerminalInput
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {error && (
                        <div className="mt-4 p-2 border border-term-error text-term-error text-sm bg-term-error/10">
                            [ERROR] {error}
                        </div>
                    )}

                    {!isRegistering && (
                        <div className="text-right mt-1">
                            <Link to="/forgot-password" className="text-term-secondary hover:text-term-accent transition-colors text-xs">
                                [ forgotten credentials? ]
                            </Link>
                        </div>
                    )}

                    <div className="mt-6">
                        <TerminalButton type="submit" variant="primary" fullWidth disabled={loading}>
                            {loading ? 'PROCESSING...' : '> return ' + (isRegistering ? 'EXECUTE REGISTRATION' : 'EXECUTE LOGIN')}
                        </TerminalButton>
                    </div>
                </form>

                <div className="mt-8 border-t border-term-border border-dashed pt-4 text-center">
                    <button
                        type="button"
                        className="text-term-secondary hover:text-term-accent transition-colors text-sm"
                        onClick={() => {
                            setIsRegistering(!isRegistering);
                            setError(null);
                        }}
                    >
                        [ {isRegistering ? 'SWITCH TO LOGIN' : 'INITIALIZE REGISTRATION SEQUENCE'} ]
                    </button>
                </div>
            </div>
        </div>
    );
};
