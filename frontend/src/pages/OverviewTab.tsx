import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Award, AwardWinner, LeagueOverview, Manager } from '../api'
import { AWARDS, awardHeadline, awardStory } from '../awards'
import { chipLabel } from '../chips'
import FocusChart from '../components/FocusChart'
import { MyTeamPicker } from '../components/MyTeamPicker'
import { PlayerPhoto } from '../components/PlayerPhoto'
import ScoreSpread from '../components/ScoreSpread'
import { SectionHeading } from '../components/SectionHeading'
import { Segmented } from '../components/Segmented'
import { Bone } from '../components/Skeleton'
import StandingsTable from '../components/StandingsTable'
import TitleRace from '../components/TitleRace'
import { chipsLeft, gameweekSummary, transferPulse, type PlayerCount } from '../dashboard'
import { useLeagueAwards, useLeagueTransfers } from '../queries'
import { YouTag } from '../components/YouTag'
import { useLeague, useMe } from './leagueContext'

export default function OverviewTab() {
  const { league } = useLeague()
  const managers = useMemo(() => new Map(league.managers.map((m) => [m.entry_id, m])), [league.managers])

  return (
    <div className="space-y-7">
      <GameweekHero league={league} />
      <AwardsStrip leagueId={league.league.id} managers={managers} />

      <section aria-labelledby="table-heading">
        <SectionHeading id="table-heading" aside={<span className="text-xs text-muted">Rank form, last 6 GWs</span>}>
          Table
        </SectionHeading>
        <StandingsTable managers={league.managers} events={league.events} />
      </section>

      <TransferPulseSection leagueId={league.league.id} managers={managers} />
      <ChipsLeft league={league} />

      <SeasonCharts league={league} />
    </div>
  )
}

function SeasonCharts({ league }: { league: LeagueOverview }) {
  const [myTeam, setMyTeam] = useMe()
  const [view, setView] = useState<'focus' | 'race'>('focus')
  const [picking, setPicking] = useState(false)
  if (league.events.length === 0) return null

  const picker = (myTeam === null || picking) && (
    <MyTeamPicker
      managers={league.managers}
      value={myTeam}
      onPick={(id) => {
        setMyTeam(id)
        setPicking(false)
      }}
      onCancel={myTeam === null ? undefined : () => setPicking(false)}
    />
  )

  return (
    <>
      <section aria-labelledby="chart-heading">
        <SectionHeading id="chart-heading" aside={<span className="text-xs text-muted">{league.managers.length} managers</span>}>
          Season so far
        </SectionHeading>
        {picker && <div className="mb-3">{picker}</div>}
        <Segmented
          label="Season view"
          value={view}
          onChange={setView}
          className="mb-3"
          options={[
            { value: 'focus', label: 'Focus' },
            { value: 'race', label: 'Race' },
          ]}
        />
        {view === 'focus' ? (
          <FocusChart
            key={myTeam ?? 'leader'}
            managers={league.managers}
            events={league.events}
            meId={myTeam}
            onChangeTeam={() => setPicking(true)}
          />
        ) : (
          <TitleRace managers={league.managers} events={league.events} meId={myTeam} />
        )}
      </section>

      {myTeam !== null && (
        <section aria-labelledby="spread-heading">
          <SectionHeading id="spread-heading">Your weeks vs the league</SectionHeading>
          <p className="-mt-2 mb-3 text-sm text-muted">
            Every dot is one manager's gameweek score. The band is the middle half of the league.
          </p>
          <ScoreSpread managers={league.managers} events={league.events} meId={myTeam} />
        </section>
      )}
    </>
  )
}

function SeeAll({ to }: { to: string }) {
  return (
    <Link to={to} className="-my-2 py-2 text-sm font-semibold text-accent">
      All
    </Link>
  )
}

