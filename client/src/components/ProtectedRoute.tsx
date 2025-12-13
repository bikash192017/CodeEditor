import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading, checkAuth } = useAuth()
  const location = useLocation()

  useEffect(() => {
    if (!isAuthenticated) checkAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="backdrop-blur-md bg-white/10 rounded-xl p-8 shadow-xl">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}








