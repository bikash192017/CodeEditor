import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { registerSocketHandlers } from './socketHandler';
import type { ClientToServerEvents, ServerToClientEvents } from './socketTypes';

export function initializeSocket(httpServer: HttpServer): Server {
  const allowedOrigins =
    process.env.CLIENT_URLS?.split(',').map((s) => s.trim()) || [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176',
    ];

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    transports: ['websocket'],
  });

  console.log('⚡ Socket.IO initialized with allowed origins:', allowedOrigins);
  registerSocketHandlers(io);
  return io;
}
