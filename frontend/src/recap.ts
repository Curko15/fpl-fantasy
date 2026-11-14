import type { Award, AwardKey, Manager } from './api'
import { AWARDS, awardHeadline, awardNote, awardStory } from './awards'
import { chipLabel } from './chips'
import { ordinal } from './seasonCharts'

// The Matchday recap: one gameweek told as a story. Pure, so it's easy to test.

export interface Standing {
  manager: Manager
  rank: number
  total: number
  points: number
  /** Places gained since the previous gameweek (negative = dropped); null when new. */
  move: number | null
}

/** The table after `event`, best first, with movement since the gameweek before it. */
export function standingsAfter(managers: Manager[], events: number[], event: number): Standing[] {
  const prev = events[events.indexOf(event) - 1]
  return managers
    .flatMap((m) => {
      const gw = m.history.find((h) => h.event === event)
      if (!gw) return []
      const before = prev === undefined ? undefined : m.history.find((h) => h.event === prev)
      return [{ manager: m, rank: gw.league_rank, total: gw.total, points: gw.points, move: before ? before.league_rank - gw.league_rank : null }]
    })
    .sort((a, b) => a.rank - b.rank || b.total - a.total)
}

export interface Headline {
  title: string
  subtitle: string
}

const joinNames = (names: string[]) =>
  names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

export function recapHeadline(table: Standing[], event: number): Headline | null {
  if (table.length === 0) return null
  const best = Math.max(...table.map((s) => s.points))
  const tops = table.filter((s) => s.points === best)
  const leader = table[0]
  const second = table[1]
  const tookTop = leader.move !== null && leader.move > 0

  let title: string
  if (tops.length > 1) {
    title = `${joinNames(tops.map((s) => s.manager.team_name))} share the week's best ${best}`
  } else {
    const star = tops[0]
    if (star === leader && tookTop) title = `${star.manager.team_name} goes top with the week's best ${best}`
    else if (star.move !== null && star.move >= 2) title = `${star.manager.team_name} storms to ${ordinal(star.rank)} with the week's best ${best}`
    else title = `${star.manager.team_name} tops GW${event} with ${best}`
  }

  let subtitle = ''
  if (second) {
    const gap = leader.total - second.total
    const by = gap === 0 ? 'level on points' : `by ${gap} point${gap === 1 ? '' : 's'}`
    const lost = tookTop ? table.find((s) => s.move !== null && s.rank + s.move === 1) : undefined
    subtitle = lost
      ? `${leader.manager.team_name} takes top spot from ${lost.manager.team_name}, ${gap === 0 ? 'level on points' : `ahead ${by}`}.`
      : `${leader.manager.team_name} stays top, ${gap === 0 ? 'level on points with' : `${gap} point${gap === 1 ? '' : 's'} clear of`} ${second.manager.team_name}.`
  }
  return { title, subtitle }
}

export type MomentKind = AwardKey | 'climb' | 'drop' | 'chip' | 'hit'
export type MomentTone = 'star' | 'good' | 'bad' | 'neutral'

export interface Moment {
  id: string
  kind: MomentKind
  tone: MomentTone
  label: string
  value: string
  entryId: number
  title: string
  detail: string
  chip?: string
}

const ORDER: MomentKind[] = [
  'manager_of_week',
  'climb',
  'chip',
  'lucky_sub',
  'vice_saviour',
  'captain_fail',
  'hit_regret',
  'sold_too_soon',
  'chip_flop',
  'bench_loser',
  'hit',
  'drop',
  'loser_of_week',
]

function placeLine(s: Standing | undefined): string {
  if (!s) return ''
  if (s.move === null) return `In at ${ordinal(s.rank)}.`
  if (s.move > 0) return `Up from ${ordinal(s.rank + s.move)} to ${ordinal(s.rank)}.`
  if (s.move < 0) return `Down from ${ordinal(s.rank + s.move)} to ${ordinal(s.rank)}.`
  return `Stays ${ordinal(s.rank)}.`
}

