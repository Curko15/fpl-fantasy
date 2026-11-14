import { describe, expect, it } from 'vitest'
import type { ChipDefinition, GameweekEntry, Manager } from './api'
import { chipHalfCards, chipHalves } from './chips'

const defs: ChipDefinition[] = [
  { name: 'wildcard', start_event: 2, stop_event: 19 },
  { name: 'wildcard', start_event: 20, stop_event: 38 },
  { name: '3xc', start_event: 1, stop_event: 19 },
  { name: '3xc', start_event: 20, stop_event: 38 },
]

const gw = (event: number, points: number, chip: string | null = null): GameweekEntry => ({
  event, points, total: 0, league_rank: 1, overall_rank: null, transfers_cost: 0, chip,
})
const manager = (id: number, history: GameweekEntry[]): Manager => ({
  entry_id: id, player_name: `P${id}`, team_name: `T${id}`, rank: id, last_rank: id, total: 0, event_total: 0, history,
})

describe('chip halves', () => {
  it('splits the season into windows', () => {
    expect(chipHalves(defs)).toEqual([{ start: 1, stop: 19 }, { start: 20, stop: 38 }])
  })

  it('summarises plays, best, average and holders for a window', () => {
    const managers = [
      manager(1, [gw(3, 80, '3xc'), gw(5, 60, 'wildcard')]),
      manager(2, [gw(4, 50, '3xc')]),
      manager(3, [gw(4, 40)]),
    ]
    const [wc, tc] = chipHalfCards(managers, defs, { start: 1, stop: 19 }, 6)
    expect(tc.name).toBe('3xc')
    expect(tc.plays.map((p) => p.manager.entry_id)).toEqual([1, 2])
    expect([tc.best?.points, tc.average]).toEqual([80, 65])
    expect(tc.holders.map((m) => m.entry_id)).toEqual([3])
    expect(wc.holders.map((m) => m.entry_id)).toEqual([2, 3])
  })
})
