import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeftRight, ArrowRight, ChartLine, ChevronDown, Trophy, X, Zap } from 'lucide-react'
import { Logo } from '../components/Logo'
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
    <div className="relative min-h-dvh overflow-hidden">
      {/* Soft brand glow behind the hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,color-mix(in_oklab,var(--color-accent)_22%,transparent),transparent)]"
      />
      <main className="relative mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <Logo size={32} />
          <span className="font-semibold">League Tracker</span>
        </div>

        <h1 className="mt-10 text-[2rem] leading-tight font-bold tracking-tight">Your mini-league, all in one place.</h1>
        <p className="mt-3 text-ink-2">
          Standings, every transfer, chips and weekly awards for your FPL classic league.
        </p>

        <form onSubmit={submit} noValidate className="mt-7 rounded-2xl border border-line bg-card p-4 shadow-sm">
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
            className="mt-2 block h-12 w-full rounded-xl border border-line bg-surface px-4 text-base placeholder:text-muted"
          />
          {error && (
            <p id="league-id-error" role="alert" className="mt-2 text-sm text-down">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="mt-3 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-accent text-base font-semibold text-accent-ink active:opacity-80"
          >
            Show league
            <ArrowRight size={18} aria-hidden />
          </button>
          <details className="group mt-3 text-sm">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-ink-2 [&::-webkit-details-marker]:hidden">
              Where do I find my league ID?
              <ChevronDown size={16} aria-hidden className="transition-transform group-open:rotate-180" />
            </summary>
            <ol className="list-decimal space-y-1 pb-1 pl-5 text-ink-2">
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
            <p className="pt-1 text-ink-2">You can also paste the whole link above.</p>
          </details>
        </form>

        {recent.length > 0 && (
          <section className="mt-8" aria-labelledby="recent-heading">
            <h2 id="recent-heading" className="text-sm font-semibold text-ink-2">
              Your leagues
            </h2>
            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
              {recent.map((league) => (
                <li key={league.id} className="flex items-center">
                  <Link
                    to={`/league/${league.id}`}
                    className="flex min-h-16 min-w-0 flex-1 items-center gap-3 pl-3 active:bg-surface"
                  >
                    <span
                      aria-hidden
                      className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/15 font-semibold text-accent"
                    >
                      {[...league.name][0]?.toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{league.name}</span>
                      <span className="block text-xs text-muted">ID {league.id}</span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    aria-label={`Remove ${league.name} from your leagues`}
                    onClick={() => {
                      forgetLeague(league.id)
                      setRecent(getRecentLeagues())
                    }}
                    className="grid size-12 shrink-0 place-items-center text-muted active:text-ink"
                  >
                    <X size={18} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8" aria-labelledby="features-heading">
          <h2 id="features-heading" className="sr-only">
            What you get
          </h2>
          <ul className="grid grid-cols-2 gap-2">
            {FEATURES.map(({ Icon, title, text }) => (
              <li key={title} className="rounded-2xl border border-line bg-card p-3">
                <span className="grid size-9 place-items-center rounded-xl bg-accent/15 text-accent">
                  <Icon size={18} aria-hidden />
                </span>
                <h3 className="mt-2 text-sm font-semibold">{title}</h3>
                <p className="mt-0.5 text-xs text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-auto pt-10 text-center text-xs text-muted">
          Unofficial fan project, not affiliated with the Premier League.
        </p>
      </main>
    </div>
  )
}

const FEATURES = [
  { Icon: ChartLine, title: 'Standings', text: 'Live table and every rank change, week by week.' },
  { Icon: ArrowLeftRight, title: 'Transfers', text: 'Who bought whom, and who paid for hits.' },
  { Icon: Zap, title: 'Chips', text: 'Which chips everyone has used, and when.' },
  { Icon: Trophy, title: 'Awards', text: 'Weekly heroes and villains, plus a Hall of Shame.' },
]
