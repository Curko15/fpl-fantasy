import { lazy, useMemo, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeftRight, ChevronDown } from 'lucide-react'
import type { TooltipContentProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { fetchManager, retryNetworkErrors, type GameweekDetail, type Manager, type ManagerDetail } from '../api'
import { useChartColors } from '../chartColors'
import { chipLabel } from '../chips'
import { ChartSlot } from '../components/ChartSlot'
import { PlayerPhoto } from '../components/PlayerPhoto'
import { SectionHeading } from '../components/SectionHeading'
import { Bone } from '../components/Skeleton'
import { ErrorCard } from '../components/Status'
import { YouTag } from '../components/YouTag'
import { JoinedNote } from '../components/JoinedNote'
import { joinedEvent } from '../joined'
import {
  defaultPair,
  gapSummary,
  headToHeadRecord,
  headToHeadWeeks,
  sideStats,
  type H2HRecord,
  type H2HWeek,
  type Side,
} from '../headToHead'
import { useLeagueTransfers } from '../queries'
import { ordinal } from '../seasonCharts'
import { useLeague, useMe } from './leagueContext'

// Recharts only loads when the chart is about to be seen (see ChartSlot).
const loadGapArea = () => import('../components/GapArea')
const GapArea = lazy(loadGapArea)

interface Pair {
  a: Manager
  b: Manager
  /** Series colours: A = accent, B = first validated rival colour. */
  colorA: string
  colorB: string
}

function useManagerDetail(leagueId: number, entryId: number) {
  return useQuery({
    queryKey: ['league', leagueId, 'manager', entryId],
    queryFn: () => fetchManager(leagueId, entryId),
    enabled: entryId > 0,
    staleTime: 5 * 60_000,
    retry: retryNetworkErrors,
  })
}

function idParam(value: string | null): number | null {
  const n = Number(value)
  return value && Number.isSafeInteger(n) ? n : null
}

/** Head-to-head: two managers side by side, chosen in the URL (?a=&b=). */
export default function ComparePage() {
  const { league } = useLeague()
  const [meId] = useMe()
  const [params, setParams] = useSearchParams()
  const colors = useChartColors()
  const leagueId = league.league.id

  const ids = defaultPair(league.managers, meId, { a: idParam(params.get('a')), b: idParam(params.get('b')) })
  const byId = useMemo(() => new Map(league.managers.map((m) => [m.entry_id, m])), [league.managers])
  const a = ids ? byId.get(ids.a) : undefined
  const b = ids ? byId.get(ids.b) : undefined

  const weeks = useMemo(() => (a && b ? headToHeadWeeks(a, b, league.events) : []), [a, b, league.events])
  const detailA = useManagerDetail(leagueId, ids?.a ?? 0)
  const detailB = useManagerDetail(leagueId, ids?.b ?? 0)

  if (!a || !b) {
    return (
      <p className="rounded-2xl border border-line bg-card p-4 text-ink-2">
        Head-to-head needs at least two managers in the league.
      </p>
    )
  }

  const pair: Pair = { a, b, colorA: colors.accent, colorB: colors.rivals[0] }
  const choose = (next: { a: number; b: number }) =>
    setParams({ a: String(next.a), b: String(next.b) }, { replace: true })
  const live = league.current_event !== null && !league.current_event_finished
  const detailError = detailA.error ?? detailB.error

  return (
    <div className="space-y-7">
      <Pickers
        managers={league.managers}
        pair={pair}
        onChange={choose}
        onSwap={() => choose({ a: b.entry_id, b: a.entry_id })}
      />
      <Hero pair={pair} meId={meId} managerCount={league.managers.length} events={league.events} />
      {live && (
        <p className="-mt-4 rounded-xl bg-accent/10 px-3 py-2 text-xs text-ink-2">
          GW{league.current_event} is still being played, so its points can still change.
        </p>
      )}
      {league.events.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card p-4 text-sm text-ink-2">
          No gameweeks played yet. Check back after GW1.
        </p>
      ) : (
        <>
          <Record pair={pair} record={headToHeadRecord(weeks)} events={league.events} />
          <GapChart pair={pair} weeks={weeks} />
          {detailError && (
            <ErrorCard
              title="Can't load captains and bench points"
              error={detailError}
              onRetry={() => {
                if (detailA.isError) detailA.refetch()
                if (detailB.isError) detailB.refetch()
              }}
            />
          )}
          <StatsTable pair={pair} detailA={detailA.data} detailB={detailB.data} />
          <WeekList pair={pair} weeks={weeks} detailA={detailA.data} detailB={detailB.data} />
        </>
      )}
    </div>
  )
}

