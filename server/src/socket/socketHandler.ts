import { Server, Socket } from 'socket.io'
import { runCode } from '../utils/codeRunner'  // ✅ Import your code executor

interface RoomData {
  code: string
  language: string
  chat: { username: string; message: string; at: string }[]
}

const roomStates: Record<string, RoomData> = {}

export function registerSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket & { userId?: string; username?: string }) => {
    // --- Step 1: Extract Auth Info Safely ---
    const { token, username: providedUsername, userId: providedUserId } = socket.handshake.auth || {}

    socket.username = providedUsername || 'Guest'
    socket.userId = providedUserId || socket.id

    // --- Step 2: Decode JWT if token exists ---
    if (token) {
      try {
        const decoded: any = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
        if (decoded?.username) socket.username = decoded.username
        if (decoded?.id) socket.userId = decoded.id
      } catch (err) {
        console.error('❌ Invalid or malformed token:', err)
      }
    }

    console.log(`🟢 Connected: ${socket.username} (${socket.id})`)

    // --- Room Join ---
    socket.on('room:join', async ({ roomId }) => {
      if (!roomId) return
      socket.join(roomId)
        ; (socket as any).roomId = roomId
      console.log(`👋 ${socket.username} joined ${roomId}`)

      // Initialize room state if missing
      if (!roomStates[roomId]) {
        roomStates[roomId] = {
          code: getDefaultCode('javascript'),
          language: 'javascript',
          chat: [],
        }
      }

      // Notify others
      socket.to(roomId).emit('room:joined', {
        roomId,
        userId: socket.userId,
        username: socket.username,
      })

      // Send current state to new user
      socket.emit('room:state', roomStates[roomId])

      // Update user list
      const clients = await io.in(roomId).fetchSockets()
      const users = clients.map(c => ({
        userId: (c as any).userId || c.id,
        username: (c as any).username || 'Guest',
      }))
      console.log(`👥 Users in ${roomId}:`, users.map(u => u.username))
      io.to(roomId).emit('room:users', { roomId, users })
    })

    // --- Helper: Default code templates ---
    function getDefaultCode(lang: string) {
      switch (lang) {
        case 'python':
        case 'java':
        case 'c':
        case 'cpp':
          return '# Start coding...'
        case 'html':
          return '<!-- Start coding... -->'
        case 'css':
          return '/* Start coding... */'
        default:
          return '// Start coding...'
      }
    }

    // --- Room Leave ---
    socket.on('room:leave', async ({ roomId }) => {
      if (!roomId) return
      socket.leave(roomId)
      console.log(`🚪 ${socket.username} left ${roomId}`)

      socket.to(roomId).emit('room:left', { roomId, userId: socket.userId })

      const clients = await io.in(roomId).fetchSockets()
      const users = clients.map(c => ({
        userId: (c as any).userId || c.id,
        username: (c as any).username || 'Guest',
      }))
      io.to(roomId).emit('room:users', { roomId, users })
    })

    // --- Code Change ---
    socket.on('code:change', ({ roomId, code }) => {
      if (!roomId) return
      roomStates[roomId].code = code
      socket.to(roomId).emit('code:update', { roomId, code, userId: socket.userId })
    })

    // --- Cursor Movement ---
    socket.on('cursor:move', ({ roomId, position }) => {
      if (!roomId) return
      socket.to(roomId).emit('cursor:update', {
        userId: socket.userId,
        username: socket.username,
        position,
      })
    })

    // --- Language Change ---
    socket.on('language:change', ({ roomId, language }) => {
      if (!roomId) return
      roomStates[roomId].language = language
      io.to(roomId).emit('language:update', { roomId, language })
    })

    // --- Chat Message ---
    socket.on('chat:send', ({ roomId, message, username }) => {
      if (!roomId || !message) return
      const msg = {
        username,
        message,
        at: new Date().toISOString(),
      }
      roomStates[roomId].chat.push(msg)
      io.to(roomId).emit('chat:new', { roomId, ...msg })
    })

    // --- Code Run & Shared Output (Main Broadcasting Logic) ---
    socket.on('code:run', async ({ roomId, language, code, input }) => {
      if (!roomId) {
        console.warn('⚠️ code:run called without roomId')
        return
      }

      try {
        const result = await runCode(language, code, input)

        // ✅ Broadcast to all users in the same room
        io.to(roomId).emit('code:output', {
          roomId,
          username: socket.username,
          language,
          code,
          output: result.output,
          timestamp: new Date().toLocaleTimeString(),
        })

        console.log(`🚀 Code executed by ${socket.username} in ${roomId}`)
      } catch (err: any) {
        console.error('❌ Error in code:run:', err)
        io.to(roomId).emit('code:output', {
          roomId,
          username: socket.username,
          language,
          code,
          output: `❌ Error: ${err?.message || 'Execution failed'}`,
          timestamp: new Date().toLocaleTimeString(),
        })
      }
    })

    // --- Typing Indicator ---
    socket.on('user:typing', ({ roomId, isTyping }) => {
      if (!roomId) return
      socket.to(roomId).emit('user:typing', {
        roomId,
        userId: socket.userId,
        username: socket.username,
        isTyping,
      })
    })

    // --- Disconnect ---
    socket.on('disconnect', async () => {
      console.log(`❌ Disconnected: ${socket.username || socket.id}`)
      const rooms = Array.from(socket.rooms).filter(r => r !== socket.id)
      for (const roomId of rooms) {
        socket.to(roomId).emit('room:left', { roomId, userId: socket.userId })
        const clients = await io.in(roomId).fetchSockets()
        const users = clients.map(c => ({
          userId: (c as any).userId || c.id,
          username: (c as any).username || 'Guest',
        }))
        io.to(roomId).emit('room:users', { roomId, users })
      }
    })
  })
}


