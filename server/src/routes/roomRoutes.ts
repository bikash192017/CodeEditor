import express from 'express';
import { protect } from '../middleware/auth';
import {
  createRoom,
  getRooms,
  getRoomById,
  updateRoom,
  addCollaborator,
  joinRoom,
  leaveRoom,
  deleteRoom,
} from '../controllers/roomController';

const router = express.Router();

// Routes
router.post('/', protect, createRoom);
router.get('/', protect, getRooms);
router.get('/:roomId', protect, getRoomById);
router.put('/:roomId', protect, updateRoom);
router.post('/:roomId/add-collaborator', protect, addCollaborator);
router.post('/:roomId/join', protect, joinRoom);
router.post('/:roomId/leave', protect, leaveRoom);
router.delete('/:roomId', protect, deleteRoom);

export default router;
