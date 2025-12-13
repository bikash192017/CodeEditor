import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { User } from '../models/User.js'
import { AuthRequest } from '../middleware/auth.js'

// ✅ Helper: generate JWT token
const generateToken = (userId: string): string => {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) throw new Error('JWT secret not configured')
  return jwt.sign({ userId }, jwtSecret, { expiresIn: '7d' })
}

// ✅ Register new user
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password } = req.body

    if (!username || !email || !password) {
      res.status(400).json({ success: false, message: 'All fields are required' })
      return
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] })
    if (existingUser) {
      res.status(400).json({ success: false, message: 'User already exists' })
      return
    }

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    const user = await User.create({ username, email, password: hashedPassword })
    const token = generateToken(user._id.toString())

    res.status(201).json({
      success: true,
      token,
      data: {
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Registration failed' })
  }
}

// ✅ Login existing user
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password required' })
      return
    }

    const user = await User.findOne({ email }).select('+password')
    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid credentials' })
      return
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      res.status(401).json({ success: false, message: 'Invalid credentials' })
      return
    }

    const token = generateToken(user._id.toString())

    res.status(200).json({
      success: true,
      token,
      data: {
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Login failed' })
  }
}

// ✅ Get current authenticated user
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' })
      return
    }
    res.status(200).json({ success: true, data: { user: req.user } })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to get user' })
  }
}

// ✅ Update profile
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' })
      return
    }

    const { username, email, avatar } = req.body
    const user = await User.findById(req.user.id)
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' })
      return
    }

    if (username !== undefined) user.username = username
    if (email !== undefined) user.email = email
    if (avatar !== undefined) user.avatar = avatar

    await user.save()

    res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
    })
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to update profile' })
  }
}


