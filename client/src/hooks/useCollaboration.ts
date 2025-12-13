import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSocket } from '../contexts/SocketContext'

type UserCursor = {
  userId: string
  username: string
  position: { lineNumber: number; column: number }
  color?: string
}

type ChatMsg = { username: string; message: string; at: string }
type TypingUser = { userId: string; username: string; isTyping: boolean }

export function useCollaboration(roomId: string | undefined) {
  const { socket, isConnected } = useSocket()
;(window as any).socket = socket
  const [code, setCode] = useState<string>('// Start coding...')
  const [language, setLanguage] = useState<string>('javascript')
  const [users, setUsers] = useState<Record<string, { username: string }>>({})
  const [cursors, setCursors] = useState<Record<string, UserCursor>>({})
  const [chat, setChat] = useState<ChatMsg[]>([])
  const [typingUsers, setTypingUsers] = useState<Record<string, TypingUser>>({})

  // Debounced emit for code updates
  const emitCode = useRef<ReturnType<typeof setTimeout> | null>(null)

  // --- Room Join / Leave ---
  useEffect(() => {
    if (!socket || !roomId || !isConnected) return
    socket.emit('room:join', { roomId })

    return () => {
      socket.emit('room:leave', { roomId })
    }
  }, [socket, roomId, isConnected])

  // --- Socket Listeners ---
  useEffect(() => {
    if (!socket || !roomId) return

    // When a new user joins
    const onJoined = (p: { roomId: string; userId: string; username: string }) => {
      setUsers(prev => ({ ...prev, [p.userId]: { username: p.username } }))
    }

    // When a user leaves
    const onLeft = (p: { roomId: string; userId: string }) => {
      setUsers(prev => {
        const n = { ...prev }
        delete n[p.userId]
        return n
      })
      setCursors(prev => {
        const n = { ...prev }
        delete n[p.userId]
        return n
      })
    }

    // ✅ NEW: Full user list sync (fixes mismatch)
    const onUsers = (data: { roomId: string; users: { userId: string; username: string }[] }) => {
      const updated: Record<string, { username: string }> = {}
      data.users.forEach(u => {
        if (u.userId) updated[u.userId] = { username: u.username }
      })
      setUsers(updated)
    }

    // Initial state when joining
    const onRoomState = (p: { code: string; language: string; roomName: string }) => {
      if (p.code) setCode(p.code)
      if (p.language) setLanguage(p.language)
    }

    // Code updates from others
    const onCode = (p: { roomId: string; code: string; userId: string }) => {
      setCode(p.code)
    }

    // Cursor updates
    const onCursor = (p: UserCursor) => {
      setCursors(prev => ({ ...prev, [p.userId]: p }))
    }

    // Language updates
    const onLang = (p: { roomId: string; language: string }) => {
      setLanguage(p.language)
    }

    // Chat messages
    const onChat = (p: { roomId: string; message: string; username: string; at: string }) => {
      setChat(prev => [...prev, { username: p.username, message: p.message, at: p.at }])
    }

    // Typing indicators
    const onUserTyping = (p: { roomId: string; userId: string; username: string; isTyping: boolean }) => {
      setTypingUsers(prev => ({
        ...prev,
        [p.userId]: { userId: p.userId, username: p.username, isTyping: p.isTyping },
      }))

      // Auto-remove typing indicator after timeout
      if (p.isTyping) {
        setTimeout(() => {
          setTypingUsers(prev => {
            const n = { ...prev }
            delete n[p.userId]
            return n
          })
        }, 3000)
      }
    }

    // Register all listeners
    socket.on('room:joined', onJoined)
    socket.on('room:left', onLeft)
    socket.on('room:users', onUsers) // ✅ Added
    socket.on('room:state', onRoomState)
    socket.on('code:update', onCode)
    socket.on('cursor:update', onCursor)
    socket.on('language:update', onLang)
    socket.on('chat:new', onChat)
    socket.on('user:typing', onUserTyping)

    return () => {
      socket.off('room:joined', onJoined)
      socket.off('room:left', onLeft)
      socket.off('room:users', onUsers) // ✅ Added cleanup
      socket.off('room:state', onRoomState)
      socket.off('code:update', onCode)
      socket.off('cursor:update', onCursor)
      socket.off('language:update', onLang)
      socket.off('chat:new', onChat)
      socket.off('user:typing', onUserTyping)
    }
  }, [socket, roomId])

  // --- Emitters ---
  const sendCode = useCallback(
    (value: string) => {
      setCode(value)
      if (!socket || !roomId) return
      if (emitCode.current) clearTimeout(emitCode.current)
      emitCode.current = setTimeout(() => {
        socket.emit('code:change', { roomId, code: value })
      }, 400)
    },
    [socket, roomId],
  )

  const sendCursor = useCallback(
    (pos: { lineNumber: number; column: number }) => {
      if (!socket || !roomId) return
      socket.emit('cursor:move', { roomId, position: pos })
    },
    [socket, roomId],
  )

  const changeLanguage = useCallback(
    (lang: string) => {
      setLanguage(lang)
      if (!socket || !roomId) return
      socket.emit('language:change', { roomId, language: lang })
    },
    [socket, roomId],
  )

  const sendChat = useCallback(
    (message: string, username: string) => {
      if (!socket || !roomId) return
      socket.emit('chat:send', { roomId, message, username })
    },
    [socket, roomId],
  )

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!socket || !roomId) return
      socket.emit('user:typing', { roomId, isTyping })
    },
    [socket, roomId],
  )

  // --- Debug: connection changes ---
  useEffect(() => {
    if (!isConnected) console.warn('⚠️ Disconnected from socket server')
  }, [isConnected])

  return useMemo(
    () => ({
      code,
      sendCode,
      cursors,
      sendCursor,
      language,
      changeLanguage,
      users,
      chat,
      sendChat,
      typingUsers,
      sendTyping,
      isConnected,
    }),
    [
      code,
      cursors,
      language,
      users,
      chat,
      typingUsers,
      sendCode,
      sendCursor,
      changeLanguage,
      sendChat,
      sendTyping,
      isConnected,
    ],
  )
}





