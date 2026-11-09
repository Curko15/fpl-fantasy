from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Path, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.cache import TtlCache
from app.config import settings
from app.fpl_client import FplClient, FplError, make_http_client
from app.league import LeagueError, LeagueOverview, build_league_overview
from app.manager import ManagerDetail, build_manager_detail, live_points
from app.transfers import LeagueTransfers, build_league_transfers

LeagueId = Path(gt=0, le=2_147_483_647)
EntryId = Path(gt=0, le=2_147_483_647)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    async with make_http_client() as http:
        app.state.fpl = FplClient(http)
        app.state.cache = TtlCache(settings.league_cache_seconds)
        app.state.finished_cache = TtlCache(settings.finished_gameweek_cache_seconds)
        app.state.live_cache = TtlCache(settings.live_cache_seconds)
        yield


app = FastAPI(title="FPL League Tracker API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.exception_handler(LeagueError)
async def league_error_handler(_: Request, exc: LeagueError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status, content={"detail": {"code": exc.code, "message": exc.message}}
    )


@app.exception_handler(FplError)
async def fpl_error_handler(_: Request, exc: FplError) -> JSONResponse:
    return JSONResponse(
        status_code=502,
        content={
            "detail": {
                "code": "fpl_unavailable",
                "message": "The FPL website isn't responding right now. Try again in a minute.",
            }
        },
    )


async def _bootstrap(request: Request) -> dict[str, Any]:
    fpl: FplClient = request.app.state.fpl
    return await request.app.state.cache.get_or_load("bootstrap", fpl.bootstrap)


async def _overview(request: Request, league_id: int) -> LeagueOverview:
    fpl: FplClient = request.app.state.fpl

    async def load() -> LeagueOverview:
        return await build_league_overview(fpl, league_id, await _bootstrap(request))

    return await request.app.state.cache.get_or_load(("league", league_id), load)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/leagues/{league_id}", response_model=LeagueOverview)
async def get_league(request: Request, league_id: int = LeagueId) -> LeagueOverview:
    return await _overview(request, league_id)


@app.get("/api/leagues/{league_id}/transfers", response_model=LeagueTransfers)
async def get_league_transfers(request: Request, league_id: int = LeagueId) -> LeagueTransfers:
    overview = await _overview(request, league_id)

    async def load() -> LeagueTransfers:
        return await build_league_transfers(
            request.app.state.fpl, overview, await _bootstrap(request)
        )

    return await request.app.state.cache.get_or_load(("transfers", league_id), load)


@app.get("/api/leagues/{league_id}/managers/{entry_id}", response_model=ManagerDetail)
async def get_manager(
    request: Request, league_id: int = LeagueId, entry_id: int = EntryId
) -> ManagerDetail:
    overview = await _overview(request, league_id)
    manager = next((m for m in overview.managers if m.entry_id == entry_id), None)
    if manager is None:
        raise LeagueError("manager_not_found", "That manager isn't in this league.", 404)

    fpl: FplClient = request.app.state.fpl
    bootstrap = await _bootstrap(request)
    finished = {e["id"] for e in bootstrap["events"] if e.get("finished")}

    def cache_for(event: int) -> TtlCache:
        state = request.app.state
        return state.finished_cache if event in finished else state.live_cache

    async def load_picks(event: int) -> dict[str, Any]:
        return await cache_for(event).get_or_load(
            ("picks", entry_id, event), lambda: fpl.entry_picks(entry_id, event)
        )

    async def load_live(event: int) -> dict[int, int]:
        async def load() -> dict[int, int]:
            return live_points(await fpl.event_live(event))

        return await cache_for(event).get_or_load(("live", event), load)

    return await build_manager_detail(overview, manager, bootstrap, load_picks, load_live)
