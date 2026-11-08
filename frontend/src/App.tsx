import { useQuery } from '@tanstack/react-query'

async function fetchHealth(): Promise<{ status: string }> {
  const res = await fetch('/api/health')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export default function App() {
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth })

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16 text-slate-900">
      <div className="mx-auto max-w-xl text-center">
        <h1 className="text-3xl font-bold tracking-tight">FPL League Tracker</h1>
        <p className="mt-3 text-slate-600">
          Enter your classic league ID to see rank history, transfers and chips.
        </p>
        <p className="mt-8 text-sm text-slate-500">
          Backend:{' '}
          {health.isPending ? 'checking…' : health.isError ? 'unreachable' : health.data.status}
        </p>
      </div>
    </main>
  )
}
