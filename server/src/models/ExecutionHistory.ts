import mongoose, { Schema, Document, Model } from 'mongoose'

// ✅ TypeScript interface for ExecutionHistory documents
export interface IExecutionHistory extends Document {
  user: mongoose.Types.ObjectId | null
  roomId?: string | null
  language: string
  code: string
  stdin?: string
  output?: string
  stderr?: string
  time?: number | null
  createdAt: Date
  updatedAt: Date
}

// ✅ Define schema
const executionHistorySchema = new Schema<IExecutionHistory>(
  {
    // Linked user (who executed the code)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Optional room (for collaborative sessions)
    roomId: {
      type: String,
      default: null,
    },

    // Language used (restricted for data consistency)
    language: {
      type: String,
      required: true,
      enum: ['javascript', 'typescript', 'python', 'cpp', 'java', 'c'],
    },

    // The code that was executed
    code: {
      type: String,
      required: true,
    },

    // Optional standard input
    stdin: {
      type: String,
      default: '',
    },

    // Execution output
    output: {
      type: String,
      default: '',
    },

    // Error output, if any
    stderr: {
      type: String,
      default: '',
    },

    // Execution time in milliseconds (optional)
    time: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
)

// ✅ Indexes for fast queries (by user or room)
executionHistorySchema.index({ user: 1, createdAt: -1 })
executionHistorySchema.index({ roomId: 1, createdAt: -1 })

// ✅ Create and export the model
export const ExecutionHistory: Model<IExecutionHistory> =
  mongoose.model<IExecutionHistory>('ExecutionHistory', executionHistorySchema)
