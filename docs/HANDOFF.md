# Handoff: where the project stands (2026-11-13)

Read this first in a new session, together with `docs/PLAN.md`.

## State of the code

| PR | Branch | Status | What |
|---|---|---|---|
| #1–#11 | – | merged | v1 features (overview, transfers, chips, manager page, database + daily refresh, awards), player photos, app shell + bottom tabs, skeletons, PWA, home page |
| #12 | `dashboard` | **open** | League home as a dashboard (design A "Floodlight") + System / Light / Dark theme switch |
| #13 | `tabs-redesign` | **open, stacked on #12** | Transfers (Feed / Market), Chips (cards + timeline), Awards (Gameweek / Season) |

Merge #12, then #13. Branch new work from `master` after both are merged. If they're still open, branch from `tabs-redesign` and say so in the PR.

## Design decisions (all chosen by the user from canvas prototypes)

Prototype canvas (private to the user): https://claude.ai/artifact/7yzcePz8fTcqbTvpxAECae

- **Look**: design A "Floodlight". Dark: near-black `#0a0b0d`, cards `#15171b`, neon green `#3dffa2`. Light theme in the style of design B "Bento": warm paper `#f4f3ef`, purple `#4b1d8f`, lime `#d7f36b`. Fonts: Space Grotesk (headings, numbers), Inter (text). Tokens are in `frontend/src/index.css`, and the theme logic is in `frontend/src/theme.ts`.
- **League home** (`OverviewTab`): gameweek card, swipeable award cards, table with rank-form sparklines, transfer pulse, chips still to play, season chart.
- **Transfers**: T1 feed (swap verdicts) + T2 market, behind a Feed / Market switch sharing one gameweek selector.
- **Chips**: C3 one card per chip + C2 timeline, with a season-half switch and a deadline card.
- **Awards**: W1 gameweek view (Manager of the Week spotlight, Heroes / Villains tiles) + W3 season race, behind a Gameweek / Season switch.

## Next task: season chart for big leagues

The current `LeagueChart` (Recharts, up to N selectable lines + chips per manager) turns into spaghetti with 50 managers. The user picked **three** prototypes from the canvas row "Season chart for a 50-manager league" and wants **all of them**:

1. **S1 · Focus on my team + behind the leader** (main chart)
   - The user picks **"my team"** once per league (saved in `localStorage`, e.g. key `myTeam:<leagueId>`). Until it's set, default to the leader and show a prompt like "Which team is yours?".
   - Highlighted lines: my team (thick, accent), the leader, and the 2 managers directly above and below me. Everyone else is faint grey.
   - Switch: **Behind leader** (points behind first place; the leader is flat at 0) / **League position**.
   - A list of the highlighted teams with rank and value, a "Change team" action, and a search box to add any other manager to compare (replaces the wall of 50 chips).
   - Small leagues (≤ ~8 managers) can still highlight everyone.
2. **S4 · Gameweek score spread** ("Your weeks vs the league")
   - For each gameweek: a dot per manager's score, a band for the middle half (p25–p75), and a median tick. My team's dots are highlighted and joined by a line.
   - Stats below: "Above median X / N gameweeks", best week (score, GW, rank that week), worst week.
   - Needs "my team" (shared with S1). It would also suit the manager page, showing that manager.
3. **S5 · Bar chart race** ("The title race")
   - Top 12 + my team as horizontal bars, sorted by total after the selected GW. A ▶ play button animates GW by GW (about 0.9 s per GW), and a slider jumps to any GW.
   - Keep a stable element per manager so bars slide (`top` transition), not re-render.

**Suggested placement**: the Overview "Season so far" section gets a switch **Focus / Race**: S1 and S5. **S4** is its own section below it ("Your weeks vs the league"), shown once my team is set. All data is already in `LeagueOverview` (`managers[].history[]` has points, total, league_rank per GW), so **no backend change** is needed. Put the maths in pure helpers (like `dashboard.ts`) with Vitest tests. Respect `prefers-reduced-motion` for the race animation.

The "my team" choice can also later drive "you" highlights elsewhere (table row, awards).

## Backlog after that

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
