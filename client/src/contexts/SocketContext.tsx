// ✅ Enhanced Socket.IO context for real-time collaboration
// - Sends both token and username to backend
// - Handles reconnection and cleanup cleanly

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../stores/authStore'

interface SocketContextValue {
  socket: Socket | null
  isConnected: boolean
  error: string | null
}

const SocketContext = createContext<SocketContextValue | null>(null)

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user) // ✅ ensure you have username here

  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Disconnect old socket if token or user changes
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }

    const SOCKET_URL =
      import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000'

  const user = useAuthStore.getState().user // get current user info (like username or id)

const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  autoConnect: true,
  withCredentials: true,
  auth: {
    token,
    username: user?.username || 'Guest',
    userId: user?._id || undefined,
  },
})


    socketRef.current = socket
    setError(null)

    // Connection listeners
    socket.on('connect', () => {
      console.log(`🟢 Connected to socket as ${user?.username || 'Guest'}`)
      setIsConnected(true)
      setError(null)
    })

    socket.on('disconnect', () => {
      console.log('🔴 Disconnected from socket')
      setIsConnected(false)
    })

    socket.on('connect_error', (err: Error) => {
      console.error('⚠️ Socket connect error:', err.message)
      setError(err.message)
    })

    // Cleanup on unmount or dependency change
    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [token, user])

  const value = useMemo<SocketContextValue>(
    () => ({
      socket: socketRef.current,
      isConnected,
      error,
    }),
    [isConnected, error],
  )

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext)
  if (!ctx) throw new Error('useSocket must be used within SocketProvider')
  return ctx
}





