import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { TerminalInput } from '../../components/common/TerminalInput';
import { TerminalButton } from '../../components/common/TerminalButton';
import { api } from '../../services/api';

export const ResetPassword: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState<{ type: 'error' | 'success', message: string } | null>(null);
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus(null);

        if (!token) {
            setStatus({ type: 'error', message: 'Missing reset token in URL' });
            return;
        }

        if (newPassword !== confirmPassword) {
            setStatus({ type: 'error', message: 'Passwords do not match' });
            return;
        }

        if (newPassword.length < 6) {
            setStatus({ type: 'error', message: 'Password must be at least 6 characters' });
            return;
        }

        setLoading(true);

        try {
            await api.post('/auth/reset-password', {
                token,
                newPassword
            });

            setStatus({ type: 'success', message: 'Password reset successful. Redirecting to login...' });

            setTimeout(() => {
                navigate('/login');
            }, 2000);

        } catch (err: any) {
            setStatus({
                type: 'error',
                message: err.response?.data?.error || 'Failed to process request'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen w-full max-w-md mx-auto p-4 relative">
            <div className="w-full border border-term-border bg-term-bg p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-term-accent"></div>

                <div className="mb-8 text-center">
                    <h1 className="text-2xl font-bold text-term-text mb-2 tracking-widest">
                        EXECUTE_RESET
                    </h1>
                    <p className="text-term-secondary text-sm">enter new access credentials</p>
                </div>

                {!token ? (
                    <div className="text-center">
                        <div className="p-4 border border-term-error text-term-error bg-term-error/10 mb-6 font-bold">
                            [CRITICAL ERROR] INSUFFICIENT PARAMETERS
                            <br /><br />
                            <span className="font-normal text-sm">Reset token missing from URL. Please use the exact link sent to your email.</span>
                        </div>
                        <Link to="/login" className="text-term-secondary hover:text-term-accent transition-colors text-sm">
                            &lt; [ RETURN TO LOGIN ]
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                        <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                            <span className="text-term-secondary text-right">new pass:</span>
                            <TerminalInput
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                            <span className="text-term-secondary text-right">confirm pass:</span>
                            <TerminalInput
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        {status && (
                            <div className={`mt-4 p-2 border text-sm animate-pulse ${status.type === 'success'
                                ? 'border-term-accent text-term-accent bg-term-accent/10 font-bold'
                                : 'border-term-error text-term-error bg-term-error/10'
                                }`}>
                                [{status.type.toUpperCase()}] {status.message}
                            </div>
                        )}

                        <div className="mt-6">
                            <TerminalButton type="submit" variant="primary" fullWidth disabled={loading || status?.type === 'success'}>
                                {loading ? 'PROCESSING...' : '> OVERWRITE CREDENTIALS'}
                            </TerminalButton>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