/**
 * The gameweek's moments, in story order: the star, big climbs, chips, the
 * awards, hits, big drops and the wooden spoon. `awards` may be missing while
 * a gameweek's team data is still being collected.
 */
export function recapMoments(table: Standing[], awards: Award[] | undefined, event: number): Moment[] {
  const byId = new Map(table.map((s) => [s.manager.entry_id, s]))
  const team = (id: number) => byId.get(id)?.manager.team_name ?? `Manager ${id}`
  const moments: Moment[] = []
  const average = table.length ? Math.round(table.reduce((n, s) => n + s.points, 0) / table.length) : 0

  for (const award of awards ?? []) {
    const meta = AWARDS[award.key]
    const note = awardNote(award)
    for (const w of award.winners) {
      const s = byId.get(w.entry_id)
      const isTop = award.key === 'manager_of_week'
      const isBottom = award.key === 'loser_of_week'
      moments.push({
        id: `${award.key}-${w.entry_id}-${w.player?.id ?? ''}`,
        kind: award.key,
        tone: isTop ? 'star' : meta.fame ? 'good' : 'bad',
        label: meta.title,
        value: awardHeadline(award.key, w).replace(/ pts?$/, ''),
        entryId: w.entry_id,
        title: team(w.entry_id),
        detail: isTop || isBottom ? placeLine(s) : [awardStory(award.key, w), note].filter(Boolean).join('. '),
        chip: w.chip ?? undefined,
      })
    }
  }

  const awarded = (key: AwardKey, id: number) => moments.some((m) => m.kind === key && m.entryId === id)

  for (const s of table) {
    const id = s.manager.entry_id
    const gw = s.manager.history.find((h) => h.event === event)
    if (gw?.chip && !awarded('chip_flop', id)) {
      moments.push({
        id: `chip-${id}`,
        kind: 'chip',
        tone: 'neutral',
        label: 'Chip played',
        value: String(gw.points),
        entryId: id,
        title: `${team(id)} played ${chipLabel(gw.chip).label}`,
        detail: `Scored ${gw.points}, league average ${average}.`,
        chip: gw.chip,
      })
    }
    if (gw && gw.transfers_cost > 0 && !awarded('hit_regret', id)) {
      moments.push({
        id: `hit-${id}`,
        kind: 'hit',
        tone: 'bad',
        label: 'Took a hit',
        value: `−${gw.transfers_cost}`,
        entryId: id,
        title: team(id),
        detail: `${gw.points} points, ${gw.points - gw.transfers_cost} after the hit.`,
      })
    }
  }

  // Biggest climb and drop (at least 2 places), unless the star or spoon already tells it.
  const moved = table.filter((s) => s.move !== null)
  const climb = moved.reduce<Standing | null>((b, s) => (s.move! >= 2 && (!b || s.move! > b.move!) ? s : b), null)
  const drop = moved.reduce<Standing | null>((b, s) => (s.move! <= -2 && (!b || s.move! < b.move!) ? s : b), null)
  if (climb && !awarded('manager_of_week', climb.manager.entry_id)) {
    moments.push({
      id: `climb-${climb.manager.entry_id}`,
      kind: 'climb',
      tone: 'good',
      label: 'Biggest climb',
      value: `▲${climb.move}`,
      entryId: climb.manager.entry_id,
      title: team(climb.manager.entry_id),
      detail: `${placeLine(climb)} Scored ${climb.points}.`,
    })
  }
  if (drop && !awarded('loser_of_week', drop.manager.entry_id)) {
    moments.push({
      id: `drop-${drop.manager.entry_id}`,
      kind: 'drop',
      tone: 'bad',
      label: 'Biggest drop',
      value: `▼${-drop.move!}`,
      entryId: drop.manager.entry_id,
      title: team(drop.manager.entry_id),
      detail: `${placeLine(drop)} Scored ${drop.points}.`,
    })
  }

  return moments.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))
}
