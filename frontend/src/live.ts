import type { LiveLeague, LiveManager } from './api'

/** Refetch live scores every minute while a gameweek is being played. */
export const LIVE_REFRESH_MS = 60_000

export function liveRefetchInterval(data: LiveLeague | undefined): number | false {
  return data?.live ? LIVE_REFRESH_MS : false
}

/** Places gained since the gameweek started (negative = dropped). */
export function rankMove(m: Pick<LiveManager, 'rank' | 'pre_rank'>): number {
  return m.pre_rank - m.rank
}

export function moveLabel(move: number): { text: string; aria: string; tone: string } {
  if (move > 0) return { text: `▲${move}`, aria: `Up ${move}`, tone: 'text-up' }
  if (move < 0) return { text: `▼${-move}`, aria: `Down ${-move}`, tone: 'text-down' }
  return { text: '–', aria: 'No change', tone: 'text-muted' }
}

export interface Spotlight {
  manager: LiveManager
  isMe: boolean
  /** Points behind the team directly above (null when leading), or ahead of 2nd when leading. */
  gap: { kind: 'behind' | 'ahead'; points: number; team: string } | null
}

/** The row the live hero features: my team if picked, otherwise the leader. */
export function liveSpotlight(managers: LiveManager[], meId: number | null): Spotlight | null {
  if (managers.length === 0) return null
  const index = Math.max(0, managers.findIndex((m) => m.entry_id === meId))
  const manager = managers[index]
  const isMe = manager.entry_id === meId
  if (index > 0) {
    // The nearest team with more points (ties share a rank, so skip level teams).
    const above = managers.slice(0, index).reverse().find((m) => m.total > manager.total)
    if (above) return { manager, isMe, gap: { kind: 'behind', points: above.total - manager.total, team: above.team_name } }
  }
  const next = managers.find((m) => m.entry_id !== manager.entry_id)
  if (!next || manager.total < next.total) return { manager, isMe, gap: null }
  return { manager, isMe, gap: { kind: 'ahead', points: manager.total - next.total, team: next.team_name } }
}

export interface LiveStats {
  average: number
  top: number
  playersLeft: number
}

export function liveStats(managers: LiveManager[]): LiveStats {
  if (managers.length === 0) return { average: 0, top: 0, playersLeft: 0 }
  const points = managers.map((m) => m.points)
  return {
    average: Math.round(points.reduce((a, b) => a + b, 0) / points.length),
    top: Math.max(...points),
    playersLeft: managers.reduce((n, m) => n + m.players_left, 0),
  }
}
