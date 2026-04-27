import { useEffect, useRef, useState } from 'react'
import logo from '../assets/logo.png'
import backLogo from '../assets/back-logo.png'
import { Link, useParams } from 'react-router-dom'
import api from '../utils/api'
import { useToast } from '../contexts/ToastContext'
import Editor, { OnMount } from '@monaco-editor/react'
import { useCollaboration } from '../hooks/useCollaboration'
import { useAuthStore } from '../stores/authStore'
import { CursorOverlayManager } from '../utils/monacoCursors'
import { format, parseISO } from 'date-fns'
import { useWebRTC } from '../hooks/useWebRTC'

const VideoPlayer = ({ stream, username, isLocal = false }: { stream: MediaStream, username: string, isLocal?: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const isScreen = stream.getVideoTracks()[0]?.label.toLowerCase().includes('screen') || stream.id.includes('screen');
  
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);
  
  return (
    <div className={`relative rounded-lg overflow-hidden border-2 shadow-2xl bg-black mb-2 pointer-events-auto transition-all group ${
      isExpanded 
        ? 'fixed inset-4 z-50 border-indigo-500 w-auto h-auto' 
        : (isScreen ? 'border-indigo-500 w-[400px] sm:w-[600px]' : 'border-gray-700 w-32 sm:w-48')
    }`}>
      <video ref={videoRef} autoPlay playsInline muted={isLocal} className={`w-full object-contain ${isExpanded ? 'h-full bg-black/90 rounded-lg' : 'h-auto'}`} />
      
      <div className="absolute bottom-1 left-1 bg-black/60 px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium text-white backdrop-blur-sm flex items-center gap-1">
        <i className={`fa-solid ${isScreen ? 'fa-desktop' : 'fa-video'} ${isLocal ? 'text-green-400' : 'text-indigo-400'}`}></i>
        <span className="truncate max-w-[100px]">{username} {isLocal ? '(You)' : ''}</span>
      </div>

      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute top-2 right-2 bg-black/60 hover:bg-black text-white p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <i className={`fa-solid ${isExpanded ? 'fa-compress' : 'fa-expand'}`}></i>
      </button>
    </div>
  );
};

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
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)
  const [savedFiles, setSavedFiles] = useState<any[]>([])
  const [showSavedFiles, setShowSavedFiles] = useState(false)
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [activeSidebarTab, setActiveSidebarTab] = useState<'chat' | 'participants' | 'history'>('chat')
  const [showCreateFileModal, setShowCreateFileModal] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [newFileLanguage, setNewFileLanguage] = useState('javascript')
  const [showCopiedTooltip, setShowCopiedTooltip] = useState(false)
  const [suggestion, setSuggestion] = useState<{ name: string; type: 'function' | 'variable'; pos: { x: number; y: number } } | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  
  // Room Ownership Features
  const [joinRequests, setJoinRequests] = useState<any[]>([])
  const [roomOwnerId, setRoomOwnerId] = useState<string | null>(null)

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
    typingUsers = {},
    sendTyping,
    isConnected,
  } = useCollaboration(roomId)

  const [chatInput, setChatInput] = useState('')
  const [localUsers, setLocalUsers] = useState<Array<{ id: string; name: string; color: string; status: string }>>([])
  
  const { 
    inCall, isCameraOn, isMicOn, isSharingScreen, 
    localCameraStream, localScreenStream, remoteStreams, 
    joinCall, leaveCall, toggleCamera, toggleMic, 
    startScreenShare, stopScreenShare 
  } = useWebRTC(roomId, localUsers)
  
  const editorRef = useRef<any>(null)
  const cursorMgrRef = useRef<CursorOverlayManager | null>(null)
  const chatEndRef = useRef<HTMLDivElement | null>(null)
  const chatContainerRef = useRef<HTMLDivElement | null>(null)
  const languageDropdownRef = useRef<HTMLDivElement>(null)
  const currentUser = useAuthStore((s) => s.user)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingRef = useRef<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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
      ; (async () => {
        try {
          console.log('🔵 Attempting to join room:', roomId)
          const res = await api.post(`/rooms/${roomId}/join`)
          const { success, data } = res.data
          if (success) {
            console.log('✅ Successfully joined room:', data?.room)
            setRoomName(data?.room?.name || 'Room')
            setRoomOwnerId(data?.room?.ownerId?._id || data?.room?.ownerId || null)
          }
        } catch (error: any) {
          console.error('❌ Failed to join room:', error.response?.data || error.message)
          show(error.response?.data?.message || 'Failed to join room', 'error')
        }
      })()
  }, [roomId, show])

  // --- Editor setup ---
  const onEditorMount: OnMount = (editor) => {
    editorRef.current = editor
    cursorMgrRef.current = new CursorOverlayManager(editor)
    editor.onDidChangeCursorPosition((e: any) => {
      sendCursor(e.position)
      detectUndefinedSymbol(e.position)
    })
  }

  const detectUndefinedSymbol = (position: { lineNumber: number; column: number }) => {
    if (!editorRef.current || !code) return

    const model = editorRef.current.getModel()
    const wordInfo = model.getWordAtPosition(position)
    if (!wordInfo) {
      setSuggestion(null)
      return
    }

    const symbolName = wordInfo.word
    console.log('Checking symbol:', symbolName)
    const lineContent = model.getLineContent(position.lineNumber)
    const afterWord = lineContent.substring(wordInfo.endColumn - 1)

    // Validate identifier: must start with letter/underscore and contain only valid chars
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(symbolName)) {
      console.log('Invalid identifier:', symbolName)
      setSuggestion(null)
      return
    }

    // Only ignore truly global/built-in objects - NOT language keywords
    const builtIns = ['console', 'alert', 'prompt', 'confirm', 'setTimeout', 'setInterval', 'fetch', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Promise', 'window', 'document', 'System', 'out', 'println']
    if (builtIns.includes(symbolName)) {
      console.log('Built-in detected:', symbolName)
      setSuggestion(null)
      return
    }

    // Check if it's a function call (followed by '(')
    const isFunctionCall = /^\s*\(/.test(afterWord)
    console.log('Is function call:', isFunctionCall)

    // Simplified check: just look for the symbol name being declared anywhere
    const isDefined =
      code.includes(`function ${symbolName}`) ||
      code.includes(`const ${symbolName}`) ||
      code.includes(`let ${symbolName}`) ||
      code.includes(`var ${symbolName}`) ||
      code.includes(`class ${symbolName}`) ||
      new RegExp(`\\b(int|double|float|long|boolean|char|String)\\s+${symbolName}\\b`).test(code) ||
      new RegExp(`\\(\\s*[^)]*\\b${symbolName}\\s*[,)]`).test(code) // parameter

    console.log('Is defined:', isDefined)

    if (!isDefined) {
      let pos = editorRef.current.getScrolledVisiblePosition(position)
      // Fallback if getScrolledVisiblePosition returns null
      if (!pos) {
        console.log('getScrolledVisiblePosition returned null, using fallback')
        pos = { left: 100, top: 100 }
      }
      console.log('Showing suggestion for:', symbolName, 'at position:', pos)
      setSuggestion({
        name: symbolName,
        type: isFunctionCall ? 'function' : 'variable',
        pos: { x: pos.left, y: pos.top }
      })
    } else {
      setSuggestion(null)
    }
  }

  const handleDeepScan = async () => {
    try {
      setIsAnalyzing(true)
      show('Analyzing code with Gemini...', 'info')
      const res = await api.post('/ai/analyze', { code, language })
      const { success, missing } = res.data

      if (success && missing && missing.length > 0) {
        show(`Gemini found ${missing.length} missing definitions.`, 'success')
        const first = missing[0]
        setSuggestion({
          name: first.name,
          type: first.type as 'function' | 'variable',
          pos: { x: 100, y: 100 }
        })
      } else {
        show('Gemini found no missing definitions!', 'success')
      }
    } catch (error: any) {
      console.error('Deep Scan Error:', error)
      show('Failed to analyze code with Gemini', 'error')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleApplyFix = () => {
    if (!suggestion || !editorRef.current) return
    const model = editorRef.current.getModel()
    let injection = ''
    let insertLine = 1

    if (suggestion.type === 'function') {
      injection = `\nfunction ${suggestion.name}() {\n  return;\n}\n`
      insertLine = 1
    } else {
      // Smart injection for variables
      if (language === 'java') {
        injection = `        int ${suggestion.name} = 0;\n`
        // Find current method start
        const pos = editorRef.current.getPosition()
        let found = false
        for (let i = pos.lineNumber; i > 0; i--) {
          const line = model.getLineContent(i)
          if (line.includes('{')) {
            insertLine = i + 1
            found = true
            break
          }
        }
        if (!found) insertLine = 1
      } else {
        injection = `let ${suggestion.name};\n`
        insertLine = 1
      }
    }

    const currentCode = model.getValue()
    const lines = currentCode.split('\n')
    lines.splice(insertLine - 1, 0, injection)

    sendCode(lines.join('\n'))
    setSuggestion(null)
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
      status: typingUsers[id]?.isTyping ? 'typing' : 'online'
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

        setOutputLog([
          {
            username: currentUser?.username || 'You',
            language,
            output: result,
            timestamp,
          },
        ])

        show('Code executed successfully ✅', 'success')
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
    const socket = (window as any).socket
    if (!socket) return
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

    socket.on('code:output', handleCodeOutput)
    return () => socket.off('code:output', handleCodeOutput)
  }, [])

  // --- Handle Join Requests (Owner only) ---
  useEffect(() => {
    const socket = (window as any).socket
    if (!socket || !currentUser || !roomOwnerId) return

    // Only listen if we are the owner
    const uid = currentUser?._id || (currentUser as any)?.id;
    if (uid !== roomOwnerId) return

    const handleJoinRequest = (data: any) => {
      if (data.roomId === roomId) {
        show(`${data.username} requested to join`, 'info')
        setJoinRequests(prev => [...prev, data])
      }
    }

    socket.on('room:join-request', handleJoinRequest)
    return () => socket.off('room:join-request', handleJoinRequest)
  }, [roomId, currentUser, roomOwnerId, show])

  const handleProcessJoinRequest = (req: any, approved: boolean) => {
    const socket = (window as any).socket
    if (!socket) return

    socket.emit('room:process-join', {
      roomId: req.roomId,
      userId: req.userId,
      requestSocketId: req.requestSocketId,
      approved
    })

    setJoinRequests(prev => prev.filter(r => r.requestSocketId !== req.requestSocketId))
    if (approved) {
      show(`Allowed ${req.username} to join`, 'success')
    } else {
      show(`Denied ${req.username}`, 'info')
    }
  }

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

  // Helper function to get file extension based on language
  const getFileExtension = (lang: string): string => {
    const extensionMap: { [key: string]: string } = {
      javascript: '.js',
      python: '.py',
      java: '.java',
      cpp: '.cpp',
      c: '.c',
      html: '.html',
      css: '.css',
      typescript: '.ts',
      plaintext: '.txt'
    }
    return extensionMap[lang] || '.txt'
  }

  const handleAddFile = () => {
    setShowCreateFileModal(true)
    setNewFileName('')
    setNewFileLanguage('javascript')
  }

  const handleCreateFile = () => {
    if (!newFileName.trim()) return

    const extension = getFileExtension(newFileLanguage)
    const fileName = newFileName.trim().endsWith(extension)
      ? newFileName.trim()
      : newFileName.trim() + extension

    const newFile = {
      id: `file-${Date.now()}`,
      name: fileName,
      language: newFileLanguage
    }
    setFiles((prev) => [...prev, newFile])
    setActiveFile(newFile.id)
    setShowCreateFileModal(false)
    setNewFileName('')
  }

  const handleRemoveFile = (id: string) => {
    const newFiles = files.filter((f) => f.id !== id)
    setFiles(newFiles)
    if (activeFile === id) {
      if (newFiles.length > 0) setActiveFile(newFiles[0].id)
      else setActiveFile('')
    }
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentUser?.username) return

    // Limit file size to 2MB to prevent socket payload too large
    if (file.size > 2 * 1024 * 1024) {
      show('File must be less than 2MB', 'error')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64Url = event.target?.result as string
      // Send chat with empty message but with file
      sendChat('', currentUser.username, base64Url, file.name, file.type)
      show('File sent successfully', 'success')
    }
    reader.readAsDataURL(file)
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendChat()
    }
  }

  const handleLanguageChange = (newLanguage: string) => {
    changeLanguage(newLanguage)
    
    // Sync active file name with new language extension
    setFiles(prev => prev.map(f => {
      if (f.id === activeFile) {
        const ext = getFileExtension(newLanguage)
        const nameWithoutExt = f.name.includes('.') ? f.name.substring(0, f.name.lastIndexOf('.')) : f.name
        return { ...f, language: newLanguage, name: `${nameWithoutExt}${ext}` }
      }
      return f
    }))
    
    setShowLanguageDropdown(false)
  }

  // Sync global language when active file tab changes
  useEffect(() => {
    const file = files.find(f => f.id === activeFile)
    if (file && file.language !== language) {
      changeLanguage(file.language)
    }
  }, [activeFile, files, language, changeLanguage])

  const handleCopyRoomId = async () => {
    if (!roomId) return
    try {
      await navigator.clipboard.writeText(roomId)
      setShowCopiedTooltip(true)
      setTimeout(() => setShowCopiedTooltip(false), 2000)
    } catch (err) {
      console.error('Failed to copy Room ID:', err)
      show('Failed to copy Room ID', 'error')
    }
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
      <header className="h-16 bg-[#020617] border-b border-[#1e293b] flex items-center justify-between px-2 sm:px-6 shrink-0 z-30 overflow-visible">
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <Link
            to="/rooms"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center group-hover:bg-indigo-500/20 transition-all overflow-hidden p-1.5">
              <img src={backLogo} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" alt="Back" />
            </div>
            <span className="text-sm font-medium hidden md:inline">Back to Rooms</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#38bdf8] rounded-xl p-[2px] shadow-lg shadow-[#38bdf8]/30">
              <div className="w-full h-full bg-[#0f172a] rounded-[10px] overflow-hidden flex items-center justify-center">
                <img src={logo} alt="CollabCode Logo" className="w-full h-full object-cover" />
              </div>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg hidden sm:block">CollabCode</h1>
              <div className="flex items-center gap-2 text-[10px] sm:text-xs text-gray-400">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-500 shrink-0 animate-pulse"></span>
                <span className="truncate max-w-[60px] sm:max-w-[120px]">{roomName}</span>
                <span className="text-gray-600 hidden sm:inline">•</span>
                <span className="text-green-400 font-medium hidden sm:inline">{isConnected ? 'Live' : 'Connecting...'}</span>
              </div>
            </div>
          </div>

          {/* Room ID Display with Copy Button */}
          <div className="flex items-center gap-1 sm:gap-2 bg-gray-800/50 border border-gray-700 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2">
            <i className="fa-solid fa-hashtag text-gray-500 text-[10px] sm:text-xs hidden sm:block"></i>
            <span className="text-gray-300 font-mono text-xs sm:text-sm font-medium tracking-wider">
              {roomId}
            </span>
            <div className="relative">
              <button
                onClick={handleCopyRoomId}
                className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-indigo-400 transition-colors"
                title="Copy Room ID"
              >
                <i className="fa-solid fa-copy text-xs"></i>
              </button>
              {showCopiedTooltip && (
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                  Copied!
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0 pl-2">
          {/* Room Info */}
          <div className="hidden sm:flex bg-gray-900/60 backdrop-blur-sm px-4 py-2 rounded-lg border border-gray-800 items-center gap-2">
            <i className="fa-solid fa-users text-green-400"></i>
            <span className="text-sm">{localUsers.length} Online</span>
          </div>

          {/* Discord-Style Call Controls */}
          {inCall ? (
            <div className="hidden lg:flex items-center gap-1 bg-gray-900/80 border border-gray-700 rounded-lg p-1">
              <button 
                onClick={toggleMic}
                className={`p-2 rounded-md transition-colors ${isMicOn ? 'text-gray-300 hover:bg-gray-800' : 'text-red-400 bg-red-400/10 hover:bg-red-400/20'}`}
                title={isMicOn ? "Mute" : "Unmute"}
              >
                <i className={`fa-solid ${isMicOn ? 'fa-microphone' : 'fa-microphone-slash'}`}></i>
              </button>
              <button 
                onClick={toggleCamera}
                className={`p-2 rounded-md transition-colors ${isCameraOn ? 'text-gray-300 hover:bg-gray-800' : 'text-red-400 bg-red-400/10 hover:bg-red-400/20'}`}
                title={isCameraOn ? "Turn off camera" : "Turn on camera"}
              >
                <i className={`fa-solid ${isCameraOn ? 'fa-video' : 'fa-video-slash'}`}></i>
              </button>
              <button 
                onClick={isSharingScreen ? stopScreenShare : startScreenShare}
                className={`p-2 rounded-md transition-colors ${isSharingScreen ? 'text-indigo-400 bg-indigo-400/10 hover:bg-indigo-400/20' : 'text-gray-300 hover:bg-gray-800'}`}
                title={isSharingScreen ? "Stop sharing" : "Share screen"}
              >
                <i className="fa-solid fa-desktop"></i>
              </button>
              <div className="w-px h-6 bg-gray-700 mx-1"></div>
              <button 
                onClick={leaveCall}
                className="px-3 py-1.5 rounded-md bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button 
              onClick={joinCall}
              className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-all"
            >
              <i className="fa-solid fa-phone-volume"></i>
              <span className="text-sm font-medium">Join Call</span>
            </button>
          )}

          {/* Language Selector */}
          <div className="relative" ref={languageDropdownRef}>
            <button
              onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-xs sm:text-sm text-gray-300 hover:border-indigo-500 transition-all min-w-[70px] sm:min-w-[140px] justify-between"
            >
              <div className="flex items-center gap-2">
                <i className={`${currentLanguage.icon} text-indigo-400`}></i>
                <span className="hidden sm:inline">{currentLanguage.label}</span>
              </div>
              <i className={`fa-solid fa-chevron-down text-[10px] sm:text-xs transition-transform ${showLanguageDropdown ? 'rotate-180' : ''}`}></i>
            </button>

            {showLanguageDropdown && (
              <div className="absolute top-full right-0 mt-2 w-56 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden z-50">
                <div className="py-1">
                  {languages.map((lang) => (
                    <button
                      key={lang.key}
                      onClick={() => handleLanguageChange(lang.key)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${language === lang.key
                        ? 'bg-[#38bdf8]/10 text-[#38bdf8]'
                        : 'text-gray-400 hover:bg-[#1e293b] hover:text-white'
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

          {/* Gemini Scan Button */}
          <button
            onClick={handleDeepScan}
            disabled={isAnalyzing}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg border transition-all duration-200 ${isAnalyzing
              ? 'bg-slate-700/50 border-slate-600 text-slate-400 cursor-not-allowed'
              : 'bg-indigo-600/20 border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 hover:border-indigo-400'
              }`}
            title="Analyze Entire File with Gemini"
          >
            {isAnalyzing ? (
              <i className="fa-solid fa-spinner fa-spin text-xs sm:text-base"></i>
            ) : (
              <i className="fa-solid fa-wand-magic-sparkles text-indigo-400 text-xs sm:text-base"></i>
            )}
            <span className="hidden sm:inline text-sm font-medium">Scan</span>
          </button>

          {/* Run Button */}
          <button
            onClick={handleRunCode}
            disabled={isRunning}
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-5 sm:py-2.5 bg-[#38bdf8] hover:bg-sky-400 text-black text-sm font-semibold rounded-lg shadow-lg shadow-[#38bdf8]/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? (
              <>
                <i className="fa-solid fa-circle-notch animate-spin text-xs sm:text-base"></i>
                <span className="hidden sm:inline">Running...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-play text-xs sm:text-base"></i>
                <span className="hidden sm:inline">Run Code</span>
                <span className="sm:hidden text-xs">Run</span>
              </>
            )}
          </button>

          {/* Mobile Sidebar Toggle Button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            <i className={`fa-solid ${isSidebarOpen ? 'fa-xmark' : 'fa-bars'}`}></i>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Floating Call Gallery */}
        {(inCall || Object.values(remoteStreams).length > 0) && (
          <div className="absolute top-4 right-4 z-40 flex flex-col items-end gap-2 pointer-events-none max-h-[80vh] overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar">
            {/* Local Streams */}
            {localCameraStream && (
              <VideoPlayer stream={localCameraStream} username={currentUser?.username || 'You'} isLocal={true} />
            )}
            {localScreenStream && (
              <VideoPlayer stream={localScreenStream} username={currentUser?.username || 'You'} isLocal={true} />
            )}
            
            {/* Remote Streams */}
            {Object.values(remoteStreams).map((rs) => (
              rs.streams.map((stream, idx) => (
                <VideoPlayer key={`${rs.username}-${idx}`} stream={stream} username={rs.username} />
              ))
            ))}
          </div>
        )}

        {/* Left Panel - Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* File Tabs */}
          <div className="flex items-center bg-[#020617] border-b border-[#1e293b] px-2 pt-2 gap-1 overflow-x-auto">
            {files.map((f) => (
              <div
                key={f.id}
                onClick={() => setActiveFile(f.id)}
                className={`group flex items-center gap-2 px-4 py-3 text-sm rounded-t-lg cursor-pointer transition-all min-w-[120px] ${activeFile === f.id
                  ? 'bg-[#0f172a] text-[#38bdf8] font-medium border-t border-x border-[#1e293b]'
                  : 'text-gray-500 hover:text-white hover:bg-[#1e293b]'
                  }`}
              >
                <i className={`fa-regular fa-file-code ${activeFile === f.id ? 'text-[#38bdf8]' : 'text-gray-600'}`}></i>
                <span className="truncate flex-1">{f.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveFile(f.id)
                  }}
                  className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors mx-1"
                  title="Close file"
                >
                  <i className="fa-solid fa-xmark text-sm"></i>
                </button>
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
              onChange={(val) => {
                sendCode(val || '')

                // Emit typing indicator ONLY if we aren't already typing
                if (!isTypingRef.current) {
                  isTypingRef.current = true
                  sendTyping(true)
                }

                // Clear existing timeout
                if (typingTimeoutRef.current) {
                  clearTimeout(typingTimeoutRef.current)
                }

                // Stop typing after 2 seconds of inactivity
                typingTimeoutRef.current = setTimeout(() => {
                  isTypingRef.current = false
                  sendTyping(false)
                }, 2000)
              }}
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

            {/* Quick Fix Suggestion */}
            {suggestion && (
              <div
                style={{
                  position: 'absolute',
                  left: suggestion.pos.x,
                  top: suggestion.pos.y - 40,
                  zIndex: 100
                }}
                className="animate-in fade-in slide-in-from-bottom-2 duration-200"
              >
                <button
                  onClick={handleApplyFix}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-xl flex items-center gap-2 border border-indigo-400 group whitespace-nowrap"
                >
                  <i className="fa-solid fa-wand-magic-sparkles text-indigo-200 group-hover:scale-110 transition-transform"></i>
                  {suggestion.type === 'function' ? `Create function ${suggestion.name}()` : `Declare variable ${suggestion.name}`}
                </button>
              </div>
            )}

            {/* Typing Indicator */}
            {Object.values(typingUsers).filter(u => (u as any).isTyping).length > 0 && (
              <div className="absolute bottom-2 left-4 z-[9999] pointer-events-none text-xs text-gray-400 flex items-center gap-2 bg-gray-900/90 px-3 py-1.5 rounded-lg backdrop-blur-sm border border-gray-800 shadow-xl">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
                <span>
                  {(() => {
                    const typing = Object.values(typingUsers).filter(u => u.isTyping)
                    if (typing.length === 1) return `${typing[0].username} is typing...`
                    if (typing.length === 2) return `${typing[0].username} and ${typing[1].username} are typing...`
                    return `${typing[0].username}, ${typing[1].username}, and ${typing.length - 2} ${typing.length - 2 === 1 ? 'other' : 'others'} are typing...`
                  })()}
                </span>
              </div>
            )}
          </div>

          {/* Resizer */}
          <div
            ref={resizerRef}
            className="h-1.5 bg-gray-900 hover:bg-indigo-500/50 cursor-ns-resize transition-colors flex items-center justify-center group"
          >
            <div className="w-12 h-1 rounded-full bg-gray-800 group-hover:bg-gray-600 transition-colors"></div>
          </div>

          {/* Terminal Area */}
          <div style={{ height: `${100 - editorHeight}%` }} className="flex flex-col bg-[#0f172a] border-t border-[#1e293b]">
            {/* Terminal Tabs */}
            <div className="flex items-center border-b border-[#1e293b] px-4">
              <button
                onClick={() => setActiveTab('output')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'output'
                  ? 'border-[#38bdf8] text-[#38bdf8]'
                  : 'border-transparent text-gray-500 hover:text-white'
                  }`}
              >
                <i className="fa-solid fa-terminal mr-2"></i>
                Output
                {outputLog.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-xs bg-[#38bdf8]/20 text-[#38bdf8] rounded-full">
                    {outputLog.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('input')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'input'
                  ? 'border-[#38bdf8] text-[#38bdf8]'
                  : 'border-transparent text-gray-500 hover:text-white'
                  }`}
              >
                <i className="fa-solid fa-keyboard mr-2"></i>
                Input
              </button>
              <button
                onClick={() => setActiveTab('debug')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'debug'
                  ? 'border-[#38bdf8] text-[#38bdf8]'
                  : 'border-transparent text-gray-500 hover:text-white'
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
        {/* Mobile Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        <div className={`fixed inset-y-0 right-0 z-50 w-80 bg-[#0f172a] border-l border-[#1e293b] flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full'}`}>
          {/* Sidebar Tabs */}
          <div className="flex bg-[#020617] p-2 border-b border-[#1e293b]">
            <button
              onClick={() => setActiveSidebarTab('chat')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all ${activeSidebarTab === 'chat'
                ? 'bg-[#1e293b] text-[#38bdf8]'
                : 'text-gray-500 hover:text-white hover:bg-[#1e293b]'
                }`}
            >
              <i className="fa-solid fa-comments"></i>
              <span className="text-sm font-medium">Chat</span>
              {chat.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-[#38bdf8] text-black rounded-full">
                  {chat.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveSidebarTab('participants')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all ${activeSidebarTab === 'participants'
                ? 'bg-[#1e293b] text-[#38bdf8]'
                : 'text-gray-500 hover:text-white hover:bg-[#1e293b]'
                }`}
            >
              <i className="fa-solid fa-users"></i>
              <span className="text-sm font-medium">Users</span>
              <span className="text-xs text-green-400">{localUsers.length}</span>
            </button>
            <button
              onClick={() => setActiveSidebarTab('history')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all ${activeSidebarTab === 'history'
                ? 'bg-[#1e293b] text-[#38bdf8]'
                : 'text-gray-500 hover:text-white hover:bg-[#1e293b]'
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
                              className={`px-4 py-3 rounded-2xl ${isMe
                                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-none'
                                : 'bg-gray-800 text-gray-200 rounded-bl-none'
                                }`}
                            >
                              {m.fileUrl ? (
                                m.fileType?.startsWith('image/') ? (
                                  <div className="flex flex-col gap-2">
                                    <img src={m.fileUrl} alt={m.fileName} className="max-w-[200px] rounded-lg cursor-pointer hover:opacity-90" onClick={() => window.open(m.fileUrl)} />
                                    {m.message && <span>{m.message}</span>}
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-2">
                                    <a href={m.fileUrl} download={m.fileName} className="flex items-center gap-2 px-3 py-2 bg-black/20 rounded-lg hover:bg-black/30 transition-colors">
                                      <i className="fa-solid fa-file-arrow-down text-xl"></i>
                                      <div className="flex flex-col">
                                        <span className="text-sm font-medium truncate max-w-[150px]">{m.fileName}</span>
                                        <span className="text-[10px] opacity-70">Click to download</span>
                                      </div>
                                    </a>
                                    {m.message && <span>{m.message}</span>}
                                  </div>
                                )
                              ) : (
                                m.message
                              )}
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
                  <div className="relative flex items-center">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.txt"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute left-4 text-gray-400 hover:text-indigo-400 transition-colors z-10 p-1 rounded-full hover:bg-gray-700/50"
                      title="Attach file"
                    >
                      <i className="fa-solid fa-paperclip text-[15px]"></i>
                    </button>
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type a message..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-full pl-12 pr-[90px] py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder-gray-500"
                    />
                    <button
                      onClick={handleSendChat}
                      disabled={!chatInput.trim()}
                      className="absolute right-2 flex items-center gap-2 px-4 py-1.5 bg-[#38bdf8] hover:bg-sky-400 text-black rounded-full text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <i className="fa-solid fa-paper-plane text-xs"></i>
                      <span className="hidden sm:inline">Send</span>
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
                      <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-gray-800 ${user.status === 'typing' ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      {/* Join Requests Modal (Owner Only) */}
      {joinRequests.length > 0 && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-indigo-500/30 rounded-2xl shadow-2xl shadow-indigo-500/20 w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-gray-800 bg-gray-950 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <i className="fa-solid fa-bell text-indigo-400"></i>
              </div>
              <h2 className="text-lg font-bold text-white">Join Requests ({joinRequests.length})</h2>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {joinRequests.map((req, idx) => (
                <div key={idx} className="p-4 border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                  <p className="text-gray-300 mb-3 text-sm">
                    <span className="font-bold text-white">{req.username}</span> wants to join the room.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleProcessJoinRequest(req, false)}
                      className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
                    >
                      Deny
                    </button>
                    <button
                      onClick={() => handleProcessJoinRequest(req, true)}
                      className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Allow
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create File Modal */}
      {showCreateFileModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-800 bg-gray-950">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <i className="fa-solid fa-file-circle-plus text-white"></i>
                </div>
                Create New File
              </h2>
            </div>

            <div className="p-6 space-y-4">
              {/* Language Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Language
                </label>
                <select
                  value={newFileLanguage}
                  onChange={(e) => setNewFileLanguage(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                >
                  {languages.map((lang) => (
                    <option key={lang.key} value={lang.key}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filename Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  File Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') handleCreateFile()
                    }}
                    placeholder={`e.g., main${getFileExtension(newFileLanguage)}`}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder-gray-500"
                    autoFocus
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 bg-gray-900 px-2 py-1 rounded">
                    {getFileExtension(newFileLanguage)}
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-gray-500">
                  Extension will be added automatically if not provided
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreateFileModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFile}
                  disabled={!newFileName.trim()}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25"
                >
                  Create File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
