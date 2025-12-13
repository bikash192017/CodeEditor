import { createContext, useContext, useEffect, useMemo } from 'react'
import { useAuthStore } from '../stores/authStore'

type AuthContextValue = ReturnType<typeof useAuthStore>

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const state = useAuthStore()

  useEffect(() => {
    state.checkAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo(() => state, [state])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}








