import type { Award, AwardKey, AwardWinner } from './api'
import { chipLabel } from './chips'

interface AwardMeta {
  emoji: string
  title: string
  fame: boolean
  /** One line telling the story of this win. */
  describe: (winner: AwardWinner) => string
}

const name = (p: { name: string } | null) => p?.name ?? 'someone'
const pts = (n: number | null) => `${n ?? 0} pt${n === 1 ? '' : 's'}`

export const AWARDS: Record<AwardKey, AwardMeta> = {
  manager_of_week: {
    emoji: '👑',
    title: 'Manager of the Week',
    fame: true,
    describe: (w) => `Top score: ${pts(w.value)}`,
  },
  loser_of_week: {
    emoji: '🥄',
    title: 'Loser of the Week',
    fame: false,
    describe: (w) => `Bottom score: ${pts(w.value)}`,
  },
  bench_loser: {
    emoji: '🪑',
    title: 'Bench Loser',
    fame: false,
    describe: (w) => `${name(w.player)} scored ${pts(w.value)} on the bench (${pts(w.secondary)} benched in total)`,
  },
  lucky_sub: {
    emoji: '🍀',
    title: 'Lucky Sub',
    fame: true,
    describe: (w) => `${name(w.player)} came on for ${name(w.other_player)} and scored ${pts(w.value)}`,
  },
  vice_saviour: {
    emoji: '🛟',
    title: 'Vice-Captain Saviour',
    fame: true,
    describe: (w) => `${name(w.other_player)} didn't play; vice ${name(w.player)} doubled to ${pts(w.value)}`,
  },
  captain_fail: {
    emoji: '🤡',
    title: 'Captain Fail',
    fame: false,
    describe: (w) => `Captained ${name(w.player)}: ${pts(w.value)}`,
  },
  hit_regret: {
    emoji: '💸',
    title: 'Hit Regret',
    fame: false,
    describe: (w) => `Took a −${w.value} hit; the new signings scored ${pts(w.secondary)}`,
  },
  sold_too_soon: {
    emoji: '🔙',
    title: 'Sold Too Soon',
    fame: false,
    describe: (w) =>
      `Sold ${name(w.player)} (${pts(w.value)}) for ${name(w.other_player)} (${pts(w.secondary)})`,
  },
  chip_flop: {
    emoji: '🎯',
    title: 'Chip Flop',
    fame: false,
    describe: (w) =>
      `${w.chip ? chipLabel(w.chip).label : 'Chip'} for ${pts(w.value)}; season average ${w.secondary}`,
  },
}

/** Extra line for an award as a whole (Captain Fail's "the league captained a haul"). */
export function awardNote(award: Award): string | null {
  if (award.key === 'captain_fail' && award.popular_captain) {
    return `Meanwhile ${award.popular_captain_count} of ${award.popular_captain_of} captained ${award.popular_captain.name} (${pts(
      award.popular_captain_points,
    )})`
  }
  return null
}
