import { describe, expect, it } from 'vitest'
import type { GameweekEntry, Manager } from './api'
import { focusTeams, ordinal, quantile, raceFrame, racePool, scoreSpread, seasonRows, spreadStats } from './seasonCharts'

const gw = (event: number, points: number, total: number, rank: number): GameweekEntry => ({
  event,
  points,
  total,
  league_rank: rank,
  overall_rank: null,
  transfers_cost: 0,
  chip: null,
})

const manager = (id: number, rank: number, history: GameweekEntry[] = []): Manager => ({
  entry_id: id,
  player_name: `P${id}`,
  team_name: `T${id}`,
  rank,
  last_rank: rank,
  total: 0,
  event_total: 0,
  history,
})

/** A league of `n` managers where entry id equals current rank. */
const table = (n: number) => Array.from({ length: n }, (_, i) => manager(i + 1, i + 1))

describe('ordinal', () => {
  it('handles teens and the usual suffixes', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st', '111th',
    ])
  })
})

describe('focusTeams', () => {
  it('picks the leader and two above and below', () => {
    expect(focusTeams(table(50), 23)).toEqual([1, 21, 22, 24, 25])
  })

  it('keeps the one manager below when second to last', () => {
    expect(focusTeams(table(11), 10)).toEqual([1, 7, 8, 9, 11])
  })

  it('fills from the other side near the top and bottom', () => {
    expect(focusTeams(table(50), 1)).toEqual([2, 3, 4, 5])
    expect(focusTeams(table(50), 2)).toEqual([1, 3, 4, 5, 6])
    expect(focusTeams(table(50), 3)).toEqual([1, 2, 4, 5, 6])
    expect(focusTeams(table(50), 50)).toEqual([1, 46, 47, 48, 49])
  })

  it('highlights everyone in a small league', () => {
    expect(focusTeams(table(5), 3)).toEqual([1, 2, 4, 5])
  })

  it('returns nothing for an unknown manager', () => {
    expect(focusTeams(table(50), 99)).toEqual([])
  })
})

describe('seasonRows', () => {
  const managers = [
    manager(1, 1, [gw(1, 60, 60, 2), gw(2, 70, 130, 1)]),
    manager(2, 2, [gw(1, 65, 65, 1), gw(2, 50, 115, 2)]),
    manager(3, 3, [gw(2, 40, 40, 3)]), // joined in GW2
  ]

  it('measures the gap to that week’s top total', () => {
    expect(seasonRows(managers, [1, 2], 'behind')).toEqual([
      { event: 1, 1: 5, 2: 0 },
      { event: 2, 1: 0, 2: 15, 3: 90 },
    ])
  })

  it('uses league rank for position', () => {
    expect(seasonRows(managers, [1], 'position')).toEqual([{ event: 1, 1: 2, 2: 1 }])
  })
})

describe('quantile', () => {
  it('interpolates between neighbours', () => {
    expect(quantile([10, 20, 30, 40], 0.5)).toBe(25)
    expect(quantile([10, 20, 30, 40, 50], 0.25)).toBe(20)
    expect(quantile([7], 0.75)).toBe(7)
  })
})

describe('scoreSpread and spreadStats', () => {
  const managers = [
    manager(1, 1, [gw(1, 80, 80, 1), gw(2, 30, 110, 2), gw(3, 50, 160, 1)]),
    manager(2, 2, [gw(1, 40, 40, 3), gw(2, 70, 110, 1), gw(3, 50, 160, 2)]),
    manager(3, 3, [gw(1, 60, 60, 2), gw(2, 50, 110, 3), gw(3, 40, 150, 3)]),
  ]

  it('summarises each week and my place in it', () => {
    const weeks = scoreSpread(managers, [1, 2, 3], 1)
    expect(weeks.map((w) => [w.median, w.p25, w.p75])).toEqual([[60, 50, 70], [50, 40, 60], [50, 45, 50]])
    expect(weeks.map((w) => w.mine)).toEqual([
      { points: 80, rank: 1 },
      { points: 30, rank: 3 },
      { points: 50, rank: 1 }, // shares the top score
    ])
  })

  it('counts weeks strictly above the median and finds best and worst', () => {
    const stats = spreadStats(scoreSpread(managers, [1, 2, 3], 1))
    expect(stats.aboveMedian).toBe(1)
    expect(stats.played).toBe(3)
    expect(stats.best).toEqual({ event: 1, points: 80, rank: 1, of: 3 })
    expect(stats.worst).toEqual({ event: 2, points: 30, rank: 3, of: 3 })
  })

  it('has no highlights when I never played', () => {
    expect(spreadStats(scoreSpread(managers, [1], 99))).toEqual({ aboveMedian: 0, played: 0, best: null, worst: null })
  })
})

describe('race', () => {
  // Top 2 race. Entry 3 was 2nd in GW1, entry 4 ("me") never made the top 2.
  const managers = [
    manager(1, 1, [gw(1, 50, 50, 1), gw(2, 80, 130, 1)]),
    manager(2, 2, [gw(1, 30, 30, 3), gw(2, 90, 120, 2)]),
    manager(3, 3, [gw(1, 40, 40, 2), gw(2, 40, 80, 3)]),
    manager(4, 4, [gw(1, 20, 20, 4), gw(2, 40, 60, 4)]),
    manager(5, 5, [gw(1, 10, 10, 5), gw(2, 10, 20, 5)]),
  ]

  it('pools everyone ever in the top, plus me', () => {
    expect(racePool(managers, 4, 2)).toEqual([1, 2, 3, 4])
    expect(racePool(managers, null, 2)).toEqual([1, 2, 3])
  })

  it('places bars by that week’s rank and scales widths to the shown range', () => {
    const frame = raceFrame(managers, racePool(managers, 4, 2), 2, 4, 2)
    expect(frame.map((b) => [b.entryId, b.slot, b.visible])).toEqual([
      [1, 0, true],
      [2, 1, true],
      [3, 3.5, false],
      [4, 2.4, true],
    ])
    expect(frame.map((b) => Math.round(b.width))).toEqual([100, 91, 0, 40])
  })
})
