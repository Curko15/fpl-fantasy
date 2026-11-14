import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import type { Award, AwardKey, AwardWinner, LeagueAwards, LeagueOverview, Manager } from '../api'
import { AWARDS, awardHeadline, awardNote, awardStory } from '../awards'
import { GameweekPills } from '../components/GameweekPills'
import { PlayerPhoto } from '../components/PlayerPhoto'
import { Segmented } from '../components/Segmented'
import { AwardsSkeleton } from '../components/Skeleton'
import { ErrorCard } from '../components/Status'
import { useLeagueAwards } from '../queries'
import { YouTag } from '../components/YouTag'
import { useLeague, useMe } from './leagueContext'
import RecapView from './RecapView'

type View = 'recap' | 'week' | 'season'

const initial = (name: string) => [...name][0]?.toUpperCase() ?? '?'

export default function AwardsTab() {
  const { league } = useLeague()
  const [params, setParams] = useSearchParams()
  const query = useLeagueAwards(league.league.id)
  const managers = useMemo(() => new Map(league.managers.map((m) => [m.entry_id, m])), [league.managers])
  const viewParam = params.get('view')
  const view: View = viewParam === 'season' || viewParam === 'week' ? viewParam : 'recap'

  function setParam(key: string, value: string | null) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  }

  if (query.isError) {
    return <ErrorCard title="Can't load awards" error={query.error} onRetry={() => query.refetch()} />
  }
  if (!query.data) return <AwardsSkeleton />

  const data = query.data
  const requested = Number(params.get('gw'))
  const selected = data.gameweeks.find((g) => g.event === requested) ?? data.gameweeks[0]
  const recapEvents = [...league.events].reverse() // newest first
  const recapEvent = recapEvents.includes(requested) ? requested : recapEvents[0]

  if (recapEvents.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-card p-4 text-sm text-ink-2">
        The recap and awards start once the first gameweek has been played.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <Segmented
        label="Awards view"
        value={view}
        onChange={(v) => setParam('view', v === 'recap' ? null : v)}
        options={[
          { value: 'recap', label: 'Recap' },
          { value: 'week', label: 'Awards' },
          { value: 'season', label: 'Season' },
        ]}
      />

      {view !== 'recap' && data.pending_events.length > 0 && (
        <p className="flex items-center gap-2 rounded-xl bg-accent/10 px-3 py-2 text-xs text-ink-2" role="status">
          <span className="size-3 shrink-0 animate-spin rounded-full border-2 border-line border-t-accent" />
          Collecting team data for {data.pending_events.length} gameweek
          {data.pending_events.length === 1 ? '' : 's'}. More awards will appear shortly.
        </p>
      )}

      {view === 'recap' ? (
        <>
          <GameweekPills events={recapEvents} selected={recapEvent} onSelect={(e) => setParam('gw', String(e))} />
          <div className="space-y-7">
            <RecapView
              league={league}
              event={recapEvent}
              awards={data.gameweeks.find((g) => g.event === recapEvent)?.awards}
              awardsPending={data.pending_events.includes(recapEvent)}
            />
          </div>
        </>
      ) : data.gameweeks.length === 0 ? (
        data.pending_events.length === 0 && (
          <p className="rounded-2xl border border-line bg-card p-4 text-sm text-ink-2">
            Awards are handed out once a gameweek is finished. Check back after the first one.
          </p>
        )
      ) : view === 'week' && selected ? (
        <>
          <GameweekPills
            events={data.gameweeks.map((g) => g.event)}
            selected={selected.event}
            onSelect={(e) => setParam('gw', String(e))}
          />
          <GameweekView league={league} event={selected.event} awards={selected.awards} managers={managers} />
        </>
      ) : (
        <SeasonView data={data} managers={managers} />
      )}
    </div>
  )
}

function GameweekView({
  league,
  event,
  awards,
  managers,
}: {
  league: LeagueOverview
  event: number
  awards: Award[]
  managers: Map<number, Manager>
}) {
  const motw = awards.find((a) => a.key === 'manager_of_week')
  const rest = awards.filter((a) => a.key !== 'manager_of_week')
  const heroes = rest.filter((a) => AWARDS[a.key].fame)
  const villains = rest.filter((a) => !AWARDS[a.key].fame)

  const scores = league.managers.flatMap((m) => m.history.filter((h) => h.event === event).map((h) => h.points))
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

  return (
    <>
      {motw && <Spotlight award={motw} managers={managers} average={average} />}
      <TileGroup title="Heroes" awards={heroes} managers={managers} fame />
      <TileGroup title="Villains" awards={villains} managers={managers} fame={false} />
    </>
  )
}

