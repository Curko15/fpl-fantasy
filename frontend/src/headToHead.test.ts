import { describe, expect, it } from 'vitest'
import type { GameweekEntry, Manager } from './api'
import { defaultPair, gapSummary, headToHeadRecord, headToHeadWeeks, sideStats } from './headToHead'

const gw = (event: number, points: number, total: number, extra: Partial<GameweekEntry> = {}): GameweekEntry => ({
  event,
  points,
  total,
  league_rank: 1,
  overall_rank: null,
  transfers_cost: 0,
  chip: null,
  ...extra,
})

const manager = (id: number, rank: number, history: GameweekEntry[]): Manager => ({
  entry_id: id,
  player_name: `P${id}`,
  team_name: `T${id}`,
  rank,
  last_rank: rank,
  total: history.at(-1)?.total ?? 0,
  event_total: history.at(-1)?.points ?? 0,
  history,
})

const ann = manager(1, 1, [gw(1, 60, 60), gw(2, 50, 110, { transfers_cost: 4 }), gw(3, 70, 180, { chip: 'bboost' }), gw(4, 40, 220)])
const bob = manager(2, 2, [gw(1, 70, 70), gw(2, 50, 120), gw(3, 45, 165), gw(4, 52, 217)])
// Joined in GW3.
const cat = manager(3, 3, [gw(3, 80, 80), gw(4, 40, 120, { chip: 'wildcard' })])

describe('headToHeadWeeks', () => {
  it('compares each gameweek and tracks the season gap', () => {
    expect(headToHeadWeeks(ann, bob, [1, 2, 3, 4])).toEqual([
      { event: 1, a: 60, b: 70, winner: 'b', gap: -10 },
      { event: 2, a: 50, b: 50, winner: 'draw', gap: -10 },
      { event: 3, a: 70, b: 45, winner: 'a', gap: 15 },
      { event: 4, a: 40, b: 52, winner: 'b', gap: 3 },
    ])
  })

  it('leaves weeks before a manager joined undecided and counts their total as 0', () => {
    const weeks = headToHeadWeeks(ann, cat, [1, 2, 3, 4])
    expect(weeks.map((w) => [w.b, w.winner, w.gap])).toEqual([
      [null, null, 60],
      [null, null, 110],
      [80, 'b', 100],
      [40, 'draw', 100],
    ])
  })
})

describe('headToHeadRecord', () => {
  it('counts wins, draws and the biggest win for each side', () => {
    expect(headToHeadRecord(headToHeadWeeks(ann, bob, [1, 2, 3, 4]))).toEqual({
      a: 1,
      b: 2,
      draws: 1,
      played: 4,
      biggestA: { event: 3, margin: 25 },
      biggestB: { event: 4, margin: 12 },
    })
  })

  it('only counts gameweeks both played', () => {
    const record = headToHeadRecord(headToHeadWeeks(ann, cat, [1, 2, 3, 4]))
    expect(record).toMatchObject({ a: 0, b: 1, draws: 1, played: 2, biggestA: null, biggestB: { event: 3, margin: 10 } })
  })

  it('handles no gameweeks', () => {
    expect(headToHeadRecord([])).toEqual({ a: 0, b: 0, draws: 0, played: 0, biggestA: null, biggestB: null })
  })
})

describe('sideStats', () => {
  it('sums the season from the history', () => {
    expect(sideStats(ann)).toEqual({
      total: 220,
      played: 4,
      best: { event: 3, points: 70 },
      average: 55,
      hits: 4,
      chips: [{ name: 'bboost', event: 3 }],
    })
  })

  it('averages over the gameweeks played', () => {
    expect(sideStats(cat)).toMatchObject({ played: 2, average: 60, best: { event: 3, points: 80 } })
  })

  it('copes with no history', () => {
    expect(sideStats(manager(9, 9, []))).toMatchObject({ played: 0, best: null, average: null, hits: 0, chips: [] })
  })
})

describe('defaultPair', () => {
  const table = [cat, bob, ann]

  it('compares my team with the manager above', () => {
    expect(defaultPair(table, 3)).toEqual({ a: 3, b: 2 })
  })

  it('compares the leader with second when no team is saved', () => {
    expect(defaultPair(table, null)).toEqual({ a: 1, b: 2 })
  })

  it('uses the requested ids when they are valid', () => {
    expect(defaultPair(table, null, { a: 2, b: 3 })).toEqual({ a: 2, b: 3 })
    expect(defaultPair(table, 3, { b: 1 })).toEqual({ a: 3, b: 1 })
  })

  it('ignores unknown ids and the same manager twice', () => {
    expect(defaultPair(table, null, { a: 99, b: 98 })).toEqual({ a: 1, b: 2 })
    expect(defaultPair(table, null, { a: 2, b: 2 })).toEqual({ a: 2, b: 1 })
  })

  it('needs two managers', () => {
    expect(defaultPair([ann], 1)).toBeNull()
  })
})

describe('gapSummary', () => {
  it('names the leader', () => {
    expect(gapSummary(23, 'Ann', 'Bob')).toBe('Ann leads by 23 points')
    expect(gapSummary(-1, 'Ann', 'Bob')).toBe('Bob leads by 1 point')
    expect(gapSummary(0, 'Ann', 'Bob')).toBe('Level on points')
  })
})
