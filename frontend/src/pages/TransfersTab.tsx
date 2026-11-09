import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchLeagueTransfers, retryNetworkErrors, type Manager } from '../api'
import { TransferCard } from '../components/TransferCard'
import { groupTransfers } from '../transfers'
import { ErrorCard, Loading } from '../components/Status'
import { useLeague } from './leagueContext'

const GAMEWEEKS_PER_PAGE = 3
const SUMMARY_COLLAPSED = 5


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

  const gameweeks = useMemo(() => {
    if (!query.data) return []
    return groupTransfers(
      query.data.transfers.filter(
        (t) => (!managerFilter || t.entry_id === managerFilter) && (!gwFilter || t.event === gwFilter),
      ),
      managers,
    )
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
