import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Swords } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useLeagueTransfers } from '../queries'
import {
  fetchManager,
  retryNetworkErrors,
  type Contributor,
  type GameweekDetail,
  type LeagueOverview,
  type Manager,
} from '../api'
import { chipLabel } from '../chips'
import ScoreSpread from '../components/ScoreSpread'
import { SectionHeading } from '../components/SectionHeading'
import { ErrorCard } from '../components/Status'
import { ManagerSkeleton } from '../components/Skeleton'
import { PlayerPhoto } from '../components/PlayerPhoto'
import { Badge, TransferCard } from '../components/TransferCard'
import { YouTag } from '../components/YouTag'
import { ordinal } from '../seasonCharts'
import { groupTransfers } from '../transfers'
import { useLeague, useMe } from './leagueContext'

const CONTRIBUTORS_COLLAPSED = 10

export default function ManagerPage() {
  const { league } = useLeague()
  const entryId = Number(useParams().entryId)
  const leagueId = league.league.id
  const manager = league.managers.find((m) => m.entry_id === entryId)

  const query = useQuery({
    queryKey: ['league', leagueId, 'manager', entryId],
    queryFn: () => fetchManager(leagueId, entryId),
    enabled: manager !== undefined,
    staleTime: 5 * 60_000,
    retry: retryNetworkErrors,
  })

  if (!manager) {
    return (
      <p className="rounded-2xl border border-line bg-card p-4 text-ink-2">
        That manager isn't in this league.{' '}
        <Link to=".." className="font-semibold text-accent">
          Back to standings
        </Link>
      </p>
    )
  }

  return (
    <div className="space-y-7">
      <ManagerHero manager={manager} league={league} />
      {query.isError && <ErrorCard title="Can't load this manager" error={query.error} onRetry={() => query.refetch()} />}
      {query.isPending && <ManagerSkeleton />}
      {query.data && (
        <>
          {query.data.provisional_event && (
            <p className="-mt-4 rounded-xl bg-accent/10 px-3 py-2 text-xs text-ink-2">
              GW{query.data.provisional_event} is still being played, so its points can still change.
            </p>
          )}
          <SeasonStats gameweeks={query.data.gameweeks} />
        </>
      )}
      <WeeksVsLeague manager={manager} league={league} />
      {query.data && (
        <>
          <Contributors contributors={query.data.contributors} />
          <GameweekLog gameweeks={query.data.gameweeks} />
        </>
      )}
      <ManagerTransfers manager={manager} />
    </div>
  )
}

function ManagerHero({ manager, league }: { manager: Manager; league: LeagueOverview }) {
  const [meId, setMe] = useMe()
  const isMe = manager.entry_id === meId
  const table = [...league.managers].sort((a, b) => a.rank - b.rank)
  // Compare with my team; when this is my team (or none is saved), with the leader, or 2nd if this is the leader.
  const rival =
    !isMe && meId !== null
      ? league.managers.find((m) => m.entry_id === meId)
      : table.find((m) => m.entry_id !== manager.entry_id)
  const leaderTotal = Math.max(...league.managers.map((m) => m.total))
  const behind = leaderTotal - manager.total
  const move = manager.last_rank === 0 ? 0 : manager.last_rank - manager.rank
  const stats = [
    { label: 'Total', value: manager.total, tone: '' },
    { label: league.current_event ? `GW${league.current_event}` : 'This GW', value: manager.event_total, tone: '' },
    { label: 'Behind 1st', value: behind === 0 ? 'Leader' : `−${behind}`, tone: behind === 0 ? 'text-accent' : '' },
  ]

  return (
    <section aria-label={`${manager.team_name} summary`} className="rounded-3xl border border-line bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">League rank</span>
        {isMe ? (
          <YouTag />
        ) : (
          <button
            type="button"
            onClick={() => setMe(manager.entry_id)}
            className="-my-2.5 h-11 rounded-full px-1 text-sm font-semibold text-accent"
          >
            This is my team
          </button>
        )}
      </div>
      <div className="mt-3 flex items-end gap-3">
        <div className="font-display text-6xl leading-[0.85] font-bold tracking-tight tabular-nums">
          {ordinal(manager.rank)}
        </div>
        <div className="min-w-0 pb-0.5">
          <div className="text-sm text-muted">of {league.managers.length}</div>
          <div className="truncate font-semibold">{manager.player_name}</div>
        </div>
        {move !== 0 && (
          <span
            className={`mb-0.5 ml-auto shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
              move > 0 ? 'bg-up/12 text-up' : 'bg-down/12 text-down'
            }`}
          >
            {move > 0 ? `▲ ${move}` : `▼ ${-move}`}
            <span className="sr-only"> since last gameweek</span>
          </span>
        )}
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-raised px-3 py-2.5">
            <dt className="text-[11px] text-muted">{s.label}</dt>
            <dd className={`mt-0.5 font-display text-xl font-bold tabular-nums ${s.tone}`}>{s.value}</dd>
          </div>
        ))}
      </dl>
      {rival && (
        <Link
          to={`/league/${league.league.id}/compare?a=${isMe || meId === null ? manager.entry_id : meId}&b=${
            isMe || meId === null ? rival.entry_id : manager.entry_id
          }`}
          className="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl border border-line text-sm font-semibold active:bg-raised"
        >
          <Swords size={16} aria-hidden className="text-accent" />
          <span className="min-w-0 truncate">Compare with {rival.team_name}</span>
        </Link>
      )}
    </section>
  )
}

