import LeagueChart from '../components/LeagueChart'
import StandingsTable from '../components/StandingsTable'
import { useLeague } from './leagueContext'

export default function OverviewTab() {
  const { league } = useLeague()
  return (
    <>
      <section aria-labelledby="standings-heading">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 id="standings-heading" className="text-lg font-semibold">
            Standings
          </h2>
          <span className="text-xs text-muted">Tap a manager for details</span>
        </div>
        <StandingsTable managers={league.managers} currentEvent={league.current_event} />
      </section>

      <section className="mt-8" aria-labelledby="chart-heading">
        <h2 id="chart-heading" className="mb-3 text-lg font-semibold">
          Season so far
        </h2>
        <LeagueChart managers={league.managers} events={league.events} />
      </section>
    </>
  )
}
