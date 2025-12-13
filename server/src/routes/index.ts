import express from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import roomRoutes from './roomRoutes';
import codeSessionRoutes from './codeSessionRoutes';

const router = express.Router();

// API routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/rooms', roomRoutes);
router.use('/sessions', codeSessionRoutes);

export default router;








