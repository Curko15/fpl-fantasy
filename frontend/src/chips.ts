import type { ChipDefinition, Manager } from './api'

// Display names for chips we know. Anything new FPL adds still shows up, using its API name.
const KNOWN: Record<string, { label: string; short: string }> = {
  wildcard: { label: 'Wildcard', short: 'WC' },
  freehit: { label: 'Free Hit', short: 'FH' },
  bboost: { label: 'Bench Boost', short: 'BB' },
  '3xc': { label: 'Triple Captain', short: 'TC' },
}
const ORDER = Object.keys(KNOWN)

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
