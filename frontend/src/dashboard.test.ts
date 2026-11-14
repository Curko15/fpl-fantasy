import { describe, expect, it } from 'vitest'
import type { GameweekEntry, Manager, Player, Transfer } from './api'
import { gameweekSummary, rankForm, transferPulse } from './dashboard'

const gw = (event: number, points: number, rank = 1, cost = 0): GameweekEntry => ({
  event,
  points,
  total: 0,
  league_rank: rank,
  overall_rank: null,
  transfers_cost: cost,
  chip: null,
})

const manager = (id: number, history: GameweekEntry[]): Manager => ({
  entry_id: id,
  player_name: `P${id}`,
  team_name: `T${id}`,
  rank: id,
  last_rank: id,
  total: 0,
  event_total: 0,
  history,
})

const player = (id: number): Player => ({ id, name: `Pl${id}`, team: 'X', position: 'MID', photo_code: null, team_code: null })

const transfer = (event: number, inId: number, outId: number): Transfer => ({
  entry_id: 1,
  event,
  time: '2026-11-01T10:00:00Z',
  player_in: player(inId),
  in_cost: 50,
  player_out: player(outId),
  out_cost: 50,
  kind: 'free',
})

describe('gameweekSummary', () => {
  it('finds top (with ties), lowest, average and hits for the gameweek', () => {
    const managers = [
      manager(1, [gw(1, 70), gw(2, 50)]),
      manager(2, [gw(1, 70, 1, 4), gw(2, 40)]),
      manager(3, [gw(1, 41, 1, 8)]),
      manager(4, [gw(2, 99)]), // joined later: not in GW1
    ]
    const s = gameweekSummary(managers, 1)!
    expect(s.top.map((t) => t.manager.entry_id)).toEqual([1, 2])
    expect([s.lowest, s.average, s.hits]).toEqual([41, 60, 12])
    expect(gameweekSummary(managers, 5)).toBeNull()
  })
})

describe('rankForm', () => {
  it('returns ranks for the last N events, oldest first', () => {
    const m = manager(1, [gw(1, 0, 5), gw(2, 0, 4), gw(3, 0, 2), gw(4, 0, 1)])
    expect(rankForm(m, [1, 2, 3, 4], 3)).toEqual([4, 2, 1])
  })
})

describe('transferPulse', () => {
  it('counts the latest gameweek only', () => {
    const pulse = transferPulse([transfer(3, 10, 20), transfer(3, 10, 21), transfer(3, 11, 20), transfer(2, 12, 22)])!
    expect(pulse.event).toBe(3)
    expect([pulse.mostBought?.player.id, pulse.mostBought?.count]).toEqual([10, 2])
    expect([pulse.mostSold?.player.id, pulse.mostSold?.count]).toEqual([20, 2])
    expect(pulse.latest).toHaveLength(3)
    expect(transferPulse([])).toBeNull()
  })
})