function SeasonStats({ gameweeks }: { gameweeks: GameweekDetail[] }) {
  if (gameweeks.length === 0) return null
  const captain = gameweeks.reduce((n, g) => n + g.captain_points, 0)
  const hits = gameweeks.reduce((n, g) => n + g.transfers_cost, 0)
  const bench = gameweeks.reduce((n, g) => n + g.bench_points, 0)
  const stats = [
    { label: 'From captains', value: captain, note: 'points', tone: '' },
    { label: 'Left on bench', value: bench, note: 'points', tone: '' },
    { label: 'Hits', value: hits ? `−${hits}` : '0', note: 'points', tone: hits ? 'text-down' : '' },
  ]
  return (
    <section aria-labelledby="season-stats-heading">
      <SectionHeading id="season-stats-heading">Season in numbers</SectionHeading>
      <dl className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0 rounded-2xl border border-line bg-card px-3 py-2.5">
            <dt className="truncate text-[11px] text-muted">{s.label}</dt>
            <dd className={`font-display text-xl font-bold tabular-nums ${s.tone}`}>{s.value}</dd>
            <dd className="text-[11px] text-muted">{s.note}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function WeeksVsLeague({ manager, league }: { manager: Manager; league: LeagueOverview }) {
  const [meId] = useMe()
  if (league.events.length === 0) return null
  const isMe = manager.entry_id === meId
  return (
    <section aria-labelledby="weeks-heading">
      <SectionHeading id="weeks-heading">{isMe ? 'Your weeks vs the league' : 'Weeks vs the league'}</SectionHeading>
      <ScoreSpread
        managers={league.managers}
        events={league.events}
        meId={manager.entry_id}
        subject={isMe ? 'You' : manager.team_name}
      />
    </section>
  )
}

function Contributors({ contributors }: { contributors: Contributor[] }) {
  const [expanded, setExpanded] = useState(false)
  if (contributors.length === 0) return null
  const max = contributors[0].points || 1
  const shown = expanded ? contributors : contributors.slice(0, CONTRIBUTORS_COLLAPSED)

  return (
    <section aria-labelledby="contributors-heading">
      <SectionHeading id="contributors-heading">Top contributors</SectionHeading>
      <p className="-mt-2 mb-3 flex flex-wrap items-center gap-x-3 text-xs text-muted">
        <span>Points that counted (bench excluded)</span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-3 rounded-sm bg-accent" /> playing
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-3 rounded-sm bg-accent/40" /> captaincy
        </span>
      </p>
      <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {shown.map((c, i) => {
          const base = c.points - c.captain_points
          return (
            <li key={c.player.id} className="flex items-center gap-3 px-3.5 py-3">
              <span className="w-5 shrink-0 font-display text-sm font-bold text-muted tabular-nums">{i + 1}</span>
              <PlayerPhoto player={c.player} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {c.player.name}
                    <span className="ml-1.5 text-xs font-normal text-muted">
                      {c.player.team} · {c.player.position}
                    </span>
                  </span>
                  <span className="shrink-0 font-display text-base font-bold tabular-nums">{c.points}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex h-1.5 flex-1 gap-0.5" aria-hidden>
                    <div className="rounded-full bg-accent" style={{ width: `${(Math.max(base, 0) / max) * 100}%` }} />
                    {c.captain_points > 0 && (
                      <div className="rounded-full bg-accent/40" style={{ width: `${(c.captain_points / max) * 100}%` }} />
                    )}
                  </div>
                  <span className="shrink-0 text-right text-[11px] text-muted">
                    {c.captain_points > 0 ? `${c.captain_points} from (C) · ` : ''}
                    {c.starts} GW{c.starts === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      {contributors.length > CONTRIBUTORS_COLLAPSED && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 flex h-11 w-full items-center justify-center text-sm font-semibold text-accent"
        >
          {expanded ? 'Show fewer' : `Show all ${contributors.length} players`}
        </button>
      )}
    </section>
  )
}

function GameweekLog({ gameweeks }: { gameweeks: GameweekDetail[] }) {
  if (gameweeks.length === 0) return null
  // gameweeks are newest first; movement compares with the gameweek before.
  const previousRank = new Map(gameweeks.slice(1).map((g, i) => [gameweeks[i].event, g.league_rank]))
  return (
    <section aria-labelledby="log-heading">
      <SectionHeading id="log-heading">Gameweek by gameweek</SectionHeading>
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] font-semibold tracking-[0.04em] text-muted uppercase">
              <th scope="col" className="w-11 py-2.5 pl-3.5 font-semibold">
                GW
              </th>
              <th scope="col" className="w-14 py-2.5 text-right font-semibold">
                Pts
              </th>
              <th scope="col" className="w-14 py-2.5 text-right font-semibold">
                Rank
              </th>
              <th scope="col" className="py-2.5 pl-3 font-semibold">
                Captain
              </th>
              <th scope="col" className="w-14 py-2.5 pr-3.5 text-right font-semibold">
                Bench
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {gameweeks.map((g) => {
              const prev = previousRank.get(g.event)
              const move = prev === undefined ? 0 : prev - g.league_rank
              return (
                <tr key={g.event}>
                  <td className="py-2.5 pl-3.5 text-muted tabular-nums">{g.event}</td>
                  <td className="py-2.5 text-right">
                    <div className="font-display text-base font-bold tabular-nums">{g.points}</div>
                    {g.transfers_cost > 0 && <div className="text-[11px] text-down">−{g.transfers_cost} hit</div>}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    <div className="font-semibold">{g.league_rank}</div>
                    {move !== 0 && (
                      <div className={`text-[11px] font-semibold ${move > 0 ? 'text-up' : 'text-down'}`}>
                        {move > 0 ? '▲' : '▼'}
                        {Math.abs(move)}
                      </div>
                    )}
                  </td>
                  <td className="min-w-0 py-2.5 pl-3">
                    {g.captain ? (
                      <div className="flex min-w-0 items-center gap-1.5">
                        <PlayerPhoto player={g.captain} size={24} />
                        <span className="truncate">{g.captain.name}</span>
                        <span className="shrink-0 text-muted tabular-nums">{g.captain_points}</span>
                      </div>
                    ) : (
                      <span className="text-muted">–</span>
                    )}
                    {g.chip && (
                      <div className="mt-0.5">
                        <Badge tone="chip">{chipLabel(g.chip).label}</Badge>
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 pr-3.5 text-right text-ink-2 tabular-nums">{g.bench_points}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ManagerTransfers({ manager }: { manager: Manager }) {
  const { league } = useLeague()
  const query = useLeagueTransfers(league.league.id)
  const [showAll, setShowAll] = useState(false)

  const gameweeks = useMemo(() => {
    if (!query.data) return []
    return groupTransfers(
      query.data.transfers.filter((t) => t.entry_id === manager.entry_id),
      new Map([[manager.entry_id, manager]]),
    )
  }, [query.data, manager])

  const shown = showAll ? gameweeks : gameweeks.slice(0, 3)

  return (
    <section aria-labelledby="manager-transfers-heading">
      <SectionHeading id="manager-transfers-heading">Transfers</SectionHeading>
      {query.isPending && <p className="text-sm text-muted">Loading transfers…</p>}
      {query.isError && <p className="text-sm text-down">Couldn't load transfers.</p>}
      {query.data && gameweeks.length === 0 && (
        <p className="rounded-2xl border border-line bg-card p-4 text-sm text-ink-2">No transfers yet.</p>
      )}
      <ul className="space-y-2.5">
        {shown.flatMap((gw) =>
          gw.cards.map((card) => (
            <TransferCard
              key={gw.event}
              card={card}
              title={
                <div className="min-w-0 flex-1 font-semibold">
                  Gameweek {gw.event}
                  <span className="font-normal text-muted">
                    {' '}
                    · {gw.count} transfer{gw.count === 1 ? '' : 's'}
                  </span>
                </div>
              }
            />
          )),
        )}
      </ul>
      {gameweeks.length > shown.length && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2.5 h-12 w-full rounded-2xl border border-line bg-card text-sm font-semibold"
        >
          Show all {gameweeks.length} gameweeks with transfers
        </button>
      )}
    </section>
  )
}
