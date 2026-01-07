import mongoose, { Document, Schema, Types } from 'mongoose';
import { generateRoomId } from '../utils/roomIdGenerator';

// TypeScript interface for Room
// User in room metadata
export interface IRoomUser {
  userId: Types.ObjectId;
  userName: string;
  role: 'owner' | 'collaborator';
  joinedAt: Date;
}

export interface IRoom extends Document {
  roomId: string;
  name: string;
  ownerId: Types.ObjectId;
  language: 'javascript' | 'python' | 'java' | 'cpp' | 'typescript' | 'go' | 'rust';
  code: string;
  collaborators: Types.ObjectId[];
  users: IRoomUser[]; // Active users with metadata
  maxUsers: number; // Maximum allowed users
  isPublic: boolean;
  isActive: boolean; // Room active status
  createdAt: Date;
  updatedAt: Date;
}

// Schema definition
const roomSchema = new Schema<IRoom>(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: [true, 'Room name is required'],
      trim: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner ID is required'],
    },
    language: {
      type: String,
      enum: ['javascript', 'python', 'java', 'cpp', 'typescript', 'go', 'rust'],
      default: 'javascript',
    },
    code: {
      type: String,
      default: '// Start coding...',
    },
    collaborators: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    users: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        userName: { type: String, required: true },
        role: { type: String, enum: ['owner', 'collaborator'], required: true },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    maxUsers: {
      type: Number,
      default: 50,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// ✅ Generate unique roomId if not already set
roomSchema.pre('validate', async function (next) {
  if (!this.roomId) {
    const RoomModel = mongoose.model<IRoom>('Room');
    let id: string;
    let unique = false;

    while (!unique) {
      id = generateRoomId(); // ABC-123 format
      const existing = await RoomModel.findOne({ roomId: id });
      if (!existing) unique = true;
    }

    this.roomId = id!;
  }
  next();
});

// Index for fast lookup
roomSchema.index({ roomId: 1 }, { unique: true });

export const Room = mongoose.model<IRoom>('Room', roomSchema);
