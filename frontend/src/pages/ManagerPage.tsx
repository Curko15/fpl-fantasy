import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  fetchLeagueTransfers,
  fetchManager,
  retryNetworkErrors,
  type Contributor,
  type GameweekDetail,
  type Manager,
} from '../api'
import { chipLabel } from '../chips'
import { ErrorCard, Loading } from '../components/Status'
import { PlayerPhoto } from '../components/PlayerPhoto'
import { Badge, TransferCard } from '../components/TransferCard'
import { groupTransfers } from '../transfers'
import { useLeague } from './leagueContext'

const CONTRIBUTORS_COLLAPSED = 10

export default function ManagerPage() {
  const { league } = useLeague()
  const entryId = Number(useParams().entryId)
  const leagueId = league.league.id
  const manager = league.managers.find((m) => m.entry_id === entryId)

  // Opened from further down the standings: start at the top of the page.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [entryId])

  const query = useQuery({
    queryKey: ['league', leagueId, 'manager', entryId],
    queryFn: () => fetchManager(leagueId, entryId),
    enabled: manager !== undefined,
    staleTime: 5 * 60_000,
    retry: retryNetworkErrors,
  })

  if (!manager) {
    return (
      <p className="rounded-xl border border-line bg-card p-4 text-ink-2">
        That manager isn't in this league.{' '}
        <Link to=".." className="font-medium text-accent">
          Back to standings
        </Link>
      </p>
    )
  }

  return (
    <>
      <ManagerHeader manager={manager} />
      {query.isError && (
        <ErrorCard title="Can't load this manager" error={query.error} onRetry={() => query.refetch()} />
      )}
      {query.isPending && (
        <Loading title="Loading team history…" hint="Fetching every gameweek's team from FPL." />
      )}
      {query.data && (
        <>
          {query.data.provisional_event && (
            <p className="mt-4 rounded-lg bg-accent/10 px-3 py-2 text-xs text-ink-2">
              GW{query.data.provisional_event} is still being played, so its points can still change.
            </p>
          )}
          <SeasonStats gameweeks={query.data.gameweeks} />
          <Contributors contributors={query.data.contributors} />
          <GameweekLog gameweeks={query.data.gameweeks} />
        </>
      )}
      <ManagerTransfers manager={manager} />
    </>
  )
}

function ManagerHeader({ manager }: { manager: Manager }) {
  return (
    <header className="flex items-center gap-3 rounded-xl border border-line bg-card p-4">
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-semibold">{manager.team_name}</h2>
        <p className="truncate text-sm text-muted">{manager.player_name}</p>
      </div>
      <div className="text-right">
        <div className="text-2xl font-bold tabular-nums">{manager.total}</div>
        <div className="text-xs text-muted">
          #{manager.rank} in league
        </div>
      </div>
    </header>
  )
}

function SeasonStats({ gameweeks }: { gameweeks: GameweekDetail[] }) {
  if (gameweeks.length === 0) return null
  const best = gameweeks.reduce((a, b) => (b.points > a.points ? b : a))
  const hits = gameweeks.reduce((n, g) => n + g.transfers_cost, 0)
  const bench = gameweeks.reduce((n, g) => n + g.bench_points, 0)
  const stats = [
    { label: 'Best GW', value: best.points, note: `GW${best.event}` },
    { label: 'On bench', value: bench, note: 'points' },
    { label: 'Hits', value: hits ? `−${hits}` : '0', note: 'points' },
  ]
  return (
    <dl className="mt-3 grid grid-cols-3 gap-2">
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl border border-line bg-card px-3 py-2">
          <dt className="text-xs text-muted">{s.label}</dt>
          <dd className="text-lg font-semibold tabular-nums">{s.value}</dd>
          <dd className="text-[11px] text-muted">{s.note}</dd>
        </div>
      ))}
    </dl>
  )
}

