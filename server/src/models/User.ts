import mongoose, { Schema, Document, Model } from 'mongoose'

// ✅ Define User interface
export interface IUser extends Document {
  username: string
  email: string
  password: string
  avatar?: string
  createdAt: Date
  updatedAt: Date
}

// ✅ User schema
const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
      unique: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      unique: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Hide password by default
    },
    avatar: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
)

// ✅ Create and export model
export const User: Model<IUser> = mongoose.model<IUser>('User', userSchema)


