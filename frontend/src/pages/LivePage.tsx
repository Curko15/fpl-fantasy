import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { fetchLeagueLive, retryNetworkErrors, type LiveLeague, type LiveManager } from '../api'
import { chipLabel } from '../chips'
import { PlayerPhoto } from '../components/PlayerPhoto'
import { SectionHeading } from '../components/SectionHeading'
import { Bone } from '../components/Skeleton'
import { ErrorCard } from '../components/Status'
import { YouTag } from '../components/YouTag'
import { liveRefetchInterval, liveSpotlight, liveStats, moveLabel, rankMove } from '../live'
import { ordinal } from '../seasonCharts'
import { useLeague, useMe } from './leagueContext'

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/**
 * Live gameweek: provisional scores and the live table while a gameweek is being played,
 * refreshed every minute. `?event=N` shows an earlier gameweek the same way.
 */
export default function LivePage() {
  const { league } = useLeague()
  const [params] = useSearchParams()
  const requested = Number(params.get('event')) || undefined
  const leagueId = league.league.id

  const query = useQuery({
    queryKey: ['league', leagueId, 'live', requested ?? 'current'],
    queryFn: () => fetchLeagueLive(leagueId, requested),
    staleTime: 30_000,
    retry: retryNetworkErrors,
    // Every minute while live; react-query pauses this while the tab is hidden.
    refetchInterval: (q) => liveRefetchInterval(q.state.data),
  })

  if (query.isError) {
    return <ErrorCard title="Can't load live scores" error={query.error} onRetry={() => query.refetch()} />
  }
  if (!query.data) return <LiveSkeleton />

  const data = query.data
  if (data.event === null || data.managers.length === 0) return <NotLive event={data.event} />

  return (
    <div className="space-y-7">
      <Hero data={data} fetching={query.isFetching} />
      <LiveTable managers={data.managers} live={data.live} />
    </div>
  )
}

function StatusPill({ live }: { live: boolean }) {
  return live ? (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-down/12 px-2.5 text-xs font-semibold text-down">
      <span className="size-1.5 animate-pulse rounded-full bg-down" />
      Live
    </span>
  ) : (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-accent/12 px-2.5 text-xs font-semibold text-accent">
      <span className="size-1.5 rounded-full bg-accent" />
      Finished
    </span>
  )
}