function Contributors({ contributors }: { contributors: Contributor[] }) {
  const [expanded, setExpanded] = useState(false)
  if (contributors.length === 0) return null
  const max = contributors[0].points || 1
  const shown = expanded ? contributors : contributors.slice(0, CONTRIBUTORS_COLLAPSED)

  return (
    <section className="mt-8" aria-labelledby="contributors-heading">
      <h2 id="contributors-heading" className="text-lg font-semibold">
        Top contributors
      </h2>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
        <span>Points that counted (bench excluded)</span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-3 rounded-sm bg-accent" /> playing
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-3 rounded-sm bg-accent/40" /> captaincy
        </span>
      </p>
      <ol className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
        {shown.map((c, i) => {
          const base = c.points - c.captain_points
          return (
            <li key={c.player.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="relative shrink-0">
                <PlayerPhoto player={c.player} size={40} />
                <span className="absolute -top-1 -left-1 flex size-4 items-center justify-center rounded-full bg-card text-[10px] font-semibold tabular-nums text-muted ring-1 ring-line">
                  {i + 1}
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {c.player.name}
                    <span className="ml-1.5 text-xs font-normal text-muted">
                      {c.player.team} · {c.player.position}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{c.points}</span>
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
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 h-11 text-sm font-medium text-accent">
          {expanded ? 'Show fewer' : `Show all ${contributors.length} players`}
        </button>
      )}
    </section>
  )
}

function GameweekLog({ gameweeks }: { gameweeks: GameweekDetail[] }) {
  // gameweeks are newest first; movement compares with the gameweek before.
  const previousRank = new Map(gameweeks.slice(1).map((g, i) => [gameweeks[i].event, g.league_rank]))
  return (
    <section className="mt-8" aria-labelledby="log-heading">
      <h2 id="log-heading" className="text-lg font-semibold">
        Gameweek by gameweek
      </h2>
      <div className="mt-3 overflow-hidden rounded-xl border border-line bg-card">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th scope="col" className="w-11 py-2 pl-3 font-medium">
                GW
              </th>
              <th scope="col" className="w-14 py-2 text-right font-medium">
                Pts
              </th>
              <th scope="col" className="w-14 py-2 text-right font-medium">
                Rank
              </th>
              <th scope="col" className="py-2 pl-3 font-medium">
                Captain
              </th>
              <th scope="col" className="w-14 py-2 pr-3 text-right font-medium">
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
                  <td className="py-2 pl-3 tabular-nums text-ink-2">{g.event}</td>
                  <td className="py-2 text-right">
                    <div className="font-semibold tabular-nums">{g.points}</div>
                    {g.transfers_cost > 0 && <div className="text-[11px] text-down">−{g.transfers_cost} hit</div>}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    <div>{g.league_rank}</div>
                    {move !== 0 && (
                      <div className={`text-[11px] font-semibold ${move > 0 ? 'text-up' : 'text-down'}`}>
                        {move > 0 ? '▲' : '▼'}
                        {Math.abs(move)}
                      </div>
                    )}
                  </td>
                  <td className="min-w-0 py-2 pl-3">
                    {g.captain ? (
                      <div className="flex min-w-0 items-center gap-1.5">
                        <PlayerPhoto player={g.captain} size={24} />
                        <span className="truncate">{g.captain.name}</span>
                        <span className="shrink-0 tabular-nums text-muted">{g.captain_points}</span>
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
                  <td className="py-2 pr-3 text-right tabular-nums text-ink-2">{g.bench_points}</td>
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
  const query = useQuery({
    queryKey: ['league', league.league.id, 'transfers'],
    queryFn: () => fetchLeagueTransfers(league.league.id),
    staleTime: 5 * 60_000,
    retry: retryNetworkErrors,
  })
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
    <section className="mt-8" aria-labelledby="manager-transfers-heading">
      <h2 id="manager-transfers-heading" className="text-lg font-semibold">
        Transfers
      </h2>
      {query.isPending && <p className="mt-2 text-sm text-muted">Loading transfers…</p>}
      {query.isError && <p className="mt-2 text-sm text-down">Couldn't load transfers.</p>}
      {query.data && gameweeks.length === 0 && <p className="mt-2 text-sm text-ink-2">No transfers yet.</p>}
      <ul className="mt-3 space-y-3">
        {shown.flatMap((gw) =>
          gw.cards.map((card) => (
            <TransferCard
              key={gw.event}
              card={card}
              title={
                <div className="min-w-0 flex-1 font-medium">
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
          className="mt-3 h-12 w-full rounded-xl border border-line bg-card font-medium"
        >
          Show all {gameweeks.length} gameweeks with transfers
        </button>
      )}
    </section>
  )
}
