import type { Manager, Player, Transfer, TransferKind } from './api'

export const CHIP_LABEL: Partial<Record<TransferKind, string>> = { wildcard: 'Wildcard', free_hit: 'Free Hit' }

export interface ManagerGameweek {
  manager: Manager
  transfers: Transfer[]
  chip: TransferKind | null
  hitCost: number
}

export interface TransferGameweek {
  event: number
  count: number
  cards: ManagerGameweek[]
}

/** Newest gameweek first; inside a gameweek, one card per manager in league order. */
export function groupTransfers(transfers: Transfer[], managers: Map<number, Manager>): TransferGameweek[] {
  const byEvent = new Map<number, Map<number, Transfer[]>>()
  for (const t of transfers) {
    const event = byEvent.get(t.event) ?? new Map<number, Transfer[]>()
    event.set(t.entry_id, [...(event.get(t.entry_id) ?? []), t])
    byEvent.set(t.event, event)
  }
  return [...byEvent.entries()]
    .sort(([a], [b]) => b - a)
    .map(([event, byManager]) => ({
      event,
      count: [...byManager.values()].reduce((n, ts) => n + ts.length, 0),
      cards: [...byManager.entries()]
        .map(([entryId, ts]): ManagerGameweek | null => {
          const manager = managers.get(entryId)
          if (!manager) return null
          const gw = manager.history.find((h) => h.event === event)
          const chip = ts.find((t) => CHIP_LABEL[t.kind])?.kind ?? null
          return { manager, transfers: ts, chip, hitCost: gw?.transfers_cost ?? 0 }
        })
        .filter((c): c is ManagerGameweek => c !== null)
        .sort((a, b) => a.manager.rank - b.manager.rank),
    }))
}

/** Points gained by the swap that gameweek (in minus out); null while unknown. */
export function verdict(t: Transfer): number | null {
  return t.in_points === null || t.out_points === null ? null : t.in_points - t.out_points
}

export interface PlayerTally {
  player: Player
  count: number
  price: number // latest price paid / received, tenths of a million
}

/** Players ranked by how often they appear, most first (ties: latest first). */
function tally(rows: { player: Player; price: number }[]): PlayerTally[] {
  const byId = new Map<number, PlayerTally>()
  for (const r of rows) {
    const t = byId.get(r.player.id)
    byId.set(r.player.id, t ? { ...t, count: t.count + 1 } : { player: r.player, count: 1, price: r.price })
  }
  return [...byId.values()].sort((a, b) => b.count - a.count)
}

export interface Market {
  best: Transfer | null // biggest points gain
  worst: Transfer | null // biggest points loss (only if it lost points)
  bought: PlayerTally[]
  sold: PlayerTally[]
  decided: number // swaps with known points
  paidOff: number // swaps that gained points
}

/** One gameweek's transfers, read as a market. `transfers` is newest first. */
export function market(transfers: Transfer[]): Market {
  const judged = transfers.filter((t) => verdict(t) !== null)
  const byGain = [...judged].sort((a, b) => verdict(b)! - verdict(a)!)
  const best = byGain[0] && verdict(byGain[0])! > 0 ? byGain[0] : null
  const last = byGain[byGain.length - 1]
  const worst = last && verdict(last)! < 0 ? last : null
  return {
    best,
    worst,
    bought: tally(transfers.map((t) => ({ player: t.player_in, price: t.in_cost }))),
    sold: tally(transfers.map((t) => ({ player: t.player_out, price: t.out_cost }))),
    decided: judged.length,
    paidOff: judged.filter((t) => verdict(t)! > 0).length,
  }
}
