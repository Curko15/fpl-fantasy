import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  fetchLeagueTransfers,
  formatPrice,
  retryNetworkErrors,
  type Manager,
  type Transfer,
  type TransferKind,
} from '../api'
import { ErrorCard, Loading } from '../components/Status'
import { useLeague } from './leagueContext'

const GAMEWEEKS_PER_PAGE = 3
const SUMMARY_COLLAPSED = 5

const CHIP_LABEL: Partial<Record<TransferKind, string>> = { wildcard: 'Wildcard', free_hit: 'Free Hit' }

interface ManagerGameweek {
  manager: Manager
  transfers: Transfer[]
  chip: TransferKind | null
  hitCost: number
}

export default function TransfersTab() {
  const { league } = useLeague()
  const [params, setParams] = useSearchParams()
  const [pages, setPages] = useState(1)

  const query = useQuery({
    queryKey: ['league', league.league.id, 'transfers'],
    queryFn: () => fetchLeagueTransfers(league.league.id),
    staleTime: 5 * 60_000,
    retry: retryNetworkErrors,
  })

  const managers = useMemo(() => new Map(league.managers.map((m) => [m.entry_id, m])), [league.managers])
  const managerFilter = Number(params.get('manager')) || null
  const gwFilter = Number(params.get('gw')) || null

  function setFilter(key: 'manager' | 'gw', value: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
    setPages(1)
  }

  // Newest gameweek first; inside a gameweek, one card per manager.
  const gameweeks = useMemo(() => {
    if (!query.data) return []
    const filtered = query.data.transfers.filter(
      (t) => (!managerFilter || t.entry_id === managerFilter) && (!gwFilter || t.event === gwFilter),
    )
    const byEvent = new Map<number, Map<number, Transfer[]>>()
    for (const t of filtered) {
      const event = byEvent.get(t.event) ?? new Map<number, Transfer[]>()
      event.set(t.entry_id, [...(event.get(t.entry_id) ?? []), t])
      byEvent.set(t.event, event)
    }
    return [...byEvent.entries()]
      .sort(([a], [b]) => b - a)
      .map(([event, byManager]) => ({
        event,
        count: [...byManager.values()].reduce((n, ts) => n + ts.length, 0),
        cards: [...byManager.entries()]
          .map(([entryId, transfers]): ManagerGameweek | null => {
            const manager = managers.get(entryId)
            if (!manager) return null
            const gw = manager.history.find((h) => h.event === event)
            const chip = transfers.find((t) => CHIP_LABEL[t.kind])?.kind ?? null
            return { manager, transfers, chip, hitCost: gw?.transfers_cost ?? 0 }
          })
          .filter((c): c is ManagerGameweek => c !== null)
          .sort((a, b) => a.manager.rank - b.manager.rank),
      }))
  }, [query.data, managerFilter, gwFilter, managers])

  if (query.isError) {
    return <ErrorCard title="Can't load transfers" error={query.error} onRetry={() => query.refetch()} />
  }
  if (!query.data) {
    return <Loading title="Loading transfers…" hint="Fetching every manager's transfer history." />
  }

  const visible = gameweeks.slice(0, pages * GAMEWEEKS_PER_PAGE)

  return (
    <>
      <HitsSummary data={query.data.managers} managers={managers} onPick={(id) => setFilter('manager', String(id))} />

      <section className="mt-8" aria-labelledby="feed-heading">
        <h2 id="feed-heading" className="text-lg font-semibold">
          All transfers
        </h2>

        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
          <FilterSelect
            label="Manager"
            value={managerFilter ? String(managerFilter) : ''}
            onChange={(v) => setFilter('manager', v)}
            options={[
              { value: '', label: 'All managers' },
              ...league.managers.map((m) => ({ value: String(m.entry_id), label: m.team_name })),
            ]}
          />
          <FilterSelect
            label="Gameweek"
            value={gwFilter ? String(gwFilter) : ''}
            onChange={(v) => setFilter('gw', v)}
            options={[
              { value: '', label: 'All GWs' },
              ...[...league.events].reverse().map((e) => ({ value: String(e), label: `GW${e}` })),
            ]}
          />
        </div>

        {visible.length === 0 && (
          <p className="mt-6 rounded-xl border border-line bg-card p-4 text-sm text-ink-2">
            No transfers match these filters.
          </p>
        )}

        {visible.map((gw) => (
          <section key={gw.event} className="mt-6" aria-label={`Gameweek ${gw.event}`}>
            <h3 className="sticky top-12 z-[5] -mx-4 bg-surface/95 px-4 py-2 text-sm font-semibold backdrop-blur">
              Gameweek {gw.event}
              <span className="font-normal text-muted">
                {' '}
                · {gw.count} transfer{gw.count === 1 ? '' : 's'}
              </span>
            </h3>
            <ul className="mt-1 space-y-3">
              {gw.cards.map((card) => (
                <TransferCard key={card.manager.entry_id} card={card} />
              ))}
            </ul>
          </section>
        ))}

        {gameweeks.length > visible.length && (
          <button
            type="button"
            onClick={() => setPages((p) => p + 1)}
            className="mt-6 h-12 w-full rounded-xl border border-line bg-card font-medium"
          >
            Show older gameweeks
          </button>
        )}
      </section>
    </>
  )
}

