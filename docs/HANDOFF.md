# Handoff: where the project stands (2026-11-13)

Read this first in a new session, together with `docs/PLAN.md`.

## State of the code

| PR | Branch | Status | What |
|---|---|---|---|
| #1–#11 | – | merged | v1 features (overview, transfers, chips, manager page, database + daily refresh, awards), player photos, app shell + bottom tabs, skeletons, PWA, home page |
| #12 | `dashboard` | **open** | League home as a dashboard (design A "Floodlight") + System / Light / Dark theme switch |
| #13 | `tabs-redesign` | **open, stacked on #12** | Transfers (Feed / Market), Chips (cards + timeline), Awards (Gameweek / Season) |
| #14 | `season-charts` | **open, stacked on #13** | Season charts for big leagues: Focus + Race switch, "Your weeks vs the league", "my team" choice |
| #15 | `my-team-everywhere` | **open, stacked on #14** | "You" highlights on every tab, manager page restyle with "This is my team" and weeks-vs-league |
| #16 | `team-bar` | **open, stacked on #15** | Always-on "Your team" switcher bar at the top of every league tab |
| #17 | `matchday-recap` | **open, stacked on #16** | Matchday recap as the first view of the Awards tab |
| #18 | `head-to-head` | **open, stacked on #17** | Head-to-head page comparing two managers |
| #19 | `live-gameweek` | **open, stacked on #18** | Live gameweek view: live scores and table while a GW is being played |

Merge #12, then #13, #14, #15, #16, #17, #18 and #19, in that order. Branch new work from `master` after both are merged. If they're still open, branch from `tabs-redesign` and say so in the PR.

## Design decisions (all chosen by the user from canvas prototypes)

Prototype canvas (private to the user): https://claude.ai/artifact/7yzcePz8fTcqbTvpxAECae

- **Look**: design A "Floodlight". Dark: near-black `#0a0b0d`, cards `#15171b`, neon green `#3dffa2`. Light theme in the style of design B "Bento": warm paper `#f4f3ef`, purple `#4b1d8f`, lime `#d7f36b`. Fonts: Space Grotesk (headings, numbers), Inter (text). Tokens are in `frontend/src/index.css`, and the theme logic is in `frontend/src/theme.ts`.
- **League home** (`OverviewTab`): gameweek card, swipeable award cards, table with rank-form sparklines, transfer pulse, chips still to play, season chart.
- **Transfers**: T1 feed (swap verdicts) + T2 market, behind a Feed / Market switch sharing one gameweek selector.
- **Chips**: C3 one card per chip + C2 timeline, with a season-half switch and a deadline card.
- **Awards**: W1 gameweek view (Manager of the Week spotlight, Heroes / Villains tiles) + W3 season race, behind a Gameweek / Season switch.

## Season charts (done in #14)

