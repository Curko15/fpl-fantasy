from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Path, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.awards import LeagueAwards, build_league_awards
from app.config import settings
from app.db import create_tables, make_engine, make_sessionmaker
from app.fpl_client import FplClient, FplError, make_http_client
from app.league import LeagueError, LeagueOverview, build_league_overview
from app.live import LiveLeague, build_live_league
from app.manager import ManagerDetail, build_manager_detail
from app.refresh import start_scheduler
from app.store import BOOTSTRAP_MAX_AGE, FplStore
from app.transfers import LeagueTransfers, build_league_transfers

LeagueId = Path(gt=0, le=2_147_483_647)
EntryId = Path(gt=0, le=2_147_483_647)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    engine = make_engine(settings.database_url)
    await create_tables(engine)
    async with make_http_client() as http:
        store = FplStore(FplClient(http), make_sessionmaker(engine))
        app.state.store = store
        scheduler = start_scheduler(store) if settings.background_jobs else None
        try:
            yield
        finally:
            if scheduler:
                scheduler.shutdown(wait=False)
            await store.wait_for_background()
    await engine.dispose()


app = FastAPI(title="FPL League Tracker API", version="0.2.0", lifespan=lifespan)

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


def _store(request: Request) -> FplStore:
    return request.app.state.store


async def _overview(store: FplStore, league_id: int) -> LeagueOverview:
    data = await store.league(league_id)
    return build_league_overview(
        data.standings, data.histories, await store.bootstrap(), data.fetched_at
    )


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/leagues/{league_id}", response_model=LeagueOverview)
async def get_league(request: Request, league_id: int = LeagueId) -> LeagueOverview:
    return await _overview(_store(request), league_id)


@app.get("/api/leagues/{league_id}/transfers", response_model=LeagueTransfers)
async def get_league_transfers(request: Request, league_id: int = LeagueId) -> LeagueTransfers:
    store = _store(request)
    data = await store.league(league_id)
    bootstrap = await store.bootstrap()
    overview = build_league_overview(data.standings, data.histories, bootstrap, data.fetched_at)
    return build_league_transfers(overview, data.transfers, bootstrap, await store.stored_live())


@app.get("/api/leagues/{league_id}/managers/{entry_id}", response_model=ManagerDetail)
async def get_manager(
    request: Request, league_id: int = LeagueId, entry_id: int = EntryId
) -> ManagerDetail:
    store = _store(request)
    overview = await _overview(store, league_id)
    manager = next((m for m in overview.managers if m.entry_id == entry_id), None)
    if manager is None:
        raise LeagueError("manager_not_found", "That manager isn't in this league.", 404)

    events = [h.event for h in manager.history]
    picks = await store.picks(entry_id, events)
    live = await store.live(events)
    return build_manager_detail(overview, manager, await store.bootstrap(), picks, live)


@app.get("/api/leagues/{league_id}/awards", response_model=LeagueAwards)
async def get_league_awards(request: Request, league_id: int = LeagueId) -> LeagueAwards:
    """Built only from stored data. Gameweeks still being backfilled come back as pending."""
    store = _store(request)
    data = await store.league(league_id)
    bootstrap = await store.bootstrap()
    overview = build_league_overview(data.standings, data.histories, bootstrap, data.fetched_at)
    awards = build_league_awards(
        overview,
        bootstrap,
        await store.stored_picks(data.histories),
        await store.stored_live(),
        data.transfers,
    )
    if awards.pending_events:
        store.spawn(("backfill", league_id), store.backfill_picks(league_id))
    return awards


@app.get("/api/leagues/{league_id}/live", response_model=LiveLeague)
async def get_league_live(
    request: Request,
    league_id: int = LeagueId,
    event: int | None = Query(None, gt=0, le=60),
) -> LiveLeague:
    """Live scores and table for the gameweek being played.

    Without `event`, returns `live: false` and no managers when no gameweek is in progress.
    `event` shows the same view for an earlier gameweek of this league, from stored points
    (used to check the page while nothing is live).
    """
    store = _store(request)
    data = await store.league(league_id)
    # Notice a gameweek starting or finishing within the hour.
    bootstrap = await store.bootstrap(max_age=BOOTSTRAP_MAX_AGE)
    overview = build_league_overview(data.standings, data.histories, bootstrap, data.fetched_at)
    current = overview.current_event
    in_progress = current is not None and not overview.current_event_finished
    if event is None:
        if not in_progress:
            return LiveLeague(event=current, live=False, managers=[], updated_at=None)
        event = current
    elif current is None or not overview.league.start_event <= event <= current:
        raise LeagueError(
            "event_not_found", "That gameweek hasn't been played in this league.", 404
        )

    live = in_progress and event == current
    if live:
        live_event = await store.live_event(event)
        points, fixtures, updated_at = live_event.points, live_event.fixtures, live_event.fetched_at
    else:
        points, fixtures, updated_at = (await store.live([event]))[event], [], data.fetched_at
    # A past gameweek only has picks for managers who were playing by then.
    entries = [
        m.entry_id for m in overview.managers if live or any(h.event == event for h in m.history)
    ]
    return build_live_league(
        overview,
        event,
        live=live,
        bootstrap=bootstrap,
        picks_by_entry=await store.event_picks(entries, event),
        points=points,
        fixtures=fixtures,
        updated_at=updated_at,
    )
