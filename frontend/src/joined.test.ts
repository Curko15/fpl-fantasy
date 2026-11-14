import { describe, expect, it } from 'vitest'
import type { GameweekEntry, Manager } from './api'
import { joinedEvent, lateJoiners, lateJoinersNote } from './joined'

const gw = (event: number): GameweekEntry => ({
  event,
  points: 50,
  total: 50 * event,
  league_rank: 1,
  overall_rank: null,
  transfers_cost: 0,
  chip: null,
})

const manager = (id: number, events: number[]): Manager => ({
  entry_id: id,
  player_name: `P${id}`,
  team_name: `T${id}`,
  rank: id,
  last_rank: id,
  total: 0,
  event_total: 0,
  history: events.map(gw),
})

describe('joinedEvent', () => {
  it('is null for a manager there from the first played gameweek', () => {
    expect(joinedEvent(manager(1, [1, 2, 3]), [1, 2, 3])).toBeNull()
  })

  it('returns the first gameweek of a mid-season joiner', () => {
    expect(joinedEvent(manager(1, [9, 10]), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(9)
  })

  it('measures from the league start, not GW1', () => {
    const events = [5, 6, 7, 8]
    expect(joinedEvent(manager(1, [3, 4, 5, 6, 7, 8]), events)).toBeNull() // history before the league started
    expect(joinedEvent(manager(2, [7, 8]), events)).toBe(7)
  })

  it('is null without played gameweeks or history', () => {
    expect(joinedEvent(manager(1, [1, 2]), [])).toBeNull()
    expect(joinedEvent(manager(1, []), [1, 2])).toBeNull()
  })

  it('does not care about history order', () => {
    expect(joinedEvent(manager(1, [4, 3]), [1, 2, 3, 4])).toBe(3)
  })
})

describe('lateJoiners', () => {
  it('maps only the late joiners to their first gameweek', () => {
    const late = lateJoiners([manager(1, [1, 2, 3]), manager(2, [3]), manager(3, [2, 3])], [1, 2, 3])
    expect([...late]).toEqual([
      [2, 3],
      [3, 2],
    ])
  })
})

describe('lateJoinersNote', () => {
  const events = [1, 2, 3, 4]
  it('is null when everyone started together', () => {
    expect(lateJoinersNote([manager(1, events), manager(2, events)], events)).toBeNull()
  })

  it('names one or two late joiners, best rank first', () => {
    expect(lateJoinersNote([manager(1, events), manager(2, [3, 4])], events)).toBe(
      'T2 joined in GW3, so their line starts there.',
    )
    expect(lateJoinersNote([manager(3, [4]), manager(2, [3, 4])], events)).toBe(
      'T2 joined in GW3 and T3 joined in GW4, so their lines start there.',
    )
  })

  it('counts three or more', () => {
    const late = [manager(1, [2]), manager(2, [3]), manager(3, [4])]
    expect(lateJoinersNote(late, events)).toBe('3 managers joined after GW1, so their lines start later.')
  })
})
