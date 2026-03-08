import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { registerRoomHandlers } from './socket-handlers/room-events.handler';
import { allowedOrigins } from './config/cors';

// Extend the Socket type to carry the authenticated userId
export interface AuthenticatedSocket extends Socket {
    userId?: string;
}

let io: SocketIOServer;

export const initSocketServer = (server: HttpServer) => {
    io = new SocketIOServer(server, {
        cors: {
            origin: allowedOrigins,
            methods: ['GET', 'POST']
        }
    });

    // Authentication Middleware
    io.use((socket: AuthenticatedSocket, next) => {
        const token = socket.handshake.auth.token;

        if (!token) {
            return next(new Error('Authentication Error: Token missing'));
        }

        try {
            if (!process.env.JWT_SECRET) {
                throw new Error('JWT_SECRET not defined');
            }
            const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: string };
            socket.userId = decoded.userId;
            next();
        } catch (err) {
            return next(new Error('Authentication Error: Invalid or expired token'));
        }
    });

    io.on('connection', (socket: AuthenticatedSocket) => {
        console.log(`🔌 Socket connected: ${socket.id} (User: ${socket.userId})`);

        // Register all modular room handlers
        registerRoomHandlers(io, socket);

        // Disconnect handler
        socket.on('disconnect', () => {
            console.log(`🔌 Socket disconnected: ${socket.id}`);
        });
    });

    return io;
};

export const getIo = (): SocketIOServer => {
    if (!io) {
        throw new Error('Socket.io has not been initialized!');
    }
    return io;
};
