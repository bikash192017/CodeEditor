import { FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function Login() {
  const { login, isLoading, error, clearError, isAuthenticated } = useAuth()
  const { show } = useToast()
  const navigate = useNavigate()
  const location = useLocation() as any
  const from = location.state?.from?.pathname || '/rooms'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await login(email, password)
      show('Logged in successfully', 'success')
      navigate(from, { replace: true })
    } catch (err: any) {
      show(err.message || 'Login failed', 'error')
    }
  }

  if (isAuthenticated) {
    navigate(from, { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#0f172a] bg-gradient-to-br from-[#020617] to-[#1e3a8a] grid place-items-center p-4">
      <div className="w-full max-w-md backdrop-blur-lg bg-[#0f172a]/80 border border-[#1e293b] rounded-2xl p-8 shadow-2xl">
        <h1 className="text-2xl font-semibold text-[#38bdf8] mb-6">Welcome back</h1>
        {error && (
          <div className="mb-4 text-sm text-rose-200 bg-rose-500/10 border border-rose-500/30 rounded-md p-3">
            <div className="flex justify-between items-center">
              <span>{error}</span>
              <button onClick={clearError} className="text-rose-200/80 hover:text-rose-100 text-xs">Dismiss</button>
            </div>
          </div>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-200 text-sm mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg bg-[#1e293b] border border-white/10 text-white placeholder-slate-400 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#38bdf8]/50"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-slate-200 text-sm mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg bg-[#1e293b] border border-white/10 text-white placeholder-slate-400 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#38bdf8]/50"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-[#38bdf8] hover:bg-sky-400 transition text-black font-medium py-2 flex items-center justify-center disabled:opacity-60"
          >
            {isLoading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-black/40 border-t-black" />
            ) : (
              'Login'
            )}
          </button>
        </form>
        <p className="text-slate-300/80 text-sm mt-4">
          Don't have an account?{' '}
          <Link to="/register" className="text-[#38bdf8] hover:text-sky-300 underline">Register</Link>
        </p>
      </div>
    </div>
  )
}








