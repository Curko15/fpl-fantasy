import type { ChipDefinition, Manager } from './api'

// Display names for chips we know. Anything new FPL adds still shows up, using its API name.
const KNOWN: Record<string, { label: string; short: string }> = {
  wildcard: { label: 'Wildcard', short: 'WC' },
  freehit: { label: 'Free Hit', short: 'FH' },
  bboost: { label: 'Bench Boost', short: 'BB' },
  '3xc': { label: 'Triple Captain', short: 'TC' },
}
const ORDER = Object.keys(KNOWN)

/** CSS colour for a chip (theme tokens); unknown chips fall back to a neutral. */
export function chipColor(name: string): string {
  return ORDER.includes(name) ? `var(--color-chip-${name})` : 'var(--color-muted)'
}

export function chipLabel(name: string): { label: string; short: string } {
  return KNOWN[name] ?? { label: name, short: name.slice(0, 3).toUpperCase() }
}

export type ChipSlot =
  | { state: 'used'; event: number; points: number }
  | { state: 'available'; until: number }
  | { state: 'later'; from: number }
  | { state: 'expired' }

export interface ChipColumn {
  name: string
  definitions: ChipDefinition[]
}

/** One column per chip name, in a stable order, each holding every playable copy. */
export function chipColumns(definitions: ChipDefinition[]): ChipColumn[] {
  const byName = new Map<string, ChipDefinition[]>()
  for (const d of definitions) byName.set(d.name, [...(byName.get(d.name) ?? []), d])
  const rank = (n: string) => (ORDER.includes(n) ? ORDER.indexOf(n) : ORDER.length)
  return [...byName.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([name, defs]) => ({ name, definitions: defs.sort((a, b) => a.start_event - b.start_event) }))
}

/**
 * Matches a manager's played chips to the season's chip definitions and works out
 * the state of each copy. `nextEvent` is the first gameweek a chip could still be played in.
 */
export function managerChipSlots(
  manager: Manager,
  columns: ChipColumn[],
  nextEvent: number,
): Map<string, ChipSlot[]> {
  const plays = manager.history.filter((h) => h.chip)
  const result = new Map<string, ChipSlot[]>()
  for (const column of columns) {
    const unmatched = plays.filter((h) => h.chip === column.name)
    const slots: ChipSlot[] = column.definitions.map((d) => {
      const i = unmatched.findIndex((h) => h.event >= d.start_event && h.event <= d.stop_event)
      if (i >= 0) {
        const [play] = unmatched.splice(i, 1)
        return { state: 'used', event: play.event, points: play.points }
      }
      if (nextEvent > d.stop_event) return { state: 'expired' }
      if (nextEvent < d.start_event) return { state: 'later', from: d.start_event }
      return { state: 'available', until: d.stop_event }
    })
    // Plays that fit no definition (rules changed mid-season) are still shown.
    for (const play of unmatched) slots.push({ state: 'used', event: play.event, points: play.points })
    result.set(column.name, slots)
  }
  return result
}

export interface ChipHalf {
  start: number
  stop: number
}

/**
 * The season's chip windows (e.g. GW1–19 and GW20–38), in order. Chips sharing a
 * deadline belong to one window, even if one opens later (the first Wildcard starts in GW2).
 */
export function chipHalves(definitions: ChipDefinition[]): ChipHalf[] {
  const byStop = new Map<number, number>()
  for (const d of definitions) byStop.set(d.stop_event, Math.min(byStop.get(d.stop_event) ?? d.start_event, d.start_event))
  return [...byStop.entries()].map(([stop, start]) => ({ start, stop })).sort((a, b) => a.start - b.start)
}

export interface ChipPlay {
  manager: Manager
  event: number
  points: number
}

export interface ChipHalfCard {
  name: string
  plays: ChipPlay[] // in this window, by gameweek
  best: ChipPlay | null
  average: number | null
  holders: Manager[] // can still play it in this window (now or once it opens)
}

/** One card per chip for one window: who played it, how it went, who still holds it. */
export function chipHalfCards(managers: Manager[], definitions: ChipDefinition[], half: ChipHalf, nextEvent: number): ChipHalfCard[] {
  const inHalf = (e: number) => e >= half.start && e <= half.stop
  return chipColumns(definitions.filter((d) => d.stop_event === half.stop)).map((column) => {
    const plays = managers
      .flatMap((m) => m.history.filter((h) => h.chip === column.name && inHalf(h.event)).map((h) => ({ manager: m, event: h.event, points: h.points })))
      .sort((a, b) => a.event - b.event)
    const best = plays.reduce<ChipPlay | null>((b, p) => (!b || p.points > b.points ? p : b), null)
    const holders = managers.filter((m) => {
      if (plays.some((p) => p.manager.entry_id === m.entry_id)) return false
      const slot = managerChipSlots(m, [column], nextEvent).get(column.name)?.[0]
      return slot?.state === 'available' || slot?.state === 'later'
    })
    return {
      name: column.name,
      plays,
      best,
      average: plays.length ? Math.round(plays.reduce((n, p) => n + p.points, 0) / plays.length) : null,
      holders,
    }
  })
}
