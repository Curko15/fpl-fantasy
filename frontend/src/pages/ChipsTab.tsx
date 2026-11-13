import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Clock } from 'lucide-react'
import type { Manager } from '../api'
import { chipColor, chipHalfCards, chipHalves, chipLabel, type ChipHalf, type ChipHalfCard } from '../chips'
import { Segmented } from '../components/Segmented'
import { YouTag } from '../components/YouTag'
import { useLeague, useMe } from './leagueContext'

const HOLDER_FACES = 5

const initial = (m: Manager) => [...m.team_name][0]?.toUpperCase() ?? '?'

export default function ChipsTab() {
  const { league } = useLeague()
  const [params, setParams] = useSearchParams()
  const halves = useMemo(() => chipHalves(league.chips), [league.chips])
  const nextEvent = (league.current_event ?? 0) + 1

  // Default to the window chips can be played in now (or the last one, once the season ends).
  const current = Math.max(0, halves.findIndex((h) => nextEvent <= h.stop))
  const requested = Number(params.get('half'))
  const index = halves[requested] ? requested : current
  const half = halves[index]

  const cards = useMemo(
    () => (half ? chipHalfCards(league.managers, league.chips, half, nextEvent) : []),
    [league.managers, league.chips, half, nextEvent],
  )

  if (!half) {
    return <p className="rounded-2xl border border-line bg-card p-4 text-sm text-ink-2">FPL hasn't published any chips for this season yet.</p>
  }

  return (
    <div className="space-y-4">
      {halves.length > 1 && (
        <Segmented
          label="Season half"
          value={String(index)}
          onChange={(v) =>
            setParams(
              (prev) => {
                const next = new URLSearchParams(prev)
                next.set('half', v)
                return next
              },
              { replace: true },
            )
          }
          options={halves.map((h, i) => ({ value: String(i), label: `GW${h.start}–${h.stop}` }))}
        />
      )}

      <Deadline half={half} nextEvent={nextEvent} unplayed={cards.reduce((n, c) => n + c.holders.length, 0)} />

      <ul className="space-y-2.5">
        {cards.map((card) => (
          <ChipCard key={card.name} card={card} managers={league.managers.length} />
        ))}
      </ul>

      <Timeline half={half} managers={league.managers} currentEvent={league.current_event} />
    </div>
  )
}

