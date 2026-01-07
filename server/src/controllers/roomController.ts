import { Response } from 'express';
import { Room } from '../models';
import { AuthRequest } from '../middleware/auth';
import { validateRoomIdFormat, normalizeRoomId } from '../utils/roomIdGenerator';

// ✅ Create room
export const createRoom = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const { name, language, isPublic } = req.body;
    console.log('🔵 Creating room with isPublic:', isPublic, 'type:', typeof isPublic);

    const room = await Room.create({
      name: name || 'Untitled Room',
      ownerId: req.user.id,
      language: language || 'javascript',
      isPublic: isPublic === true, // Explicitly convert to boolean, defaults to false
      users: [
        {
          userId: req.user.id,
          userName: req.user.username || 'Unknown',
          role: 'owner',
          joinedAt: new Date(),
        },
      ],
    });

    // Generate shareable link
    const shareableLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/rooms/${room.roomId}`;

    res.status(201).json({
      success: true,
      message: 'Room created successfully',
      data: {
        room,
        roomId: room.roomId,
        shareableLink
      },
    });
  } catch (error: any) {
    console.error('❌ Error creating room:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to create room' });
  }
};

// ✅ Get all rooms
export const getRooms = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { public: publicRooms, owner } = req.query;
    let query: any = {};

    if (publicRooms === 'true') query.isPublic = true;
    else if (req.user && owner === 'me') query.ownerId = req.user.id;
    else if (req.user) {
      query.$or = [
        { ownerId: req.user.id },
        { collaborators: req.user.id },
        { isPublic: true },
      ];
    } else query.isPublic = true;

    const rooms = await Room.find(query)
      .populate('ownerId', 'username email avatar')
      .populate('collaborators', 'username email avatar')
      .sort({ updatedAt: -1 });

    res.json({ success: true, data: { rooms } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch rooms' });
  }
};

// ✅ Get single room by roomId
export const getRoomById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { roomId } = req.params;
    console.log('📩 Fetching room:', roomId);

    const room = await Room.findOne({ roomId })
      .populate('ownerId', 'username email avatar')
      .populate('collaborators', 'username email avatar');

    if (!room) {
      console.log('❌ Room not found for:', roomId);
      res.status(404).json({ success: false, message: 'Room not found' });
      return;
    }

    console.log('🔍 Room details:', { roomId: room.roomId, name: room.name, isPublic: room.isPublic });

    if (!room.isPublic && req.user?.id !== room.ownerId.toString()) {
      const isCollab = room.collaborators.some(
        (c: any) => c._id.toString() === req.user?.id
      );
      if (!isCollab) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }
    }

    res.json({ success: true, data: { room } });
  } catch (error: any) {
    console.error('🔥 Error in getRoomById:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch room' });
  }
};

// ✅ Update room
export const updateRoom = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const { roomId } = req.params;
    const { name, language, code, isPublic } = req.body;

    const room = await Room.findOne({ roomId });
    if (!room) {
      res.status(404).json({ success: false, message: 'Room not found' });
      return;
    }

    if (room.ownerId.toString() !== req.user.id) {
      res.status(403).json({ success: false, message: 'Only room owner can update' });
      return;
    }

    if (name !== undefined) room.name = name;
    if (language !== undefined) room.language = language;
    if (code !== undefined) room.code = code;
    if (isPublic !== undefined) room.isPublic = isPublic;

    await room.save();

    const updated = await Room.findById(room._id)
      .populate('ownerId', 'username email avatar')
      .populate('collaborators', 'username email avatar');

    res.json({
      success: true,
      message: 'Room updated successfully',
      data: { room: updated },
    });
  } catch (error: any) {
    console.error('❌ Error updating room:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to update room' });
  }
};

// ✅ Add collaborator
export const addCollaborator = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const { roomId } = req.params;
    const { userId } = req.body;

    const room = await Room.findOne({ roomId });
    if (!room) {
      res.status(404).json({ success: false, message: 'Room not found' });
      return;
    }

    if (room.ownerId.toString() !== req.user.id) {
      res.status(403).json({ success: false, message: 'Only room owner can add collaborators' });
      return;
    }

    if (room.collaborators.includes(userId as any)) {
      res.status(400).json({ success: false, message: 'User is already a collaborator' });
      return;
    }

    room.collaborators.push(userId);
    await room.save();

    const updated = await Room.findById(room._id)
      .populate('ownerId', 'username email avatar')
      .populate('collaborators', 'username email avatar');

    res.json({
      success: true,
      message: 'Collaborator added successfully',
      data: { room: updated },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to add collaborator' });
  }
};

// ✅ Join room
export const joinRoom = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const { roomId } = req.params;

    // Validate Room ID format
    const normalizedRoomId = normalizeRoomId(roomId);
    if (!validateRoomIdFormat(normalizedRoomId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid room ID format. Expected format: ABC-123'
      });
      return;
    }

    const room = await Room.findOne({ roomId: normalizedRoomId });
    if (!room) {
      res.status(404).json({ success: false, message: 'Room not found' });
      return;
    }

    // Check if room is active
    if (!room.isActive) {
      res.status(403).json({ success: false, message: 'Room is no longer active' });
      return;
    }

    const isOwner = room.ownerId.toString() === req.user!.id;
    const isCollab = room.collaborators.some((id) => id.toString() === req.user!.id);

    // Note: Anyone with the Room ID can join (public or private)
    // The isPublic flag only affects dashboard visibility, not join access

    // Check if user is already in the room
    const existingUser = room.users.find(u => u.userId.toString() === req.user!.id);
    if (existingUser) {
      res.json({
        success: true,
        message: 'Already in room (rejoined successfully)',
        data: { room },
      });
      return;
    }

    // Check room capacity
    if (room.users.length >= room.maxUsers) {
      res.status(403).json({
        success: false,
        message: `Room is full (${room.users.length}/${room.maxUsers} users)`
      });
      return;
    }

    // Add user to room
    if (!isOwner && !isCollab) {
      room.collaborators.push(req.user!.id as any);
    }

    room.users.push({
      userId: req.user!.id as any,
      userName: req.user!.username || 'Unknown',
      role: isOwner ? 'owner' : 'collaborator',
      joinedAt: new Date(),
    });

    await room.save();

    const updated = await Room.findById(room._id)
      .populate('ownerId', 'username email avatar')
      .populate('collaborators', 'username email avatar');

    res.json({
      success: true,
      message: 'Joined room successfully',
      data: { room: updated },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to join room' });
  }
};

// ✅ Leave room
export const leaveRoom = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const { roomId } = req.params;
    const room = await Room.findOne({ roomId });
    if (!room) {
      res.status(404).json({ success: false, message: 'Room not found' });
      return;
    }

    if (room.ownerId.toString() === req.user.id) {
      res.status(400).json({
        success: false,
        message: 'Room owner cannot leave. Delete the room instead.',
      });
      return;
    }

    const index = room.collaborators.findIndex((id) => id.toString() === req.user!.id);
    if (index === -1) {
      res.status(400).json({ success: false, message: 'You are not a collaborator' });
      return;
    }

    room.collaborators.splice(index, 1);
    await room.save();

    res.json({ success: true, message: 'Left room successfully' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to leave room' });
  }
};

// ✅ Delete room
export const deleteRoom = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const { roomId } = req.params;
    const room = await Room.findOne({ roomId });
    if (!room) {
      res.status(404).json({ success: false, message: 'Room not found' });
      return;
    }

    if (room.ownerId.toString() !== req.user.id) {
      res.status(403).json({ success: false, message: 'Only room owner can delete' });
      return;
    }

    await Room.findByIdAndDelete(room._id);
    res.json({ success: true, message: 'Room deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to delete room' });
  }
};
