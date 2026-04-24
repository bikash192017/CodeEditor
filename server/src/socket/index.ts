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
      'http://localhost:5177',
      'http://localhost:5178',
    ];

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        const isLocalhost = origin.startsWith('http://localhost:');
        if (isLocalhost || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'), false);
        }
      },
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  console.log('⚡ Socket.IO initialized with allowed origins:', allowedOrigins);
  registerSocketHandlers(io);
  return io;
}
