import { expect, it } from 'vitest'
import { parseLeagueId } from './parseLeagueId'

it.each([
  ['123456', 123456],
  ['  42 ', 42],
  ['https://fantasy.premierleague.com/leagues/314/standings/c', 314],
  ['fantasy.premierleague.com/leagues/999/standings/c?page=2', 999],
  ['abc', null],
  ['0', null],
  ['99999999999', null],
])('parseLeagueId(%j) -> %j', (input, expected) => {
  expect(parseLeagueId(input)).toBe(expected)
})
