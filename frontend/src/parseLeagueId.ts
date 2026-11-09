/**
 * Accepts a bare ID ("123456") or a pasted FPL league URL
 * (".../leagues/123456/standings/c"), which is easier on a phone.
 */
export function parseLeagueId(input: string): number | null {
  const text = input.trim()
  const match = text.match(/leagues\/(\d+)/) ?? text.match(/^(\d+)$/)
  if (!match) return null
  const id = Number(match[1])
  return Number.isSafeInteger(id) && id > 0 && id <= 2_147_483_647 ? id : null
}
