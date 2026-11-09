import type { Manager, Transfer, TransferKind } from './api'

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
