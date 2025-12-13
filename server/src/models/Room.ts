import mongoose, { Document, Schema, Types } from 'mongoose';
import { nanoid } from 'nanoid';

// TypeScript interface for Room
export interface IRoom extends Document {
  roomId: string;
  name: string;
  ownerId: Types.ObjectId;
  language: 'javascript' | 'python' | 'java' | 'cpp' | 'typescript' | 'go' | 'rust';
  code: string;
  collaborators: Types.ObjectId[];
  isPublic: boolean;
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
    isPublic: {
      type: Boolean,
      default: false,
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
      id = nanoid(12);
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