/* ---------- Pickers ---------- */

function Pickers({
  managers,
  pair,
  onChange,
  onSwap,
}: {
  managers: Manager[]
  pair: Pair
  onChange: (next: { a: number; b: number }) => void
  onSwap: () => void
}) {
  const sorted = useMemo(() => [...managers].sort((x, y) => x.rank - y.rank), [managers])
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
      <Picker
        label="Team A"
        managers={sorted}
        value={pair.a.entry_id}
        other={pair.b.entry_id}
        color={pair.colorA}
        onChange={(id) => onChange({ a: id, b: pair.b.entry_id })}
      />
      <button
        type="button"
        onClick={onSwap}
        aria-label="Swap teams"
        className="grid size-11 place-items-center rounded-full border border-line bg-card text-ink-2 active:bg-raised"
      >
        <ArrowLeftRight size={18} aria-hidden />
      </button>
      <Picker
        label="Team B"
        managers={sorted}
        value={pair.b.entry_id}
        other={pair.a.entry_id}
        color={pair.colorB}
        onChange={(id) => onChange({ a: pair.a.entry_id, b: id })}
      />
    </div>
  )
}

/** Same trick as TeamBar: an invisible native select covers the whole card. */
function Picker({
  label,
  managers,
  value,
  other,
  color,
  onChange,
}: {
  label: string
  managers: Manager[]
  value: number
  other: number
  color: string
  onChange: (entryId: number) => void
}) {
  const current = managers.find((m) => m.entry_id === value)
  return (
    <div className="relative flex h-14 min-w-0 items-center gap-2 rounded-2xl border border-line bg-card pr-2 pl-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
      <span aria-hidden className="h-7 w-1 shrink-0 rounded-full" style={{ background: color }} />
      <div aria-hidden className="min-w-0 flex-1 leading-tight">
        <div className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">{label}</div>
        <div className="truncate text-sm font-bold">{current?.team_name}</div>
      </div>
      <ChevronDown size={16} aria-hidden className="shrink-0 text-muted" />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {managers.map((m) => (
          // The other side's team can't be picked: no comparing a team with itself.
          <option key={m.entry_id} value={m.entry_id} disabled={m.entry_id === other}>
            {m.rank}. {m.team_name} ({m.player_name})
          </option>
        ))}
      </select>
    </div>
  )
}

/* ---------- Hero ---------- */

function Hero({
  pair,
  meId,
  managerCount,
  events,
}: {
  pair: Pair
  meId: number | null
  managerCount: number
  events: number[]
}) {
  const gap = pair.a.total - pair.b.total
  return (
    <section aria-label="Head-to-head summary" className="rounded-3xl border border-line bg-card p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3">
        <HeroSide
          manager={pair.a}
          color={pair.colorA}
          isMe={pair.a.entry_id === meId}
          managerCount={managerCount}
          joined={joinedEvent(pair.a, events)}
        />
        <div className="self-center pt-1 font-display text-sm font-bold text-muted">vs</div>
        <HeroSide
          manager={pair.b}
          color={pair.colorB}
          isMe={pair.b.entry_id === meId}
          managerCount={managerCount}
          joined={joinedEvent(pair.b, events)}
          align="right"
        />
      </div>
      <p className="mt-5 rounded-xl bg-raised px-3 py-2.5 text-center font-display text-base font-bold">
        {gapSummary(gap, pair.a.team_name, pair.b.team_name)}
      </p>
    </section>
  )
}

