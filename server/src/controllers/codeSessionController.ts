import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { CodeSession } from '../models/CodeSession.js'

// ✅ Create a new code session
export const createCodeSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' })
      return
    }

    const { roomId, language, code } = req.body

    const session = await CodeSession.create({
      roomId,
      language: language || 'javascript',
      code: code || '',
      ownerId: req.user.id,
    })

    res.status(201).json({
      success: true,
      message: 'Code session created successfully',
      data: { session },
    })
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create code session',
    })
  }
}

// ✅ Get all sessions (for current user)
export const getAllCodeSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sessions = await CodeSession.find({
      $or: [{ ownerId: req.user?.id }, { isPublic: true }],
    })
      .sort({ updatedAt: -1 })
      .populate('ownerId', 'username email avatar')

    res.json({ success: true, data: { sessions } })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch sessions' })
  }
}

// ✅ Get session by ID
export const getCodeSessionById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params

    const session = await CodeSession.findById(sessionId)
      .populate('ownerId', 'username email avatar')
      .populate('roomId')

    if (!session) {
      res.status(404).json({ success: false, message: 'Code session not found' })
      return
    }

    res.json({ success: true, data: { session } })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to get session' })
  }
}

// ✅ Update session code
export const updateCodeSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params
    const { code } = req.body

    const session = await CodeSession.findById(sessionId)

    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' })
      return
    }

    session.code = code
    await session.save()

    res.json({
      success: true,
      message: 'Code updated successfully',
      data: { session },
    })
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update code',
    })
  }
}

// ✅ Delete session
export const deleteCodeSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params
    const session = await CodeSession.findByIdAndDelete(sessionId)

    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' })
      return
    }

    res.json({ success: true, message: 'Session deleted successfully' })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to delete session' })
  }
}


