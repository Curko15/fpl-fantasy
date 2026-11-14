import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Manager } from '../api'
import { rankForm } from '../dashboard'

const COLLAPSED = 10

function movement(m: Manager): { label: string; aria: string; tone: string } | null {
  if (m.last_rank === 0) return { label: 'new', aria: 'New', tone: 'text-muted' }
  const diff = m.last_rank - m.rank
  if (diff === 0) return null
  return diff > 0
    ? { label: `▲ ${diff}`, aria: `Up ${diff}`, tone: 'text-up' }
    : { label: `▼ ${-diff}`, aria: `Down ${-diff}`, tone: 'text-down' }
}

/** Tiny line of league rank over recent gameweeks; higher on the chart = better rank. */
function RankSpark({ ranks, size }: { ranks: number[]; size: number }) {
  if (ranks.length < 2) return <span className="w-14 shrink-0" />
  const w = 56
  const h = 24
  const x = (i: number) => 3 + (i * (w - 6)) / (ranks.length - 1)
  const y = (r: number) => 3 + ((r - 1) * (h - 6)) / Math.max(size - 1, 1)
  const trend = ranks[0] - ranks[ranks.length - 1]
  const tone = trend > 0 ? 'text-up' : trend < 0 ? 'text-down' : 'text-muted'
  const last = ranks.length - 1
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className={`shrink-0 ${tone}`}>
      <polyline
        points={ranks.map((r, i) => `${x(i)},${y(r)}`).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={x(last)} cy={y(ranks[last])} r={2.5} fill="currentColor" />
    </svg>
  )
}

export default function StandingsTable({ managers, events }: { managers: Manager[]; events: number[] }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? managers : managers.slice(0, COLLAPSED)
  return (
    <>
      <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {shown.map((m) => {
          const move = movement(m)
          return (
            <li key={m.entry_id} className="relative flex items-center gap-3 px-3.5 py-3 active:bg-raised">
              <span
                className={`w-6 shrink-0 font-display text-base font-bold tabular-nums ${m.rank === 1 ? 'text-accent' : ''}`}
              >
                {m.rank}
              </span>
              <div className="min-w-0 flex-1">
                {/* Stretched link: the whole row opens the manager page. */}
                <Link to={`manager/${m.entry_id}`} className="block truncate text-sm font-semibold after:absolute after:inset-0">
                  {m.team_name}
                </Link>
                <div className="truncate text-xs text-muted">
                  {m.player_name}
                  {move && (
                    <>
                      {' · '}
                      <span className={`font-semibold ${move.tone}`} aria-label={move.aria}>
                        {move.label}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <RankSpark ranks={rankForm(m, events)} size={managers.length} />
              <div className="w-12 shrink-0 text-right">
                <div className="font-display text-base font-bold tabular-nums">{m.total}</div>
                <div className="text-[11px] text-muted tabular-nums">{m.event_total} GW</div>
              </div>
            </li>
          )
        })}
      </ol>
      {managers.length > COLLAPSED && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 flex h-11 w-full items-center justify-center text-sm font-semibold text-accent"
        >
          {expanded ? 'Show fewer' : `Show all ${managers.length}`}
        </button>
      )}
    </>
  )
}
