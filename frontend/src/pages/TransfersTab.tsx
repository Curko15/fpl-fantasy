import { useMemo, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { formatPrice, type LeagueOverview, type Manager, type Transfer } from '../api'
import { GameweekPills } from '../components/GameweekPills'
import { PlayerPhoto } from '../components/PlayerPhoto'
import { Segmented } from '../components/Segmented'
import { TransfersSkeleton } from '../components/Skeleton'
import { ErrorCard } from '../components/Status'
import { TransferCard } from '../components/TransferCard'
import { useLeagueTransfers } from '../queries'
import { groupTransfers, market, verdict, type PlayerTally } from '../transfers'
import { useLeague } from './leagueContext'

type View = 'feed' | 'market'

const KIND_TAG: Record<Transfer['kind'], { label: string; tone: string }> = {
  free: { label: 'Free', tone: 'text-muted' },
  hit: { label: 'Hit', tone: 'text-down' },
  wildcard: { label: 'Wildcard', tone: 'text-accent' },
  free_hit: { label: 'Free Hit', tone: 'text-accent' },
}

export default function TransfersTab() {
  const { league } = useLeague()
  const [params, setParams] = useSearchParams()
  const query = useLeagueTransfers(league.league.id)
  const managers = useMemo(() => new Map(league.managers.map((m) => [m.entry_id, m])), [league.managers])

  const view: View = params.get('view') === 'market' ? 'market' : 'feed'
  const managerFilter = Number(params.get('manager')) || null

  // Gameweeks that had transfers, newest first.
  const events = useMemo(
    () => [...new Set((query.data?.transfers ?? []).map((t) => t.event))].sort((a, b) => b - a),
    [query.data],
  )
  const requested = Number(params.get('gw'))
  const event = events.includes(requested) ? requested : (events[0] ?? null)
  const week = useMemo(
    () => (query.data?.transfers ?? []).filter((t) => t.event === event),
    [query.data, event],
  )

  function setParam(key: string, value: string | null) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  }

  if (query.isError) {
    return <ErrorCard title="Can't load transfers" error={query.error} onRetry={() => query.refetch()} />
  }
  if (!query.data) return <TransfersSkeleton />
  if (event === null) {
    return <p className="rounded-2xl border border-line bg-card p-4 text-sm text-ink-2">No transfers in this league yet.</p>
  }

  return (
    <div className="space-y-4">
      <Segmented
        label="Transfers view"
        value={view}
        onChange={(v) => setParam('view', v === 'feed' ? null : v)}
        options={[
          { value: 'feed', label: 'Feed' },
          { value: 'market', label: 'Market' },
        ]}
      />
      <GameweekPills events={events} selected={event} onSelect={(e) => setParam('gw', String(e))} />

      {view === 'feed' ? (
        <FeedView
          league={league}
          event={event}
          week={week}
          managers={managers}
          managerFilter={managerFilter}
          onManagerFilter={(id) => setParam('manager', id ? String(id) : null)}
        />
      ) : (
        <MarketView week={week} managers={managers} />
      )}
    </div>
  )
}

function Stat({ label, value, tone = '' }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-3 py-2.5">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={`font-display text-xl font-bold tabular-nums ${tone}`}>{value}</div>
    </div>
  )
}

function FeedView({
  league,
  event,
  week,
  managers,
  managerFilter,
  onManagerFilter,
}: {
  league: LeagueOverview
  event: number
  week: Transfer[]
  managers: Map<number, Manager>
  managerFilter: number | null
  onManagerFilter: (entryId: number | null) => void
}) {
  const m = useMemo(() => market(week), [week])
  const hits = league.managers.reduce((n, mgr) => n + (mgr.history.find((h) => h.event === event)?.transfers_cost ?? 0), 0)
  const shown = managerFilter ? week.filter((t) => t.entry_id === managerFilter) : week
  const cards = groupTransfers(shown, managers)[0]?.cards ?? []
  // Only managers who moved this gameweek are worth filtering by.
  const movers = league.managers.filter((mgr) => week.some((t) => t.entry_id === mgr.entry_id))

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Transfers" value={week.length} />
        <Stat label="Hits" value={hits ? `−${hits}` : '0'} tone={hits ? 'text-down' : ''} />
        <Stat
          label="Paid off"
          value={m.decided ? `${m.paidOff} / ${m.decided}` : '–'}
          tone={m.decided ? 'text-up' : 'text-muted'}
        />
      </div>

      <label className="block">
        <span className="sr-only">Manager</span>
        <select
          value={managerFilter ?? ''}
          onChange={(e) => onManagerFilter(Number(e.target.value) || null)}
          className="h-11 w-full truncate rounded-xl border border-line bg-card px-3 text-base sm:text-sm"
        >
          <option value="">All managers ({movers.length})</option>
          {movers.map((mgr) => (
            <option key={mgr.entry_id} value={mgr.entry_id}>
              {mgr.team_name}
            </option>
          ))}
        </select>
      </label>

      {cards.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card p-4 text-sm text-ink-2">No transfers by this manager in GW{event}.</p>
      ) : (
        <ul className="space-y-2.5">
          {cards.map((card) => (
            <TransferCard key={card.manager.entry_id} card={card} />
          ))}
        </ul>
      )}
      {m.decided === 0 && (
        <p className="text-xs text-muted">Points for each swap appear once this gameweek's scores are collected.</p>
      )}
    </>
  )
}

