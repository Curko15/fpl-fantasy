import { useCallback, useSyncExternalStore } from 'react'

// "My team" is picked once per league and lives only in this browser.
// Storage can be unavailable (private mode, blocked site data), so every access is guarded.

const CHANGE = 'myteamchange'
const key = (leagueId: number) => `myTeam:${leagueId}`

export function getMyTeam(leagueId: number): number | null {
  try {
    const id = Number(localStorage.getItem(key(leagueId)))
    return Number.isInteger(id) && id > 0 ? id : null
  } catch {
    return null
  }
}

export function setMyTeam(leagueId: number, entryId: number | null): void {
  try {
    if (entryId === null) localStorage.removeItem(key(leagueId))
    else localStorage.setItem(key(leagueId), String(entryId))
  } catch {
    // ignore: the choice just won't survive a reload
  }
  window.dispatchEvent(new Event(CHANGE))
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(CHANGE, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(CHANGE, cb)
    window.removeEventListener('storage', cb)
  }
}

/**
 * The saved team for this league, or null when none is saved or the saved
 * manager is no longer in the league.
 */
export function useMyTeam(leagueId: number, entryIds: number[]): [number | null, (id: number | null) => void] {
  const saved = useSyncExternalStore(subscribe, () => getMyTeam(leagueId))
  const set = useCallback((id: number | null) => setMyTeam(leagueId, id), [leagueId])
  return [saved !== null && entryIds.includes(saved) ? saved : null, set]
}