function Spotlight({ award, managers, average }: { award: Award; managers: Map<number, Manager>; average: number | null }) {
  const Icon = AWARDS.manager_of_week.icon
  const [meId] = useMe()
  return (
    <section aria-label="Manager of the week" className="relative overflow-hidden rounded-[1.75rem] bg-pop p-5 text-pop-ink">
      <Icon aria-hidden size={150} strokeWidth={1.2} className="pointer-events-none absolute -top-5 -right-6 opacity-10" />
      <div className="text-xs font-extrabold tracking-[0.08em] uppercase">Manager of the week</div>
      {award.winners.map((w) => {
        const m = managers.get(w.entry_id)
        const team = m?.team_name ?? `Manager ${w.entry_id}`
        return (
          <div key={w.entry_id} className="relative mt-4 flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-full bg-pop-ink font-display text-2xl font-bold text-pop">
              {initial(team)}
            </span>
            <div className="min-w-0">
              <div className="font-display text-5xl leading-[0.85] font-bold tracking-tight tabular-nums">{w.value}</div>
              <div className="mt-1 flex items-center gap-1.5">
                <Link to={`../manager/${w.entry_id}`} className="min-w-0 truncate font-bold after:absolute after:inset-0">
                  {team}
                </Link>
                {w.entry_id === meId && <YouTag onPop />}
              </div>
              <div className="truncate text-xs opacity-75">
                {m?.player_name}
                {average !== null && ` · ${w.value - average} above the league average`}
              </div>
            </div>
          </div>
        )
      })}
    </section>
  )
}

function TileGroup({ title, awards, managers, fame }: { title: string; awards: Award[]; managers: Map<number, Manager>; fame: boolean }) {
  const tiles = awards.flatMap((award) => award.winners.map((w) => ({ award, w })))
  if (tiles.length === 0) return null
  const id = `tiles-${fame ? 'fame' : 'shame'}`
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-2.5 text-lg font-bold">
        {title}
      </h2>
      <ul className="grid grid-cols-2 gap-2.5">
        {tiles.map(({ award, w }) => (
          <AwardTile key={`${award.key}-${w.entry_id}-${w.player?.id ?? ''}`} award={award} winner={w} managers={managers} fame={fame} />
        ))}
      </ul>
    </section>
  )
}

function AwardTile({ award, winner, managers, fame }: { award: Award; winner: AwardWinner; managers: Map<number, Manager>; fame: boolean }) {
  const meta = AWARDS[award.key]
  const Icon = meta.icon
  const note = awardNote(award)
  const [meId] = useMe()
  return (
    <li className={`relative flex flex-col rounded-3xl border p-3.5 ${fame ? 'border-up/25 bg-up/8' : 'border-down/25 bg-down/8'}`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`grid size-9 place-items-center rounded-xl ${fame ? 'bg-up/15 text-up' : 'bg-down/15 text-down'}`}>
          <Icon size={18} aria-hidden />
        </span>
        {winner.player && <PlayerPhoto player={winner.player} size={36} />}
      </div>
      <div className="mt-2.5 text-[11px] leading-tight font-bold tracking-[0.04em] text-muted uppercase">{meta.title}</div>
      <div className="mt-0.5 font-display text-2xl font-bold tabular-nums">{awardHeadline(award.key, winner)}</div>
      <div className="flex items-center gap-1.5">
        <Link to={`../manager/${winner.entry_id}`} className="min-w-0 truncate text-sm font-semibold after:absolute after:inset-0">
          {managers.get(winner.entry_id)?.team_name ?? `Manager ${winner.entry_id}`}
        </Link>
        {winner.entry_id === meId && <YouTag />}
      </div>
      <p className="mt-0.5 text-xs text-muted">{awardStory(award.key, winner)}</p>
      {note && <p className="mt-1 text-xs text-ink-2">{note}</p>}
    </li>
  )
}

function SeasonView({ data, managers }: { data: LeagueAwards; managers: Map<number, Manager> }) {
  const totals = (fame: boolean) => {
    const wins = new Map<number, number>()
    for (const h of data.hall) {
      if (AWARDS[h.key].fame !== fame) continue
      for (const r of h.ranking) wins.set(r.entry_id, (wins.get(r.entry_id) ?? 0) + r.wins)
    }
    const top = Math.max(0, ...wins.values())
    return { top, leaders: [...wins.entries()].filter(([, n]) => n === top && top > 0).map(([id]) => id) }
  }
  const glory = totals(true)
  const shame = totals(false)
  const races = data.hall.filter((h) => h.ranking.length > 0)
  const finished = data.gameweeks.length

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <LeaderCard title="Most decorated" unit="trophies" {...glory} managers={managers} good />
        <LeaderCard title="Hall of Shame" unit="shames" {...shame} managers={managers} good={false} />
      </div>
      <p className="text-xs text-muted">
        Season totals over {finished} finished gameweek{finished === 1 ? '' : 's'}.
      </p>
      <div className="space-y-2.5">
        {races.map((h) => (
          <Race key={h.key} awardKey={h.key} ranking={h.ranking} managers={managers} />
        ))}
      </div>
    </>
  )
}

