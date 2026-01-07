import { useEffect, useMemo, useState } from 'react'
import logo from '../assets/logo.png'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../utils/api'
import { useToast } from '../contexts/ToastContext'

export default function Rooms() {
  const navigate = useNavigate()
  const { logout, user } = useAuth()

  // Replaced: rooms state populated from backend instead of mock
  // Shape aligns with backend: roomId is the public id field
  const [rooms, setRooms] = useState<{ roomId: string; name: string; description?: string; isPublic?: boolean }[]>([])

  // Added: loading and error states for UX
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [_error, setError] = useState<string | null>(null)

  const { show } = useToast()

  // Local UI state for create-room modal
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomDesc, setNewRoomDesc] = useState('')
  const [newRoomPublic, setNewRoomPublic] = useState(true)
  const [isJoinOpen, setIsJoinOpen] = useState(false)
  const [joinRoomId, setJoinRoomId] = useState('')

  // Derived: friendly greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  // Added: handle logout via auth store, then navigate to /login
  async function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  // Added: fetch rooms from backend on mount (persists across sessions)
  useEffect(() => {
    let active = true
      ; (async () => {
        try {
          setIsLoading(true)
          setError(null)
          // GET /api/rooms returns { success, data: { rooms } }
          const res = await api.get('/rooms')
          if (active) {
            const fetched = (res.data?.data?.rooms || []).map((r: any) => ({
              roomId: r.roomId,
              name: r.name,
              description: r.description,
              isPublic: r.isPublic,
            }))
            setRooms(fetched)
          }
        } catch (err: any) {
          const message = err?.response?.data?.message || 'Failed to fetch rooms'
          setError(message)
          show(message, 'error')
        } finally {
          setIsLoading(false)
        }
      })()
    return () => {
      active = false
    }
  }, [show])

  // Added: create a new room via backend, then prepend to list
  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault()
    if (!newRoomName.trim()) return
    try {
      setIsLoading(true)
      setError(null)
      // POST /api/rooms { name, isPublic } -> { data: { room } }
      const res = await api.post('/rooms', {
        name: newRoomName.trim(),
        isPublic: newRoomPublic,
        // description is not in controller schema; keep locally if needed later
      })
      const r = res.data?.data?.room
      if (r) {
        setRooms((prev) => [
          { roomId: r.roomId, name: r.name, description: r.description, isPublic: r.isPublic },
          ...prev,
        ])
        show('Room created successfully!', 'success')

        // Navigate to the newly created room
        setNewRoomName('')
        setNewRoomDesc('')
        setNewRoomPublic(true)
        setIsCreateOpen(false)

        // Navigate to the room
        navigate(`/rooms/${r.roomId}`)
      }
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to create room'
      setError(message)
      show(message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // Added: join room via backend (POST /api/rooms/:roomId/join) then navigate
  async function handleJoinRoom(roomId: string) {
    try {
      setIsLoading(true)
      setError(null)

      // Normalize Room ID
      const normalizedId = roomId.trim()

      // Validate format: Accept both ABC-123 (new) and 12-char legacy IDs
      const newFormat = /^[A-HJ-NP-Z]{3}-[2-9]{3}$/i
      const legacyFormat = /^[a-zA-Z0-9_-]{12}$/

      if (!newFormat.test(normalizedId) && !legacyFormat.test(normalizedId)) {
        show('Invalid Room ID format', 'error')
        setIsLoading(false)
        return
      }

      await api.post(`/rooms/${normalizedId}/join`)
      show('Joined room successfully!', 'success')
      navigate(`/rooms/${normalizedId}`)
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to join room'
      setError(message)
      show(message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle join room from modal
  async function handleJoinRoomSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!joinRoomId.trim()) return
    await handleJoinRoom(joinRoomId)
    setJoinRoomId('')
    setIsJoinOpen(false)
  }

  // Format Room ID input (support both ABC-123 and legacy formats)
  function handleRoomIdInput(value: string) {
    // Remove all non-alphanumeric characters except hyphen and underscore
    let formatted = value.replace(/[^A-Za-z0-9-_]/g, '')

    // Auto-add hyphen after 3 characters ONLY if it looks like ABC-123 format
    if (formatted.length === 3 && /^[A-Za-z]{3}$/.test(formatted)) {
      formatted = formatted.toUpperCase() + '-'
    } else if (formatted.length > 3 && formatted[3] !== '-' && /^[A-Za-z]{3}$/.test(formatted.slice(0, 3))) {
      // Insert hyphen if first 3 chars are letters
      formatted = formatted.slice(0, 3).toUpperCase() + '-' + formatted.slice(3)
    }

    // Limit to 12 characters (legacy) or 7 (ABC-123)
    formatted = formatted.slice(0, 12)

    setJoinRoomId(formatted)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="mx-auto max-w-6xl">
        {/* Added: Top bar with page title and a11y-friendly Logout button */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-[2px] shadow-lg shadow-indigo-500/30">
              <div className="w-full h-full bg-slate-900 rounded-[10px] overflow-hidden flex items-center justify-center">
                <img src={logo} alt="CollabCode Logo" className="w-full h-full object-cover" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">CollabCode</h1>
              <p className="text-slate-400 text-sm">
                {greeting}{user ? `, ${user.username}` : ''}. Select a room to start coding.
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-medium px-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
            aria-label="Log out"
          >
            {/* Added: Logout text button */}
            Logout
          </button>
        </div>

        {/* Added: Actions row with Create New Room button */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setIsJoinOpen(true)}
            className="rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-medium px-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 flex items-center gap-2"
          >
            <i className="fa-solid fa-right-to-bracket"></i>
            Join Room
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-medium px-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            Create New Room
          </button>
        </div>

        {/* Added: Rooms grid with glassmorphism cards */}
        {isLoading ? (
          <div className="mt-16 grid place-items-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="mt-16 text-center">
            <div className="inline-block backdrop-blur-lg bg-white/10 border border-white/10 rounded-xl px-6 py-8">
              <h2 className="text-white text-lg font-semibold mb-1">No rooms yet</h2>
              <p className="text-slate-300/80 text-sm">Create your first room to get started.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <div
                key={room.roomId}
                className="backdrop-blur-lg bg-white/10 border border-white/10 rounded-2xl p-5 shadow-xl flex flex-col"
              >
                <div className="mb-3">
                  <h3 className="text-white font-semibold text-lg">{room.name}</h3>
                  {room.description ? (
                    <p className="text-slate-300/80 text-sm">{room.description}</p>
                  ) : (
                    <p className="text-slate-300/60 text-sm">No description provided</p>
                  )}
                </div>
                <div className="mt-auto">
                  <button
                    onClick={() => handleJoinRoom(room.roomId)}
                    className="w-full rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-medium px-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  >
                    Join
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Join Room Modal */}
      {isJoinOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          {/* Modal backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/70"
            onClick={() => setIsJoinOpen(false)}
            aria-hidden="true"
          />
          {/* Modal panel */}
          <div className="relative w-full max-w-md backdrop-blur-lg bg-white/10 border border-white/10 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
              <i className="fa-solid fa-right-to-bracket text-indigo-400"></i>
              Join a Room
            </h2>
            <form onSubmit={handleJoinRoomSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-200 text-sm mb-1">Room ID</label>
                <input
                  value={joinRoomId}
                  onChange={(e) => handleRoomIdInput(e.target.value)}
                  required
                  maxLength={12}
                  className="w-full rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-300/60 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 font-mono text-lg tracking-wider text-center"
                  placeholder="ABC-123 or legacy ID"
                  autoFocus
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  Enter Room ID (ABC-123 or 12-character legacy ID)
                </p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsJoinOpen(false)}
                  className="flex-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium px-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joinRoomId.length < 3}
                  className="flex-1 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-medium px-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Join Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Added: Create Room modal (simple, accessible dialog) */}
      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          {/* Modal backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/70"
            onClick={() => setIsCreateOpen(false)}
            aria-hidden="true"
          />
          {/* Modal panel */}
          <div className="relative w-full max-w-md backdrop-blur-lg bg-white/10 border border-white/10 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-white text-lg font-semibold mb-4">Create a new room</h2>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-slate-200 text-sm mb-1">Room name</label>
                <input
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  required
                  minLength={3}
                  className="w-full rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-300/60 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  placeholder="e.g. Collaboration Hub"
                />
              </div>
              <div>
                <label className="block text-slate-200 text-sm mb-1">Description (optional)</label>
                <textarea
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-300/60 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  placeholder="What is this room about?"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                {/* Added: toggle for public/private room (stored as isPublic) */}
                <label className="flex items-center gap-2 text-slate-200 text-sm">
                  <input
                    type="checkbox"
                    checked={newRoomPublic}
                    onChange={(e) => setNewRoomPublic(e.target.checked)}
                  />
                  Public room
                </label>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium px-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-medium px-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}


