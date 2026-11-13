import { describe, expect, it } from 'vitest'
import type { Award, AwardKey, AwardWinner, GameweekEntry, Manager } from './api'
import { recapHeadline, recapMoments, standingsAfter } from './recap'

const gw = (event: number, points: number, total: number, rank: number, extra: Partial<GameweekEntry> = {}): GameweekEntry => ({
  event,
  points,
  total,
  league_rank: rank,
  overall_rank: null,
  transfers_cost: 0,
  chip: null,
  ...extra,
})

const manager = (id: number, name: string, history: GameweekEntry[]): Manager => ({
  entry_id: id,
  player_name: `P${id}`,
  team_name: name,
  rank: 0,
  last_rank: 0,
  total: 0,
  event_total: 0,
  history,
})

const winner = (entryId: number, value: number, extra: Partial<AwardWinner> = {}): AwardWinner => ({
  entry_id: entryId,
  value,
  player: null,
  other_player: null,
  secondary: null,
  chip: null,
  ...extra,
})

const award = (key: AwardKey, winners: AwardWinner[]): Award => ({
  key,
  winners,
  popular_captain: null,
  popular_captain_count: null,
  popular_captain_points: null,
  popular_captain_of: null,
})

// GW1 order: Ann, Bob, Cat, Dan. In GW2 Dan scores the week's best and climbs to 2nd.
const league = [
  manager(1, 'Ann', [gw(1, 70, 70, 1), gw(2, 50, 120, 1)]),
  manager(2, 'Bob', [gw(1, 65, 65, 2), gw(2, 40, 105, 3, { transfers_cost: 4 })]),
  manager(3, 'Cat', [gw(1, 60, 60, 3), gw(2, 30, 90, 4, { chip: 'bboost' })]),
  manager(4, 'Dan', [gw(1, 40, 40, 4), gw(2, 75, 115, 2)]),
]

describe('standingsAfter', () => {
  it('orders by rank and measures movement', () => {
    const table = standingsAfter(league, [1, 2], 2)
    expect(table.map((s) => [s.manager.team_name, s.rank, s.move])).toEqual([
      ['Ann', 1, 0],
      ['Dan', 2, 2],
      ['Bob', 3, -1],
      ['Cat', 4, -1],
    ])
    expect(standingsAfter(league, [1, 2], 1)[0].move).toBeNull()
  })
})

describe('recapHeadline', () => {
  it('celebrates a big climb by the top scorer', () => {
    expect(recapHeadline(standingsAfter(league, [1, 2], 2), 2)).toEqual({
      title: "Dan storms to 2nd with the week's best 75",
      subtitle: 'Ann stays top, 5 points clear of Dan.',
    })
  })

  it('says when the leader changes hands', () => {
    const swap = [
      manager(1, 'Ann', [gw(1, 70, 70, 1), gw(2, 40, 110, 2)]),
      manager(2, 'Bob', [gw(1, 65, 65, 2), gw(2, 52, 117, 1)]),
    ]
    expect(recapHeadline(standingsAfter(swap, [1, 2], 2), 2)).toEqual({
      title: "Bob goes top with the week's best 52",
      subtitle: 'Bob takes top spot from Ann, ahead by 7 points.',
    })
  })

  it('handles a shared top score and a quiet week', () => {
    const tie = [manager(1, 'Ann', [gw(1, 60, 60, 1)]), manager(2, 'Bob', [gw(1, 60, 60, 1)]), manager(3, 'Cat', [gw(1, 20, 20, 3)])]
    expect(recapHeadline(standingsAfter(tie, [1], 1), 1)?.title).toBe("Ann and Bob share the week's best 60")
    const quiet = [manager(1, 'Ann', [gw(1, 60, 60, 1)]), manager(2, 'Bob', [gw(1, 50, 50, 2)])]
    expect(recapHeadline(standingsAfter(quiet, [1], 1), 1)?.title).toBe('Ann tops GW1 with 60')
    expect(recapHeadline([], 1)).toBeNull()
  })
})

describe('recapMoments', () => {
  const table = standingsAfter(league, [1, 2], 2)

  it('tells the week in story order, without repeating what awards already say', () => {
    const awards = [
      award('manager_of_week', [winner(4, 75)]),
      award('loser_of_week', [winner(3, 30)]),
      award('captain_fail', [winner(1, 2, { player: { id: 9, name: 'Salah', team: 'LIV', position: 'MID', photo_code: null, team_code: null } })]),
    ]
    const moments = recapMoments(table, awards, 2)
    expect(moments.map((m) => [m.kind, m.title, m.value])).toEqual([
      ['manager_of_week', 'Dan', '75'], // Dan's climb is told here, not as a separate moment
      ['chip', 'Cat played Bench Boost', '30'],
      ['captain_fail', 'Ann', '2'],
      ['hit', 'Bob', '−4'],
      ['loser_of_week', 'Cat', '30'],
    ])
    expect(moments[0].detail).toBe('Up from 4th to 2nd.')
    expect(moments[3].detail).toBe('40 points, 36 after the hit.')
  })

  it('still has moments before awards arrive', () => {
    const moments = recapMoments(table, undefined, 2)
    expect(moments.map((m) => m.kind)).toEqual(['climb', 'chip', 'hit'])
  })
})