function LeaderCard({
  title,
  unit,
  top,
  leaders,
  managers,
  good,
}: {
  title: string
  unit: string
  top: number
  leaders: number[]
  managers: Map<number, Manager>
  good: boolean
}) {
  const names = leaders.map((id) => managers.get(id)?.team_name ?? String(id))
  return (
    <article className={`relative rounded-3xl border p-3.5 ${good ? 'border-transparent bg-pop text-pop-ink' : 'border-down/25 bg-down/10'}`}>
      <div className="text-[11px] font-extrabold tracking-[0.06em] uppercase">{title}</div>
      <span
        className={`mt-3 grid size-12 place-items-center rounded-full font-display text-base font-bold ${
          good ? 'bg-pop-ink text-pop' : 'bg-down text-card'
        }`}
      >
        {names[0] ? initial(names[0]) : '–'}
      </span>
      <div className="mt-2.5 line-clamp-2 text-sm leading-tight font-bold">
        {leaders.length === 1 ? (
          <Link to={`../manager/${leaders[0]}`} className="after:absolute after:inset-0">
            {names[0]}
          </Link>
        ) : (
          names.join(', ') || 'Nobody yet'
        )}
      </div>
      <div className="mt-0.5 text-xs opacity-75">
        {top} {unit}
      </div>
    </article>
  )
}

const RACE_TOP = 3

function Race({ awardKey, ranking, managers }: { awardKey: AwardKey; ranking: { entry_id: number; wins: number }[]; managers: Map<number, Manager> }) {
  const [open, setOpen] = useState(false)
  const meta = AWARDS[awardKey]
  const Icon = meta.icon
  const max = ranking[0].wins
  const rows = open ? ranking : ranking.slice(0, RACE_TOP)
  const tone = meta.fame ? 'up' : 'down'
  const [meId] = useMe()
  // Show my row even when it's outside the top 3.
  const mine = open ? -1 : ranking.findIndex((r) => r.entry_id === meId)
  const extra = mine >= RACE_TOP ? [{ ...ranking[mine], place: mine }] : []
  return (
    <section className="rounded-3xl border border-line bg-card p-3.5" aria-label={meta.title}>
      <div className="flex items-center gap-2.5">
        <span className={`grid size-8 place-items-center rounded-[10px] ${tone === 'up' ? 'bg-up/15 text-up' : 'bg-down/15 text-down'}`}>
          <Icon size={16} aria-hidden />
        </span>
        <h2 className="flex-1 text-base font-bold">{meta.title}</h2>
      </div>
      <ol className="mt-2.5 space-y-2">
        {[...rows.map((r, i) => ({ ...r, place: i })), ...extra].map((r) => (
          <li key={r.entry_id} className="grid grid-cols-[1.1rem_minmax(0,7.5rem)_minmax(0,1fr)_2rem] items-center gap-2">
            <span className={`text-xs font-bold tabular-nums ${r.entry_id === meId ? 'text-accent' : 'text-muted'}`}>{r.place + 1}</span>
            <Link
              to={`../manager/${r.entry_id}`}
              className={`truncate text-sm ${r.entry_id === meId ? 'font-bold text-accent' : 'font-semibold'}`}
            >
              {managers.get(r.entry_id)?.team_name ?? r.entry_id}
            </Link>
            <span className="h-2 rounded-full bg-raised">
              <span
                className={`block h-full rounded-full ${tone === 'up' ? 'bg-up' : 'bg-down'} ${r.wins === max ? '' : 'opacity-55'}`}
                style={{ width: `${(r.wins / max) * 100}%` }}
              />
            </span>
            <span className="text-right font-display text-sm font-bold tabular-nums">×{r.wins}</span>
          </li>
        ))}
      </ol>
      {ranking.length > RACE_TOP && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-1 -mb-1.5 flex h-10 items-center gap-1 text-sm font-semibold text-accent"
        >
          {open ? 'Show top 3' : `Show all ${ranking.length}`}
          <ChevronDown size={16} aria-hidden className={open ? 'rotate-180' : ''} />
        </button>
      )}
    </section>
  )
}
