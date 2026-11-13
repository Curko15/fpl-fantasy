import { lazy, useId, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { TooltipContentProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import type { Manager } from '../api'
import { useChartColors } from '../chartColors'
import { ChartSlot } from './ChartSlot'
import { lateJoiners, lateJoinersNote } from '../joined'
import { JoinedNote } from './JoinedNote'
import { Segmented } from './Segmented'
import { YouTag } from './YouTag'
import { focusTeams, seasonRows, type FocusMode } from '../seasonCharts'

// Recharts only loads when the chart is about to be seen (see ChartSlot).
const loadLines = () => import('./FocusLines')
const FocusLines = lazy(loadLines)

const MAX_MATCHES = 5

/**
 * S1: the season for "my team", the leader and the managers around me. Everyone
 * else is a faint line. `meId` null means no team is saved yet: focus the leader.
 */
export default function FocusChart({
  managers,
  events,
  meId,
}: {
  managers: Manager[]
  events: number[]
  meId: number | null
}) {
  const colors = useChartColors()
  const searchId = useId()
  const [mode, setMode] = useState<FocusMode>('behind')
  const [extra, setExtra] = useState<number[]>([]) // managers added from search, in order
  const [query, setQuery] = useState('')

  const table = useMemo(() => [...managers].sort((a, b) => a.rank - b.rank), [managers])
  const byId = useMemo(() => new Map(managers.map((m) => [m.entry_id, m])), [managers])
  const me = meId ?? table[0]?.entry_id
  const leader = table[0]?.entry_id
  const auto = useMemo(() => (me === undefined ? [] : focusTeams(managers, me)), [managers, me])
  const rows = useMemo(() => seasonRows(managers, events, mode), [managers, events, mode])
  const late = useMemo(() => lateJoiners(managers, events), [managers, events])
  const lateNote = useMemo(() => lateJoinersNote(managers, events), [managers, events])

  // Color follows the manager: me = accent, leader = ink, rivals in fixed order, then extras.
  const color = new Map<number, string>()
  const rivals = [...auto.filter((id) => id !== leader), ...extra]
  rivals.forEach((id, i) => color.set(id, colors.rivals[i]))
  if (leader !== undefined) color.set(leader, colors.ink)
  if (me !== undefined) color.set(me, colors.accent)
  const highlighted = table.filter((m) => color.has(m.entry_id))
  const full = rivals.length >= colors.rivals.length

  if (events.length === 0 || me === undefined) {
    return <p className="text-sm text-ink-2">No gameweeks played yet. Check back after GW1.</p>
  }

  const latest = rows[rows.length - 1]
  // Scale "behind" to the highlighted lines; faint far-behind lines run off the bottom.
  // Late joiners (other than me) don't stretch it either: their gap is mostly missed weeks.
  const scaled = highlighted.filter((m) => m.entry_id === me || !late.has(m.entry_id))
  const behindMax = Math.max(10, ...rows.flatMap((r) => scaled.map((m) => r[m.entry_id] ?? 0)))
  const behindTop = Math.ceil((behindMax * 1.1) / 10) * 10
  const q = query.trim().toLowerCase()
  const matches = q
    ? table
        .filter((m) => !color.has(m.entry_id))
        .filter((m) => m.team_name.toLowerCase().includes(q) || m.player_name.toLowerCase().includes(q))
        .slice(0, MAX_MATCHES)
    : []

  function add(id: number) {
    setExtra((prev) => [...prev, id])
    setQuery('')
  }

  function value(id: number): string {
    const v = latest[id]
    if (v === undefined) return '–'
    if (mode === 'position') return `${byId.get(id)?.total ?? 0} pts`
    return v === 0 ? 'Leader' : `−${v}`
  }

  function TooltipContent({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
    if (!active || !payload?.length) return null
    const items = payload
      .filter((p) => color.has(Number(p.dataKey)) && p.value != null)
      .map((p) => ({ id: Number(p.dataKey), value: Number(p.value) }))
      .sort((a, b) => a.value - b.value)
    return (
      <div className="max-w-60 rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-lg">
        <div className="mb-1 font-semibold">Gameweek {label}</div>
        {items.map(({ id, value: v }) => (
          <div key={id} className="flex items-center gap-2 py-0.5">
            <span className="h-1 w-3 shrink-0 rounded-full" style={{ background: color.get(id) }} />
            <span className={`min-w-0 flex-1 truncate ${id === me ? 'font-semibold' : 'text-ink-2'}`}>
              {byId.get(id)?.team_name}
            </span>
            {late.has(id) && <JoinedNote event={late.get(id)!} className="shrink-0 text-[11px]" />}
            <span className="font-semibold tabular-nums">
              {mode === 'position' ? `#${v}` : v === 0 ? 'Leader' : `−${v}`}
            </span>
          </div>
        ))}
      </div>
    )
  }

  const chartLabel = mode === 'position' ? 'League position by gameweek' : 'Points behind the leader by gameweek'
  const faint = table.filter((m) => !color.has(m.entry_id))
  // Draw me last so my line sits on top.
  const strong = [...highlighted.filter((m) => m.entry_id !== me), byId.get(me)!]

  return (
    <div>
      <Segmented
        label="Chart scale"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'behind', label: 'Behind leader' },
          { value: 'position', label: 'League position' },
        ]}
      />

      <div className="mt-3 rounded-2xl border border-line bg-card px-1 pt-3 pb-1">
        <ChartSlot className="h-64 sm:h-80" label={chartLabel} preload={loadLines}>
          <FocusLines
            rows={rows}
            mode={mode}
            managerCount={managers.length}
            behindTop={behindTop}
            faint={faint.map((m) => m.entry_id)}
            strong={strong.map((m) => m.entry_id)}
            color={color}
            me={me}
            tooltip={TooltipContent}
          />
        </ChartSlot>
      </div>
      {lateNote && <p className="mt-2 px-1 text-xs text-muted">{lateNote}</p>}

      <div className="mt-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">{meId === null ? 'Leader and chasers' : 'Your team and rivals'}</h3>
      </div>
      <ol className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {highlighted.map((m) => {
          const isMe = m.entry_id === me && meId !== null
          const removable = extra.includes(m.entry_id)
          return (
            <li key={m.entry_id} className="flex h-12 items-center gap-2.5 pl-3.5 pr-1">
              <span className="h-1 w-3 shrink-0 rounded-full" style={{ background: color.get(m.entry_id) }} />
              <span className="w-8 shrink-0 text-xs text-muted tabular-nums">#{m.rank}</span>
              <span className={`min-w-0 flex-1 truncate text-sm ${isMe ? 'font-bold' : 'font-medium'}`}>{m.team_name}</span>
              {isMe && <YouTag />}
              {late.has(m.entry_id) && <JoinedNote event={late.get(m.entry_id)!} className="shrink-0 text-[11px]" />}
              <span className={`shrink-0 font-display text-sm font-bold tabular-nums ${removable ? '' : 'pr-2.5'}`}>
                {value(m.entry_id)}
              </span>
              {removable && (
                <button
                  type="button"
                  aria-label={`Remove ${m.team_name}`}
                  onClick={() => setExtra((prev) => prev.filter((id) => id !== m.entry_id))}
                  className="grid size-11 shrink-0 place-items-center text-muted"
                >
                  <X size={16} aria-hidden />
                </button>
              )}
            </li>
          )
        })}
      </ol>

      {faint.length > 0 && (
        <div className="relative mt-2.5">
          <label htmlFor={searchId} className="sr-only">
            Compare with another manager
          </label>
          <div className="flex h-11 items-center gap-2 rounded-xl border border-line bg-card px-3.5 text-muted">
            <Search size={16} aria-hidden />
            <input
              id={searchId}
              type="search"
              value={query}
              disabled={full}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={full ? 'Remove a team to compare another' : 'Compare with another manager…'}
              autoComplete="off"
              className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted disabled:opacity-60"
            />
          </div>
          {q && (
            <ul className="mt-1.5 divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
              {matches.length === 0 && <li className="px-3.5 py-3 text-sm text-muted">No manager matches “{query.trim()}”</li>}
              {matches.map((m) => (
                <li key={m.entry_id}>
                  <button type="button" onClick={() => add(m.entry_id)} className="flex h-12 w-full items-center gap-2.5 px-3.5 text-left">
                    <span className="w-8 shrink-0 text-xs text-muted tabular-nums">#{m.rank}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{m.team_name}</span>
                      <span className="block truncate text-xs text-muted">{m.player_name}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
