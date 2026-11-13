import type { Manager } from './api'

/**
 * The gameweek a manager joined the league, when that was after the league's
 * first played gameweek (`events[0]`). Null when they've been there from the
 * start, or when there's nothing to compare yet (no played gameweeks or no
 * history). Their totals only cover the weeks since, which skews charts and
 * races, so the UI marks them with a "Joined GWn" note.
 */
export function joinedEvent(manager: Manager, events: number[]): number | null {
  if (events.length === 0) return null
  const played = new Set(manager.history.map((h) => h.event))
  const first = events.find((e) => played.has(e))
  return first === undefined || first === events[0] ? null : first
}

/** `joinedEvent` for every manager who joined late, keyed by entry id. */
export function lateJoiners(managers: Manager[], events: number[]): Map<number, number> {
  const late = new Map<number, number>()
  for (const m of managers) {
    const event = joinedEvent(m, events)
    if (event !== null) late.set(m.entry_id, event)
  }
  return late
}

/**
 * One-line chart footnote naming the late joiners (best rank first), or null
 * when everyone has been there from the start.
 */
export function lateJoinersNote(managers: Manager[], events: number[]): string | null {
  const late = lateJoiners(managers, events)
  const teams = managers
    .filter((m) => late.has(m.entry_id))
    .sort((a, b) => a.rank - b.rank)
    .map((m) => `${m.team_name} joined in GW${late.get(m.entry_id)}`)
  if (teams.length === 0) return null
  if (teams.length === 1) return `${teams[0]}, so their line starts there.`
  if (teams.length === 2) return `${teams[0]} and ${teams[1]}, so their lines start there.`
  return `${teams.length} managers joined after GW${events[0]}, so their lines start later.`
}
