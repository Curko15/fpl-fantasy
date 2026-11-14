import type { Manager } from './api'

// Maths for the Overview season charts: Focus (S1), Race (S5) and Spread (S4).

/** Leagues this small highlight everyone instead of a few rivals. */
export const SMALL_LEAGUE = 7
const NEIGHBOURS = 2 // rivals directly above and directly below "me"

export function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'}`
}

function byRank(managers: Manager[]): Manager[] {
  return [...managers].sort((a, b) => a.rank - b.rank)
}

/**
 * Who to highlight next to `meId`, best rank first: the leader plus the managers
 * just above and below. When "me" is near the top or bottom, the other side fills
 * in, so there are always up to 2 × NEIGHBOURS rivals. Small leagues get everyone.
 */
export function focusTeams(managers: Manager[], meId: number): number[] {
  const table = byRank(managers)
  if (table.length <= SMALL_LEAGUE) return table.map((m) => m.entry_id).filter((id) => id !== meId)

  const me = table.findIndex((m) => m.entry_id === meId)
  if (me < 0) return []
  const leader = table[0].entry_id
  const above = table.slice(0, me).filter((m) => m.entry_id !== leader)
  const below = table.slice(me + 1)
  const nearUp = Math.min(NEIGHBOURS, above.length)
  const nearDown = Math.min(NEIGHBOURS, below.length)
  const up = Math.min(above.length, nearUp + (NEIGHBOURS - nearDown))
  const down = Math.min(below.length, nearDown + (NEIGHBOURS - nearUp))

  const ids = new Set<number>([leader, ...above.slice(above.length - up).map((m) => m.entry_id), ...below.slice(0, down).map((m) => m.entry_id)])
  ids.delete(meId)
  return table.map((m) => m.entry_id).filter((id) => ids.has(id))
}

export type FocusMode = 'behind' | 'position'

/**
 * One row per gameweek for the line chart, keyed by entry id. "behind" is the gap
 * to that gameweek's top total (the leader sits at 0); "position" is league rank.
 */
export function seasonRows(managers: Manager[], events: number[], mode: FocusMode): Record<string, number>[] {
  return events.map((event) => {
    const row: Record<string, number> = { event }
    const played = managers.flatMap((m) => {
      const gw = m.history.find((h) => h.event === event)
      return gw ? [{ id: m.entry_id, gw }] : []
    })
    const top = Math.max(...played.map((p) => p.gw.total))
    for (const { id, gw } of played) row[id] = mode === 'position' ? gw.league_rank : top - gw.total
    return row
  })
}

/** Linear-interpolated quantile of an ascending list (p in 0..1). */
export function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN
  const i = (sorted.length - 1) * p
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

export interface SpreadWeek {
  event: number
  scores: { entryId: number; points: number }[]
  p25: number
  median: number
  p75: number
  /** My points and my rank among that week's scores (1 = best), when I played. */
  mine: { points: number; rank: number } | null
}

export function scoreSpread(managers: Manager[], events: number[], meId: number): SpreadWeek[] {
  return events.flatMap((event) => {
    const scores = managers.flatMap((m) => {
      const gw = m.history.find((h) => h.event === event)
      return gw ? [{ entryId: m.entry_id, points: gw.points }] : []
    })
    if (scores.length === 0) return []
    const sorted = scores.map((s) => s.points).sort((a, b) => a - b)
    const my = scores.find((s) => s.entryId === meId)
    return [
      {
        event,
        scores,
        p25: quantile(sorted, 0.25),
        median: quantile(sorted, 0.5),
        p75: quantile(sorted, 0.75),
        mine: my ? { points: my.points, rank: 1 + scores.filter((s) => s.points > my.points).length } : null,
      },
    ]
  })
}

export interface WeekHighlight {
  event: number
  points: number
  rank: number
  of: number
}

export interface SpreadStats {
  aboveMedian: number
  played: number
  best: WeekHighlight | null
  worst: WeekHighlight | null
}

export function spreadStats(weeks: SpreadWeek[]): SpreadStats {
  let aboveMedian = 0
  let best: WeekHighlight | null = null
  let worst: WeekHighlight | null = null
  let played = 0
  for (const w of weeks) {
    if (!w.mine) continue
    const week = { event: w.event, points: w.mine.points, rank: w.mine.rank, of: w.scores.length }
    played += 1
    if (week.points > w.median) aboveMedian += 1
    if (!best || week.points > best.points) best = week
    if (!worst || week.points < worst.points) worst = week
  }
  return { aboveMedian, played, best, worst }
}

export const RACE_TOP = 12

/**
 * Everyone who appears in the race at some gameweek: anyone ever in the top
 * `top`, plus "me". A fixed list lets each bar keep its element and slide.
 */
export function racePool(managers: Manager[], meId: number | null, top = RACE_TOP): number[] {
  return byRank(managers)
    .filter((m) => m.entry_id === meId || m.history.some((h) => h.league_rank <= top))
    .map((m) => m.entry_id)
}

export interface RaceBar {
  entryId: number
  rank: number
  total: number
  /** Row position: 0 is first place. "Me" outside the top sits just under it. */
  slot: number
  visible: boolean
  /** Bar length in percent, 0 when hidden. */
  width: number
}

const MIN_WIDTH = 40 // keeps room for the team name inside the shortest bar

export function raceFrame(managers: Manager[], pool: number[], event: number, meId: number | null, top = RACE_TOP): RaceBar[] {
  const byId = new Map(managers.map((m) => [m.entry_id, m]))
  const rows = pool.map((id) => {
    const gw = byId.get(id)?.history.find((h) => h.event === event)
    const rank = gw?.league_rank ?? Infinity
    // Everyone ranked inside the top shows, so a tie at the cut-off keeps both.
    const visible = gw !== undefined && (rank <= top || id === meId)
    return { entryId: id, rank, total: gw?.total ?? 0, visible, team: byId.get(id)?.team_name ?? '' }
  })
  // Managers level on points share a rank but never a row: break ties by name.
  const order = [...rows].sort((a, b) => a.rank - b.rank || b.total - a.total || a.team.localeCompare(b.team) || a.entryId - b.entryId)
  const row = new Map(order.map((r, i) => [r.entryId, i]))
  const inTop = rows.filter((r) => r.rank <= top).length
  const shown = rows.filter((r) => r.visible).map((r) => r.total)
  const hi = Math.max(...shown)
  const lo = Math.min(...shown)
  return rows.map((r) => ({
    entryId: r.entryId,
    rank: r.rank,
    total: r.total,
    visible: r.visible,
    slot: r.rank <= top ? row.get(r.entryId)! : r.visible ? inTop + 0.4 : inTop + 1.5,
    width: !r.visible ? 0 : hi === lo ? 100 : MIN_WIDTH + ((r.total - lo) / (hi - lo)) * (100 - MIN_WIDTH),
  }))
}