function Deadline({ half, nextEvent, unplayed }: { half: ChipHalf; nextEvent: number; unplayed: number }) {
  let title: string
  let text: string
  if (nextEvent < half.start) {
    title = `Unlocks in GW${half.start}`
    text = 'Everyone gets a fresh set of chips for the second half.'
  } else if (nextEvent > half.stop) {
    title = `Window closed after GW${half.stop}`
    text = unplayed ? `${unplayed} chip${unplayed === 1 ? '' : 's'} expired unplayed.` : 'Every chip was played.'
  } else {
    const left = half.stop - nextEvent + 1
    title = `${left} GW${left === 1 ? '' : 's'} left to play these chips`
    text = `${unplayed} chip${unplayed === 1 ? '' : 's'} still unplayed. They expire after GW${half.stop}.`
  }
  const urgent = nextEvent >= half.start && nextEvent <= half.stop
  return (
    <section
      aria-label="Chip deadline"
      className={`flex items-center gap-3 rounded-2xl border p-3.5 ${
        urgent ? 'border-chip-bboost/40 bg-chip-bboost/10' : 'border-line bg-card'
      }`}
    >
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${urgent ? 'bg-chip-bboost/20 text-ink' : 'bg-raised text-muted'}`}>
        <Clock size={20} aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="text-sm font-bold">{title}</div>
        <div className="text-xs text-ink-2">{text}</div>
      </div>
    </section>
  )
}

function ChipCard({ card, managers }: { card: ChipHalfCard; managers: number }) {
  const [meId] = useMe()
  const holders = [...card.holders].sort((x, y) => Number(y.entry_id === meId) - Number(x.entry_id === meId))
  const { label, short } = chipLabel(card.name)
  const color = chipColor(card.name)
  const used = card.plays.length
  return (
    <li className="rounded-3xl border border-line bg-card p-4">
      <div className="flex items-center gap-3">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-2xl font-display text-[15px] font-bold text-chip-ink"
          style={{ background: color }}
        >
          {short}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold">{label}</h2>
          <div className="text-xs text-muted">
            {used} of {managers} played{card.average !== null && ` · avg ${card.average} pts`}
          </div>
        </div>
        <div
          role="img"
          aria-label={`${used} of ${managers} played`}
          className="grid size-11 shrink-0 place-items-center rounded-full"
          style={{ background: `conic-gradient(${color} ${(used / Math.max(managers, 1)) * 360}deg, var(--color-line) 0)` }}
        >
          <span className="grid size-[34px] place-items-center rounded-full bg-card font-display text-[13px] font-bold tabular-nums">
            {used}
          </span>
        </div>
      </div>

      {card.best && (
        <Link
          to={`../manager/${card.best.manager.entry_id}`}
          className="mt-3.5 flex items-center gap-3 rounded-2xl bg-raised px-3 py-2.5"
        >
          <span className="text-[11px] font-bold tracking-[0.06em] text-muted uppercase">Best</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold">{card.best.manager.team_name}</span>
              {card.best.manager.entry_id === meId && <YouTag />}
            </div>
            <div className="text-xs text-muted">GW{card.best.event}</div>
          </div>
          <span className="font-display text-xl font-bold tabular-nums">{card.best.points}</span>
        </Link>
      )}

      <div className="mt-3 flex items-center gap-2">
        {card.holders.length > 0 ? (
          <>
            <div className="flex">
              {holders.slice(0, HOLDER_FACES).map((m) => (
                <span
                  key={m.entry_id}
                  title={m.team_name}
                  className={`-mr-2 grid size-[30px] place-items-center rounded-full border-2 text-[11px] font-bold ${
                    m.entry_id === meId ? 'border-accent bg-accent text-accent-ink' : 'border-card bg-raised'
                  }`}
                >
                  {initial(m)}
                </span>
              ))}
            </div>
            <span className="ml-2 text-xs text-ink-2">
              {card.holders.length} still holding
              {card.holders.length > HOLDER_FACES && ` (+${card.holders.length - HOLDER_FACES} more)`}
            </span>
          </>
        ) : (
          <span className="text-xs text-muted">Nobody left holding it</span>
        )}
      </div>
    </li>
  )
}

function Timeline({ half, managers, currentEvent }: { half: ChipHalf; managers: Manager[]; currentEvent: number | null }) {
  const span = Math.max(half.stop - half.start, 1)
  const pos = (e: number) => `${((e - half.start) / span) * 100}%`
  const now = currentEvent !== null && currentEvent >= half.start && currentEvent <= half.stop ? currentEvent : null
  const ticks = [half.start, Math.round(half.start + span / 3), Math.round(half.start + (2 * span) / 3), half.stop]
  const [meId] = useMe()
  // My row first, then the table order.
  const ordered = [...managers].sort((x, y) => Number(y.entry_id === meId) - Number(x.entry_id === meId))
  const plays = ordered.map((m) => ({
    manager: m,
    plays: m.history.filter((h) => h.chip && h.event >= half.start && h.event <= half.stop),
  }))
  const kinds = [...new Set(plays.flatMap((p) => p.plays.map((h) => h.chip!)))]

  return (
    <section aria-labelledby="timeline-heading">
      <h2 id="timeline-heading" className="mb-1 text-lg font-bold">
        When chips were played
      </h2>
      {kinds.length > 0 && (
        <ul className="mb-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-2">
          {kinds.map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: chipColor(k) }} />
              {chipLabel(k).label}
            </li>
          ))}
        </ul>
      )}
      <div className="rounded-2xl border border-line bg-card px-3.5 pt-3 pb-2.5">
        <div className="relative px-3">
          {now !== null && (
            <span aria-hidden className="absolute top-0 bottom-5 w-0.5 bg-accent/50" style={{ left: `calc(${pos(now)} + 0.75rem - 1px)` }} />
          )}
          {plays.map(({ manager, plays: own }) => (
            <div key={manager.entry_id} className="h-12">
              <div className="-mx-3 flex items-center gap-1.5">
                <Link
                  to={`../manager/${manager.entry_id}`}
                  className={`min-w-0 truncate text-xs ${manager.entry_id === meId ? 'font-bold text-accent' : 'font-semibold'}`}
                >
                  {manager.team_name}
                </Link>
                {manager.entry_id === meId && <YouTag />}
              </div>
              <div className="relative mt-1 h-[22px]">
                <span aria-hidden className="absolute inset-x-0 top-2.5 h-0.5 rounded-full bg-line" />
                {own.map((h, i) => {
                  // Two chips in one gameweek (e.g. WC + BB) sit side by side.
                  const twin = own.slice(0, i).some((o) => o.event === h.event)
                  return (
                    <span
                      key={`${h.chip}-${h.event}`}
                      title={`${chipLabel(h.chip!).label}, GW${h.event}: ${h.points} pts`}
                      className="absolute top-0 grid h-[22px] min-w-[26px] -translate-x-1/2 place-items-center rounded-full px-1 text-[10px] font-extrabold text-chip-ink"
                      style={{ left: twin ? `calc(${pos(h.event)} + 28px)` : pos(h.event), background: chipColor(h.chip!) }}
                    >
                      {chipLabel(h.chip!).short}
                    </span>
                  )
                })}
              </div>
            </div>
          ))}
          <div className="relative mt-1 h-4 text-[10px] text-muted">
            {ticks.filter((t) => now === null || Math.abs(t - now) > 1).map((t) => (
              <span key={t} className="absolute -translate-x-1/2" style={{ left: pos(t) }}>
                {t === half.start ? `GW${t}` : t}
              </span>
            ))}
            {now !== null && (
              <span className="absolute -translate-x-1/2 font-bold text-accent" style={{ left: pos(now) }}>
                now
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