function Hero({ data, fetching }: { data: LiveLeague; fetching: boolean }) {
  const [meId] = useMe()
  const spot = liveSpotlight(data.managers, meId)
  const stats = liveStats(data.managers)
  if (!spot) return null
  const m = spot.manager
  const move = moveLabel(rankMove(m))
  const gap = spot.gap
  const tiles = [
    { label: 'League avg', value: stats.average },
    { label: 'Top score', value: stats.top },
    { label: data.live ? 'Players left' : 'Managers', value: data.live ? stats.playersLeft : data.managers.length },
  ]

  return (
    <section aria-labelledby="live-hero" className="rounded-3xl border border-line bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">Gameweek {data.event}</span>
        <StatusPill live={data.live} />
      </div>

      <div className="mt-4 flex items-end gap-3">
        <div className="font-display text-6xl leading-[0.85] font-bold tracking-tight tabular-nums">{m.points}</div>
        <div className="min-w-0 pb-0.5">
          <div className="flex items-center gap-1.5 text-sm text-muted">
            {spot.isMe ? 'your' : 'leader’s'} {data.live ? 'live score' : 'score'}
          </div>
          <h2 id="live-hero" className="flex min-w-0 items-center gap-1.5 font-semibold">
            <span className="truncate">{m.team_name}</span>
            {spot.isMe && <YouTag />}
          </h2>
        </div>
      </div>

      <p className="mt-4 text-sm text-ink-2">
        <span className="font-semibold text-ink">{ordinal(m.rank)}</span>
        {data.live && ' live'}
        {rankMove(m) !== 0 && (
          <>
            {' '}
            <span className={`font-semibold ${move.tone}`} aria-label={move.aria}>
              {move.text}
            </span>
          </>
        )}{' '}
        · {m.total} pts
        {gap && (
          <>
            {' · '}
            {gap.points === 0
              ? `level with ${gap.team}`
              : gap.kind === 'behind'
                ? `${gap.points} behind ${gap.team}`
                : `${gap.points} clear of ${gap.team}`}
          </>
        )}
      </p>

      <dl className="mt-4 grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl bg-raised px-3 py-2.5">
            <dt className="text-[11px] text-muted">{t.label}</dt>
            <dd className="mt-0.5 font-display text-xl font-bold tabular-nums">{t.value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 flex items-start gap-2 text-xs text-muted">
        <RefreshCw size={14} aria-hidden className={`mt-px shrink-0 ${fetching ? 'animate-spin' : ''}`} />
        <span>
          {data.live ? (
            <>
              {data.updated_at && <>Updated {clock(data.updated_at)} · </>}refreshes every minute. Provisional: before
              auto-subs and final bonus.
            </>
          ) : (
            <>GW{data.event} is finished: these are its final scores.</>
          )}
        </span>
      </p>
    </section>
  )
}

function LiveTable({ managers, live }: { managers: LiveManager[]; live: boolean }) {
  const [meId] = useMe()
  return (
    <section aria-labelledby="live-table-heading">
      <SectionHeading id="live-table-heading" aside={<span className="text-xs text-muted">Movement since the deadline</span>}>
        {live ? 'Live table' : 'Table'}
      </SectionHeading>
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <div aria-hidden className="flex items-center gap-2.5 border-b border-line px-3.5 py-2 text-[11px] font-semibold text-muted">
          <span className="w-6">#</span>
          <span className="w-7" />
          <span className="flex-1">Team</span>
          <span className="w-11 text-right">GW</span>
          <span className="w-11 text-right">Total</span>
        </div>
        <ol className="divide-y divide-line">
          {managers.map((m) => (
            <LiveRow key={m.entry_id} m={m} isMe={m.entry_id === meId} live={live} />
          ))}
        </ol>
      </div>
    </section>
  )
}

function LiveRow({ m, isMe, live }: { m: LiveManager; isMe: boolean; live: boolean }) {
  const move = moveLabel(rankMove(m))
  const details = [
    m.chip && chipLabel(m.chip).short,
    m.transfers_cost > 0 && `−${m.transfers_cost} hit`,
  ].filter(Boolean)

  return (
    <li className={`relative flex items-center gap-2.5 px-3.5 py-2.5 ${isMe ? 'bg-accent/8' : 'active:bg-raised'}`}>
      {isMe && <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-accent" />}
      <span className={`w-6 shrink-0 font-display text-base font-bold tabular-nums ${m.rank === 1 || isMe ? 'text-accent' : ''}`}>
        {m.rank}
      </span>
      <span className={`w-7 shrink-0 text-xs font-semibold tabular-nums ${move.tone}`} aria-label={move.aria}>
        {move.text}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {/* Stretched link: the whole row opens the manager page. */}
          <Link to={`../manager/${m.entry_id}`} className="min-w-0 truncate text-sm font-semibold after:absolute after:inset-0">
            {m.team_name}
          </Link>
          {isMe && <YouTag />}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted">
          {m.captain && (
            <>
              <PlayerPhoto player={m.captain} size={18} />
              <span className="shrink-0">
                {m.captain.name} <span className="font-semibold text-ink-2 tabular-nums">{m.captain_points}</span>
              </span>
            </>
          )}
          {details.length > 0 && <span className="min-w-0 truncate">· {details.join(' · ')}</span>}
        </div>
      </div>
      <div className="w-11 shrink-0 text-right">
        <div className="font-display text-base leading-tight font-bold tabular-nums">{m.points}</div>
        {live && (
          <div className={`text-[11px] tabular-nums ${m.players_left > 0 ? 'text-ink-2' : 'text-muted'}`}>
            {m.players_left > 0 ? `${m.players_left} left` : 'done'}
          </div>
        )}
      </div>
      <span className="w-11 shrink-0 text-right text-sm font-semibold text-ink-2 tabular-nums">{m.total}</span>
    </li>
  )
}

function NotLive({ event }: { event: number | null }) {
  return (
    <section className="rounded-3xl border border-line bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">Live scores</span>
        <span className="inline-flex h-6 items-center rounded-full bg-raised px-2.5 text-xs font-semibold text-muted">
          Not live
        </span>
      </div>
      <h2 className="mt-3 font-display text-2xl leading-tight font-bold tracking-tight">No gameweek in progress</h2>
      <p className="mt-2 text-sm text-ink-2">
        {event === null
          ? 'Live scores show here once the season’s first deadline has passed.'
          : `GW${event} is finished. Live scores and the live table show here from the GW${event + 1} deadline until its last match.`}
      </p>
      {event !== null && (
        <Link
          to={`../awards`}
          className="mt-4 flex h-12 items-center gap-3 rounded-2xl bg-raised px-3.5 text-sm font-semibold active:bg-line/60"
        >
          <span className="min-w-0 flex-1 truncate">See the GW{event} recap</span>
          <ChevronRight size={18} aria-hidden className="shrink-0 text-muted" />
        </Link>
      )}
    </section>
  )
}

function LiveSkeleton() {
  return (
    <div className="space-y-7" aria-busy="true" aria-label="Loading live scores">
      <Bone className="h-64 rounded-3xl" />
      <div className="space-y-px overflow-hidden rounded-2xl border border-line">
        {Array.from({ length: 6 }, (_, i) => (
          <Bone key={i} className="h-14 rounded-none" />
        ))}
      </div>
    </div>
  )
}