function GameweekHero({ league }: { league: LeagueOverview }) {
  const event = league.current_event
  const summary = event ? gameweekSummary(league.managers, event) : null
  if (!summary) {
    return (
      <section className="rounded-3xl border border-line bg-card p-5">
        <p className="font-display text-lg font-bold">The season hasn't started yet</p>
        <p className="mt-1 text-sm text-muted">Scores appear here after the first gameweek.</p>
      </section>
    )
  }
  const finished = league.current_event_finished
  const leaders = summary.top.map((t) => t.manager.team_name).join(', ')
  const stats = [
    { label: 'League avg', value: summary.average, tone: '' },
    { label: 'Lowest', value: summary.lowest, tone: '' },
    { label: 'Hits taken', value: summary.hits ? `−${summary.hits}` : '0', tone: summary.hits ? 'text-down' : '' },
  ]
  return (
    <section aria-label={`Gameweek ${summary.event}`} className="rounded-3xl border border-line bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">Gameweek {summary.event}</span>
        <span
          className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ${
            finished ? 'bg-accent/12 text-accent' : 'bg-down/12 text-down'
          }`}
        >
          <span className={`size-1.5 rounded-full ${finished ? 'bg-accent' : 'animate-pulse bg-down'}`} />
          {finished ? 'Finished' : 'In progress'}
        </span>
      </div>
      <div className="mt-4 flex items-end gap-3">
        <div className="font-display text-6xl leading-[0.85] font-bold tracking-tight tabular-nums">
          {summary.top[0].points}
        </div>
        <div className="min-w-0 pb-0.5">
          <div className="text-sm text-muted">top score by</div>
          <div className="truncate font-semibold">{leaders}</div>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-raised px-3 py-2.5">
            <dt className="text-[11px] text-muted">{s.label}</dt>
            <dd className={`mt-0.5 font-display text-xl font-bold tabular-nums ${s.tone}`}>{s.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function awardTone(award: Award): string {
  if (award.key === 'manager_of_week') return 'bg-pop text-pop-ink border-transparent'
  return AWARDS[award.key].fame ? 'bg-accent/10 border-accent/20' : 'bg-down/10 border-down/20'
}

function AwardsStrip({ leagueId, managers }: { leagueId: number; managers: Map<number, Manager> }) {
  const query = useLeagueAwards(leagueId)
  const week = query.data?.gameweeks[0]
  if (query.isError || (query.data && !week)) return null

  return (
    <section aria-labelledby="awards-heading">
      <SectionHeading id="awards-heading" aside={week && <SeeAll to="awards" />}>
        {week ? `GW${week.event} awards` : 'Awards'}
      </SectionHeading>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none]">
        {week
          ? week.awards.flatMap((award) =>
              award.winners.map((w) => (
                <AwardCard key={`${award.key}-${w.entry_id}-${w.player?.id ?? ''}`} award={award} winner={w} managers={managers} />
              )),
            )
          : [0, 1, 2].map((i) => (
              <li key={i} className="w-56 shrink-0 rounded-2xl border border-line bg-card p-3.5">
                <Bone className="h-3 w-28" />
                <Bone className="mt-5 h-7 w-20" />
                <Bone className="mt-2 h-3.5 w-36" />
              </li>
            ))}
      </ul>
    </section>
  )
}

function AwardCard({ award, winner, managers }: { award: Award; winner: AwardWinner; managers: Map<number, Manager> }) {
  const meta = AWARDS[award.key]
  const team = managers.get(winner.entry_id)?.team_name ?? `Manager ${winner.entry_id}`
  const [meId] = useMe()
  return (
    <li className={`relative w-56 shrink-0 snap-start rounded-2xl border p-3.5 ${awardTone(award)}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] leading-tight font-bold tracking-[0.04em] uppercase">{meta.title}</span>
        {winner.player ? (
          <PlayerPhoto player={winner.player} size={40} />
        ) : (
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-black/10 font-display text-sm font-bold">
            {[...team][0]?.toUpperCase()}
          </span>
        )}
      </div>
      <div className="mt-2 font-display text-3xl leading-none font-bold tabular-nums">{awardHeadline(award.key, winner)}</div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <Link to={`manager/${winner.entry_id}`} className="min-w-0 truncate text-sm font-semibold after:absolute after:inset-0">
          {team}
        </Link>
        {winner.entry_id === meId && <YouTag onPop={award.key === 'manager_of_week'} />}
      </div>
      <p className="mt-0.5 line-clamp-2 text-xs opacity-80">{awardStory(award.key, winner)}</p>
    </li>
  )
}

