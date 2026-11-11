/**
 * Player photos and kit shirts, served by the Premier League / FPL image servers.
 * These URLs are unofficial and have changed between seasons: keep them in this one place.
 */
const PHOTO_BASE = 'https://resources.premierleague.com/premierleague25/photos/players/40x40'
const SHIRT_BASE = 'https://fantasy.premierleague.com/dist/img/shirts/standard'

/** 80×80 transparent PNG (~15 KB), despite the "40x40" in its path. */
export function playerPhotoUrl(photoCode: number): string {
  return `${PHOTO_BASE}/${photoCode}.png`
}

export function shirtUrl(teamCode: number, goalkeeper = false): string {
  return `${SHIRT_BASE}/shirt_${teamCode}${goalkeeper ? '_1' : ''}-66.png`
}
