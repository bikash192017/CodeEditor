import { Server } from 'socket.io'
import { CodeSession, Room } from '../models'
import { AuthenticatedSocket } from './roomHandlers'
import { runCode } from '../utils/codeRunner' // ✅ import your executor

// Code editor socket handlers
export const setupCodeHandlers = (io: Server): void => {
  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`🟢 Connected: ${socket.username || 'Guest'} (${socket.id})`)

    // --- Handle Code Changes ---
    socket.on('code-change', async (data: { roomId: string; code: string; userId: string }) => {
      try {
        const { roomId, code } = data

        // Verify room exists
        const room = await Room.findOne({ roomId })
        if (!room) {
          socket.emit('error', { message: 'Room not found' })
          return
        }

        // Update room code
        room.code = code
        await room.save()

        // Broadcast code change to other users
        socket.to(`room:${roomId}`).emit('code-updated', {
          code,
          userId: socket.userId,
          username: socket.username,
          timestamp: new Date(),
        })

        // Save snapshot in CodeSession
        let session = await CodeSession.findOne({ roomId: room._id })
        if (!session) {
          session = await CodeSession.create({ roomId: room._id })
        }

        session.snapshots.push({
          code,
          timestamp: new Date(),
          userId: socket.userId as any,
        })

        await session.save()
      } catch (error: any) {
        console.error('❌ Error in code-change:', error)
        socket.emit('error', { message: error.message || 'Failed to update code' })
      }
    })

    // --- Handle Cursor Updates ---
    socket.on('cursor-update', (data: { roomId: string; cursor: { line: number; column: number } }) => {
      const { roomId, cursor } = data
      socket.to(`room:${roomId}`).emit('cursor-changed', {
        userId: socket.userId,
        username: socket.username,
        cursor,
      })
    })

    // --- Handle Selection Updates ---
    socket.on('selection-update', (data: { roomId: string; selection: any }) => {
      const { roomId, selection } = data
      socket.to(`room:${roomId}`).emit('selection-changed', {
        userId: socket.userId,
        username: socket.username,
        selection,
      })
    })

    // --- Handle Chat Messages ---
    socket.on('chat-message', async (data: { roomId: string; message: string }) => {
      try {
        const { roomId, message } = data

        if (!message?.trim()) {
          socket.emit('error', { message: 'Message cannot be empty' })
          return
        }

        // Verify room exists
        const room = await Room.findOne({ roomId })
        if (!room) {
          socket.emit('error', { message: 'Room not found' })
          return
        }

        // Save message in session
        let session = await CodeSession.findOne({ roomId: room._id })
        if (!session) {
          session = await CodeSession.create({ roomId: room._id })
        }

        session.chatMessages.push({
          userId: socket.userId as any,
          username: socket.username || 'Unknown',
          message: message.trim(),
          timestamp: new Date(),
        })

        await session.save()

        // Broadcast to everyone in that room
        io.to(`room:${roomId}`).emit('chat-message-received', {
          userId: socket.userId,
          username: socket.username,
          message: message.trim(),
          timestamp: new Date(),
        })
      } catch (error: any) {
        console.error('❌ Error in chat-message:', error)
        socket.emit('error', { message: error.message || 'Failed to send chat message' })
      }
    })

    // --- 🧠 NEW: Handle Code Execution + Output Broadcast ---
    socket.on('code-run', async (data: { roomId: string; language: string; code: string; input?: string }) => {
      const { roomId, language, code, input } = data

      if (!roomId || !code) {
        socket.emit('error', { message: 'Missing roomId or code' })
        return
      }

      try {
        console.log(`🚀 Running code in room:${roomId} by ${socket.username}`)

        // Execute the code (using your codeRunner)
        const result = await runCode(language, code, input || '')

        // Save run info in DB
        const room = await Room.findOne({ roomId })
        if (room) {
          let session = await CodeSession.findOne({ roomId: room._id })
          if (!session) {
            session = await CodeSession.create({ roomId: room._id })
          }

          session.snapshots.push({
            code,
            timestamp: new Date(),
            userId: socket.userId as any,
          })

          await session.save()
        }

        // ✅ Broadcast output to all users in that room
        io.to(`room:${roomId}`).emit('code-output', {
          username: socket.username || 'Guest',
          language,
          output: result.output,
          timestamp: new Date().toLocaleTimeString(),
        })
      } catch (error: any) {
        console.error('❌ Error during code-run:', error)
        io.to(`room:${roomId}`).emit('code-output', {
          username: socket.username || 'Guest',
          language,
          output: `❌ Error: ${error.message || 'Execution failed'}`,
          timestamp: new Date().toLocaleTimeString(),
        })
      }
    })

    // --- Handle Disconnect ---
    socket.on('disconnect', () => {
      console.log(`❌ Disconnected: ${socket.username || 'Guest'} (${socket.id})`)
    })
  })
}
