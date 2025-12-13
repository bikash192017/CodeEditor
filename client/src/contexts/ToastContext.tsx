import { createContext, useCallback, useContext, useMemo, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toasts: ToastItem[]
  show: (message: string, type?: ToastType) => void
  remove: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2)
    const toast: ToastItem = { id, message, type }
    setToasts((prev) => [...prev, toast])
    setTimeout(() => remove(id), 3500)
  }, [remove])

  const value = useMemo(() => ({ toasts, show, remove }), [toasts, show, remove])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              'px-4 py-3 rounded-lg shadow-lg text-sm text-white backdrop-blur-md ' +
              (t.type === 'success'
                ? 'bg-emerald-500/80'
                : t.type === 'error'
                ? 'bg-rose-500/80'
                : 'bg-slate-700/80')
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}








