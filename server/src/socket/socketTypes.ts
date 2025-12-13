export type Language =
  | 'javascript' | 'typescript' | 'python' | 'java' | 'cpp' | 'go' | 'rust'

export interface JoinRoomPayload { roomId: string }
export interface CodeChangePayload {
  roomId: string
  code: string
  cursor?: { lineNumber: number; column: number }
}
export interface CursorPayload {
  roomId: string
  position: { lineNumber: number; column: number }
  userId?: string
  username?: string
}
export interface LanguageChangePayload { roomId: string; language: Language }
export interface ChatMessagePayload { roomId: string; message: string; username: string }

export interface ServerToClientEvents {
  'room:joined': (data: { roomId: string; userId: string; username: string }) => void
  'room:left': (data: { roomId: string; userId: string; username: string }) => void
  'room:state': (data: { code: string; language: Language; roomName: string }) => void
  'code:update': (data: { roomId: string; code: string; userId: string; cursorPosition?: { lineNumber: number; column: number } }) => void
  'cursor:update': (data: Required<CursorPayload> & { color?: string }) => void
  'language:update': (data: { roomId: string; language: Language; userId: string; username: string }) => void
  'chat:new': (data: { roomId: string; message: string; username: string; at: string }) => void
  'user:typing': (data: { roomId: string; userId: string; username: string; isTyping: boolean }) => void
  error: (data: { message: string }) => void
}

export interface ClientToServerEvents {
  'room:join': (payload: JoinRoomPayload) => void
  'room:leave': (payload: { roomId: string }) => void
  'code:change': (payload: CodeChangePayload) => void
  'cursor:move': (payload: CursorPayload) => void
  'language:change': (payload: LanguageChangePayload) => void
  'chat:send': (payload: ChatMessagePayload) => void
  'user:typing': (payload: { roomId: string; isTyping: boolean }) => void
}