function TransferPulseSection({ leagueId, managers }: { leagueId: number; managers: Map<number, Manager> }) {
  const query = useLeagueTransfers(leagueId)
  const pulse = useMemo(() => (query.data ? transferPulse(query.data.transfers) : null), [query.data])
  if (query.isError || (query.data && !pulse)) return null

  return (
    <section aria-labelledby="pulse-heading">
      <SectionHeading id="pulse-heading" aside={pulse && <SeeAll to="transfers" />}>
        Transfer pulse{pulse && <span className="ml-1.5 text-sm font-medium text-muted">GW{pulse.event}</span>}
      </SectionHeading>
      <div className="grid grid-cols-2 gap-2.5">
        <PulseTile label="Most bought" tone="text-up" item={pulse?.mostBought} loading={!pulse} />
        <PulseTile label="Most sold" tone="text-down" item={pulse?.mostSold} loading={!pulse} />
      </div>
      {pulse && (
        <ul className="mt-2.5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          {pulse.latest.map((t) => (
            <li key={`${t.entry_id}-${t.time}-${t.player_in.id}`} className="flex items-center gap-3 px-3.5 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{managers.get(t.entry_id)?.team_name}</div>
                <div className="mt-0.5 truncate text-sm text-muted">
                  <span className="text-down">{t.player_out.name}</span> → <span className="text-up">{t.player_in.name}</span>
                </div>
              </div>
              <span
                className={`shrink-0 text-xs font-semibold ${
                  t.kind === 'hit' ? 'text-down' : t.kind === 'free' ? 'text-muted' : 'text-accent'
                }`}
              >
                {{ hit: '−4 hit', free: 'Free', wildcard: 'Wildcard', free_hit: 'Free Hit' }[t.kind]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function PulseTile({
  label,
  tone,
  item,
  loading,
}: {
  label: string
  tone: string
  item: PlayerCount | null | undefined
  loading: boolean
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-3.5">
      <div className={`text-[11px] font-bold tracking-[0.06em] uppercase ${tone}`}>{label}</div>
      <div className="mt-3 flex items-center gap-2.5">
        {loading || !item ? (
          <>
            <Bone className="size-11 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Bone className="h-3.5 w-16" />
              <Bone className="h-3 w-20" />
            </div>
          </>
        ) : (
          <>
            <PlayerPhoto player={item.player} size={44} />
            <div className="min-w-0">
              <div className="truncate font-semibold">{item.player.name}</div>
              <div className="text-xs text-muted">
                by {item.count} manager{item.count === 1 ? '' : 's'}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ChipsLeft({ league }: { league: LeagueOverview }) {
  const chips = useMemo(() => chipsLeft(league), [league])
  if (chips.length === 0) return null
  return (
    <section aria-labelledby="chips-left-heading">
      <SectionHeading id="chips-left-heading" aside={<SeeAll to="chips" />}>
        Chips still to play
      </SectionHeading>
      <ul className="grid grid-cols-4 gap-2">
        {chips.map((c) => (
          <li key={c.name} className="rounded-2xl border border-line bg-card px-1 py-3 text-center">
            <div className="font-display text-2xl font-bold tabular-nums">{c.left}</div>
            <div className="px-1 text-[11px] leading-tight text-muted">{chipLabel(c.name).label}</div>
          </li>
        ))}
      </ul>
    </section>
  )
}
