import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleMinus, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import type { Award, LeagueOverview } from '../api'
import { AWARDS } from '../awards'
import { chipColor, chipLabel } from '../chips'
import { SectionHeading } from '../components/SectionHeading'
import { YouTag } from '../components/YouTag'
import { recapHeadline, recapMoments, standingsAfter, type Moment, type MomentKind, type Standing } from '../recap'
import { useMe } from './leagueContext'

const REST_COLLAPSED = 7

const EXTRA_ICONS: Partial<Record<MomentKind, LucideIcon>> = { climb: TrendingUp, drop: TrendingDown, hit: CircleMinus }

const TONE = {
  star: { icon: 'bg-pop text-pop-ink', label: 'text-ink' },
  good: { icon: 'bg-up/15 text-up', label: 'text-up' },
  bad: { icon: 'bg-down/15 text-down', label: 'text-down' },
  neutral: { icon: 'bg-raised text-ink-2', label: 'text-muted' },
}

/** One gameweek as a story: headline, podium, the week in moments and the rest of the table. */
export default function RecapView({
  league,
  event,
  awards,
  awardsPending,
}: {
  league: LeagueOverview
  event: number
  awards: Award[] | undefined
  awardsPending: boolean
}) {
  const table = useMemo(() => standingsAfter(league.managers, league.events, event), [league, event])
  const headline = useMemo(() => recapHeadline(table, event), [table, event])
  const moments = useMemo(() => recapMoments(table, awards, event), [table, awards, event])
  const live = event === league.current_event && !league.current_event_finished

  if (!headline) {
    return <p className="rounded-2xl border border-line bg-card p-4 text-sm text-ink-2">No scores for GW{event} yet.</p>
  }

  return (
    <>
      <section aria-labelledby="recap-headline" className="rounded-3xl border border-line bg-card p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold tracking-[0.12em] text-accent uppercase">Gameweek {event} recap</span>
          {live && (
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-down/12 px-2.5 text-xs font-semibold text-down">
              <span className="size-1.5 animate-pulse rounded-full bg-down" />
              In progress
            </span>
          )}
        </div>
        <h2 id="recap-headline" className="mt-2 font-display text-[28px] leading-[1.05] font-bold tracking-tight">
          {headline.title}
        </h2>
        {headline.subtitle && <p className="mt-2 text-sm text-muted">{headline.subtitle}</p>}
        <Podium table={table} />
      </section>

      <section aria-labelledby="moments-heading">
        <SectionHeading id="moments-heading">The week in moments</SectionHeading>
        {awardsPending && (
          <p className="-mt-1 mb-3 text-xs text-muted">Awards for this gameweek are still being collected. More moments will appear shortly.</p>
        )}
        {moments.length === 0 ? (
          <p className="rounded-2xl border border-line bg-card p-4 text-sm text-ink-2">A quiet week: no chips, hits or big moves.</p>
        ) : (
          <ol>
            {moments.map((m, i) => (
              <MomentRow key={m.id} moment={m} last={i === moments.length - 1} />
            ))}
          </ol>
        )}
      </section>

      <Rest table={table} />
    </>
  )
}

function moveLabel(move: number | null): { text: string; tone: string } {
  if (move === null) return { text: 'new', tone: 'text-muted' }
  if (move > 0) return { text: `▲${move}`, tone: 'text-up' }
  if (move < 0) return { text: `▼${-move}`, tone: 'text-down' }
  return { text: '–', tone: 'text-muted' }
}