function MarketView({ week, managers }: { week: Transfer[]; managers: Map<number, Manager> }) {
  const m = useMemo(() => market(week), [week])
  return (
    <>
      {(m.best || m.worst) && (
        <div className="grid grid-cols-2 gap-2.5">
          {m.best ? <MoveCard title="Move of the week" t={m.best} managers={managers} good /> : <div />}
          {m.worst ? <MoveCard title="Howler" t={m.worst} managers={managers} good={false} /> : <div />}
        </div>
      )}

      <Tally title="In demand" rows={m.bought} tone="up" />
      <Tally title="Shown the door" rows={m.sold} tone="down" />

      <section aria-labelledby="moves-heading">
        <div className="mb-2.5 flex items-baseline justify-between">
          <h2 id="moves-heading" className="text-lg font-bold">
            Every move
          </h2>
          <span className="text-xs text-muted">{week.length} this week</span>
        </div>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          {week.map((t) => {
            const tag = KIND_TAG[t.kind]
            const v = verdict(t)
            return (
              <li key={`${t.entry_id}-${t.time}-${t.player_in.id}`} className="flex items-center gap-3 px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <Link to={`../manager/${t.entry_id}`} className="block truncate text-xs text-muted">
                    {managers.get(t.entry_id)?.team_name}
                  </Link>
                  <div className="truncate text-sm">
                    <span className="text-muted">{t.player_out.name}</span> →{' '}
                    <span className="font-semibold">{t.player_in.name}</span>
                  </div>
                </div>
                {v !== null && (
                  <span className={`font-display text-sm font-bold tabular-nums ${v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-muted'}`}>
                    {v > 0 ? `+${v}` : v}
                  </span>
                )}
                <span className={`w-14 shrink-0 text-right text-xs font-semibold ${tag.tone}`}>{tag.label}</span>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}

function MoveCard({ title, t, managers, good }: { title: string; t: Transfer; managers: Map<number, Manager>; good: boolean }) {
  const v = verdict(t)!
  return (
    <article
      className={`relative rounded-3xl border p-3.5 ${good ? 'border-transparent bg-pop text-pop-ink' : 'border-down/25 bg-down/10'}`}
    >
      <div className="text-[11px] font-bold tracking-[0.06em] uppercase">{title}</div>
      <div className="mt-3 flex items-center">
        <PlayerPhoto player={t.player_out} size={34} className="opacity-60 grayscale" />
        <PlayerPhoto player={t.player_in} size={42} className="-ml-2 ring-2 ring-card" />
      </div>
      <div className="mt-2 font-display text-3xl leading-none font-bold tabular-nums">{v > 0 ? `+${v}` : v}</div>
      <div className="mt-1 truncate text-sm font-semibold">
        {t.player_out.name} → {t.player_in.name}
      </div>
      <Link to={`../manager/${t.entry_id}`} className="block truncate text-xs opacity-75 after:absolute after:inset-0">
        {managers.get(t.entry_id)?.team_name}
        {t.kind === 'hit' && ' · hit'}
      </Link>
    </article>
  )
}

const TALLY_LIMIT = 5

function Tally({ title, rows, tone }: { title: string; rows: PlayerTally[]; tone: 'up' | 'down' }) {
  if (rows.length === 0) return null
  const max = rows[0].count
  const id = `tally-${tone}`
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-2.5 text-lg font-bold">
        {title}
      </h2>
      <ol className="space-y-1 rounded-2xl border border-line bg-card py-1.5">
        {rows.slice(0, TALLY_LIMIT).map((r) => (
          <li key={r.player.id} className="flex items-center gap-3 px-3.5 py-1.5">
            <PlayerPhoto player={r.player} size={36} className={tone === 'down' ? 'opacity-70 grayscale' : ''} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-semibold">{r.player.name}</span>
                <span className="shrink-0 text-xs text-muted">
                  {r.player.team} · {formatPrice(r.price)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-raised">
                <div
                  className={`h-full rounded-full ${tone === 'up' ? 'bg-up' : 'bg-down'}`}
                  style={{ width: `${(r.count / max) * 100}%` }}
                />
              </div>
            </div>
            <span className={`w-8 shrink-0 text-right font-display font-bold tabular-nums ${tone === 'up' ? 'text-up' : 'text-down'}`}>
              {tone === 'up' ? '+' : '−'}
              {r.count}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
