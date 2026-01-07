import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import { Room } from '../models';

// Extend Socket to include user info
export interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

// Authenticate socket connection
export const authenticateSocket = async (socket: AuthenticatedSocket, next: any) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return next(new Error('JWT secret not configured'));
    }

    const decoded = jwt.verify(token, jwtSecret) as { id: string };
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    socket.userId = (user._id as any).toString();
    socket.username = user.username;

    next();
  } catch (error) {
    next(new Error('Authentication error: Invalid token'));
  }
};

// Room socket handlers
export const setupRoomHandlers = (io: Server) => {
  io.use(authenticateSocket);

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`User connected: ${socket.username} (${socket.userId})`);

    // Join room
    socket.on('join-room', async (data: { roomId: string }) => {
      try {
        const { roomId } = data;

        // Verify room exists and user has access
        const room = await Room.findOne({ roomId }).populate('ownerId', 'username');

        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        // Check access
        const hasAccess =
          room.isPublic ||
          room.ownerId._id.toString() === socket.userId ||
          room.collaborators.some((collab) => collab.toString() === socket.userId);

        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        // Join the room
        socket.join(`room:${roomId}`);
        socket.emit('room-joined', { roomId, room });

        // Notify others in the room
        socket.to(`room:${roomId}`).emit('user-joined', {
          userId: socket.userId,
          username: socket.username,
        });
      } catch (error: any) {
        socket.emit('error', { message: error.message || 'Failed to join room' });
      }
    });

    // Leave room
    socket.on('leave-room', (data: { roomId: string }) => {
      const { roomId } = data;
      socket.leave(`room:${roomId}`);

      socket.to(`room:${roomId}`).emit('user-left', {
        userId: socket.userId,
        username: socket.username,
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.username} (${socket.userId})`);
    });
  });
};








