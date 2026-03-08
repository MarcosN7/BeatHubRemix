import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4002';

// Singleton socket instance, initially disconnected
export let socket: Socket | null = null;

export const connectSocket = () => {
    const token = useAuthStore.getState().token;
    if (!token) return null;

    if (!socket) {
        socket = io(SOCKET_URL, {
            auth: { token },
            autoConnect: true,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 10,
        });

        socket.on('connect', () => {
            console.log('[Socket] Connected:', socket?.id);
        });

        socket.on('disconnect', (reason) => {
            console.log('[Socket] Disconnected:', reason);
        });

        socket.on('connect_error', (err) => {
            console.error('[Socket] Connection Error:', err.message);
        });
    }

    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};