function HitsSummary({
  data,
  managers,
  onPick,
}: {
  data: { entry_id: number; transfers: number; hits: number; hit_cost: number }[]
  managers: Map<number, Manager>
  onPick: (entryId: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const rows = [...data].sort((a, b) => b.hit_cost - a.hit_cost || b.transfers - a.transfers)
  const shown = expanded ? rows : rows.slice(0, SUMMARY_COLLAPSED)

  return (
    <section aria-labelledby="hits-heading">
      <h2 id="hits-heading" className="text-lg font-semibold">
        Points spent on hits
      </h2>
      <p className="mt-0.5 text-xs text-muted">Tap a manager to see their transfers.</p>
      <div className="mt-2 overflow-hidden rounded-xl border border-line bg-card">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th scope="col" className="py-2 pl-3 font-medium">
                Manager
              </th>
              <th scope="col" className="w-20 py-2 text-right font-medium">
                Transfers
              </th>
              <th scope="col" className="w-16 py-2 pr-3 text-right font-medium">
                Hits
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((row) => {
              const m = managers.get(row.entry_id)
              return (
                <tr key={row.entry_id} onClick={() => onPick(row.entry_id)} className="cursor-pointer active:bg-surface">
                  <td className="min-w-0 py-0 pl-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onPick(row.entry_id)
                      }}
                      className="block min-h-11 w-full truncate text-left font-medium"
                    >
                      {m?.team_name ?? row.entry_id}
                    </button>
                  </td>
                  <td className="text-right tabular-nums text-ink-2">{row.transfers}</td>
                  <td
                    className={`pr-3 text-right font-semibold tabular-nums ${row.hit_cost ? 'text-down' : 'text-muted'}`}
                  >
                    {row.hit_cost ? `−${row.hit_cost}` : '0'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {rows.length > SUMMARY_COLLAPSED && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 h-11 text-sm font-medium text-accent"
        >
          {expanded ? 'Show fewer' : `Show all ${rows.length} managers`}
        </button>
      )}
    </section>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="block min-w-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full truncate rounded-xl border border-line bg-card px-3 text-base sm:text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function Badge({ children, tone }: { children: ReactNode; tone: 'hit' | 'chip' }) {
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] font-semibold ${
        tone === 'hit' ? 'bg-down/15 text-down' : 'bg-accent/15 text-accent'
      }`}
    >
      {children}
    </span>
  )
}

function TransferCard({ card }: { card: ManagerGameweek }) {
  const { manager, transfers, chip, hitCost } = card
  return (
    <li className="rounded-xl border border-line bg-card px-3 py-2.5">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{manager.team_name}</div>
          <div className="truncate text-xs text-muted">{manager.player_name}</div>
        </div>
        {chip && <Badge tone="chip">{CHIP_LABEL[chip]}</Badge>}
        {!chip && hitCost > 0 && <Badge tone="hit">−{hitCost} pts</Badge>}
      </div>
      <ul className="mt-2 divide-y divide-line">
        {transfers.map((t) => (
          <li
            key={`${t.time}-${t.player_in.id}`}
            className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 py-2"
          >
            <PlayerCell direction="out" name={t.player_out.name} meta={`${t.player_out.team} · ${formatPrice(t.out_cost)}`} />
            <span aria-hidden className="text-muted">
              →
            </span>
            <PlayerCell
              direction="in"
              name={t.player_in.name}
              meta={`${t.player_in.team} · ${formatPrice(t.in_cost)}`}
              hit={t.kind === 'hit'}
            />
          </li>
        ))}
      </ul>
    </li>
  )
}

function PlayerCell({
  direction,
  name,
  meta,
  hit = false,
}: {
  direction: 'in' | 'out'
  name: string
  meta: string
  hit?: boolean
}) {
  const out = direction === 'out'
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1">
        <span className={`text-[10px] ${out ? 'text-down' : 'text-up'}`} aria-label={out ? 'Out' : 'In'}>
          {out ? '▼' : '▲'}
        </span>
        <span className="truncate text-sm font-medium">{name}</span>
        {hit && (
          <span className="shrink-0 text-[10px] font-semibold text-down" title="Paid for with a points hit">
            HIT
          </span>
        )}
      </div>
      <div className="truncate pl-3.5 text-xs text-muted">{meta}</div>
    </div>
  )
}