function HeroSide({
  manager,
  color,
  isMe,
  managerCount,
  joined,
  align = 'left',
}: {
  manager: Manager
  color: string
  isMe: boolean
  managerCount: number
  joined: number | null
  align?: 'left' | 'right'
}) {
  const right = align === 'right'
  return (
    <div className={`min-w-0 ${right ? 'text-right' : ''}`}>
      <div className={`flex items-center gap-1.5 ${right ? 'justify-end' : ''}`}>
        <span aria-hidden className="h-1 w-4 shrink-0 rounded-full" style={{ background: color }} />
        <span className="text-[11px] text-muted">
          {ordinal(manager.rank)} of {managerCount}
        </span>
      </div>
      <div className="mt-2 font-display text-4xl leading-none font-bold tracking-tight tabular-nums">{manager.total}</div>
      <div className="text-[11px] text-muted">points</div>
      <div className={`mt-3 flex items-center gap-1.5 ${right ? 'justify-end' : ''}`}>
        <span className="min-w-0 truncate text-sm font-bold">{manager.team_name}</span>
        {isMe && <YouTag />}
      </div>
      <div className="truncate text-xs text-muted">{manager.player_name}</div>
      {joined !== null && <JoinedNote event={joined} className="block text-[11px]" />}
    </div>
  )
}

/* ---------- Record ---------- */

