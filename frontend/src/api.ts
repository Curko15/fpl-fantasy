export interface GameweekEntry {
  event: number
  points: number
  total: number
  league_rank: number
  overall_rank: number | null
  transfers_cost: number
  chip: string | null
}

export interface Manager {
  entry_id: number
  player_name: string
  team_name: string
  rank: number
  last_rank: number
  total: number
  event_total: number
  history: GameweekEntry[]
}

export interface LeagueOverview {
  league: { id: number; name: string; start_event: number }
  current_event: number | null
  events: number[]
  managers: Manager[]
  last_updated: string
}

export type ApiErrorCode =
  | 'not_found'
  | 'not_classic'
  | 'too_large'
  | 'fpl_unavailable'
  | 'network'
  | 'unknown'

export class ApiError extends Error {
  readonly code: ApiErrorCode

  constructor(code: ApiErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

export async function fetchLeague(leagueId: number): Promise<LeagueOverview> {
  let res: Response
  try {
    res = await fetch(`/api/leagues/${leagueId}`)
  } catch {
    throw new ApiError('network', "Couldn't reach the server. Check your connection.")
  }
  if (res.ok) return res.json()

  const body = await res.json().catch(() => null)
  const detail = body?.detail
  if (detail && typeof detail === 'object' && 'code' in detail) {
    throw new ApiError(detail.code, detail.message)
  }
  throw new ApiError('unknown', `Something went wrong (HTTP ${res.status}).`)
}
