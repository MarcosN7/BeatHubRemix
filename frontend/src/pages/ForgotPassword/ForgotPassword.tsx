import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { TerminalInput } from '../../components/common/TerminalInput';
import { TerminalButton } from '../../components/common/TerminalButton';
import { api } from '../../services/api';

export const ForgotPassword: React.FC = () => {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<{ type: 'error' | 'success', message: string } | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus(null);
        setLoading(true);

        try {
            const res = await api.post('/auth/forgot-password', { email });
            setStatus({ type: 'success', message: res.data.message });
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
                {/* Decorative terminal top bar elements */}
                <div className="absolute top-0 left-0 w-full h-1 bg-term-accent"></div>

                <div className="mb-8 text-center">
                    <h1 className="text-2xl font-bold text-term-text mb-2 tracking-widest">
                        PASSWORD_RECOVERY
                    </h1>
                    <p className="text-term-secondary text-sm">enter email to initialize reset sequence</p>
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

                    {status && (
                        <div className={`mt-4 p-2 border text-sm ${status.type === 'success'
                            ? 'border-term-accent text-term-accent bg-term-accent/10'
                            : 'border-term-error text-term-error bg-term-error/10'
                            }`}>
                            [{status.type.toUpperCase()}] {status.message}
                        </div>
                    )}

                    <div className="mt-6">
                        <TerminalButton type="submit" variant="primary" fullWidth disabled={loading}>
                            {loading ? 'PROCESSING...' : '> REQUEST RESET COMMAND'}
                        </TerminalButton>
                    </div>
                </form>

                <div className="mt-8 border-t border-term-border border-dashed pt-4 text-center">
                    <Link to="/login" className="text-term-secondary hover:text-term-accent transition-colors text-sm">
                        &lt; [ ABORT & RETURN TO LOGIN ]
                    </Link>
                </div>
            </div>
        </div>
    );
};
