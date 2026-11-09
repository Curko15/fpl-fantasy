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
from app.transfers import LeagueTransfers, build_league_transfers

LeagueId = Path(gt=0, le=2_147_483_647)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    async with make_http_client() as http:
        app.state.fpl = FplClient(http)
        app.state.cache = TtlCache(settings.league_cache_seconds)
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
