import { useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { LeagueOverview } from '../api'
import { useMyTeam } from '../myTeam'

export interface LeagueContext {
  league: LeagueOverview
}

/** League data loaded by LeagueLayout, available to every league tab. */
export function useLeague(): LeagueContext {
  return useOutletContext<LeagueContext>()
}

/** The team picked as "mine" in this league (null until picked), and a setter. */
export function useMe(): [number | null, (entryId: number | null) => void] {
  const { league } = useLeague()
  const ids = useMemo(() => league.managers.map((m) => m.entry_id), [league.managers])
  return useMyTeam(league.league.id, ids)
}
