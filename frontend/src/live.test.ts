import { describe, expect, it } from 'vitest'
import type { LiveManager } from './api'
import { liveRefetchInterval, liveSpotlight, liveStats, moveLabel, rankMove } from './live'

const row = (id: number, rank: number, preRank: number, total: number, extra: Partial<LiveManager> = {}): LiveManager => ({
  entry_id: id,
  player_name: `P${id}`,
  team_name: `Team ${id}`,
  rank,
  pre_rank: preRank,
  points: 50,
  transfers_cost: 0,
  total,
  chip: null,
  captain: null,
  captain_points: 0,
  players_left: 0,
  ...extra,
})

describe('liveRefetchInterval', () => {
  it('refreshes every minute only while live', () => {
    expect(liveRefetchInterval(undefined)).toBe(false)
    expect(liveRefetchInterval({ event: 10, live: false, managers: [], updated_at: null })).toBe(false)
    expect(liveRefetchInterval({ event: 11, live: true, managers: [], updated_at: null })).toBe(60_000)
  })
})

describe('rankMove / moveLabel', () => {
  it('counts places gained since the deadline', () => {
    expect(rankMove(row(1, 2, 5, 0))).toBe(3)
    expect(moveLabel(3)).toMatchObject({ text: '▲3', tone: 'text-up' })
    expect(moveLabel(-2)).toMatchObject({ text: '▼2', aria: 'Down 2', tone: 'text-down' })
    expect(moveLabel(0).text).toBe('–')
  })
})

describe('liveSpotlight', () => {
  const table = [row(1, 1, 2, 120), row(2, 2, 1, 110), row(3, 2, 3, 110), row(4, 4, 4, 90)]

  it('features my team with the gap to the nearest team above', () => {
    const s = liveSpotlight(table, 3)
    expect(s?.isMe).toBe(true)
    // Team 2 is level, so the gap is to the leader.
    expect(s?.gap).toEqual({ kind: 'behind', points: 10, team: 'Team 1' })
  })

  it('falls back to the leader and their lead over 2nd', () => {
    const s = liveSpotlight(table, null)
    expect(s?.manager.entry_id).toBe(1)
    expect(s?.isMe).toBe(false)
    expect(s?.gap).toEqual({ kind: 'ahead', points: 10, team: 'Team 2' })
  })

  it('handles a tie at the top and empty tables', () => {
    const tied = [row(1, 1, 1, 100), row(2, 1, 2, 100)]
    expect(liveSpotlight(tied, 2)?.gap).toEqual({ kind: 'ahead', points: 0, team: 'Team 1' })
    expect(liveSpotlight([], 1)).toBeNull()
  })
})

describe('liveStats', () => {
  it('sums players left and averages scores', () => {
    const stats = liveStats([
      row(1, 1, 1, 0, { points: 61, players_left: 3 }),
      row(2, 2, 2, 0, { points: 40, players_left: 1 }),
    ])
    expect(stats).toEqual({ average: 51, top: 61, playersLeft: 4 })
    expect(liveStats([])).toEqual({ average: 0, top: 0, playersLeft: 0 })
  })
})