function Record({ pair, record, events }: { pair: Pair; record: H2HRecord; events: number[] }) {
  const late = [pair.a, pair.b].flatMap((m) => {
    const event = joinedEvent(m, events)
    return event === null ? [] : [{ m, event }]
  })
  const { played } = record
  const segments = [
    { key: 'a', value: record.a, color: pair.colorA },
    { key: 'draw', value: record.draws, color: 'var(--color-track)' },
    { key: 'b', value: record.b, color: pair.colorB },
  ].filter((s) => s.value > 0)

  return (
    <section aria-labelledby="record-heading">
      <SectionHeading id="record-heading" aside={<span className="text-xs text-muted">Gameweeks won</span>}>
        Head-to-head record
      </SectionHeading>
      <div className="rounded-2xl border border-line bg-card p-4">
        <dl className="grid grid-cols-3 items-start text-center">
          <RecordCount label={`Won by ${pair.a.team_name}`} value={record.a} color={pair.colorA} />
          <RecordCount label="Drawn" value={record.draws} />
          <RecordCount label={`Won by ${pair.b.team_name}`} value={record.b} color={pair.colorB} />
        </dl>
        {played > 0 && (
          <div className="mt-3 flex h-2 gap-0.5" aria-hidden>
            {segments.map((s) => (
              <div key={s.key} className="rounded-full" style={{ flexGrow: s.value, background: s.color }} />
            ))}
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <BiggestWin side="a" pair={pair} record={record} />
          <BiggestWin side="b" pair={pair} record={record} />
        </div>
        {late.length > 0 && (
          <p className="mt-3 text-xs text-muted">
            {late.map(({ m, event }) => `${m.team_name} joined in GW${event}`).join(' · ')}, so {played} gameweek
            {played === 1 ? '' : 's'} count.
          </p>
        )}
      </div>
    </section>
  )
}

function RecordCount({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex min-w-0 flex-col-reverse items-center px-1">
      <dt className="flex max-w-full min-w-0 items-start justify-center gap-1 text-[11px] leading-tight text-muted">
        {color && <span aria-hidden className="mt-0.5 size-2 shrink-0 rounded-full" style={{ background: color }} />}
        <span className="line-clamp-2 break-words">{label}</span>
      </dt>
      <dd className="font-display text-3xl font-bold tabular-nums">{value}</dd>
    </div>
  )
}

function BiggestWin({ side, pair, record }: { side: Side; pair: Pair; record: H2HRecord }) {
  const win = side === 'a' ? record.biggestA : record.biggestB
  const manager = side === 'a' ? pair.a : pair.b
  return (
    <div className="min-w-0 rounded-xl bg-raised px-3 py-2.5">
      <div className="truncate text-[11px] text-muted">Biggest win · {manager.team_name}</div>
      {win ? (
        <div className="mt-0.5 font-display text-lg font-bold tabular-nums">
          +{win.margin} <span className="text-xs font-medium text-muted">in GW{win.event}</span>
        </div>
      ) : (
        <div className="mt-0.5 font-display text-lg font-bold text-muted">–</div>
      )}
    </div>
  )
}

/* ---------- Gap chart ---------- */

function GapChart({ pair, weeks }: { pair: Pair; weeks: H2HWeek[] }) {
  function TooltipContent({ active, payload }: TooltipContentProps<ValueType, NameType>) {
    if (!active || !payload?.length) return null
    const w = payload[0].payload as H2HWeek
    return (
      <div className="max-w-60 rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-lg">
        <div className="mb-1 font-semibold">After GW{w.event}</div>
        <div className="text-ink-2">{gapSummary(w.gap, pair.a.team_name, pair.b.team_name)}</div>
        <div className="mt-1 flex items-center gap-2 text-muted">
          <span className="h-1 w-3 shrink-0 rounded-full" style={{ background: pair.colorA }} />
          <span className="tabular-nums">{w.a ?? '–'}</span>
          <span>v</span>
          <span className="tabular-nums">{w.b ?? '–'}</span>
          <span className="h-1 w-3 shrink-0 rounded-full" style={{ background: pair.colorB }} />
          <span>that week</span>
        </div>
      </div>
    )
  }

  return (
    <section aria-labelledby="gap-heading">
      <SectionHeading id="gap-heading">Points gap over the season</SectionHeading>
      <div className="rounded-2xl border border-line bg-card px-1 pt-3 pb-1">
        <Legend color={pair.colorA}>{pair.a.team_name} ahead</Legend>
        <ChartSlot
          className="h-52 sm:h-64"
          label={`Points gap between ${pair.a.team_name} and ${pair.b.team_name} after each gameweek`}
          preload={loadGapArea}
        >
          <GapArea
            weeks={weeks}
            colorA={pair.colorA}
            colorB={pair.colorB}
            gradientId={`gap-${pair.a.entry_id}-${pair.b.entry_id}`}
            tooltip={TooltipContent}
          />
        </ChartSlot>
        <Legend color={pair.colorB}>{pair.b.team_name} ahead</Legend>
      </div>
    </section>
  )
}

function Legend({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 py-0.5 pl-11 text-[11px] text-muted">
      <span aria-hidden className="h-1 w-3 shrink-0 rounded-full" style={{ background: color }} />
      <span className="truncate">{children}</span>
    </div>
  )
}

/* ---------- Stats table ---------- */

type Better = 'high' | 'low' | null

interface StatRow {
  label: string
  a: ReactNode
  b: ReactNode
  /** Numbers to compare for the "better" highlight. */
  va?: number | null
  vb?: number | null
  better: Better
}

function StatsTable({ pair, detailA, detailB }: { pair: Pair; detailA?: ManagerDetail; detailB?: ManagerDetail }) {
  const { league } = useLeague()
  const transfers = useLeagueTransfers(league.league.id)
  const sa = sideStats(pair.a)
  const sb = sideStats(pair.b)
  const sum = (d: ManagerDetail | undefined, key: 'captain_points' | 'bench_points') =>
    d ? d.gameweeks.reduce((n, g) => n + g[key], 0) : null
  const moves = (id: number) => transfers.data?.managers.find((m) => m.entry_id === id)?.transfers ?? 0
  const pending = <Bone className="ml-auto h-4 w-8" />
  const pendingB = <Bone className="h-4 w-8" />
  const capA = sum(detailA, 'captain_points')
  const capB = sum(detailB, 'captain_points')
  const benchA = sum(detailA, 'bench_points')
  const benchB = sum(detailB, 'bench_points')

  const rows: StatRow[] = [
    { label: 'Total points', a: sa.total, b: sb.total, va: sa.total, vb: sb.total, better: 'high' },
    {
      label: 'Best gameweek',
      a: sa.best ? <WithNote value={sa.best.points} note={`GW${sa.best.event}`} /> : '–',
      b: sb.best ? <WithNote value={sb.best.points} note={`GW${sb.best.event}`} /> : '–',
      va: sa.best?.points,
      vb: sb.best?.points,
      better: 'high',
    },
    {
      label: 'Average gameweek',
      a: sa.average === null ? '–' : sa.average.toFixed(1),
      b: sb.average === null ? '–' : sb.average.toFixed(1),
      va: sa.average,
      vb: sb.average,
      better: 'high',
    },
    { label: 'From captains', a: capA ?? pending, b: capB ?? pendingB, va: capA, vb: capB, better: 'high' },
    { label: 'Left on bench', a: benchA ?? pending, b: benchB ?? pendingB, va: benchA, vb: benchB, better: 'low' },
    {
      label: 'Transfers',
      a: transfers.data ? moves(pair.a.entry_id) : transfers.isError ? '–' : pending,
      b: transfers.data ? moves(pair.b.entry_id) : transfers.isError ? '–' : pendingB,
      better: null,
    },
    {
      label: 'Hits taken',
      a: sa.hits ? `−${sa.hits}` : '0',
      b: sb.hits ? `−${sb.hits}` : '0',
      va: sa.hits,
      vb: sb.hits,
      better: 'low',
    },
    { label: 'Chips played', a: <Chips chips={sa.chips} />, b: <Chips chips={sb.chips} align="right" />, better: null },
  ]

  return (
    <section aria-labelledby="stats-heading">
      <SectionHeading id="stats-heading">Side by side</SectionHeading>
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-2.5 pl-3.5 text-left">
                <ColumnHead color={pair.colorA}>{pair.a.team_name}</ColumnHead>
              </th>
              <th scope="col" className="w-[34%] py-2.5">
                <span className="sr-only">Stat</span>
              </th>
              <th scope="col" className="py-2.5 pr-3.5 text-right">
                <ColumnHead color={pair.colorB} align="right">
                  {pair.b.team_name}
                </ColumnHead>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const winner = betterSide(r)
              const cell = (side: Side) =>
                winner === null ? 'font-semibold' : winner === side ? 'font-bold text-ink' : 'font-medium text-muted'
              return (
                <tr key={r.label}>
                  <td className={`py-2.5 pl-3.5 align-top tabular-nums ${cell('a')}`}>{r.a}</td>
                  <th scope="row" className="px-1 py-2.5 text-center align-top text-xs font-medium text-muted">
                    {r.label}
                  </th>
                  <td className={`py-2.5 pr-3.5 text-right align-top tabular-nums ${cell('b')}`}>{r.b}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function betterSide(r: StatRow): Side | null {
  if (r.better === null || r.va == null || r.vb == null || r.va === r.vb) return null
  const aWins = r.better === 'high' ? r.va > r.vb : r.va < r.vb
  return aWins ? 'a' : 'b'
}

function ColumnHead({ color, align = 'left', children }: { color: string; align?: 'left' | 'right'; children: ReactNode }) {
  return (
    <span className={`flex min-w-0 items-center gap-1.5 ${align === 'right' ? 'justify-end' : ''}`}>
      <span aria-hidden className="h-1 w-3 shrink-0 rounded-full" style={{ background: color }} />
      <span className="truncate text-xs font-bold">{children}</span>
    </span>
  )
}

function WithNote({ value, note }: { value: ReactNode; note: string }) {
  return (
    <>
      {value} <span className="text-[11px] font-normal text-muted">{note}</span>
    </>
  )
}

function Chips({ chips, align = 'left' }: { chips: { name: string; event: number }[]; align?: 'left' | 'right' }) {
  if (chips.length === 0) return <span className="text-muted">None</span>
  return (
    <ul className={`flex flex-wrap gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
      {chips.map((c) => (
        <li
          key={`${c.name}-${c.event}`}
          className="inline-flex h-6 items-center rounded-full bg-raised px-2 text-[11px] font-semibold text-ink-2"
        >
          {chipLabel(c.name).short}
          <span className="ml-1 font-normal text-muted">GW{c.event}</span>
        </li>
      ))}
    </ul>
  )
}

/* ---------- Gameweek list ---------- */

function WeekList({
  pair,
  weeks,
  detailA,
  detailB,
}: {
  pair: Pair
  weeks: H2HWeek[]
  detailA?: ManagerDetail
  detailB?: ManagerDetail
}) {
  const gwA = useMemo(() => new Map(detailA?.gameweeks.map((g) => [g.event, g])), [detailA])
  const gwB = useMemo(() => new Map(detailB?.gameweeks.map((g) => [g.event, g])), [detailB])
  const newestFirst = [...weeks].reverse()

  return (
    <section aria-labelledby="h2h-weeks-heading">
      <SectionHeading id="h2h-weeks-heading">Gameweek by gameweek</SectionHeading>
      <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {newestFirst.map((w) => (
          <li key={w.event} className="grid grid-cols-[minmax(0,1fr)_2.75rem_minmax(0,1fr)] items-center gap-1 px-2.5 py-2.5">
            <WeekSide
              points={w.a}
              won={w.winner === 'a'}
              color={pair.colorA}
              detail={gwA.get(w.event)}
              loading={!detailA}
            />
            <div className="text-center">
              <div className="text-[11px] text-muted">GW</div>
              <div className="font-display text-sm font-bold tabular-nums">{w.event}</div>
              <span className="sr-only">
                {w.winner === null
                  ? ''
                  : w.winner === 'draw'
                    ? 'Drawn'
                    : `Won by ${w.winner === 'a' ? pair.a.team_name : pair.b.team_name}`}
              </span>
            </div>
            <WeekSide
              points={w.b}
              won={w.winner === 'b'}
              color={pair.colorB}
              detail={gwB.get(w.event)}
              loading={!detailB}
              align="right"
            />
          </li>
        ))}
      </ol>
    </section>
  )
}

function WeekSide({
  points,
  won,
  color,
  detail,
  loading,
  align = 'left',
}: {
  points: number | null
  won: boolean
  color: string
  detail?: GameweekDetail
  loading: boolean
  align?: 'left' | 'right'
}) {
  const right = align === 'right'
  if (points === null) {
    return <div className={`text-xs text-muted ${right ? 'text-right' : ''}`}>Not joined yet</div>
  }
  return (
    <div className={`flex min-w-0 items-center gap-2 ${right ? 'flex-row-reverse text-right' : ''}`}>
      <span
        className={`grid h-9 w-11 shrink-0 place-items-center rounded-xl font-display text-base font-bold tabular-nums ${
          won ? 'text-ink' : 'text-muted'
        }`}
        // Winner: a tint of the side's colour (8-digit hex = colour + alpha), with a ring for clarity.
        style={won ? { background: `${color}26`, boxShadow: `inset 0 0 0 1.5px ${color}` } : undefined}
      >
        {points}
      </span>
      <div className="min-w-0 flex-1">
        {loading ? (
          <Bone className={`h-3 w-16 ${right ? 'ml-auto' : ''}`} />
        ) : detail?.captain ? (
          <div className={`flex min-w-0 items-center gap-1 ${right ? 'flex-row-reverse' : ''}`}>
            <PlayerPhoto player={detail.captain} size={20} />
            <span className="truncate text-xs text-ink-2">{detail.captain.name}</span>
          </div>
        ) : (
          <span className="text-xs text-muted">–</span>
        )}
        {!loading && detail && (
          <div className="truncate text-[11px] text-muted">
            (C) {detail.captain_points}
            {detail.chip && ` · ${chipLabel(detail.chip).short}`}
            {detail.transfers_cost > 0 && ` · −${detail.transfers_cost}`}
          </div>
        )}
      </div>
    </div>
  )
}
