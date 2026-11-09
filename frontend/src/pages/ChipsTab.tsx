import { useMemo } from 'react'
import type { Manager } from '../api'
import { chipColumns, chipLabel, managerChipSlots, type ChipColumn, type ChipSlot } from '../chips'
import { useLeague } from './leagueContext'

interface Play {
  manager: Manager
  event: number
  points: number
}

export default function ChipsTab() {
  const { league } = useLeague()
  const columns = useMemo(() => chipColumns(league.chips), [league.chips])
  const nextEvent = (league.current_event ?? 0) + 1

  const rows = useMemo(
    () => league.managers.map((m) => ({ manager: m, slots: managerChipSlots(m, columns, nextEvent) })),
    [league.managers, columns, nextEvent],
  )

  if (columns.length === 0) {
    return <p className="text-sm text-ink-2">FPL hasn't published any chips for this season yet.</p>
  }

  return (
    <>
      <section aria-labelledby="chips-heading">
        <h2 id="chips-heading" className="text-lg font-semibold">
          Chips played
        </h2>
        <Legend />

        {/* Scrolls sideways only if FPL ever adds more chips than fit a phone. */}
        <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full min-w-[20rem] table-fixed text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th scope="col" className="sticky left-0 bg-card py-2 pl-3 text-left font-medium">
                  Manager
                </th>
                {columns.map((c) => (
                  <th key={c.name} scope="col" className="w-12 py-2 text-center font-medium">
                    <abbr title={chipLabel(c.name).label} className="no-underline">
                      {chipLabel(c.name).short}
                    </abbr>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ manager, slots }) => (
                <tr key={manager.entry_id}>
                  <th scope="row" className="sticky left-0 min-w-0 bg-card py-2 pl-3 pr-1 text-left font-normal">
                    <div className="truncate font-medium">{manager.team_name}</div>
                    <div className="truncate text-xs text-muted">{manager.player_name}</div>
                  </th>
                  {columns.map((c) => (
                    <td key={c.name} className="py-1.5 text-center align-middle last:pr-1">
                      <div className="flex flex-col items-center gap-1">
                        {slots.get(c.name)!.map((slot, i) => (
                          <SlotMark key={i} slot={slot} chip={chipLabel(c.name).label} />
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <BestAndWorst columns={columns} managers={league.managers} />
    </>
  )
}

function Legend() {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      <li className="flex items-center gap-1.5">
        <span className="rounded bg-accent/15 px-1 font-semibold text-accent">GW5</span> played, with points
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded-full border-2 border-up" /> available
      </li>
      <li className="flex items-center gap-1.5">
        <span className="text-muted">–</span> not yet
      </li>
      <li className="flex items-center gap-1.5">
        <span className="text-muted">✕</span> expired unused
      </li>
    </ul>
  )
}

function SlotMark({ slot, chip }: { slot: ChipSlot; chip: string }) {
  switch (slot.state) {
    case 'used':
      return (
        <span
          className="flex flex-col items-center rounded-md bg-accent/15 px-1.5 py-0.5 leading-tight"
          aria-label={`${chip} played in gameweek ${slot.event}, ${slot.points} points`}
        >
          <span className="text-[11px] font-semibold text-accent">GW{slot.event}</span>
          <span className="text-[11px] tabular-nums text-ink-2">{slot.points}</span>
        </span>
      )
    case 'available':
      return (
        <span
          className="my-1 size-3.5 rounded-full border-2 border-up"
          role="img"
          aria-label={`${chip} available until gameweek ${slot.until}`}
          title={`Available until GW${slot.until}`}
        />
      )
    case 'later':
      return (
        <span className="text-muted" role="img" aria-label={`${chip} available from gameweek ${slot.from}`} title={`From GW${slot.from}`}>
          –
        </span>
      )
    case 'expired':
      return (
        <span className="text-muted" role="img" aria-label={`${chip} expired unused`} title="Expired unused">
          ✕
        </span>
      )
  }
}

function BestAndWorst({ columns, managers }: { columns: ChipColumn[]; managers: Manager[] }) {
  const cards = columns
    .map((c) => {
      const plays: Play[] = managers.flatMap((m) =>
        m.history.filter((h) => h.chip === c.name).map((h) => ({ manager: m, event: h.event, points: h.points })),
      )
      return { column: c, plays }
    })
    .filter((c) => c.plays.length > 0)

  if (cards.length === 0) return null

  return (
    <section className="mt-8" aria-labelledby="chip-plays-heading">
      <h2 id="chip-plays-heading" className="text-lg font-semibold">
        Best and worst plays
      </h2>
      <p className="mt-0.5 text-xs text-muted">Gameweek score (after hits) in the week the chip was played.</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {cards.map(({ column, plays }) => {
          const best = Math.max(...plays.map((p) => p.points))
          const worst = Math.min(...plays.map((p) => p.points))
          return (
            <li key={column.name} className="rounded-xl border border-line bg-card px-3 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">{chipLabel(column.name).label}</h3>
                <span className="text-xs text-muted">played {plays.length}×</span>
              </div>
              <PlayLine label="Best" plays={plays.filter((p) => p.points === best)} tone="up" />
              {plays.length > 1 && worst !== best && (
                <PlayLine label="Worst" plays={plays.filter((p) => p.points === worst)} tone="down" />
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function PlayLine({ label, plays, tone }: { label: string; plays: Play[]; tone: 'up' | 'down' }) {
  return (
    <div className="mt-2 flex items-start gap-2 text-sm">
      <span className={`w-11 shrink-0 text-xs font-semibold uppercase ${tone === 'up' ? 'text-up' : 'text-down'}`}>
        {label}
      </span>
      <div className="min-w-0 flex-1">
        {plays.map((p) => (
          <div key={`${p.manager.entry_id}-${p.event}`} className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate">{p.manager.team_name}</span>
            <span className="shrink-0 text-xs text-muted">GW{p.event}</span>
            <span className="w-8 shrink-0 text-right font-semibold tabular-nums">{p.points}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
