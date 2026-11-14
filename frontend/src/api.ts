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
  photo_code: number | null
  team_code: number | null
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
  /** Points each player scored that gameweek; null until its live points are stored. */
  in_points: number | null
  out_points: number | null
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

export type AwardKey =
  | 'manager_of_week'
  | 'loser_of_week'
  | 'bench_loser'
  | 'lucky_sub'
  | 'vice_saviour'
  | 'captain_fail'
  | 'hit_regret'
  | 'sold_too_soon'
  | 'chip_flop'

export interface AwardWinner {
  entry_id: number
  value: number
  player: Player | null
  other_player: Player | null
  secondary: number | null
  chip: string | null
}

export interface Award {
  key: AwardKey
  winners: AwardWinner[]
  popular_captain: Player | null
  popular_captain_count: number | null
  popular_captain_points: number | null
  popular_captain_of: number | null
}

export interface LeagueAwards {
  gameweeks: { event: number; awards: Award[] }[]
  hall: { key: AwardKey; ranking: { entry_id: number; wins: number }[] }[]
  pending_events: number[]
}

export function fetchLeagueAwards(leagueId: number): Promise<LeagueAwards> {
  return getJson(`/api/leagues/${leagueId}/awards`)
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

/** Backend address in production (set on Vercel); empty locally, where Vite proxies /api. */
const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

async function getJson<T>(url: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(API_BASE + url)
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

export interface LiveManager {
  entry_id: number
  player_name: string
  team_name: string
  /** Live league rank, and the rank before this gameweek. */
  rank: number
  pre_rank: number
  /** Live gameweek points after hits (provisional, before auto-subs). */
  points: number
  transfers_cost: number
  total: number
  chip: string | null
  captain: Player | null
  captain_points: number
  /** Counting players whose team still has a match to kick off. */
  players_left: number
}

export interface LiveLeague {
  event: number | null
  /** True while `event` is being played. */
  live: boolean
  managers: LiveManager[]
  updated_at: string | null
}

/** `event` shows an earlier gameweek the same way (for checking the page while nothing is live). */
export function fetchLeagueLive(leagueId: number, event?: number): Promise<LiveLeague> {
  return getJson(`/api/leagues/${leagueId}/live${event ? `?event=${event}` : ''}`)
}
