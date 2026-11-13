import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import type { Manager } from '../api'
import { useChartColors } from '../chartColors'
import { ordinal, scoreSpread, spreadStats, type WeekHighlight } from '../seasonCharts'

const HEIGHT = 240
const PAD = { top: 8, right: 8, bottom: 22, left: 28 }

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

/** Deterministic jitter in [-0.5, 0.5) so dots don't jump around between renders. */
function jitter(entryId: number, event: number): number {
  const h = Math.sin(entryId * 12.9898 + event * 78.233) * 43758.5453
  return h - Math.floor(h) - 0.5
}

/** S4: each gameweek's scores across the league, with one manager's weeks on top. */
export default function ScoreSpread({ managers, events, meId }: { managers: Manager[]; events: number[]; meId: number }) {
  const colors = useChartColors()
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const weeks = useMemo(() => scoreSpread(managers, events, meId), [managers, events, meId])
  const stats = useMemo(() => spreadStats(weeks), [weeks])

  if (weeks.length === 0) return null

  const all = weeks.flatMap((w) => w.scores.map((s) => s.points))
  const lo = Math.floor(Math.min(...all) / 20) * 20
  const hi = Math.max(lo + 20, Math.ceil(Math.max(...all) / 20) * 20)
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const step = weeks.length ? plotW / weeks.length : 0
  const x = (i: number) => PAD.left + (i + 0.5) * step
  const y = (v: number) => PAD.top + ((hi - v) / (hi - lo)) * plotH
  const band = Math.min(18, step * 0.7)
  const dotR = step < 10 ? 1.3 : 1.8
  const ticks = Array.from({ length: (hi - lo) / 20 + 1 }, (_, k) => lo + k * 20)
  const labelEvery = Math.max(1, Math.ceil(weeks.length / 6))
  const mine = weeks.flatMap((w, i) => (w.mine ? [{ i, points: w.mine.points }] : []))

  function onPointer(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const i = Math.floor((e.clientX - rect.left - PAD.left) / step)
    setActive(i >= 0 && i < weeks.length ? i : null)
  }

  const hover = active !== null ? weeks[active] : null
  const tipLeft = active !== null ? Math.min(Math.max(x(active) - 80, 0), Math.max(0, width - 160)) : 0

  return (
    <div>
      <div className="rounded-2xl border border-line bg-card px-2.5 pt-3 pb-3">
        <div ref={ref} className="relative">
          {width > 0 && (
            <svg
              width={width}
              height={HEIGHT}
              role="img"
              aria-label={`Gameweek scores for all ${managers.length} managers, with your scores highlighted`}
              className="block touch-pan-y"
              onPointerMove={onPointer}
              onPointerDown={onPointer}
              onPointerLeave={() => setActive(null)}
            >
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={colors.grid} />
                  <text x={0} y={y(t) + 3.5} fill={colors.axis} fontSize={10}>
                    {t}
                  </text>
                </g>
              ))}
              {active !== null && (
                <rect x={x(active) - step / 2} y={PAD.top} width={step} height={plotH} fill={colors.grid} opacity={0.6} />
              )}
              {weeks.map((w, i) => (
                <g key={w.event}>
                  <rect x={x(i) - band / 2} y={y(w.p75)} width={band} height={Math.max(1, y(w.p25) - y(w.p75))} rx={Math.min(5, band / 3)} fill={colors.track} />
                  <line x1={x(i) - band / 2} x2={x(i) + band / 2} y1={y(w.median)} y2={y(w.median)} stroke={colors.axis} strokeWidth={1.5} />
                  {w.scores.map((s) =>
                    s.entryId === meId ? null : (
                      <circle key={s.entryId} cx={x(i) + jitter(s.entryId, w.event) * band * 0.9} cy={y(s.points)} r={dotR} fill={colors.dot} opacity={0.75} />
                    ),
                  )}
                  {(weeks.length - 1 - i) % labelEvery === 0 && (
                    <text x={x(i)} y={HEIGHT - 6} fill={colors.axis} fontSize={10} textAnchor="middle">
                      GW{w.event}
                    </text>
                  )}
                </g>
              ))}
              <polyline
                points={mine.map((d) => `${x(d.i)},${y(d.points)}`).join(' ')}
                fill="none"
                stroke={colors.accent}
                strokeWidth={2}
                strokeLinejoin="round"
                opacity={0.6}
              />
              {mine.map((d) => (
                <circle key={d.i} cx={x(d.i)} cy={y(d.points)} r={step < 10 ? 3 : 4.5} fill={colors.accent} stroke={colors.card} strokeWidth={2} />
              ))}
            </svg>
          )}
          {width === 0 && <div style={{ height: HEIGHT }} />}
          {hover && (
            <div
              className="pointer-events-none absolute top-0 w-40 rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-lg"
              style={{ left: tipLeft }}
            >
              <div className="mb-1 font-semibold">Gameweek {hover.event}</div>
              {hover.mine && (
                <div className="flex justify-between gap-2">
                  <span className="text-ink-2">You</span>
                  <span className="font-semibold tabular-nums">
                    {hover.mine.points} · {ordinal(hover.mine.rank)}
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-ink-2">Median</span>
                <span className="font-semibold tabular-nums">{Math.round(hover.median)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-ink-2">Middle half</span>
                <span className="font-semibold tabular-nums">
                  {Math.round(hover.p25)}–{Math.round(hover.p75)}
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-1 text-[11px] text-ink-2">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-accent" />
            Your team
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-3.5 rounded-sm bg-track" />
            Middle half
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 bg-muted" />
            Median
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full" style={{ background: colors.dot }} />
            Other managers
          </span>
        </div>
      </div>

      <dl className="mt-2.5 grid grid-cols-3 gap-2">
        <Stat label="Above median" value={`${stats.aboveMedian} / ${stats.played}`} note="gameweeks" tone="text-accent" />
        <Highlight label="Best week" week={stats.best} />
        <Highlight label="Worst week" week={stats.worst} tone="text-down" />
      </dl>
    </div>
  )
}

function Stat({ label, value, note, tone = '' }: { label: string; value: string; note: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-card px-3 py-2.5">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd>
        <div className={`font-display text-xl font-bold tabular-nums ${tone}`}>{value}</div>
        <div className="truncate text-[11px] text-muted">{note}</div>
      </dd>
    </div>
  )
}

function Highlight({ label, week, tone }: { label: string; week: WeekHighlight | null; tone?: string }) {
  if (!week) return <Stat label={label} value="–" note="no games yet" />
  return <Stat label={label} value={String(week.points)} note={`GW${week.event} · ${ordinal(week.rank)} of ${week.of}`} tone={tone} />
}
