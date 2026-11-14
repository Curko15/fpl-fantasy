import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Manager } from '../api'
import { rankForm } from '../dashboard'
import { useMe } from '../pages/leagueContext'
import { lateJoiners } from '../joined'
import { JoinedNote } from './JoinedNote'
import { YouTag } from './YouTag'

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
  const [meId] = useMe()
  const late = useMemo(() => lateJoiners(managers, events), [managers, events])
  const shown = expanded ? managers : managers.slice(0, COLLAPSED)
  // Keep my row visible under the top 10 when the table is collapsed.
  const pinned = expanded ? undefined : managers.slice(COLLAPSED).find((m) => m.entry_id === meId)

  function row(m: Manager) {
    const move = movement(m)
    const isMe = m.entry_id === meId
    const joinedGw = late.get(m.entry_id) ?? null
    return (
      <li key={m.entry_id} className={`relative flex items-center gap-3 px-3.5 py-3 ${isMe ? 'bg-accent/8' : 'active:bg-raised'}`}>
        {isMe && <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-accent" />}
        <span className={`w-6 shrink-0 font-display text-base font-bold tabular-nums ${m.rank === 1 || isMe ? 'text-accent' : ''}`}>
          {m.rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {/* Stretched link: the whole row opens the manager page. */}
            <Link to={`manager/${m.entry_id}`} className="min-w-0 truncate text-sm font-semibold after:absolute after:inset-0">
              {m.team_name}
            </Link>
            {isMe && <YouTag />}
          </div>
          <div className="flex min-w-0 text-xs text-muted">
            <span className="truncate">{m.player_name}</span>
            {/* The notes stay whole; only the manager's name truncates. */}
            {joinedGw !== null && (
              <span className="shrink-0 whitespace-pre">
                {' · '}
                <JoinedNote event={joinedGw} />
              </span>
            )}
            {move && (
              <span className="shrink-0 whitespace-pre">
                {' · '}
                <span className={`font-semibold ${move.tone}`} aria-label={move.aria}>
                  {move.label}
                </span>
              </span>
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
  }

  return (
    <>
      <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {shown.map(row)}
        {pinned && (
          <>
            <li aria-hidden className="py-0.5 text-center text-xs leading-4 text-muted">
              ⋯
            </li>
            {row(pinned)}
          </>
        )}
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
