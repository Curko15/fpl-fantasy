import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { parseLeagueId } from '../parseLeagueId'
import { forgetLeague, getRecentLeagues } from '../recentLeagues'

export default function HomePage() {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [recent, setRecent] = useState(getRecentLeagues)

  function submit(e: FormEvent) {
    e.preventDefault()
    const id = parseLeagueId(input)
    if (id === null) {
      setError('Enter a league ID (numbers only) or paste your league link.')
      return
    }
    navigate(`/league/${id}`)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-10">
      <h1 className="text-3xl font-bold tracking-tight">FPL League Tracker</h1>
      <p className="mt-2 text-ink-2">
        Rank history, transfers and chips for your whole mini-league, in one place.
      </p>

      <form onSubmit={submit} noValidate className="mt-8">
        <label htmlFor="league-id" className="block text-sm font-medium">
          League ID or link
        </label>
        <input
          id="league-id"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="go"
          placeholder="e.g. 123456"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setError(null)
          }}
          aria-invalid={error !== null}
          aria-describedby={error ? 'league-id-error' : undefined}
          className="mt-2 block h-12 w-full rounded-xl border border-line bg-card px-4 text-base placeholder:text-muted"
        />
        {error && (
          <p id="league-id-error" role="alert" className="mt-2 text-sm text-down">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="mt-4 h-12 w-full rounded-xl bg-accent text-base font-semibold text-accent-ink active:opacity-80"
        >
          Show league
        </button>
      </form>

      <details className="mt-6 rounded-xl border border-line bg-card px-4 text-sm">
        <summary className="flex min-h-12 cursor-pointer items-center font-medium">
          Where do I find my league ID?
        </summary>
        <ol className="list-decimal space-y-1 pb-4 pl-5 text-ink-2">
          <li>Open the FPL website or app and go to <b>Leagues</b>.</li>
          <li>Open your classic league.</li>
          <li>
            The number in the link is the ID:
            <br />
            <span className="break-all text-ink">
              fantasy.premierleague.com/leagues/<b>123456</b>/standings/c
            </span>
          </li>
        </ol>
        <p className="pb-4 text-ink-2">You can also paste the whole link above.</p>
      </details>

      {recent.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-ink-2">Recent leagues</h2>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
            {recent.map((league) => (
              <li key={league.id} className="flex items-center">
                <Link
                  to={`/league/${league.id}`}
                  className="flex min-h-14 min-w-0 flex-1 flex-col justify-center px-4 active:bg-surface"
                >
                  <span className="truncate font-medium">{league.name}</span>
                  <span className="text-xs text-muted">ID {league.id}</span>
                </Link>
                <button
                  type="button"
                  aria-label={`Remove ${league.name} from recent leagues`}
                  onClick={() => {
                    forgetLeague(league.id)
                    setRecent(getRecentLeagues())
                  }}
                  className="grid size-12 shrink-0 place-items-center text-xl text-muted active:text-ink"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-auto pt-10 text-xs text-muted">
        Unofficial fan project, not affiliated with the Premier League.
      </p>
    </main>
  )
}
