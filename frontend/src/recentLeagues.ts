// "Recent leagues" live only in this browser. Storage can be unavailable
// (private mode, blocked site data), so every access is guarded.

const KEY = 'recentLeagues'
const MAX = 6

export interface RecentLeague {
  id: number
  name: string
}

export function getRecentLeagues(): RecentLeague[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function rememberLeague(league: RecentLeague): void {
  try {
    const rest = getRecentLeagues().filter((l) => l.id !== league.id)
    localStorage.setItem(KEY, JSON.stringify([league, ...rest].slice(0, MAX)))
  } catch {
    // ignore: recent leagues are a convenience
  }
}

export function forgetLeague(id: number): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(getRecentLeagues().filter((l) => l.id !== id)))
  } catch {
    // ignore
  }
}
