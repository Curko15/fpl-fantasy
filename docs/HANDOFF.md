# Handoff: where the project stands (2026-11-13)

Read this first in a new session, together with `docs/PLAN.md`.

## State of the code

| PR | Branch | Status | What |
|---|---|---|---|
| #1–#11 | – | merged | v1 features (overview, transfers, chips, manager page, database + daily refresh, awards), player photos, app shell + bottom tabs, skeletons, PWA, home page |
| #12 | `dashboard` | **open** | League home as a dashboard (design A "Floodlight") + System / Light / Dark theme switch |
| #13 | `tabs-redesign` | **open, stacked on #12** | Transfers (Feed / Market), Chips (cards + timeline), Awards (Gameweek / Season) |
| #14 | `season-charts` | **open, stacked on #13** | Season charts for big leagues: Focus + Race switch, "Your weeks vs the league", "my team" choice |

Merge #12, then #13, then #14. Branch new work from `master` after both are merged. If they're still open, branch from `tabs-redesign` and say so in the PR.

## Design decisions (all chosen by the user from canvas prototypes)

Prototype canvas (private to the user): https://claude.ai/artifact/7yzcePz8fTcqbTvpxAECae

- **Look**: design A "Floodlight". Dark: near-black `#0a0b0d`, cards `#15171b`, neon green `#3dffa2`. Light theme in the style of design B "Bento": warm paper `#f4f3ef`, purple `#4b1d8f`, lime `#d7f36b`. Fonts: Space Grotesk (headings, numbers), Inter (text). Tokens are in `frontend/src/index.css`, and the theme logic is in `frontend/src/theme.ts`.
- **League home** (`OverviewTab`): gameweek card, swipeable award cards, table with rank-form sparklines, transfer pulse, chips still to play, season chart.
- **Transfers**: T1 feed (swap verdicts) + T2 market, behind a Feed / Market switch sharing one gameweek selector.
- **Chips**: C3 one card per chip + C2 timeline, with a season-half switch and a deadline card.
- **Awards**: W1 gameweek view (Manager of the Week spotlight, Heroes / Villains tiles) + W3 season race, behind a Gameweek / Season switch.

## Season charts (done in #14)

- "My team" is saved per league in `localStorage` (`myTeam:<leagueId>`, `src/myTeam.ts`, hook `useMyTeam`). Until it's set, Focus centres on the leader and a "Which team is yours?" card shows.
- Maths in `src/seasonCharts.ts` (tested): `focusTeams`, `seasonRows`, `scoreSpread` / `spreadStats`, `racePool` / `raceFrame`.
- Components: `FocusChart` (S1), `TitleRace` (S5), `ScoreSpread` (S4), `MyTeamPicker`. Chart hex colours live in `src/chartColors.ts` (keep in step with `index.css`).
- Highlight colours: me = accent, leader = ink, up to 5 rivals from a validated subset of the categorical palette, so at most 5 rivals + compares. Leagues of ≤ 7 highlight everyone.
- "Behind leader" scales to the highlighted lines; faint far-behind lines run off the bottom on purpose.
- Not done yet: using "my team" elsewhere (table row, awards), and S4 on the manager page.

## Backlog

1. **Matchday recap** (from prototype C "Matchday feed"): a new feature/tab with the GW headline ("Ivan storms to 3rd with the week's best 81"), a top-3 podium, and a "week in moments" timeline mixing awards, chips played, hits and captain fails.
2. **Manager page restyle**: the last screen still in the old style.
3. **Deployment**: Vercel (frontend) + Render (backend) + Neon (Postgres), as in `docs/PLAN.md`. The user needs to create the accounts.

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
