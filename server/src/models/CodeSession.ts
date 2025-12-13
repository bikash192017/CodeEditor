import mongoose, { Document, Schema, Types } from 'mongoose';

// TypeScript interface for Snapshot
export interface ISnapshot {
  code: string;
  timestamp: Date;
  userId: Types.ObjectId;
}

// TypeScript interface for ChatMessage
export interface IChatMessage {
  userId: Types.ObjectId;
  username: string;
  message: string;
  timestamp: Date;
}

// TypeScript interface for CodeSession
export interface ICodeSession extends Document {
  roomId: Types.ObjectId;
  snapshots: ISnapshot[];
  chatMessages: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// Mongoose schema for Snapshot
const snapshotSchema = new Schema<ISnapshot>(
  {
    code: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    _id: false, // Don't create separate _id for subdocuments
  }
);

// Mongoose schema for ChatMessage
const chatMessageSchema = new Schema<IChatMessage>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false, // Don't create separate _id for subdocuments
  }
);

// Mongoose schema for CodeSession
const codeSessionSchema = new Schema<ICodeSession>(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room ID is required'],
    },
    snapshots: {
      type: [snapshotSchema],
      default: [],
    },
    chatMessages: {
      type: [chatMessageSchema],
      default: [],
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Limit snapshots array to last 50 entries
codeSessionSchema.pre('save', function (next) {
  if (this.snapshots.length > 50) {
    // Keep only the last 50 snapshots
    this.snapshots = this.snapshots.slice(-50);
  }
  next();
});

// Create unique index on roomId to enforce one session per room
codeSessionSchema.index({ roomId: 1 }, { unique: true });

// Export the model
export const CodeSession = mongoose.model<ICodeSession>('CodeSession', codeSessionSchema);



