import express from 'express'
import { protect } from '../middleware/auth.js'
import {
  createCodeSession,
  getCodeSessionById,
  updateCodeSession,
  deleteCodeSession,
  getAllCodeSessions,
} from '../controllers/codeSessionController.js'

const router = express.Router()

// ✅ Create a new collaborative coding session
router.post('/create', protect, createCodeSession)

// ✅ Fetch all sessions (for a user or admin)
router.get('/', protect, getAllCodeSessions)

// ✅ Fetch a specific session by ID
router.get('/:sessionId', protect, getCodeSessionById)

// ✅ Update code in a session
router.put('/:sessionId', protect, updateCodeSession)

// ✅ Delete a session
router.delete('/:sessionId', protect, deleteCodeSession)

export default router


