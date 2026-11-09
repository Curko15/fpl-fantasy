import { useEffect } from 'react'
import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ApiError, fetchLeague, retryNetworkErrors } from '../api'
import { rememberLeague } from '../recentLeagues'
import { ErrorCard, Loading } from '../components/Status'
import type { LeagueContext } from './leagueContext'

function formatUpdated(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const TABS = [
  { to: '', label: 'Overview', end: true },
  { to: 'transfers', label: 'Transfers', end: false },
  { to: 'chips', label: 'Chips', end: false },
  { to: 'awards', label: 'Awards', end: false },
]

function BackLink() {
  return (
    <Link to="/" className="-ml-2 inline-flex h-11 items-center px-2 text-sm font-medium text-ink-2">
      ← Leagues
    </Link>
  )
}

const shell =
  'mx-auto max-w-3xl px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]'

export default function LeagueLayout() {
  const leagueId = Number(useParams().leagueId)
  const valid = Number.isSafeInteger(leagueId) && leagueId > 0

  const query = useQuery({
    queryKey: ['league', leagueId],
    queryFn: () => fetchLeague(leagueId),
    enabled: valid,
    staleTime: 5 * 60_000,
    retry: retryNetworkErrors,
  })

  const data = query.data
  useEffect(() => {
    if (data) {
      rememberLeague({ id: data.league.id, name: data.league.name })
      document.title = `${data.league.name} · FPL League Tracker`
    }
  }, [data])

  if (!valid || query.isError) {
    return (
      <main className={shell}>
        <BackLink />
        <ErrorCard
          error={valid ? query.error : new ApiError('not_found', "That doesn't look like a league ID.")}
          onRetry={valid ? () => query.refetch() : undefined}
        />
      </main>
    )
  }

  if (!data) {
    return (
      <main className={shell}>
        <BackLink />
        <Loading
          title="Loading league…"
          hint="The first visit fetches every manager's history from FPL and can take a few seconds."
        />
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

      <nav
        aria-label="League sections"
        className="sticky top-0 z-10 -mx-4 mt-3 overflow-x-auto border-b border-line bg-surface/95 px-4 backdrop-blur [scrollbar-width:none]"
      >
        <ul className="flex gap-1">
          {TABS.map((tab) => (
            <li key={tab.label}>
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `relative flex h-12 items-center px-3 text-sm font-medium whitespace-nowrap ${
                    isActive
                      ? 'text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent'
                      : 'text-ink-2'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-5">
        <Outlet context={{ league: data } satisfies LeagueContext} />
      </div>
    </main>
  )
}
