import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { disconnectSocket } from '../services/socket';

interface AuthState {
    token: string | null;
    userId: string | null;
    username: string | null;
    setAuth: (token: string, userId: string, username: string) => void;
    logout: () => void;
    isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: null,
            userId: null,
            username: null,

            setAuth: (token, userId, username) => set({ token, userId, username }),

            logout: () => {
                set({ token: null, userId: null, username: null });
                disconnectSocket();
            },

            isAuthenticated: () => !!get().token,
        }),
        {
            name: 'beathub-auth-storage', // saves to localStorage so session persists
        }
    )
);
