import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// Determine base URL (default to localhost:4002 for backend in dev)
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4002/api';

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Auto-attach JWT token to requests
api.interceptors.request.use(
    (config) => {
        const token = useAuthStore.getState().token;
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Auto-logout on 401 Unauthorized
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            useAuthStore.getState().logout();
        }
        return Promise.reject(error);
    }
);
