import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ApiError, fetchLeague } from '../api'
import { rememberLeague } from '../recentLeagues'
import LeagueChart from '../components/LeagueChart'
import StandingsTable from '../components/StandingsTable'

function formatUpdated(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function BackLink() {
  return (
    <Link to="/" className="-ml-2 inline-flex h-11 items-center px-2 text-sm font-medium text-ink-2">
      ← Leagues
    </Link>
  )
}

export default function LeaguePage() {
  const leagueId = Number(useParams().leagueId)
  const valid = Number.isSafeInteger(leagueId) && leagueId > 0

  const query = useQuery({
    queryKey: ['league', leagueId],
    queryFn: () => fetchLeague(leagueId),
    enabled: valid,
    staleTime: 5 * 60_000,
    retry: (count, error) => error instanceof ApiError && error.code === 'network' && count < 2,
  })

  const data = query.data
  useEffect(() => {
    if (data) {
      rememberLeague({ id: data.league.id, name: data.league.name })
      document.title = `${data.league.name} · FPL League Tracker`
    }
  }, [data])

  const shell = 'mx-auto max-w-3xl px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]'

  if (!valid || query.isError) {
    const message = !valid
      ? "That doesn't look like a league ID."
      : query.error instanceof ApiError
        ? query.error.message
        : 'Something went wrong.'
    const retryable = query.error instanceof ApiError && ['network', 'fpl_unavailable', 'unknown'].includes(query.error.code)
    return (
      <main className={shell}>
        <BackLink />
        <div className="mt-6 rounded-xl border border-line bg-card p-5">
          <h1 className="text-lg font-semibold">Can't show this league</h1>
          <p className="mt-2 text-ink-2">{message}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {retryable && (
              <button
                type="button"
                onClick={() => query.refetch()}
                className="h-11 rounded-xl bg-accent px-5 font-semibold text-accent-ink"
              >
                Try again
              </button>
            )}
            <Link to="/" className="inline-flex h-11 items-center rounded-xl border border-line px-5 font-medium">
              Enter another ID
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (!data) {
    return (
      <main className={shell}>
        <BackLink />
        <div className="mt-16 flex flex-col items-center text-center" role="status">
          <div className="size-8 animate-spin rounded-full border-2 border-line border-t-accent" />
          <p className="mt-4 font-medium">Loading league…</p>
          <p className="mt-1 max-w-xs text-sm text-muted">
            The first visit fetches every manager's history from FPL and can take a few seconds.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className={shell}>
      <BackLink />
      <header className="mt-1">
        <h1 className="text-2xl font-bold tracking-tight break-words">{data.league.name}</h1>
        <p className="mt-1 text-xs text-muted">
          {data.managers.length} managers
          {data.current_event && <> · GW{data.current_event}</>} · Updated {formatUpdated(data.last_updated)}
        </p>
      </header>

      <section className="mt-5" aria-labelledby="standings-heading">
        <h2 id="standings-heading" className="mb-2 text-lg font-semibold">
          Standings
        </h2>
        <StandingsTable managers={data.managers} currentEvent={data.current_event} />
      </section>

      <section className="mt-8" aria-labelledby="chart-heading">
        <h2 id="chart-heading" className="mb-3 text-lg font-semibold">
          Season so far
        </h2>
        <LeagueChart managers={data.managers} events={data.events} />
      </section>
    </main>
  )
}
