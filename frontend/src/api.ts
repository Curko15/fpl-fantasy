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

export interface ChipDefinition {
  name: string
  start_event: number
  stop_event: number
}

export interface LeagueOverview {
  league: { id: number; name: string; start_event: number }
  current_event: number | null
  current_event_finished: boolean
  events: number[]
  managers: Manager[]
  chips: ChipDefinition[]
  last_updated: string
}

export type ApiErrorCode =
  | 'not_found'
  | 'not_classic'
  | 'too_large'
  | 'fpl_unavailable'
  | 'manager_not_found'
  | 'network'
  | 'unknown'

export class ApiError extends Error {
  readonly code: ApiErrorCode

  constructor(code: ApiErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

export interface Player {
  id: number
  name: string
  team: string
  position: string
}

export type TransferKind = 'free' | 'hit' | 'wildcard' | 'free_hit'

export interface Transfer {
  entry_id: number
  event: number
  time: string
  player_in: Player
  in_cost: number
  player_out: Player
  out_cost: number
  kind: TransferKind
}

export interface ManagerTransferSummary {
  entry_id: number
  transfers: number
  hits: number
  hit_cost: number
}

export interface LeagueTransfers {
  transfers: Transfer[]
  managers: ManagerTransferSummary[]
}

export interface Contributor {
  player: Player
  points: number
  captain_points: number
  starts: number
  captained: number
}

export interface GameweekDetail {
  event: number
  points: number
  total: number
  league_rank: number
  overall_rank: number | null
  transfers_cost: number
  chip: string | null
  bench_points: number
  captain: Player | null
  captain_points: number
}

export interface ManagerDetail {
  manager: Manager
  contributors: Contributor[]
  gameweeks: GameweekDetail[]
  provisional_event: number | null
}

export function fetchManager(leagueId: number, entryId: number): Promise<ManagerDetail> {
  return getJson(`/api/leagues/${leagueId}/managers/${entryId}`)
}

export function fetchLeague(leagueId: number): Promise<LeagueOverview> {
  return getJson(`/api/leagues/${leagueId}`)
}

export function fetchLeagueTransfers(leagueId: number): Promise<LeagueTransfers> {
  return getJson(`/api/leagues/${leagueId}/transfers`)
}

/** FPL prices are in tenths of a million. */
export function formatPrice(cost: number): string {
  return `£${(cost / 10).toFixed(1)}m`
}

/** Only retry when the network blipped; FPL errors are already retried server-side. */
export function retryNetworkErrors(count: number, error: unknown): boolean {
  return error instanceof ApiError && error.code === 'network' && count < 2
}

async function getJson<T>(url: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(url)
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
