import { Suspense, useEffect, useMemo } from 'react'
import { NavLink, Outlet, useLocation, useMatch, useParams } from 'react-router-dom'
import { ArrowLeftRight, ChartLine, Trophy, Zap, type LucideIcon } from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { useQuery } from '@tanstack/react-query'
import { ApiError, fetchLeague, retryNetworkErrors, type LeagueOverview } from '../api'
import { TeamBar } from '../components/TeamBar'
import { useMyTeam } from '../myTeam'
import { rememberLeague } from '../recentLeagues'
import { ErrorCard } from '../components/Status'
import { Bone, PageSkeleton, StandingsSkeleton } from '../components/Skeleton'
import type { LeagueContext } from './leagueContext'

function formatUpdated(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const TABS: { to: string; label: string; end: boolean; Icon: LucideIcon }[] = [
  { to: '', label: 'Overview', end: true, Icon: ChartLine },
  { to: 'transfers', label: 'Transfers', end: false, Icon: ArrowLeftRight },
  { to: 'chips', label: 'Chips', end: false, Icon: Zap },
  { to: 'awards', label: 'Awards', end: false, Icon: Trophy },
]

// Content scrolls under the sticky header (and the top tabs from sm up). Sticky
// headings inside tabs sit at top-(--sticky-top).
const shell =
  'mx-auto max-w-3xl px-4 pt-5 [--sticky-top:calc(3.5rem+1px+env(safe-area-inset-top))] sm:[--sticky-top:calc(6.5rem+2px+env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pb-12'

export default function LeagueLayout() {
  const leagueId = Number(useParams().leagueId)
  const valid = Number.isSafeInteger(leagueId) && leagueId > 0
  const { pathname } = useLocation()
  const managerMatch = useMatch('/league/:leagueId/manager/:entryId')

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

  // Like an app: switching tab or opening a manager starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  if (!valid || query.isError) {
    return (
      <>
        <AppHeader title="League" />
        <main className={shell}>
          <ErrorCard
            error={valid ? query.error : new ApiError('not_found', "That doesn't look like a league ID.")}
            onRetry={valid ? () => query.refetch() : undefined}
          />
        </main>
      </>
    )
  }

  if (!data) {
    return (
      <>
        <AppHeader title={<Bone className="h-4 w-44" />} subtitle={<Bone className="mt-1.5 h-3 w-56" />} />
        <main className={shell}>
          <StandingsSkeleton hint="First visit: fetching every manager's history from FPL. This can take a few seconds." />
        </main>
      </>
    )
  }

  const manager = managerMatch
    ? data.managers.find((m) => m.entry_id === Number(managerMatch.params.entryId))
    : undefined

  return (
    <>
      {managerMatch ? (
        <AppHeader
          title={manager?.team_name ?? 'Manager'}
          subtitle={data.league.name}
          back={{ to: `/league/${data.league.id}`, label: `Back to ${data.league.name}` }}
        />
      ) : (
        <AppHeader
          title={data.league.name}
          subtitle={
            <>
              {data.managers.length} managers
              {data.current_event && <> · GW{data.current_event}</>} · Updated {formatUpdated(data.last_updated)}
            </>
          }
        />
      )}

      {/* From sm up: tabs under the header. Phones get the bottom bar instead. */}
      <nav
        aria-label="League sections"
        className="sticky top-[calc(3.5rem+1px+env(safe-area-inset-top))] z-10 hidden border-b border-line bg-surface/90 backdrop-blur-md sm:block"
      >
        <ul className="mx-auto flex max-w-3xl gap-1 px-2">
          {TABS.map(({ to, label, end, Icon }) => (
            <li key={label}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `relative flex h-12 items-center gap-2 px-3 text-sm font-medium whitespace-nowrap ${
                    isActive
                      ? 'text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent'
                      : 'text-ink-2 hover:text-ink'
                  }`
                }
              >
                <Icon size={16} aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <main className={shell}>
        <Suspense fallback={<PageSkeleton />}>
          {!managerMatch && <MyTeamBar league={data} />}
          <Outlet context={{ league: data } satisfies LeagueContext} />
        </Suspense>
      </main>

      <BottomTabs />
    </>
  )
}

/** "Your team" switcher, always at the top of the league tabs. */
function MyTeamBar({ league }: { league: LeagueOverview }) {
  const ids = useMemo(() => league.managers.map((m) => m.entry_id), [league.managers])
  const [myTeam, setMyTeam] = useMyTeam(league.league.id, ids)
  return (
    <div className="mb-6">
      <TeamBar managers={league.managers} value={myTeam} onChange={setMyTeam} />
    </div>
  )
}

function BottomTabs() {
  return (
    <nav
      aria-label="League sections"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
    >
      <ul className="grid grid-cols-4">
        {TABS.map(({ to, label, end, Icon }) => (
          <li key={label}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `group flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                  isActive ? 'text-ink' : 'text-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-7 w-14 items-center justify-center rounded-full transition-colors ${
                      isActive ? 'bg-accent/15 text-accent' : 'group-active:bg-line/60'
                    }`}
                  >
                    <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} aria-hidden />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
