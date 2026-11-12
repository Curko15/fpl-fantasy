import { useQuery } from '@tanstack/react-query'
import { fetchLeagueAwards, fetchLeagueTransfers, retryNetworkErrors } from './api'

/** League transfers: shared by the dashboard, Transfers tab and manager pages. */
export function useLeagueTransfers(leagueId: number) {
  return useQuery({
    queryKey: ['league', leagueId, 'transfers'],
    queryFn: () => fetchLeagueTransfers(leagueId),
    staleTime: 5 * 60_000,
    retry: retryNetworkErrors,
  })
}

/** League awards: shared by the dashboard and the Awards tab. */
export function useLeagueAwards(leagueId: number) {
  return useQuery({
    queryKey: ['league', leagueId, 'awards'],
    queryFn: () => fetchLeagueAwards(leagueId),
    staleTime: 5 * 60_000,
    retry: retryNetworkErrors,
    // Team data is fetched in the background after a league's first visit: keep checking.
    refetchInterval: (q) => (q.state.data?.pending_events.length ? 5000 : false),
  })
}
