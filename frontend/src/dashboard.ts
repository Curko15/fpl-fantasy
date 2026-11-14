import type { LeagueOverview, Manager, Player, Transfer } from './api'
import { chipColumns, managerChipSlots } from './chips'

export interface GameweekSummary {
  event: number
  top: { manager: Manager; points: number }[] // several on a tie
  lowest: number
  average: number
  hits: number // points spent on hits across the league
}

/** Headline numbers for one gameweek, from the managers who played it. */
export function gameweekSummary(managers: Manager[], event: number): GameweekSummary | null {
  const played = managers.flatMap((m) => {
    const gw = m.history.find((h) => h.event === event)
    return gw ? [{ manager: m, points: gw.points, cost: gw.transfers_cost }] : []
  })
  if (played.length === 0) return null
  const best = Math.max(...played.map((p) => p.points))
  return {
    event,
    top: played.filter((p) => p.points === best).map(({ manager, points }) => ({ manager, points })),
    lowest: Math.min(...played.map((p) => p.points)),
    average: Math.round(played.reduce((n, p) => n + p.points, 0) / played.length),
    hits: played.reduce((n, p) => n + p.cost, 0),
  }
}

/** League rank over the last `count` gameweeks the manager played, oldest first. */
export function rankForm(manager: Manager, events: number[], count = 6): number[] {
  const recent = events.slice(-count)
  return manager.history.filter((h) => recent.includes(h.event)).map((h) => h.league_rank)
}

export interface PlayerCount {
  player: Player
  count: number
}

export interface TransferPulse {
  event: number
  mostBought: PlayerCount | null
  mostSold: PlayerCount | null
  latest: Transfer[]
}

function mostCommon(players: Player[]): PlayerCount | null {
  const counts = new Map<number, PlayerCount>()
  for (const p of players) {
    const c = counts.get(p.id)
    counts.set(p.id, { player: p, count: (c?.count ?? 0) + 1 })
  }
  let best: PlayerCount | null = null
  for (const c of counts.values()) if (!best || c.count > best.count) best = c
  return best
}

/**
 * Who the league bought and sold most in the latest gameweek with transfers.
 * `transfers` is newest first, as the API returns it.
 */
export function transferPulse(transfers: Transfer[], latestCount = 3): TransferPulse | null {
  if (transfers.length === 0) return null
  const event = transfers[0].event
  const week = transfers.filter((t) => t.event === event)
  return {
    event,
    mostBought: mostCommon(week.map((t) => t.player_in)),
    mostSold: mostCommon(week.map((t) => t.player_out)),
    latest: transfers.slice(0, latestCount),
  }
}

/** For each chip, how many copies the league can still play (now or later this season). */
export function chipsLeft(league: LeagueOverview): { name: string; left: number }[] {
  const columns = chipColumns(league.chips)
  const nextEvent = (league.current_event ?? 0) + 1
  return columns.map((column) => ({
    name: column.name,
    left: league.managers.reduce((n, m) => {
      const slots = managerChipSlots(m, [column], nextEvent).get(column.name) ?? []
      return n + slots.filter((s) => s.state === 'available' || s.state === 'later').length
    }, 0),
  }))
}