function Podium({ table }: { table: Standing[] }) {
  const [meId] = useMe()
  const top = table.slice(0, 3)
  // Classic podium order: 2nd, 1st, 3rd.
  const order = [top[1], top[0], top[2]].filter((s): s is Standing => s !== undefined)
  const height = { 1: 'h-24', 2: 'h-16', 3: 'h-12' } as Record<number, string>

  return (
    <ol aria-label="Top three after this gameweek" className="mt-5 grid grid-cols-3 items-end gap-2">
      {order.map((s) => {
        const place = top.indexOf(s) + 1
        const move = moveLabel(s.move)
        const isMe = s.manager.entry_id === meId
        return (
          <li key={s.manager.entry_id} className="relative min-w-0 text-center">
            <Link
              to={`../manager/${s.manager.entry_id}`}
              className={`line-clamp-2 text-xs leading-tight break-words after:absolute after:inset-0 ${place === 1 ? 'font-bold' : 'font-semibold'} ${isMe ? 'text-accent' : ''}`}
            >
              {s.manager.team_name}
            </Link>
            <div className="text-xs text-muted tabular-nums">
              {s.total}
              {s.move ? <span className={`ml-1 font-semibold ${move.tone}`}>{move.text}</span> : null}
            </div>
            <div
              className={`mt-2 grid place-items-center rounded-t-xl font-display font-bold ${height[place]} ${
                place === 1 ? 'bg-pop text-4xl text-pop-ink' : 'bg-raised text-2xl'
              }`}
            >
              {place}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function MomentIcon({ moment }: { moment: Moment }) {
  if (moment.kind === 'chip' && moment.chip) {
    return (
      <span
        className="grid size-9 shrink-0 place-items-center rounded-full font-display text-[11px] font-bold text-chip-ink"
        style={{ background: chipColor(moment.chip) }}
      >
        {chipLabel(moment.chip).short}
      </span>
    )
  }
  const Icon = EXTRA_ICONS[moment.kind] ?? AWARDS[moment.kind as keyof typeof AWARDS]?.icon
  return (
    <span className={`grid size-9 shrink-0 place-items-center rounded-full ${TONE[moment.tone].icon}`}>
      {Icon && <Icon size={17} aria-hidden />}
    </span>
  )
}

function MomentRow({ moment, last }: { moment: Moment; last: boolean }) {
  const [meId] = useMe()
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <MomentIcon moment={moment} />
        {!last && <span aria-hidden className="mt-1 w-0.5 flex-1 rounded-full bg-line" />}
      </div>
      <article className="relative mb-3 min-w-0 flex-1 rounded-2xl border border-line bg-card px-3.5 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[11px] font-bold tracking-[0.06em] uppercase ${TONE[moment.tone].label}`}>{moment.label}</span>
          <span className="font-display text-xl leading-none font-bold tabular-nums">{moment.value}</span>
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <Link
            to={`../manager/${moment.entryId}`}
            className="min-w-0 text-sm leading-snug font-semibold after:absolute after:inset-0"
          >
            {moment.title}
          </Link>
          {moment.entryId === meId && <YouTag />}
        </div>
        <p className="mt-0.5 text-xs text-muted">{moment.detail}</p>
      </article>
    </li>
  )
}

function Rest({ table }: { table: Standing[] }) {
  const [meId] = useMe()
  const [open, setOpen] = useState(false)
  const rest = table.slice(3)
  if (rest.length === 0) return null
  const shown = open ? rest : rest.slice(0, REST_COLLAPSED)
  const pinned = open ? undefined : rest.slice(REST_COLLAPSED).find((s) => s.manager.entry_id === meId)

  function row(s: Standing) {
    const move = moveLabel(s.move)
    const isMe = s.manager.entry_id === meId
    return (
      <li key={s.manager.entry_id} className={`relative flex h-13 items-center gap-3 px-3.5 ${isMe ? 'bg-accent/8' : ''}`}>
        <span className={`w-6 shrink-0 font-display text-base font-bold tabular-nums ${isMe ? 'text-accent' : 'text-muted'}`}>{s.rank}</span>
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <Link to={`../manager/${s.manager.entry_id}`} className="min-w-0 truncate text-sm font-semibold after:absolute after:inset-0">
            {s.manager.team_name}
          </Link>
          {isMe && <YouTag />}
        </div>
        <span className={`w-8 shrink-0 text-right text-xs font-semibold ${move.tone}`}>{move.text}</span>
        <div className="w-12 shrink-0 text-right">
          <div className="font-display text-base font-bold tabular-nums">{s.total}</div>
          <div className="text-[11px] text-muted tabular-nums">{s.points} GW</div>
        </div>
      </li>
    )
  }

  return (
    <section aria-labelledby="rest-heading">
      <SectionHeading
        id="rest-heading"
        aside={
          <Link to=".." className="-my-2 py-2 text-sm font-semibold text-accent">
            Full table
          </Link>
        }
      >
        The rest
      </SectionHeading>
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
      {rest.length > REST_COLLAPSED && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-1 flex h-11 w-full items-center justify-center text-sm font-semibold text-accent"
        >
          {open ? 'Show fewer' : `Show all ${rest.length}`}
        </button>
      )}
    </section>
  )
}
