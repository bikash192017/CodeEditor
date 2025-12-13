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
  const [activeTab, setActiveTab] = useState<'output' | 'input'>('output')
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

  const {
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
  } = useCollaboration(roomId)

  const [chatInput, setChatInput] = useState('')
  const [localUsers, setLocalUsers] = useState<Array<{ id: string; name: string; color: string }>>([])
  const editorRef = useRef<any>(null)
  const cursorMgrRef = useRef<CursorOverlayManager | null>(null)
  const chatEndRef = useRef<HTMLDivElement | null>(null)
  const chatContainerRef = useRef<HTMLDivElement | null>(null)
  const languageDropdownRef = useRef<HTMLDivElement>(null)
  const currentUser = useAuthStore((s) => s.user)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(event.target as Node)) {
        setShowLanguageDropdown(false)
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
    Object.values(cursors).forEach((c) =>
      mgr.upsert({ userId: c.userId, username: c.username, color: (c as any).color, position: c.position })
    )
  }, [cursors])

  useEffect(() => {
    const mapped = Object.entries(users || {}).map(([id, u]) => ({
      id,
      name: u.username,
      color: getUserColor(id),
    }))
    setLocalUsers(mapped)
  }, [users])

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

      // Call backend to execute code
      const res = await api.post('/execute', { language, code, stdin, roomId })
      const data = res.data

      if (data.success) {
        const result = data.data.output || 'No output.'
        const timestamp = new Date().toLocaleTimeString()

        // Append result to local output log
        setOutputLog((prev) => [
          ...prev,
          {
            username: currentUser?.username || 'You',
            language,
            output: result,
            timestamp,
          },
        ])

        // Ask user whether to save the executed code
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
        { username: data.username, language: data.language, output: data.output, timestamp: data.timestamp },
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
    const newFile = { id: `file-${Date.now()}`, name: `newFile${files.length + 1}.txt`, language: 'plaintext' }
    setFiles((prev) => [...prev, newFile])
    setActiveFile(newFile.id)
  }

  const handleRemoveFile = (id: string) => {
    if (files.length === 1) return
    setFiles((prev) => prev.filter((f) => f.id !== id))
    if (activeFile === id) setActiveFile(files[0].id)
  }

  function getUserColor(id: string) {
    const colors = ['#22c55e', '#3b82f6', '#a855f7', '#ef4444', '#eab308', '#06b6d4']
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

  return (
    <div className="h-screen w-full bg-[#0f172a] text-slate-300 flex flex-col overflow-hidden font-sans selection:bg-indigo-500/30">
      {/* --- Header --- */}
      <header className="h-16 bg-[#1e293b]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 z-20 shadow-sm">
        <div className="flex items-center gap-6">
          <Link
            to="/rooms"
            className="group flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-all">
              <i className="fa-solid fa-arrow-left text-sm"></i>
            </div>
            <span className="font-medium text-sm">Back</span>
          </Link>

          <div className="h-6 w-px bg-white/10"></div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <i className="fa-solid fa-code text-white text-lg"></i>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight tracking-tight">CollabCode</h1>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{roomName}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Participants Toggle */}
          <div className="relative">
             <button
              onClick={() => setShowParticipants(!showParticipants)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                showParticipants ? 'bg-indigo-500/10 text-indigo-400' : 'hover:bg-white/5 text-slate-400 hover:text-slate-200'
              }`}
            >
              <i className="fa-solid fa-users"></i>
              <span>{localUsers.length}</span>
            </button>
            
            {/* Participants Dropdown */}
            {showParticipants && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-[#1e293b] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                <div className="p-3 border-b border-white/5 bg-white/5">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Online Users</h3>
                </div>
                <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                  {localUsers.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                      <div className="relative">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-inner"
                          style={{ backgroundColor: u.color }}
                        >
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#1e293b] rounded-full"></div>
                      </div>
                      <span className="text-sm text-slate-200 font-medium truncate">{u.name}</span>
                    </div>
                  ))}
                  {localUsers.length === 0 && (
                    <div className="p-4 text-center text-slate-500 text-sm">No one else is here.</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Language Selector */}
          <div className="relative" ref={languageDropdownRef}>
            <button
              onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
              className="flex items-center gap-3 px-4 py-2 bg-[#0f172a] border border-white/10 rounded-lg text-sm text-slate-300 hover:border-indigo-500/50 hover:text-white transition-all min-w-[140px] justify-between"
            >
              <div className="flex items-center gap-2">
                <i className={`${currentLanguage.icon} text-indigo-400`}></i>
                <span>{currentLanguage.label}</span>
              </div>
              <i className={`fa-solid fa-chevron-down text-xs transition-transform ${showLanguageDropdown ? 'rotate-180' : ''}`}></i>
            </button>

            {showLanguageDropdown && (
              <div className="absolute top-full right-0 mt-2 w-56 bg-[#1e293b] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                <div className="max-h-80 overflow-y-auto py-1">
                  {languages.map((lang) => (
                    <button
                      key={lang.key}
                      onClick={() => handleLanguageChange(lang.key)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                        language === lang.key
                          ? 'bg-indigo-500/10 text-indigo-400'
                          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
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

          <div className="h-6 w-px bg-white/10 mx-2"></div>

          {/* Saved Files Button */}
           <button
            onClick={() => setShowSavedFiles(true)}
            className="p-2.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all"
            title="Saved Files"
          >
            <i className="fa-solid fa-folder-open text-lg"></i>
          </button>

          {/* Run Button */}
          <button
            onClick={handleRunCode}
            disabled={isRunning}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
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

      {/* --- Main Body --- */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Panel: Editor & Terminal */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0f172a] relative">
          
          {/* File Tabs */}
          <div className="flex items-center bg-[#0f172a] border-b border-white/5 px-2 pt-2 gap-1 overflow-x-auto no-scrollbar">
            {files.map((f) => (
              <div
                key={f.id}
                onClick={() => setActiveFile(f.id)}
                className={`group flex items-center gap-2 px-4 py-2.5 text-sm rounded-t-lg cursor-pointer border-t border-x border-transparent transition-all min-w-[120px] max-w-[200px] ${
                  activeFile === f.id
                    ? 'bg-[#1e293b] border-white/5 text-indigo-400 font-medium'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                }`}
              >
                <i className={`fa-regular fa-file-code ${activeFile === f.id ? 'text-indigo-400' : 'text-slate-600'}`}></i>
                <span className="truncate flex-1">{f.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveFile(f.id)
                  }}
                  className={`opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-red-500/20 hover:text-red-400 transition-all ${files.length === 1 ? 'hidden' : ''}`}
                >
                  <i className="fa-solid fa-xmark text-xs"></i>
                </button>
              </div>
            ))}
            <button
              onClick={handleAddFile}
              className="p-2 text-slate-500 hover:text-indigo-400 hover:bg-white/5 rounded-lg transition-colors ml-1"
              title="New File"
            >
              <i className="fa-solid fa-plus"></i>
            </button>
          </div>

          {/* Editor Area */}
          <div style={{ height: `${editorHeight}%` }} className="relative w-full bg-[#1e293b]">
            <Editor
              height="100%"
              theme="vs-dark"
              language={language}
              value={code}
              onMount={onEditorMount}
              onChange={(val) => sendCode(val || '')}
              options={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                minimap: { enabled: false },
                smoothScrolling: true,
                padding: { top: 20 },
                lineHeight: 1.6,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                scrollBeyondLastLine: false,
                roundedSelection: true,
              }}
            />
          </div>

          {/* Resizer */}
          <div
            ref={resizerRef}
            className="h-1.5 bg-[#0f172a] hover:bg-indigo-500/50 cursor-ns-resize transition-colors z-10 flex items-center justify-center group"
          >
             <div className="w-12 h-1 rounded-full bg-white/10 group-hover:bg-white/30 transition-colors"></div>
          </div>

          {/* Terminal / Output Area */}
          <div style={{ height: `${100 - editorHeight}%` }} className="flex flex-col bg-[#0f172a] border-t border-white/5">
            {/* Terminal Tabs */}
            <div className="flex items-center border-b border-white/5 px-4">
              <button
                onClick={() => setActiveTab('output')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'output'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                Output
                {outputLog.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-indigo-500/20 text-indigo-300 rounded-full">
                    {outputLog.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('input')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'input'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                Input
              </button>
            </div>

            {/* Terminal Content */}
            <div className="flex-1 overflow-hidden p-4 font-mono text-sm">
              {activeTab === 'output' ? (
                <div className="h-full overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                  {outputLog.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600">
                      <i className="fa-solid fa-terminal text-4xl mb-4 opacity-20"></i>
                      <p>Run your code to see the output here.</p>
                    </div>
                  ) : (
                    outputLog.map((o, idx) => (
                      <div key={idx} className="bg-[#1e293b] rounded-lg border border-white/5 p-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center gap-3 text-xs text-slate-500 mb-2 pb-2 border-b border-white/5">
                          <span className="font-semibold text-indigo-400">{o.username}</span>
                          <span>•</span>
                          <span>{o.language}</span>
                          <span className="ml-auto">{o.timestamp}</span>
                        </div>
                        <pre className="whitespace-pre-wrap text-slate-300 font-mono leading-relaxed">
                          {o.output}
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <textarea
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  placeholder="Enter standard input here..."
                  className="w-full h-full bg-[#1e293b] border border-white/10 rounded-lg p-4 text-slate-300 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all resize-none placeholder-slate-600"
                />
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Chat Sidebar */}
        <div className="w-80 bg-[#1e293b] border-l border-white/5 flex flex-col shadow-xl z-10">
          <div className="p-4 border-b border-white/5 bg-[#1e293b]">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <i className="fa-regular fa-comments text-indigo-400"></i>
              Team Chat
            </h2>
          </div>

          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#0f172a]/30"
          >
            {chat.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 text-sm text-center px-4">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                  <i className="fa-regular fa-comment-dots text-xl"></i>
                </div>
                <p>No messages yet.</p>
                <p className="text-xs mt-1">Start the conversation!</p>
              </div>
            ) : (
              chat.map((m, idx) => {
                const isMe = m.username === currentUser?.username
                return (
                  <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-end gap-2 max-w-[85%]">
                      {!isMe && (
                        <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-400 flex-shrink-0 mb-1">
                          {m.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div
                        className={`px-3 py-2 rounded-2xl text-sm leading-relaxed shadow-sm ${
                          isMe
                            ? 'bg-indigo-600 text-white rounded-br-none'
                            : 'bg-[#1e293b] border border-white/5 text-slate-200 rounded-bl-none'
                        }`}
                      >
                        {m.message}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 px-1">
                      {!isMe && <span className="mr-1 font-medium text-slate-400">{m.username}</span>}
                      {(() => {
                        try {
                          return format(parseISO(m.at), 'HH:mm')
                        } catch {
                          return ''
                        }
                      })()}
                    </span>
                  </div>
                )
              })
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 bg-[#1e293b] border-t border-white/5">
            <div className="relative">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="w-full bg-[#0f172a] border border-white/10 rounded-full pl-4 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder-slate-600"
              />
              <button
                onClick={handleSendChat}
                disabled={!chatInput.trim()}
                className="absolute right-1.5 top-1.5 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full w-7 h-7 flex items-center justify-center transition-all disabled:opacity-0 disabled:scale-75"
              >
                <i className="fa-solid fa-paper-plane text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Saved Files Modal (Simple Overlay) */}
      {showSavedFiles && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
           <div className="bg-[#1e293b] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
             <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
               <h2 className="text-lg font-bold text-white flex items-center gap-2">
                 <i className="fa-solid fa-folder-open text-indigo-400"></i>
                 Saved Executions
               </h2>
               <button 
                 onClick={() => setShowSavedFiles(false)}
                 className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
               >
                 <i className="fa-solid fa-xmark"></i>
               </button>
             </div>
             
             <div className="p-0 max-h-[60vh] overflow-y-auto">
               {isLoadingFiles ? (
                 <div className="p-8 text-center text-slate-500">
                   <i className="fa-solid fa-circle-notch animate-spin text-2xl mb-2"></i>
                   <p>Loading history...</p>
                 </div>
               ) : savedFiles.length === 0 ? (
                 <div className="p-12 text-center text-slate-500">
                   <i className="fa-regular fa-folder-open text-4xl mb-3 opacity-30"></i>
                   <p>No saved files found.</p>
                 </div>
               ) : (
                 <div className="divide-y divide-white/5">
                   {savedFiles.map((file, i) => (
                     <div key={i} className="p-4 hover:bg-white/5 transition-colors group">
                       <div className="flex items-start justify-between mb-2">
                         <div className="flex items-center gap-2">
                           <span className="px-2 py-1 rounded text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                             {file.language}
                           </span>
                           <span className="text-xs text-slate-500">
                             {new Date(file.createdAt).toLocaleString()}
                           </span>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-4 mt-3">
                         <div className="bg-[#0f172a] rounded-lg p-3 border border-white/5">
                           <div className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Code</div>
                           <pre className="text-xs text-slate-300 font-mono line-clamp-3 overflow-hidden opacity-70 group-hover:opacity-100 transition-opacity">
                             {file.code}
                           </pre>
                         </div>
                         <div className="bg-[#0f172a] rounded-lg p-3 border border-white/5">
                           <div className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Output</div>
                           <pre className="text-xs text-emerald-400/80 font-mono line-clamp-3 overflow-hidden">
                             {file.output}
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