import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../utils/api'
import { useToast } from '../contexts/ToastContext'
import Editor, { OnMount } from '@monaco-editor/react'
import { useCollaboration } from '../hooks/useCollaboration'
import { useAuthStore } from '../stores/authStore'
import { CursorOverlayManager } from '../utils/monacoCursors'
import { format, parseISO } from 'date-fns'

export default function RoomEditor() {
  const { roomId } = useParams()
  const { show } = useToast()
  const [roomName, setRoomName] = useState('Room')
  const [outputLog, setOutputLog] = useState<any[]>([])
  const [stdin, setStdin] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [activeTab, setActiveTab] = useState<'output' | 'input' | 'debug'>('output')
  const [activeFile, setActiveFile] = useState('main')
  const [files, setFiles] = useState([
    { id: 'main', name: 'Main.java', language: 'java' },
    { id: 'input', name: 'input.txt', language: 'plaintext' },
  ])
  const [editorHeight, setEditorHeight] = useState(65)
  const resizerRef = useRef<HTMLDivElement>(null)
  const [showParticipants, setShowParticipants] = useState(false)
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)
  const [savedFiles, setSavedFiles] = useState<any[]>([])
  const [showSavedFiles, setShowSavedFiles] = useState(false)
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [activeSidebarTab, setActiveSidebarTab] = useState<'chat' | 'participants' | 'history'>('chat')

  const {
    code,
    sendCode,
    cursors,
    sendCursor,
    language,
    changeLanguage,
    users = {},
    chat = [],
    sendChat,
    typingUsers = [], // Fixed: Ensure it's an array
    sendTyping,
    isConnected,
  } = useCollaboration(roomId)

  const [chatInput, setChatInput] = useState('')
  const [localUsers, setLocalUsers] = useState<Array<{ id: string; name: string; color: string; status: string }>>([])
  const editorRef = useRef<any>(null)
  const cursorMgrRef = useRef<CursorOverlayManager | null>(null)
  const chatEndRef = useRef<HTMLDivElement | null>(null)
  const chatContainerRef = useRef<HTMLDivElement | null>(null)
  const languageDropdownRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const currentUser = useAuthStore((s) => s.user)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(event.target as Node)) {
        setShowLanguageDropdown(false)
      }
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setShowParticipants(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // --- Join Room ---
  useEffect(() => {
    if (!roomId) return
    ;(async () => {
      try {
        const res = await api.post(`/rooms/${roomId}/join`)
        const { success, data } = res.data
        if (success) setRoomName(data?.room?.name || 'Room')
      } catch {
        show('Failed to join room', 'error')
      }
    })()
  }, [roomId, show])

  // --- Editor setup ---
  const onEditorMount: OnMount = (editor) => {
    editorRef.current = editor
    cursorMgrRef.current = new CursorOverlayManager(editor)
    editor.onDidChangeCursorPosition((e) => sendCursor(e.position))
  }

  useEffect(() => {
    const mgr = cursorMgrRef.current
    if (!mgr || !editorRef.current) return
    Object.values(cursors || {}).forEach((c) =>
      mgr.upsert({ 
        userId: c.userId, 
        username: c.username, 
        color: (c as any).color, 
        position: c.position 
      })
    )
  }, [cursors])

  useEffect(() => {
    const mapped = Object.entries(users || {}).map(([id, u]) => ({
      id,
      name: u.username,
      color: getUserColor(id),
      status: Array.isArray(typingUsers) && typingUsers.includes(id) ? 'typing' : 'online' // Fixed
    }))
    setLocalUsers(mapped)
  }, [users, typingUsers])

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chat])

  // --- Run Code ---
  const handleRunCode = async () => {
    try {
      setIsRunning(true)
      show('Running your code...', 'info')

      const res = await api.post('/execute', { language, code, stdin, roomId })
      const data = res.data

      if (data.success) {
        const result = data.data.output || 'No output.'
        const timestamp = new Date().toLocaleTimeString()

        setOutputLog((prev) => [
          ...prev,
          {
            username: currentUser?.username || 'You',
            language,
            output: result,
            timestamp,
          },
        ])

        const shouldSave = window.confirm('✅ Code executed successfully!\n\nDo you want to save this code as a file?')

        if (shouldSave) {
          try {
            await api.post('/execute/save', {
              language,
              code,
              output: result,
              roomId,
            })
            show('Execution saved successfully ✅', 'success')
          } catch (saveErr) {
            console.error('Save error:', saveErr)
            show('Failed to save execution ❌', 'error')
          }
        } else {
          show('Execution discarded 🚫', 'info')
        }
      } else {
        show(`Execution failed: ${data.message}`, 'error')
      }
    } catch (err: any) {
      console.error('Execution Error:', err)
      show(err?.response?.data?.message || 'Server error during code execution.', 'error')
    } finally {
      setIsRunning(false)
    }
  }

  // --- Receive shared output ---
  useEffect(() => {
    if (!window.socket) return
    const handleCodeOutput = (data: { username: string; language: string; output: string; timestamp: string }) => {
      setOutputLog((prev) => [
        ...prev,
        { 
          username: data.username, 
          language: data.language, 
          output: data.output, 
          timestamp: data.timestamp 
        },
      ])
    }

    window.socket.on('code:output', handleCodeOutput)
    return () => window.socket.off('code:output', handleCodeOutput)
  }, [])

  // --- Resize layout (editor <-> terminal) ---
  useEffect(() => {
    const resizer = resizerRef.current
    if (!resizer) return
    let startY = 0
    let startHeight = 0
    const onMouseDown = (e: MouseEvent) => {
      startY = e.clientY
      startHeight = editorHeight
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    }
    const onMouseMove = (e: MouseEvent) => {
      const diff = ((e.clientY - startY) / window.innerHeight) * 100
      const newHeight = Math.max(20, Math.min(80, startHeight - diff))
      setEditorHeight(newHeight)
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    resizer.addEventListener('mousedown', onMouseDown)
    return () => resizer.removeEventListener('mousedown', onMouseDown)
  }, [editorHeight])

  useEffect(() => {
    if (!showSavedFiles) return
    const fetchSavedFiles = async () => {
      try {
        setIsLoadingFiles(true)
        const res = await api.get('/execute/history')
        if (res.data.success) setSavedFiles(res.data.data)
      } catch (err) {
        console.error('Failed to fetch saved files:', err)
        show('Failed to load saved files', 'error')
      } finally {
        setIsLoadingFiles(false)
      }
    }
    fetchSavedFiles()
  }, [showSavedFiles])

  const handleAddFile = () => {
    const newFile = { 
      id: `file-${Date.now()}`, 
      name: `newFile${files.length + 1}.txt`, 
      language: 'plaintext' 
    }
    setFiles((prev) => [...prev, newFile])
    setActiveFile(newFile.id)
  }

  const handleRemoveFile = (id: string) => {
    if (files.length === 1) return
    setFiles((prev) => prev.filter((f) => f.id !== id))
    if (activeFile === id) setActiveFile(files[0].id)
  }

  function getUserColor(id: string) {
    const colors = ['#22c55e', '#3b82f6', '#a855f7', '#ef4444', '#eab308', '#06b6d4', '#8b5cf6', '#10b981']
    let hash = 0
    for (let i = 0; i < id.length; i++) hash = (hash << 5) - hash + id.charCodeAt(i)
    return colors[Math.abs(hash) % colors.length]
  }

  const handleSendChat = () => {
    if (chatInput.trim() && currentUser?.username) {
      sendChat(chatInput, currentUser.username)
      setChatInput('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendChat()
    }
  }

  const handleLanguageChange = (newLanguage: string) => {
    changeLanguage(newLanguage)
    setShowLanguageDropdown(false)
  }

  const languages = [
    { key: 'javascript', label: 'JavaScript', icon: 'fa-brands fa-js' },
    { key: 'python', label: 'Python', icon: 'fa-brands fa-python' },
    { key: 'java', label: 'Java', icon: 'fa-brands fa-java' },
    { key: 'cpp', label: 'C++', icon: 'fa-solid fa-c' },
    { key: 'c', label: 'C', icon: 'fa-solid fa-c' },
    { key: 'html', label: 'HTML', icon: 'fa-brands fa-html5' },
    { key: 'css', label: 'CSS', icon: 'fa-brands fa-css3' },
    { key: 'typescript', label: 'TypeScript', icon: 'fa-solid fa-code' },
  ]

  const getCurrentLanguage = () => {
    return languages.find((lang) => lang.key === language) || languages[0]
  }

  const currentLanguage = getCurrentLanguage()

  // Add error boundary to prevent crashes
  if (!roomId) {
    return (
      <div className="h-screen w-full bg-[#0f172a] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Room Not Found</h1>
          <Link to="/rooms" className="text-indigo-400 hover:underline">
            Back to Rooms
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-full bg-[#0f172a] text-gray-300 flex flex-col overflow-hidden font-sans">
      {/* Header - Professional Design */}
      <header className="h-16 bg-gradient-to-r from-gray-900 to-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link
            to="/rooms"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center group-hover:bg-indigo-500/20 transition-all">
              <i className="fa-solid fa-chevron-left text-sm"></i>
            </div>
            <span className="text-sm font-medium hidden md:inline">Back to Rooms</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <i className="fa-solid fa-code text-white text-lg"></i>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">CollabCode</h1>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span>{roomName}</span>
                <span className="text-gray-600">•</span>
                <span className="text-green-400 font-medium">{isConnected ? 'Live' : 'Connecting...'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Room Info */}
          <div className="bg-gray-900/60 backdrop-blur-sm px-4 py-2 rounded-lg border border-gray-800 flex items-center gap-2">
            <i className="fa-solid fa-users text-green-400"></i>
            <span className="text-sm">{localUsers.length} Online</span>
          </div>

          {/* Share Button */}
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-all">
            <i className="fa-solid fa-share"></i>
            <span className="text-sm font-medium">Share</span>
          </button>

          {/* Language Selector */}
          <div className="relative" ref={languageDropdownRef}>
            <button
              onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-300 hover:border-indigo-500 transition-all min-w-[140px] justify-between"
            >
              <div className="flex items-center gap-2">
                <i className={`${currentLanguage.icon} text-indigo-400`}></i>
                <span>{currentLanguage.label}</span>
              </div>
              <i className={`fa-solid fa-chevron-down text-xs transition-transform ${showLanguageDropdown ? 'rotate-180' : ''}`}></i>
            </button>

            {showLanguageDropdown && (
              <div className="absolute top-full right-0 mt-2 w-56 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden z-50">
                <div className="py-1">
                  {languages.map((lang) => (
                    <button
                      key={lang.key}
                      onClick={() => handleLanguageChange(lang.key)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                        language === lang.key
                          ? 'bg-indigo-500/10 text-indigo-400'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                      }`}
                    >
                      <i className={`${lang.icon} w-5 text-center`}></i>
                      <span className="flex-1 text-left">{lang.label}</span>
                      {language === lang.key && <i className="fa-solid fa-check text-xs"></i>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Run Button */}
          <button
            onClick={handleRunCode}
            disabled={isRunning}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? (
              <>
                <i className="fa-solid fa-circle-notch animate-spin"></i>
                <span>Running...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-play"></i>
                <span>Run Code</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* File Tabs */}
          <div className="flex items-center bg-gray-900 border-b border-gray-800 px-2 pt-2 gap-1 overflow-x-auto">
            {files.map((f) => (
              <div
                key={f.id}
                onClick={() => setActiveFile(f.id)}
                className={`group flex items-center gap-2 px-4 py-3 text-sm rounded-t-lg cursor-pointer transition-all min-w-[120px] ${
                  activeFile === f.id
                    ? 'bg-gray-800 text-indigo-400 font-medium border-t border-x border-gray-700'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'
                }`}
              >
                <i className={`fa-regular fa-file-code ${activeFile === f.id ? 'text-indigo-400' : 'text-gray-600'}`}></i>
                <span className="truncate flex-1">{f.name}</span>
                {files.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveFile(f.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 hover:text-red-400 transition-all"
                  >
                    <i className="fa-solid fa-xmark text-xs"></i>
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={handleAddFile}
              className="p-2 text-gray-500 hover:text-indigo-400 hover:bg-gray-900 rounded-lg transition-colors ml-1"
              title="New File"
            >
              <i className="fa-solid fa-plus"></i>
            </button>
          </div>

          {/* Editor Area */}
          <div style={{ height: `${editorHeight}%` }} className="relative w-full">
            <Editor
              height="100%"
              theme="vs-dark"
              language={language}
              value={code || ''}
              onMount={onEditorMount}
              onChange={(val) => sendCode(val || '')}
              options={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                minimap: { enabled: false },
                smoothScrolling: true,
                padding: { top: 20 },
                lineHeight: 1.6,
                scrollBeyondLastLine: false,
              }}
            />
          </div>

          {/* Resizer */}
          <div
            ref={resizerRef}
            className="h-1.5 bg-gray-900 hover:bg-indigo-500/50 cursor-ns-resize transition-colors flex items-center justify-center group"
          >
            <div className="w-12 h-1 rounded-full bg-gray-800 group-hover:bg-gray-600 transition-colors"></div>
          </div>

          {/* Terminal Area */}
          <div style={{ height: `${100 - editorHeight}%` }} className="flex flex-col bg-gray-900 border-t border-gray-800">
            {/* Terminal Tabs */}
            <div className="flex items-center border-b border-gray-800 px-4">
              <button
                onClick={() => setActiveTab('output')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'output'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <i className="fa-solid fa-terminal mr-2"></i>
                Output
                {outputLog.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-xs bg-indigo-500/20 text-indigo-300 rounded-full">
                    {outputLog.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('input')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'input'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <i className="fa-solid fa-keyboard mr-2"></i>
                Input
              </button>
              <button
                onClick={() => setActiveTab('debug')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'debug'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <i className="fa-solid fa-bug mr-2"></i>
                Debug
              </button>
            </div>

            {/* Terminal Content */}
            <div className="flex-1 overflow-hidden p-4 font-mono text-sm">
              {activeTab === 'output' ? (
                <div className="h-full overflow-y-auto space-y-3 pr-2">
                  {outputLog.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600">
                      <i className="fa-solid fa-terminal text-4xl mb-4 opacity-20"></i>
                      <p>Run your code to see the output here.</p>
                    </div>
                  ) : (
                    outputLog.map((o, idx) => (
                      <div key={idx} className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                        <div className="flex items-center gap-3 text-xs text-gray-500 mb-2 pb-2 border-b border-gray-700">
                          <span className="font-semibold text-indigo-400">{o.username}</span>
                          <span>•</span>
                          <span className="px-2 py-1 bg-gray-900 rounded text-xs">{o.language}</span>
                          <span className="ml-auto">{o.timestamp}</span>
                        </div>
                        <pre className="whitespace-pre-wrap text-gray-300 font-mono leading-relaxed">
                          {o.output}
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              ) : activeTab === 'input' ? (
                <textarea
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  placeholder="Enter standard input here..."
                  className="w-full h-full bg-gray-800 border border-gray-700 rounded-lg p-4 text-gray-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all resize-none placeholder-gray-600 font-mono"
                />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-600">
                  <div className="text-center">
                    <i className="fa-solid fa-bug text-4xl mb-4 opacity-20"></i>
                    <p>Debug console will appear here.</p>
                    <p className="text-sm text-gray-500 mt-2">Set breakpoints and inspect variables</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Sidebar */}
        <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col">
          {/* Sidebar Tabs */}
          <div className="flex bg-gray-950 p-2 border-b border-gray-800">
            <button
              onClick={() => setActiveSidebarTab('chat')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all ${
                activeSidebarTab === 'chat'
                  ? 'bg-gray-800 text-indigo-400'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'
              }`}
            >
              <i className="fa-solid fa-comments"></i>
              <span className="text-sm font-medium">Chat</span>
              {chat.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-indigo-500 text-white rounded-full">
                  {chat.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveSidebarTab('participants')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all ${
                activeSidebarTab === 'participants'
                  ? 'bg-gray-800 text-indigo-400'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'
              }`}
            >
              <i className="fa-solid fa-users"></i>
              <span className="text-sm font-medium">Users</span>
              <span className="text-xs text-green-400">{localUsers.length}</span>
            </button>
            <button
              onClick={() => setActiveSidebarTab('history')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all ${
                activeSidebarTab === 'history'
                  ? 'bg-gray-800 text-indigo-400'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'
              }`}
            >
              <i className="fa-solid fa-history"></i>
              <span className="text-sm font-medium">History</span>
            </button>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-hidden">
            {/* Chat Tab */}
            {activeSidebarTab === 'chat' && (
              <div className="h-full flex flex-col">
                <div
                  ref={chatContainerRef}
                  className="flex-1 overflow-y-auto p-4 space-y-4"
                >
                  {(chat || []).length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600 text-sm text-center px-4">
                      <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-3">
                        <i className="fa-regular fa-comment-dots text-xl"></i>
                      </div>
                      <p>No messages yet.</p>
                      <p className="text-xs mt-1">Start the conversation!</p>
                    </div>
                  ) : (
                    (chat || []).map((m: any, idx: number) => {
                      const isMe = m.username === currentUser?.username
                      return (
                        <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] ${isMe ? 'ml-auto' : ''}`}>
                            {!isMe && (
                              <div className="flex items-center gap-2 mb-1">
                                <div
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                  style={{ backgroundColor: getUserColor(m.username) }}
                                >
                                  {m.username.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-xs font-medium text-gray-400">{m.username}</span>
                              </div>
                            )}
                            <div
                              className={`px-4 py-3 rounded-2xl ${
                                isMe
                                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-none'
                                  : 'bg-gray-800 text-gray-200 rounded-bl-none'
                              }`}
                            >
                              {m.message}
                            </div>
                            <span className="text-[11px] text-gray-500 mt-1 block text-right">
                              {(() => {
                                try {
                                  return format(parseISO(m.at), 'HH:mm')
                                } catch {
                                  return m.at || 'Just now'
                                }
                              })()}
                            </span>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-4 border-t border-gray-800">
                  <div className="relative">
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type a message..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-full pl-4 pr-12 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder-gray-500"
                    />
                    <button
                      onClick={handleSendChat}
                      disabled={!chatInput.trim()}
                      className="absolute right-2 top-2 flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <i className="fa-solid fa-paper-plane text-xs"></i>
                      <span>Send</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Participants Tab */}
            {activeSidebarTab === 'participants' && (
              <div className="h-full overflow-y-auto p-4 space-y-3">
                {localUsers.map((user) => (
                  <div key={user.id} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg border border-gray-700">
                    <div className="relative">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white shadow-lg"
                        style={{ backgroundColor: user.color }}
                      >
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-gray-800 ${
                        user.status === 'typing' ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'
                      }`}></div>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-200">{user.name}</div>
                      <div className="text-xs text-gray-400 flex items-center gap-1">
                        {user.status === 'typing' ? (
                          <>
                            <i className="fa-solid fa-pencil-alt text-yellow-500"></i>
                            <span className="text-yellow-500">Typing...</span>
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-circle text-green-500 text-[8px]"></i>
                            <span>Online</span>
                          </>
                        )}
                      </div>
                    </div>
                    {user.name === currentUser?.username && (
                      <span className="px-2 py-1 text-xs bg-indigo-500/20 text-indigo-400 rounded">You</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* History Tab */}
            {activeSidebarTab === 'history' && (
              <div className="h-full overflow-y-auto p-4 space-y-3">
                {savedFiles.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-600">
                    <i className="fa-solid fa-history text-4xl mb-4 opacity-20"></i>
                    <p>No history yet.</p>
                    <p className="text-sm text-gray-500 mt-2">Run and save code to see history</p>
                  </div>
                ) : (
                  savedFiles.map((file, idx) => (
                    <div key={idx} className="p-3 bg-gray-800 rounded-lg border border-gray-700 hover:border-indigo-500/50 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-200">Execution #{savedFiles.length - idx}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(file.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 text-xs bg-indigo-500/10 text-indigo-400 rounded">
                          {file.language}
                        </span>
                        <span className="text-xs text-gray-400 truncate">by {file.username || 'Unknown'}</span>
                      </div>
                      <pre className="text-xs text-gray-400 font-mono truncate bg-gray-900/50 p-2 rounded">
                        {file.code ? file.code.substring(0, 100) + '...' : 'No code available'}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Saved Files Modal */}
      {showSavedFiles && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-gray-950">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <i className="fa-solid fa-folder-open text-white"></i>
                </div>
                <div>
                  <div>Saved Executions</div>
                  <div className="text-sm text-gray-400 font-normal">View and manage your saved code executions</div>
                </div>
              </h2>
              <button
                onClick={() => setShowSavedFiles(false)}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {isLoadingFiles ? (
                <div className="p-12 text-center text-gray-500">
                  <i className="fa-solid fa-circle-notch animate-spin text-2xl mb-4"></i>
                  <p>Loading saved files...</p>
                </div>
              ) : savedFiles.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <i className="fa-regular fa-folder-open text-2xl"></i>
                  </div>
                  <p className="text-lg text-gray-400 mb-2">No saved executions yet</p>
                  <p className="text-gray-600">Run and save your code to see it here</p>
                </div>
              ) : (
                <div className="p-6 grid gap-4">
                  {savedFiles.map((file, idx) => (
                    <div key={idx} className="bg-gray-800 rounded-xl border border-gray-700 p-5 hover:border-indigo-500/50 transition-all group">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 rounded-full text-sm font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              {file.language}
                            </span>
                            <span className="text-sm text-gray-400">
                              {new Date(file.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-sm text-gray-400 mb-1">
                            Saved by <span className="text-indigo-400">{file.username || 'Unknown'}</span>
                          </div>
                        </div>
                        <button className="opacity-0 group-hover:opacity-100 p-2 hover:bg-gray-700 rounded-lg transition-all">
                          <i className="fa-solid fa-ellipsis-vertical text-gray-400"></i>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                          <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider flex items-center gap-2">
                            <i className="fa-solid fa-code"></i>
                            Code
                          </div>
                          <pre className="text-sm text-gray-300 font-mono overflow-x-auto whitespace-pre-wrap max-h-32">
                            {file.code || 'No code available'}
                          </pre>
                        </div>
                        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                          <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider flex items-center gap-2">
                            <i className="fa-solid fa-terminal"></i>
                            Output
                          </div>
                          <pre className="text-sm text-green-400 font-mono overflow-x-auto whitespace-pre-wrap max-h-32">
                            {file.output || 'No output available'}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}