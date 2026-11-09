import { useOutletContext } from 'react-router-dom'
import type { LeagueOverview } from '../api'

export interface LeagueContext {
  league: LeagueOverview
}

/** League data loaded by LeagueLayout, available to every league tab. */
export function useLeague(): LeagueContext {
  return useOutletContext<LeagueContext>()
}
