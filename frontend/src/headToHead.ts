import type { GameweekEntry, Manager } from './api'

/** Head-to-head maths: two managers compared gameweek by gameweek. */

export type Side = 'a' | 'b'

export interface H2HWeek {
  event: number
  /** Points that gameweek (after hits); null when that manager hadn't joined yet. */
  a: number | null
  b: number | null
  /** Who scored more; null when only one of them played. */
  winner: Side | 'draw' | null
  /** Season gap after this gameweek: A's total minus B's (0 before someone joined). */
  gap: number
}

/**
 * One row per gameweek, oldest first. A manager who joined mid-season has no
 * history before joining: their weekly score is null and their total counts as 0
 * until then, like the league table.
 */
export function headToHeadWeeks(a: Manager, b: Manager, events: number[]): H2HWeek[] {
  const histA = new Map(a.history.map((h) => [h.event, h]))
  const histB = new Map(b.history.map((h) => [h.event, h]))
  let totalA = 0
  let totalB = 0
  return events.map((event) => {
    const ha = histA.get(event)
    const hb = histB.get(event)
    if (ha) totalA = ha.total
    if (hb) totalB = hb.total
    const pa = ha?.points ?? null
    const pb = hb?.points ?? null
    const winner = pa === null || pb === null ? null : pa > pb ? 'a' : pb > pa ? 'b' : 'draw'
    return { event, a: pa, b: pb, winner, gap: totalA - totalB }
  })
}

export interface BiggestWin {
  event: number
  margin: number
}

export interface H2HRecord {
  a: number
  b: number
  draws: number
  /** Gameweeks both managers played. */
  played: number
  biggestA: BiggestWin | null
  biggestB: BiggestWin | null
}

/** Gameweeks won, drawn and the biggest winning margin for each side (earliest on ties). */
export function headToHeadRecord(weeks: H2HWeek[]): H2HRecord {
  const record: H2HRecord = { a: 0, b: 0, draws: 0, played: 0, biggestA: null, biggestB: null }
  for (const w of weeks) {
    if (w.winner === null || w.a === null || w.b === null) continue
    record.played++
    if (w.winner === 'draw') {
      record.draws++
      continue
    }
    record[w.winner]++
    const margin = Math.abs(w.a - w.b)
    const key = w.winner === 'a' ? 'biggestA' : 'biggestB'
    const best = record[key]
    if (!best || margin > best.margin) record[key] = { event: w.event, margin }
  }
  return record
}

export interface SideStats {
  total: number
  /** Gameweeks played (fewer than the league's for a mid-season joiner). */
  played: number
  best: { event: number; points: number } | null
  average: number | null
  /** Points spent on transfer hits. */
  hits: number
  chips: { name: string; event: number }[]
}

/** Season stats from the league history (bench and captain points need the manager detail). */
export function sideStats(manager: Manager): SideStats {
  const history: GameweekEntry[] = [...manager.history].sort((x, y) => x.event - y.event)
  let best: SideStats['best'] = null
  for (const h of history) if (!best || h.points > best.points) best = { event: h.event, points: h.points }
  const sum = history.reduce((n, h) => n + h.points, 0)
  return {
    total: manager.total,
    played: history.length,
    best,
    average: history.length ? sum / history.length : null,
    hits: history.reduce((n, h) => n + h.transfers_cost, 0),
    chips: history.filter((h) => h.chip).map((h) => ({ name: h.chip!, event: h.event })),
  }
}

/**
 * Who to compare when the URL doesn't say: A is my team (or the leader), B the
 * manager directly above A in the table, or directly below when A is first.
 * Missing or unknown ids in `requested` fall back to those defaults.
 */
export function defaultPair(
  managers: Manager[],
  meId: number | null,
  requested: { a?: number | null; b?: number | null } = {},
): { a: number; b: number } | null {
  if (managers.length < 2) return null
  const table = [...managers].sort((x, y) => x.rank - y.rank || y.total - x.total)
  const known = (id: number | null | undefined): id is number => id != null && table.some((m) => m.entry_id === id)
  const a = known(requested.a) ? requested.a : known(meId) ? meId : table[0].entry_id
  if (known(requested.b) && requested.b !== a) return { a, b: requested.b }
  const i = table.findIndex((m) => m.entry_id === a)
  const b = i > 0 ? table[i - 1].entry_id : table[1].entry_id
  return { a, b }
}

/** "A&A lead by 23" / "Level on points" style summary of a points gap. */
export function gapSummary(gap: number, nameA: string, nameB: string): string {
  if (gap === 0) return 'Level on points'
  const n = Math.abs(gap)
  return `${gap > 0 ? nameA : nameB} leads by ${n} point${n === 1 ? '' : 's'}`
}
