import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { User } from '../models/User.js'  // ✅ Fixed import

// ✅ Interface for decoded JWT
interface DecodedToken {
  userId: string
}

// ✅ Extend Request type to include authenticated user
export interface AuthRequest extends Request {
  user?: {
    id: string
    username: string
    email: string
    avatar?: string
  }
}

// ✅ Authentication middleware
export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined

    // Extract Bearer token
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1]
    }

    if (!token) {
      res.status(401).json({ success: false, message: 'Not authorized, no token' })
      return
    }

    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      res.status(500).json({ success: false, message: 'JWT secret not configured' })
      return
    }

    // Verify and decode
    const decoded = jwt.verify(token, jwtSecret) as DecodedToken
    const user = await User.findById(decoded.userId).select('-password')

    if (!user) {
      res.status(401).json({ success: false, message: 'User not found' })
      return
    }

    // Attach user info to request
    req.user = {
      id: (user._id as any).toString(),
      username: user.username,
      email: user.email,
      avatar: user.avatar,
    }

    next()
  } catch (err: any) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      error: err.message,
    })
  }
}

// ✅ Optional alias for consistency
export const verifyToken = protect