- "My team" is saved per league in `localStorage` (`myTeam:<leagueId>`, `src/myTeam.ts`, hook `useMyTeam`). It is chosen or switched in the always-on "Your team" bar at the top of every league tab (`components/TeamBar.tsx`, mounted in `LeagueLayout`; prompt style until set, "No team" clears it), or with "This is my team" on a manager page. Until it's set, Focus centres on the leader.
- Maths in `src/seasonCharts.ts` (tested): `focusTeams`, `seasonRows`, `scoreSpread` / `spreadStats`, `racePool` / `raceFrame`.
- Components: `FocusChart` (S1), `TitleRace` (S5), `ScoreSpread` (S4), `MyTeamPicker`. Chart hex colours live in `src/chartColors.ts` (keep in step with `index.css`).
- Highlight colours: me = accent, leader = ink, up to 5 rivals from a validated subset of the categorical palette, so at most 5 rivals + compares. Leagues of ≤ 7 highlight everyone.
- "Behind leader" scales to the highlighted lines; faint far-behind lines run off the bottom on purpose.
- `useMe()` in `pages/leagueContext.ts` gives any league screen the saved team; `components/YouTag.tsx` is the shared pill (`onPop` on lime/neon cards). Used in the table (row tint, pinned under the top 10), transfers, awards (incl. my row in season races), chips and the manager page (#15).

## Matchday recap (done in #17)

- Lives in the Awards tab: Recap (default) / Awards / Season. Recap has its own gameweek pills (every played GW, incl. one in progress); `?view=week` opens the awards.
- Maths in `src/recap.ts` (tested): `standingsAfter` (table + movement after a GW), `recapHeadline` (generated headline + leader line), `recapMoments` (awards, chips, hits, biggest climb/drop in story order, without repeating what an award already says).
- UI in `pages/RecapView.tsx`: headline card with podium, "The week in moments" timeline, "The rest" of the table (my row pinned). Prototype C's look was adapted to Floodlight tokens.
- Idea for later: a recap teaser card on the Overview linking to it.

## Head-to-head (done in #18)

- Route `/league/:id/compare?a=&b=` (`pages/ComparePage.tsx`), inside the league layout: back-button header "Head-to-head", no team bar. Defaults: A = my team or the leader, B = the manager directly above A (2nd if A leads). Each picker disables the other side's team.
- Maths in `src/headToHead.ts` (tested): `headToHeadWeeks` (weekly scores, winner, season gap; a mid-season joiner's missing GWs are null and count 0 towards the gap), `headToHeadRecord`, `sideStats`, `defaultPair`, `gapSummary`.
- Sections: hero with the gap, GW record + biggest wins, points-gap chart (A colour above zero, B below), side-by-side stats, GW list with captains (manager detail query, same key as the manager page).
- Colours: A = accent, B = `chartColors.rivals[0]` (validated in both themes).
- Entry points: "Compare with …" on the manager page hero, and a row under the Overview table.

## Live gameweek (done in #19)

- Endpoint `GET /api/leagues/{id}/live` (`backend/app/live.py`, `build_live_league`). While the current GW is in progress it returns per manager: live GW points (picks × FPL live points; the picks' multipliers carry captain, Triple Captain and Bench Boost) minus hits, live total (league total before the GW + live points), live rank and rank before the GW (ties share a rank), captain + captain points, chip, and players left (counting players whose club still has a match to kick off). No GW in progress → `{"live": false, "event": <current>, "managers": []}`.
- Provisional, before auto-subs: FPL only applies auto-subs and the vice-captain once the GW is processed.
- Caching (`FplStore.live_event` / `event_picks`): `/event/{gw}/live/` + `/fixtures/?event=` are fetched at most once a minute per GW however many people watch (in memory, under a lock), and also stored as provisional `LiveRow` points, so transfer points and awards stay fresher during a GW. Picks are fetched once per manager per GW and read from the DB after that. The live endpoint reads bootstrap with a 1 h max age, so a GW starting/finishing is noticed within the hour.
- UI: `/league/:id/live` (`pages/LivePage.tsx`), a detail page with a back header. Reached from the "Live scores and table" button in the Overview gameweek card, shown only while the GW is in progress. Hero = my team (or the leader): live score, live rank + movement, gap to the team above; then the live table (rank, movement since the deadline, captain, chip/hit, GW points + players left, total), my row highlighted. Refetches every 60 s only while live (react-query pauses it in a hidden tab). Helpers in `src/live.ts` (tested).
- Testing while nothing is live: `?event=N` (endpoint and page, e.g. `/league/1700002/live?event=10`) shows the same view for an earlier GW of the league from stored points, marked "Finished", without auto refresh. Only GWs from the league start to the current one are accepted.

## Backlog

1. **Polish**: lazy-load the chart code (Overview chunk is ~400 KB, mostly Recharts); mark managers who joined mid-season in charts and the race.
2. **Deployment** (postponed by the user, 2026-11-13). Agreed plan, all free tiers:
   - Vercel Hobby (frontend), Render free web service (backend), Neon free Postgres (`FPL_DATABASE_URL`).
   - Render free sleeps after ~15 min idle: 30–60 s cold start, and the in-process 06:00 refresh won't fire while asleep. Fix with a free scheduled ping (GitHub Actions cron or cron-job.org). Always-on Render is ~$7/month if needed.
   - User: create the three accounts with GitHub, copy the Neon connection string, connect the repo.
   - Us (one PR): Postgres URL support check, `render.yaml`, `vercel.json` rewriting `/api/*` to Render, wake-up cron, `docs/DEPLOY.md`.
   - Check the providers' current free-tier limits at signup time.

## How we work

- One branch per feature, PR against `master`. The user merges, then we continue.
- **No Claude / co-author attribution** in commits or PRs.
- **Mobile first**: check every screen at 375px, in both themes.
- Checks before a PR: backend `ruff format`, `ruff check`, `pytest`; frontend `tsc -b`, `eslint src`, `vitest run`, `npm run build`.

## Dev notes

- Run locally (Windows, Git Bash):
  - Backend: `cd backend && .venv/Scripts/uvicorn app.main:app --port 8000`. There's no `--reload` (unreliable on Windows); restart after backend changes.
  - Frontend: `cd frontend && npm run dev`, then open http://localhost:5173.
  - Test league: `/league/1700002` (11 managers, real data).
- Phone screenshots: headless Chrome can't go below ~500px wide, so put a wrapper page with a 375px iframe in `frontend/public/__phone.html`. It can set `localStorage.theme` first. Screenshot it with `chrome --headless=new --screenshot`, then delete the wrapper.
- Tailwind v4 drops theme variables that no utility class uses. Variables read only from JS (e.g. `chipColor()` → `var(--color-chip-3xc)`) must sit in an `@theme static` block.
- Shared queries for awards and transfers are in `frontend/src/queries.ts`, and shared UI in `components/Segmented.tsx` and `components/GameweekPills.tsx`.
- `Transfer.in_points` / `out_points` come from stored live points and are `null` until that gameweek is collected by the background backfill.
