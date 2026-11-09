import { useMemo, useState, useSyncExternalStore } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import type { Manager } from '../api'

// Validated categorical palette (dataviz reference), fixed order, light/dark steps.
const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']
const MAX_SELECTED = SERIES_LIGHT.length
const DEFAULT_SELECTED = 3
const COLLAPSED_CHIPS = 12

const darkQuery = '(prefers-color-scheme: dark)'
function useDarkMode(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(darkQuery)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia(darkQuery).matches,
  )
}

type Mode = 'position' | 'points'

/** Evenly spaced rank ticks that always include first and last place. */
function positionTicks(count: number): number[] {
  const step = Math.max(1, Math.ceil((count - 1) / 5))
  const ticks: number[] = []
  for (let t = 1; t < count; t += step) ticks.push(t)
  return [...ticks, count]
}

export default function LeagueChart({ managers, events }: { managers: Manager[]; events: number[] }) {
  const dark = useDarkMode()
  const series = dark ? SERIES_DARK : SERIES_LIGHT
  const theme = dark
    ? { muted: '#3a3a37', grid: '#2e2e2c', axis: '#9a998f' }
    : { muted: '#d6d5d0', grid: '#ecebe7', axis: '#6f6e69' }

  const [mode, setMode] = useState<Mode>('position')
  const [showAll, setShowAll] = useState(false)
  // entry id -> palette slot. A manager keeps its color while selected.
  const [slots, setSlots] = useState<Map<number, number>>(
    () => new Map(managers.slice(0, DEFAULT_SELECTED).map((m, i) => [m.entry_id, i])),
  )

  const data = useMemo(
    () =>
      events.map((event) => {
        const row: Record<string, number> = { event }
        for (const m of managers) {
          const gw = m.history.find((h) => h.event === event)
          if (gw) row[m.entry_id] = mode === 'position' ? gw.league_rank : gw.total
        }
        return row
      }),
    [events, managers, mode],
  )

  const byId = useMemo(() => new Map(managers.map((m) => [m.entry_id, m])), [managers])

  function toggle(entryId: number) {
    setSlots((prev) => {
      const next = new Map(prev)
      if (next.has(entryId)) {
        next.delete(entryId)
      } else if (next.size < MAX_SELECTED) {
        const used = new Set(next.values())
        next.set(entryId, series.findIndex((_, i) => !used.has(i)))
      }
      return next
    })
  }

  if (events.length === 0) {
    return <p className="text-sm text-ink-2">No gameweeks played yet. Check back after GW1.</p>
  }

  const unselected = managers.filter((m) => !slots.has(m.entry_id))
  const selected = managers.filter((m) => slots.has(m.entry_id))
  const chipManagers = showAll ? managers : managers.slice(0, COLLAPSED_CHIPS)
  const full = slots.size >= MAX_SELECTED

  function TooltipContent({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
    if (!active || !payload?.length) return null
    const rows = payload
      .filter((p) => slots.has(Number(p.dataKey)) && p.value != null)
      .map((p) => ({ id: Number(p.dataKey), value: Number(p.value) }))
      .sort((a, b) => (mode === 'position' ? a.value - b.value : b.value - a.value))
    return (
      <div className="max-w-56 rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-lg">
        <div className="mb-1 font-semibold">Gameweek {label}</div>
        {rows.length === 0 && <div className="text-muted">Select managers below</div>}
        {rows.map(({ id, value }) => {
          return (
            <div key={id} className="flex items-center gap-2 py-0.5">
              <span className="size-2 shrink-0 rounded-full" style={{ background: series[slots.get(id)!] }} />
              <span className="min-w-0 flex-1 truncate text-ink-2">{byId.get(id)?.team_name}</span>
              <span className="font-semibold tabular-nums">
                {mode === 'position' ? `#${value}` : value}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div>
      <div role="radiogroup" aria-label="Chart type" className="grid grid-cols-2 rounded-xl bg-line/60 p-1 text-sm">
        {(['position', 'points'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`h-10 rounded-lg font-medium ${mode === m ? 'bg-card shadow-sm' : 'text-ink-2'}`}
          >
            {m === 'position' ? 'League position' : 'Total points'}
          </button>
        ))}
      </div>

      <div className="mt-3 h-72 sm:h-96" aria-label={`${mode === 'position' ? 'League position' : 'Total points'} by gameweek`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={theme.grid} vertical={false} />
            <XAxis
              dataKey="event"
              tick={{ fontSize: 11, fill: theme.axis }}
              tickLine={false}
              axisLine={{ stroke: theme.grid }}
              interval="preserveStartEnd"
              minTickGap={12}
            />
            <YAxis
              reversed={mode === 'position'}
              domain={mode === 'position' ? [1, managers.length] : ['dataMin', 'dataMax']}
              allowDecimals={false}
              ticks={mode === 'position' ? positionTicks(managers.length) : undefined}
              tick={{ fontSize: 11, fill: theme.axis }}
              tickLine={false}
              axisLine={false}
              width={mode === 'position' ? 28 : 40}
            />
            <Tooltip content={TooltipContent} cursor={{ stroke: theme.axis, strokeDasharray: '3 3' }} />
            {[...unselected, ...selected].map((m) => {
              const slot = slots.get(m.entry_id)
              const isSelected = slot !== undefined
              return (
                <Line
                  key={m.entry_id}
                  dataKey={String(m.entry_id)}
                  type="monotone"
                  stroke={isSelected ? series[slot] : theme.muted}
                  strokeWidth={isSelected ? 2.5 : 1}
                  dot={false}
                  activeDot={isSelected ? { r: 4, strokeWidth: 2 } : false}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4">
        <p className="text-xs text-muted">
          {full ? `Up to ${MAX_SELECTED} managers at once. Tap one to remove it.` : 'Tap managers to compare them.'}
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {chipManagers.map((m) => {
            const slot = slots.get(m.entry_id)
            const isSelected = slot !== undefined
            return (
              <li key={m.entry_id} className="max-w-full">
                <button
                  type="button"
                  aria-pressed={isSelected}
                  disabled={!isSelected && full}
                  onClick={() => toggle(m.entry_id)}
                  className={`flex h-11 max-w-full items-center gap-2 rounded-full border px-3 text-sm disabled:opacity-40 ${
                    isSelected ? 'border-ink/30 bg-card font-medium' : 'border-line text-ink-2'
                  }`}
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: isSelected ? series[slot] : theme.muted }}
                  />
                  <span className="truncate">{m.team_name}</span>
                </button>
              </li>
            )
          })}
        </ul>
        {managers.length > COLLAPSED_CHIPS && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-2 h-11 text-sm font-medium text-accent"
          >
            {showAll ? 'Show fewer' : `Show all ${managers.length} managers`}
          </button>
        )}
      </div>
    </div>
  )
}
