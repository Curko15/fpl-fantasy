import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Path, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.fpl_client import FplClient, FplError, make_http_client
from app.league import LeagueError, LeagueOverview, build_league_overview


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    async with make_http_client() as http:
        app.state.fpl = FplClient(http)
        app.state.league_cache = {}
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


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/leagues/{league_id}", response_model=LeagueOverview)
async def get_league(
    request: Request, league_id: int = Path(gt=0, le=2_147_483_647)
) -> LeagueOverview:
    cache: dict[int, tuple[float, LeagueOverview]] = request.app.state.league_cache
    cached = cache.get(league_id)
    if cached and time.monotonic() - cached[0] < settings.league_cache_seconds:
        return cached[1]
    overview = await build_league_overview(request.app.state.fpl, league_id)
    cache[league_id] = (time.monotonic(), overview)
    return overview
