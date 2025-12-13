import express from 'express'
import { getAllUsers, getUserById } from '../controllers/userController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

// ✅ Get all users (protected)
router.get('/', protect, getAllUsers)

// ✅ Get user by ID (protected)
router.get('/:userId', protect, getUserById)

export default router


