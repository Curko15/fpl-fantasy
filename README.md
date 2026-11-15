# FPL League Tracker

**Follow everything that happens in your Fantasy Premier League mini-league, in one place.**

### 🌐 Live: **https://fpl-fantasy.vercel.app**

Open it, enter your **classic league ID**, and you get the full story of your league: the
table and how it moved, every transfer, every chip, weekly awards, a matchday recap,
head-to-heads and live scores. No account, no login, nothing to install. It is built for
phones first and can be added to your home screen like an app.

> Your league ID is in the URL of the league on the FPL site:
> `fantasy.premierleague.com/leagues/`**`123456`**`/standings/c`

## Links

| What | URL |
|---|---|
| **Website** | https://fpl-fantasy.vercel.app |
| A league | `https://fpl-fantasy.vercel.app/league/<league-id>` |
| Backend API | https://fpl-league-api-k4w0.onrender.com |
| API health check | https://fpl-league-api-k4w0.onrender.com/api/health |
| API docs (Swagger) | https://fpl-league-api-k4w0.onrender.com/docs |
| Source code | https://github.com/Curko15/fpl-fantasy |
| CI/CD runs | https://github.com/Curko15/fpl-fantasy/actions |
| Hosting dashboards | [Vercel](https://vercel.com/dashboard) (frontend) · [Render](https://dashboard.render.com) (backend) · [Neon](https://console.neon.tech) (database) |

The backend runs on Render's free plan, which sleeps after 15 minutes without visitors.
The first visit after a quiet spell can take up to a minute while it wakes up; after that
it is fast.

## Features

### Your team
Pick your team once in the **"Your team" bar** at the top of every league screen (or tap
*This is my team* on a manager page). From then on you are highlighted everywhere: your row
in the table (pinned under the top 10 if you're further down), your transfers, your chips,
your awards and your line in the charts. It is remembered per league on your device and can
be switched at any time.

### Overview (league home)
- Gameweek card for the latest gameweek, plus a **Live scores** button while a gameweek is
  being played
- Swipeable award cards for the latest gameweek
- Standings table with gameweek points, rank movement and a rank-form sparkline per manager
- Transfer pulse and the chips still left to play
- **Season charts**
  - **Focus:** your gap to the leader (or your league position) over the season, with the
    leader and your closest rivals highlighted and everyone else faint. Search to add anyone.
  - **Race:** an animated bar-chart race of the top 12 (plus you) through every gameweek,
    with play/pause and a slider to jump to any week. Managers level on points share the
    rank but keep their own row.
  - **Your weeks vs the league:** every gameweek's spread of scores, the median, and where
    your score landed, with your best and worst weeks.

### Transfers
- **Feed:** every transfer in the league with a verdict on the swap (who outscored whom),
  tagged as free, **hit (-4)**, Wildcard or Free Hit
- **Market:** move of the week and the week's howler, the most bought (*In demand*) and most
  sold (*Shown the door*) players, and every move of the gameweek
- Filter by gameweek

### Chips
- One card per chip showing who played it, when and for how many points
- A season timeline of chip usage, split by season half, with the next chip deadline
- Chip rules are read from FPL itself, so it keeps working when FPL changes them

### Awards 🏆
- **Recap** (default): a generated headline for the gameweek with a podium, *The week in
  moments* (awards, chips, hits, biggest climb and drop) and the rest of the table
- **Awards:** Manager of the Week plus heroes and villains of the gameweek
- **Season:** a running Hall of Fame / Hall of Shame

| Award | Who gets it |
|---|---|
| 👑 **Manager of the Week** | Highest score of the gameweek |
| 🥄 **Loser of the Week** | Lowest score of the gameweek |
| 🪑 **Bench Loser** | Left the highest-scoring player on the bench |
| 🍀 **Lucky Sub** | A starter didn't play, and the bench player who came on scored big |
| 🛟 **Vice-Captain Saviour** | Captain didn't play, vice-captain's double points saved the week |
| 🤡 **Captain Fail** | Worst captain pick, extra shame if the rest of the league captained a haul |
| 💸 **Hit Regret** | Took a points hit, and the new players didn't even earn it back |
| 🔙 **Sold Too Soon** | Sold a player who scored big that same week |
| 🎯 **Chip Flop** | Played a chip and still scored below their own average |

### Manager pages
- Rank, total, gap to first place, and *This is my team* / *Compare with …* buttons
- Season in numbers and *Weeks vs the league*
- **Top contributors:** which players scored the most for this manager, with captain bonus
  shown separately (e.g. *Salah: 187 pts, 62 from captaincy*)
- Gameweek-by-gameweek log (points, rank, captain, chips) and full transfer history

### Head-to-head
`/league/<id>/compare?a=<entry>&b=<entry>`: two managers side by side: the points gap, the
gameweek win/loss record and biggest wins, a gap chart over the season, side-by-side stats
and every gameweek with both captains.

### Live gameweek
`/league/<id>/live`: while a gameweek is being played, live points (captain, Triple Captain
and Bench Boost included, hits deducted), the live table with movement since the deadline,
captains, chips and players still to play. Refreshes every minute. Points are provisional
until FPL applies auto-subs after the gameweek.

### Good to know
- Light and dark themes (follows your phone, or pick one)
- Managers who joined mid-season are marked *Joined GWn*, since their totals cover fewer weeks
- Leagues up to **50 managers**, classic scoring only

## How it works

```
Phone / browser                Vercel                Render                  FPL
┌────────────────┐   page    ┌──────────┐
│ React app      │ ◄──────── │ frontend │
│                │   /api    └──────────┘     ┌─────────────────┐  fetch  ┌──────────────┐
│                │ ─────────────────────────► │ FastAPI backend │ ──────► │ Official FPL │
└────────────────┘                            └────────┬────────┘         │ API          │
                                                       │                  └──────────────┘
                                                ┌──────▼──────┐
                                                │ Neon        │
                                                │ PostgreSQL  │
                                                └─────────────┘
```

- The backend fetches league data from the public FPL API, stores FPL's raw responses in the
  database and computes every page from them, so new features need no migrations.
- The **first visit** to a league takes a few seconds while its data is fetched. After that
  it loads from the database, and every manager's gameweek teams are fetched in the background.
- A **daily refresh** at 06:00 UTC updates every league viewed in the last 14 days (run by a
  GitHub Action, see below). A league older than 26 hours is also refreshed in the background
  when someone opens it. Finished gameweeks never change, so they're fetched only once.
- During a live gameweek, FPL's live points are fetched at most once a minute per gameweek,
  however many people are watching.

## Tech stack

| Part | Technology | Hosted on |
|---|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query, React Router, Recharts | Vercel (Hobby, free) |
| Backend | Python 3.13, FastAPI, httpx, SQLAlchemy (async), APScheduler | Render (free) |
| Database | SQLite locally, PostgreSQL in production | Neon (free, Frankfurt) |
| CI/CD | GitHub Actions | GitHub |

## Deployment and CI/CD

Every push and pull request runs [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml):

```
push / PR ──► Backend tests  (ruff, pytest)          ─┐
              Frontend tests (eslint, vitest, build)  ─┴─► master only, all green:
                                                            ├─► Deploy backend  → Render (deploy hook)
                                                            └─► Deploy frontend → Vercel (CLI)
```

- **Pull requests** only run the tests.
- **Merging to `master`** runs the tests and, only if they all pass, deploys both parts.
  Render's and Vercel's own auto-deploys are off, so failing code never goes live.
- [`.github/workflows/daily-refresh.yml`](.github/workflows/daily-refresh.yml) wakes the
  backend at 06:00 UTC and starts the daily refresh through `POST /api/refresh`.
- Both workflows can also be started by hand: **Actions → workflow → Run workflow**.

Settings used by the pipeline (GitHub → Settings → Secrets and variables → Actions):

| Name | Kind | Value |
|---|---|---|
| `API_URL` | variable | Backend URL; also baked into the frontend build |
| `RENDER_DEPLOY_HOOK` | secret | Render → service → Settings → Deploy Hook |
| `VERCEL_TOKEN` | secret | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | secret | Vercel team → Settings → General → Team ID |
| `VERCEL_PROJECT_ID` | secret | Vercel project → Settings → General → Project ID |
| `REFRESH_TOKEN` | secret | Same value as `FPL_REFRESH_TOKEN` on Render |

The full setup, step by step (accounts, Neon, Render blueprint, Vercel, secrets), is in
[docs/DEPLOY.md](docs/DEPLOY.md).

## API

All endpoints are `GET` unless noted. Interactive docs: https://fpl-league-api-k4w0.onrender.com/docs

| Endpoint | Returns |
|---|---|
| `/api/health` | `{"status": "ok"}` |
| `/api/leagues/{league_id}` | Standings, history per manager, gameweeks |
| `/api/leagues/{league_id}/transfers` | Every transfer with points before/after |
| `/api/leagues/{league_id}/managers/{entry_id}` | One manager: contributors, GW log, transfers |
| `/api/leagues/{league_id}/awards` | Gameweek awards and season tallies |
| `/api/leagues/{league_id}/live` | Live points and table while a GW is in progress (`?event=N` for a past GW) |
| `POST /api/refresh` | Starts the daily refresh. Needs `Authorization: Bearer <FPL_REFRESH_TOKEN>` |

## Project structure

```
backend/              Python + FastAPI: fetches and caches FPL data, computes stats and awards
  app/                  main.py (routes), store.py (cache + fetching), league/awards/live/... (features)
  tests/                pytest
frontend/             React + TypeScript: the website
  src/pages/            one file per screen
  src/components/       shared UI and charts
  src/*.ts              pure helpers with Vitest tests (seasonCharts, recap, headToHead, live, ...)
docs/                 PLAN.md (plan), DEPLOY.md (deployment), HANDOFF.md (project state and conventions)
.github/workflows/    ci-cd.yml, daily-refresh.yml
render.yaml           Render blueprint for the backend
```

## Running locally

**Backend** (Python 3.12+):

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -e ".[dev]"
uvicorn app.main:app --port 8000
```

Data is stored in a local SQLite file, `backend/fpl.db`, created on first start. Delete it to
start from scratch.

**Frontend** (Node 20+), in a second terminal:

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173, forwards /api calls to the backend
```

If the backend runs on a different port, set `API_URL`
(e.g. `API_URL=http://localhost:8010 npm run dev`).

**Checks** (the same ones CI runs):

```bash
cd backend  && ruff format --check . && ruff check . && pytest
cd frontend && npm run lint && npm test && npm run build
```

## Configuration

Backend settings come from environment variables (or `backend/.env` locally):

| Variable | Default | Purpose |
|---|---|---|
| `FPL_DATABASE_URL` | `sqlite+aiosqlite:///./fpl.db` | Database. A Postgres URL in production; Neon/Render `postgres://…?sslmode=require` URLs work as-is (`pip install -e ".[postgres]"`) |
| `FPL_CORS_ORIGINS` | `["http://localhost:5173"]` | JSON list of sites allowed to call the API. Production: `["https://fpl-fantasy.vercel.app"]` |
| `FPL_REFRESH_TOKEN` | *(empty: disabled)* | Token for `POST /api/refresh` |
| `FPL_REFRESH_HOUR_UTC` | `6` | Hour of the in-process daily refresh (when the server is awake) |
| `FPL_REFRESH_RECENT_DAYS` | `14` | Only leagues viewed within this many days are refreshed |
| `FPL_STALE_AFTER_HOURS` | `26` | Older leagues are refreshed in the background when opened |
| `FPL_MAX_LEAGUE_SIZE` | `50` | Largest league the app accepts |

Frontend (build time):

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | *(empty)* | Backend URL in production. Set by CI from `API_URL`; empty locally, where Vite proxies `/api` |

## Disclaimer

This is an unofficial fan project and is not affiliated with the Premier League or
Fantasy Premier League. It only reads publicly available data from the FPL API.
