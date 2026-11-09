# FPL League Tracker — Plan

A website where anyone enters an FPL **classic** league ID and sees the full story of
their league: rank history, transfers, chips, and who scored the points.

## Decisions

| Topic | Decision |
|---|---|
| Leagues | Any classic league, entered by ID. H2H not supported (for now). |
| League size cap | **50 managers.** Larger leagues are rejected with a clear message. |
| Accounts | None. "Recent leagues" stored in the browser (localStorage). |
| Data freshness | Refreshed **daily at a fixed time** for recently viewed leagues. |
| Frontend | React + TypeScript + Vite, Tailwind CSS + shadcn/ui, Recharts, TanStack Query. |
| Backend | Python + FastAPI, `httpx` (async) for FPL calls, APScheduler for the daily job. |
| Database | PostgreSQL in production, SQLite locally. |
| Hosting (planned) | Frontend: Vercel/Netlify/Cloudflare Pages. Backend: Render/Fly.io. DB: Neon/Supabase. |
| Layout | **Mobile-first.** Most friends open it on phones: design every screen for ~375px first, no horizontal page scroll, tap targets ≥44px, charts readable on narrow screens. |

## Architecture

```
Browser (React)  ──>  Our backend (FastAPI)  ──>  FPL API (fantasy.premierleague.com/api)
                          │
                          └── Database (cache of league/manager/gameweek data)
```

- The browser cannot call the FPL API directly (CORS), so the backend proxies and caches.
- First visit to a league: backend fetches everything (rate-limited), stores it, returns it.
  Frontend shows a loading state ("Loading 24 managers…").
- Later visits: served from the database.
- Daily job: refresh every league viewed in the last N days.

### FPL endpoints used

| Data | Endpoint |
|---|---|
| Players, teams, gameweeks, chip definitions | `/api/bootstrap-static/` |
| League members | `/api/leagues-classic/{league_id}/standings/?page_standings=N` |
| Per-GW points/rank/chips for a manager | `/api/entry/{entry_id}/history/` |
| All transfers of a manager | `/api/entry/{entry_id}/transfers/` |
| Team, captain, chip for a GW | `/api/entry/{entry_id}/event/{gw}/picks/` |
| Player points per GW | `/api/event/{gw}/live/` |

## Features

### v1 — Core

1. **Home** — league ID input (with hint where to find it), recent leagues, clear errors
   (invalid ID, >50 managers, H2H league).
2. **League overview** — standings table (rank, movement, total, GW points); league
   position chart across all GWs (toggle managers, hover tooltips); cumulative points chart;
   "last updated" timestamp.
3. **Transfers** — league-wide feed (manager, GW, out → in, prices), tagged
   free / hit / Wildcard / Free Hit; filters by manager and GW; per-manager totals and hit cost.
4. **Chips** — managers × chips grid showing GW used and points scored that GW. Chip types
   and counts come from the API, never hardcoded (rules change between seasons).
5. **Manager page** — top contributing players (points while in starting XI, captain bonus
   included and shown separately); GW-by-GW points/rank/chip; transfer history.
6. **Gameweek awards** — a row of award cards per GW (manager, player, numbers), plus a
   season **Hall of Fame / Hall of Shame** counting how often each manager won each award.

   | Award | Rule |
   |---|---|
   | 🪑 Bench Loser | Highest-scoring **single** player left on the bench. Excludes players who came on as auto-subs and Bench Boost GWs. Tiebreak: total bench points. |
   | 🍀 Lucky Sub | Biggest points from an automatic substitution (starter didn't play, bench player came on). |
   | 🛟 Vice-Captain Saviour | Captain didn't play; vice-captain's doubled points rescued the GW. Ranked by vice's points. |
   | 🤡 Captain Fail | Lowest captain score, extra shame when most of the league captained someone who hauled. |
   | 💸 Hit Regret | Took a hit (-4/-8…) and the players bought scored less than the hit cost that GW. |
   | 🔙 Sold Too Soon | Sold a player who scored big in the same GW. Ranked by the sold player's points. |
   | 🎯 Chip Flop | Played Bench Boost / Triple Captain / Free Hit and scored below own season average. |
   | 👑 Manager of the Week | Highest GW score (after hits). |
   | 🥄 Loser of the Week | Lowest GW score (after hits). |

   Awards with no eligible manager in a GW (e.g. nobody took a hit) are simply not shown.

### v2 — Insights

- Captaincy analysis (captain points vs best possible captain in hindsight)
- Bench points (per GW and total)
- Gameweek view extras (most captained, chips played) — best/worst manager moved to v1 awards
- Transfer hindsight (did player in outscore player out over next N GWs)
- Season awards ("Most hits", "Bench king", "Best captain picker", "Biggest climber")
- Head-to-head comparison of two managers

### Later

- Live points during gameweeks
- H2H leagues
- Season archives (FPL API resets each summer; we'd snapshot before reset)

## Edge cases to handle

- **Late joiners** — no data for early GWs; show gaps, not zeros.
- **Auto-subs & vice-captain** — "top contributors" must use points that actually counted.
- **Free Hit** — squad reverts next GW; those transfers are not lasting squad changes.
- **Hits** — API gives hit cost per GW, not per transfer; we infer which transfers were paid.
- **Pre-season / season reset** — no GW data before GW1; show a friendly "season hasn't
  started" state.
- **Rate limiting** — throttle and retry FPL calls; never hammer the API.
- **Award ties** — multiple managers can share an award; show all of them.
- **Awards for the current GW** — only computed once the GW is finished (`finished` flag in
  bootstrap-static), so live-updating points don't produce awards that later change.
