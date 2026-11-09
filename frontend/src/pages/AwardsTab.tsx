import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchLeagueAwards, retryNetworkErrors, type Award, type LeagueAwards, type Manager } from '../api'
import { AWARDS, awardNote } from '../awards'
import { ErrorCard, Loading } from '../components/Status'
import { useLeague } from './leagueContext'

export default function AwardsTab() {
  const { league } = useLeague()
  const [params, setParams] = useSearchParams()

  const query = useQuery({
    queryKey: ['league', league.league.id, 'awards'],
    queryFn: () => fetchLeagueAwards(league.league.id),
    staleTime: 5 * 60_000,
    retry: retryNetworkErrors,
    // Team data is fetched in the background after a league's first visit: keep checking.
    refetchInterval: (q) => (q.state.data?.pending_events.length ? 5000 : false),
  })

  const managers = useMemo(() => new Map(league.managers.map((m) => [m.entry_id, m])), [league.managers])

  if (query.isError) {
    return <ErrorCard title="Can't load awards" error={query.error} onRetry={() => query.refetch()} />
  }
  if (!query.data) return <Loading title="Loading awards…" />

  const data = query.data
  const requested = Number(params.get('gw'))
  const selected = data.gameweeks.find((g) => g.event === requested) ?? data.gameweeks[0]

  return (
    <>
      {data.pending_events.length > 0 && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-2 text-xs text-ink-2" role="status">
          <span className="size-3 shrink-0 animate-spin rounded-full border-2 border-line border-t-accent" />
          Collecting team data for {data.pending_events.length} gameweek
          {data.pending_events.length === 1 ? '' : 's'}. More awards will appear shortly.
        </p>
      )}

      {data.gameweeks.length === 0 && data.pending_events.length === 0 && (
        <p className="rounded-xl border border-line bg-card p-4 text-sm text-ink-2">
          Awards are handed out once a gameweek is finished. Check back after the first one.
        </p>
      )}

      {selected && (
        <section aria-labelledby="gw-awards-heading">
          <h2 id="gw-awards-heading" className="text-lg font-semibold">
            Gameweek awards
          </h2>
          <nav aria-label="Gameweek" className="-mx-4 mt-2 overflow-x-auto px-4 [scrollbar-width:none]">
            <ul className="flex gap-2">
              {data.gameweeks.map((g) => (
                <li key={g.event}>
                  <button
                    type="button"
                    aria-pressed={g.event === selected.event}
                    onClick={() =>
                      setParams(
                        (prev) => {
                          const next = new URLSearchParams(prev)
                          next.set('gw', String(g.event))
                          return next
                        },
                        { replace: true },
                      )
                    }
                    className={`h-10 rounded-full border px-4 text-sm font-medium whitespace-nowrap ${
                      g.event === selected.event
                        ? 'border-accent bg-accent text-accent-ink'
                        : 'border-line bg-card text-ink-2'
                    }`}
                  >
                    GW{g.event}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {selected.awards.map((award) => (
              <AwardCard key={award.key} award={award} managers={managers} />
            ))}
          </ul>
        </section>
      )}

      {data.gameweeks.length > 0 && <Hall data={data} managers={managers} />}
    </>
  )
}

function AwardCard({ award, managers }: { award: Award; managers: Map<number, Manager> }) {
  const meta = AWARDS[award.key]
  const note = awardNote(award)
  return (
    <li className="rounded-xl border border-line bg-card p-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl leading-none" aria-hidden>
          {meta.emoji}
        </span>
        <h3 className="font-semibold">{meta.title}</h3>
      </div>
      <ul className="mt-2 space-y-2">
        {award.winners.map((w) => {
          const m = managers.get(w.entry_id)
          return (
            <li key={`${w.entry_id}-${w.player?.id ?? ''}`}>
              <Link to={`../manager/${w.entry_id}`} className="block truncate font-medium text-accent">
                {m?.team_name ?? `Manager ${w.entry_id}`}
              </Link>
              <p className="text-sm text-ink-2">{meta.describe(w)}</p>
            </li>
          )
        })}
      </ul>
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
    </li>
  )
}

function Hall({ data, managers }: { data: LeagueAwards; managers: Map<number, Manager> }) {
  const groups = [
    { title: 'Hall of Fame', fame: true },
    { title: 'Hall of Shame', fame: false },
  ]
  const finished = data.gameweeks.length
  return (
    <section className="mt-10" aria-label="Season awards">
      <p className="text-xs text-muted">
        Season totals over {finished} finished gameweek{finished === 1 ? '' : 's'}.
      </p>
      {groups.map((group) => (
        <div key={group.title} className="mt-4">
          <h2 className="text-lg font-semibold">{group.title}</h2>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
            {data.hall
              .filter((h) => AWARDS[h.key].fame === group.fame)
              .map((h) => {
                const meta = AWARDS[h.key]
                const top = h.ranking[0]?.wins ?? 0
                const leaders = h.ranking.filter((r) => r.wins === top)
                return (
                  <li key={h.key}>
                    <details className="group">
                      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
                        <span className="text-xl leading-none" aria-hidden>
                          {meta.emoji}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{meta.title}</span>
                          <span className="block truncate text-xs text-muted">
                            {top === 0
                              ? 'Nobody yet'
                              : leaders.map((r) => managers.get(r.entry_id)?.team_name ?? r.entry_id).join(', ')}
                          </span>
                        </span>
                        {top > 0 && <span className="shrink-0 text-sm font-semibold tabular-nums">×{top}</span>}
                        <span className="shrink-0 text-muted transition-transform group-open:rotate-90" aria-hidden>
                          ›
                        </span>
                      </summary>
                      {h.ranking.length > 0 && (
                        <ol className="border-t border-line bg-surface/50 px-3 py-2 text-sm">
                          {h.ranking.map((r) => (
                            <li key={r.entry_id} className="flex items-center gap-2 py-1">
                              <Link to={`../manager/${r.entry_id}`} className="min-w-0 flex-1 truncate">
                                {managers.get(r.entry_id)?.team_name ?? r.entry_id}
                              </Link>
                              <span className="tabular-nums text-ink-2">×{r.wins}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </details>
                  </li>
                )
              })}
          </ul>
        </div>
      ))}
    </section>
  )
}
