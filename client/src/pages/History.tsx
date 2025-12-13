import { useEffect, useState } from 'react'
import api from '../utils/api'

export default function History() {
  const [history, setHistory] = useState([])

  useEffect(() => {
    const fetchHistory = async () => {
      const res = await api.get('/execute/history')
      setHistory(res.data.history)
    }
    fetchHistory()
  }, [])

  return (
    <div className="p-6 text-white bg-slate-900 min-h-screen">
      <h1 className="text-2xl font-semibold mb-4">Execution History</h1>
      <div className="space-y-4">
        {history.map((h: any, idx: number) => (
          <div key={idx} className="bg-white/10 p-4 rounded-lg border border-white/10">
            <div className="flex justify-between">
              <span className="text-emerald-400 font-medium">{h.language}</span>
              <span className="text-sm text-gray-400">
                {new Date(h.executedAt).toLocaleString()}
              </span>
            </div>
            <pre className="mt-2 text-sm bg-black/30 p-2 rounded">{h.code}</pre>
            {h.stdin && <div className="text-xs text-gray-300">Input: {h.stdin}</div>}
            <div className="mt-2 text-gray-200">Output: {h.output}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
