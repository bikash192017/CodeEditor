import { Request, Response } from 'express'
import { User } from '../models/User.js'

// ✅ Fetch all users (requires authentication)
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find().select('-password')
    res.json({ success: true, data: users })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch users',
    })
  }
}

// ✅ Fetch a single user by ID
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.userId).select('-password')
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      })
      return
    }
    res.json({ success: true, data: user })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch user',
    })
  }
}


