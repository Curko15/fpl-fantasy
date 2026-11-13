import { describe, expect, it } from 'vitest'
import type { Player, Transfer } from './api'
import { market, verdict } from './transfers'

const player = (id: number): Player => ({ id, name: `P${id}`, team: 'X', position: 'MID', photo_code: null, team_code: null })

const t = (inId: number, outId: number, inPts: number | null, outPts: number | null): Transfer => ({
  entry_id: 1,
  event: 3,
  time: '2026-11-01T10:00:00Z',
  player_in: player(inId),
  in_cost: 60,
  player_out: player(outId),
  out_cost: 70,
  kind: 'free',
  in_points: inPts,
  out_points: outPts,
})

describe('market', () => {
  it('finds best and worst swaps, tallies players and counts what paid off', () => {
    const m = market([t(1, 2, 12, 1), t(1, 3, 2, 8), t(4, 2, 5, 5), t(5, 6, null, null)])
    expect(verdict(m.best!)).toBe(11)
    expect(verdict(m.worst!)).toBe(-6)
    expect(m.bought[0]).toMatchObject({ player: { id: 1 }, count: 2, price: 60 })
    expect(m.sold[0]).toMatchObject({ player: { id: 2 }, count: 2 })
    expect([m.decided, m.paidOff]).toEqual([3, 1])
  })

  it('has no worst move when nothing lost points', () => {
    expect(market([t(1, 2, 6, 2)]).worst).toBeNull()
  })
})
