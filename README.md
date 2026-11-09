# FPL League Tracker

**Follow everything that happens in your Fantasy Premier League mini-league, in one place.**

Playing FPL with a big group of friends is fun, but the official site makes it hard to see
the bigger picture: who made which transfers, how the table changed week by week, who has
already burned their chips, and which players actually carried each manager.

FPL League Tracker fixes that. Enter your **classic league ID** and you get the full story
of your league. No account, no login, nothing to install.

> Status: early development. See [docs/PLAN.md](docs/PLAN.md) for the full plan.

## Features

### League overview
- Standings table with total points, gameweek points and rank movement
- **League position chart** across every gameweek: watch the title race and the relegation
  battle unfold, and toggle managers on or off
- Cumulative points chart to see how big the gaps really are

### Transfers
- A feed of every transfer in the league: who sold whom, who bought whom, and when
- Each transfer tagged as **free**, **hit (-4)**, **Wildcard** or **Free Hit**
- Filter by manager or gameweek, and see who has thrown away the most points on hits

### Chips
- A grid of every manager × every chip, showing when it was played and how many points it
  earned
- Chip rules are read from FPL itself, so it keeps working when FPL changes them

### Manager pages
- **Top contributors:** which players scored the most points for this manager, with captain
  bonus shown separately (e.g. *Salah: 187 pts, 62 from captaincy*)
- Gameweek-by-gameweek points, rank and chips
- Full transfer history

### Gameweek awards 🏆
Every finished gameweek hands out awards, and a season-long **Hall of Fame / Hall of Shame**
keeps count.

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

### Coming later
Captaincy analysis, bench points, transfer hindsight, season awards, head-to-head manager
comparison, and eventually live points and H2H leagues.

## How it works

```
Browser (React)  ──>  Backend (FastAPI)  ──>  Official FPL API
                          │
                          └── Database (cached league data)
```

- The backend fetches league data from the public FPL API, stores it, and works out the
  stats and awards.
- The first visit to a league takes a few seconds while its data is fetched. After that it
  loads instantly from the database, and every manager's gameweek teams are fetched in the
  background.
- Data is refreshed **once a day** for every league that people have looked at recently.
  Finished gameweeks never change, so they are fetched only once.
- Leagues are limited to **50 managers**. Classic scoring only for now.

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, TanStack Query, Recharts |
| Backend | Python, FastAPI, httpx |
| Database | SQLite locally, PostgreSQL in production |

## Project structure

```
backend/    Python + FastAPI: fetches and caches FPL data, computes stats and awards
frontend/   React + TypeScript: the website
docs/       Plan and design notes
```

## Running locally

**Backend** (Python 3.12+):

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
pytest                        # run tests
```

Data is stored in a local SQLite file, `backend/fpl.db`, created on first start. Delete it to
start from scratch. Settings are read from environment variables (or `backend/.env`):

| Variable | Default | Purpose |
|---|---|---|
| `FPL_DATABASE_URL` | `sqlite+aiosqlite:///./fpl.db` | Use a Postgres URL in production (`postgres://…` works as-is; install with `pip install -e ".[postgres]"`) |
| `FPL_REFRESH_HOUR_UTC` | `6` | Hour of the daily refresh |
| `FPL_REFRESH_RECENT_DAYS` | `14` | Only leagues viewed within this many days are refreshed |
| `FPL_STALE_AFTER_HOURS` | `26` | Older leagues are refreshed in the background when opened |

**Frontend** (Node 20+), in a second terminal:

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173, forwards /api calls to the backend
```

If the backend runs on a different port, set `API_URL`
(e.g. `API_URL=http://localhost:8010 npm run dev`).

## Disclaimer

This is an unofficial fan project and is not affiliated with the Premier League or
Fantasy Premier League. It only reads publicly available data from the FPL API.
