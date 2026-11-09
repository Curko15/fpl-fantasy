import { describe, expect, it } from 'vitest'
import type { ChipDefinition, GameweekEntry, Manager } from './api'
import { chipColumns, chipLabel, managerChipSlots } from './chips'

const DEFS: ChipDefinition[] = [
  { name: 'wildcard', start_event: 2, stop_event: 19 },
  { name: 'wildcard', start_event: 20, stop_event: 38 },
  { name: 'bboost', start_event: 1, stop_event: 19 },
  { name: 'bboost', start_event: 20, stop_event: 38 },
  { name: 'freehit', start_event: 2, stop_event: 19 },
  { name: 'freehit', start_event: 20, stop_event: 38 },
  { name: 'mystery', start_event: 1, stop_event: 38 },
]

function gw(event: number, points: number, chip: string | null = null): GameweekEntry {
  return { event, points, total: 0, league_rank: 1, overall_rank: null, transfers_cost: 0, chip }
}

function manager(history: GameweekEntry[]): Manager {
  return { entry_id: 1, player_name: 'P', team_name: 'T', rank: 1, last_rank: 1, total: 0, event_total: 0, history }
}

describe('chipColumns', () => {
  it('groups by name in a stable order, unknown chips last', () => {
    expect(chipColumns(DEFS).map((c) => c.name)).toEqual(['wildcard', 'freehit', 'bboost', 'mystery'])
  })

  it('labels unknown chips from their API name', () => {
    expect(chipLabel('mystery')).toEqual({ label: 'mystery', short: 'MYS' })
  })
})

describe('managerChipSlots', () => {
  const columns = chipColumns(DEFS)

  it('marks used, available, not-yet and expired copies', () => {
    const m = manager([gw(3, 60, 'wildcard'), gw(5, 90, 'bboost')])
    const slots = managerChipSlots(m, columns, 11)
    expect(slots.get('wildcard')).toEqual([
      { state: 'used', event: 3, points: 60 },
      { state: 'later', from: 20 },
    ])
    expect(slots.get('freehit')).toEqual([
      { state: 'available', until: 19 },
      { state: 'later', from: 20 },
    ])
    expect(slots.get('bboost')![0]).toEqual({ state: 'used', event: 5, points: 90 })
  })

  it('expires first-half chips once their window has passed', () => {
    const slots = managerChipSlots(manager([]), columns, 21)
    expect(slots.get('freehit')).toEqual([{ state: 'expired' }, { state: 'available', until: 38 }])
  })

  it('puts a play into the copy whose window contains it', () => {
    const slots = managerChipSlots(manager([gw(25, 70, 'wildcard')]), columns, 26)
    expect(slots.get('wildcard')).toEqual([{ state: 'expired' }, { state: 'used', event: 25, points: 70 }])
  })
})
