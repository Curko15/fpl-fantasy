import { useEffect, useId, useMemo, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import type { Manager } from '../api'
import { lateJoiners } from '../joined'
import { RACE_TOP, raceFrame, racePool } from '../seasonCharts'
import { JoinedNote } from './JoinedNote'

const ROW = 36 // px per bar row
const STEP_MS = 900

/** S5: bar chart race of the top 12 (plus my team) through the season. */
export default function TitleRace({ managers, events, meId }: { managers: Manager[]; events: number[]; meId: number | null }) {
  const sliderId = useId()
  const last = events[events.length - 1]
  const [event, setEvent] = useState(last)
  const [playing, setPlaying] = useState(false)

  const byId = useMemo(() => new Map(managers.map((m) => [m.entry_id, m])), [managers])
  const pool = useMemo(() => racePool(managers, meId), [managers, meId])
  const late = useMemo(() => lateJoiners(managers, events), [managers, events])
  const shown = events.includes(event) ? event : last
  const bars = useMemo(() => raceFrame(managers, pool, shown, meId), [managers, pool, shown, meId])

  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => {
      setEvent((e) => {
        const next = events[events.indexOf(e) + 1]
        if (next === undefined) {
          setPlaying(false)
          return e
        }
        return next
      })
    }, STEP_MS)
    return () => clearInterval(timer)
  }, [playing, events])

  if (events.length === 0) return <p className="text-sm text-ink-2">No gameweeks played yet. Check back after GW1.</p>

  function togglePlay() {
    if (playing) return setPlaying(false)
    if (shown === last) setEvent(events[0]) // replay from the start
    setPlaying(true)
  }

  const meOutside = bars.some((b) => b.entryId === meId && b.visible && b.rank > RACE_TOP)
  const rowsShown = Math.min(RACE_TOP, bars.filter((b) => b.visible && b.rank <= RACE_TOP).length)
  const height = (meOutside ? rowsShown + 1.4 : rowsShown) * ROW

  return (
    <section aria-label={`Standings after gameweek ${shown}`} className="rounded-2xl border border-line bg-card p-3.5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold tracking-[0.08em] text-muted uppercase">After gameweek</div>
          <div className="font-display text-5xl leading-none font-bold tabular-nums">{shown}</div>
        </div>
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play the season'}
          className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-accent-ink"
        >
          {playing ? <Pause size={20} fill="currentColor" aria-hidden /> : <Play size={20} fill="currentColor" aria-hidden />}
        </button>
      </div>

      <ol className="relative mt-4" style={{ height }}>
        {bars.map((b) => {
          const m = byId.get(b.entryId)!
          const isMe = b.entryId === meId
          const isLeader = b.rank === 1
          const tone = isMe ? 'bg-accent text-accent-ink' : isLeader ? 'bg-ink text-surface' : 'bg-track text-ink'
          return (
            <li
              key={b.entryId}
              aria-hidden={!b.visible}
              className="absolute inset-x-0 top-0 flex items-center gap-2 transition-[transform,opacity] duration-600 ease-out motion-reduce:transition-none"
              style={{ height: ROW, transform: `translateY(${b.slot * ROW}px)`, opacity: b.visible ? 1 : 0 }}
            >
              <span className="w-6 shrink-0 text-right font-display text-sm font-bold text-muted tabular-nums">
                {Number.isFinite(b.rank) ? b.rank : ''}
              </span>
              <div className="flex h-7 min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                <div
                  className={`flex h-full shrink-0 items-center overflow-hidden rounded-lg px-2 transition-[width] duration-600 ease-out motion-reduce:transition-none ${tone}`}
                  style={{ width: `${b.width}%` }}
                >
                  <span className={`truncate text-xs ${isMe ? 'font-bold' : 'font-semibold'}`}>{m.team_name}</span>
                </div>
                {/* Late joiners' totals cover fewer weeks: say so in the space past the bar. */}
                {late.has(b.entryId) && (
                  <JoinedNote event={late.get(b.entryId)!} className="min-w-0 truncate text-[11px]" />
                )}
              </div>
              <span className="w-10 shrink-0 text-right font-display text-sm font-bold tabular-nums">{b.total}</span>
            </li>
          )
        })}
      </ol>

      <label htmlFor={sliderId} className="sr-only">
        Gameweek
      </label>
      <input
        id={sliderId}
        type="range"
        min={0}
        max={events.length - 1}
        value={events.indexOf(shown)}
        onChange={(e) => {
          setPlaying(false)
          setEvent(events[Number(e.target.value)])
        }}
        aria-valuetext={`Gameweek ${shown}`}
        className="mt-3 h-8 w-full accent-accent"
      />
      <div className="flex justify-between text-[11px] text-muted">
        <span>GW{events[0]}</span>
        <span>GW{last}</span>
      </div>
    </section>
  )
}
