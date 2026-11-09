import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from app.config import settings
from app.fpl_client import FplClient, FplError
from app.league import LeagueError, build_league_overview
from app.main import app

API = settings.fpl_api_base

BOOTSTRAP = {
    "events": [
        {"id": 1, "is_current": False},
        {"id": 2, "is_current": False},
        {"id": 3, "is_current": True},
    ]
}


def standings(results, *, scoring="c", has_next=False, start_event=1):
    return {
        "league": {"id": 42, "name": "Friends", "scoring": scoring, "start_event": start_event},
        "standings": {"has_next": has_next, "page": 1, "results": results},
    }


def row(entry, rank, total, last_rank=0, event_total=0):
    return {
        "entry": entry,
        "entry_name": f"Team {entry}",
        "player_name": f"Player {entry}",
        "rank": rank,
        "last_rank": last_rank,
        "total": total,
        "event_total": event_total,
    }


def gw(event, points, cost=0):
    return {
        "event": event,
        "points": points,
        "event_transfers_cost": cost,
        "overall_rank": 1000 * event,
    }


def mock_league(results, histories, **kwargs):
    respx.get(f"{API}/bootstrap-static/").respond(json=BOOTSTRAP)
    respx.get(f"{API}/leagues-classic/42/standings/").respond(json=standings(results, **kwargs))
    for entry, history in histories.items():
        respx.get(f"{API}/entry/{entry}/history/").respond(json=history)


async def overview():
    async with httpx.AsyncClient() as http:
        return await build_league_overview(FplClient(http, backoff_seconds=0), 42, BOOTSTRAP)


@respx.mock
async def test_league_ranks_per_gameweek_with_ties_hits_and_late_joiner():
    mock_league(
        [row(1, 1, 150), row(2, 2, 146), row(3, 3, 60)],
        {
            1: {"current": [gw(1, 50), gw(2, 40), gw(3, 60)], "chips": []},
            # Takes a -4 hit in GW2, which drops him level with manager 1
            2: {
                "current": [gw(1, 60), gw(2, 34, cost=4), gw(3, 56)],
                "chips": [{"name": "wildcard", "event": 2}],
            },
            # Joined in GW3
            3: {"current": [gw(3, 60)], "chips": []},
        },
    )

    result = await overview()

    assert result.events == [1, 2, 3]
    assert result.current_event == 3
    by_id = {m.entry_id: m for m in result.managers}
    assert [(h.event, h.league_rank) for h in by_id[1].history] == [(1, 2), (2, 1), (3, 1)]
    assert [(h.event, h.league_rank) for h in by_id[2].history] == [(1, 1), (2, 1), (3, 2)]
    gw2 = by_id[2].history[1]
    assert (gw2.points, gw2.total, gw2.transfers_cost, gw2.chip) == (30, 90, 4, "wildcard")
    assert [(h.event, h.league_rank) for h in by_id[3].history] == [(3, 3)]


@respx.mock
async def test_league_totals_count_from_league_start_event():
    mock_league(
        [row(1, 1, 100)],
        {1: {"current": [gw(1, 80), gw(2, 40), gw(3, 60)], "chips": []}},
        start_event=2,
    )

    result = await overview()

    assert result.events == [2, 3]
    assert [h.total for h in result.managers[0].history] == [40, 100]


@respx.mock
async def test_unknown_league():
    respx.get(f"{API}/bootstrap-static/").respond(json=BOOTSTRAP)
    respx.get(f"{API}/leagues-classic/42/standings/").respond(404)

    with pytest.raises(LeagueError) as exc:
        await overview()
    assert exc.value.code == "not_found"


@respx.mock
async def test_head_to_head_league_rejected():
    mock_league([row(1, 1, 10)], {}, scoring="h")

    with pytest.raises(LeagueError) as exc:
        await overview()
    assert exc.value.code == "not_classic"


@respx.mock
async def test_league_over_size_cap_rejected():
    mock_league([row(i, i, 10) for i in range(1, 51)], {}, has_next=True)

    with pytest.raises(LeagueError) as exc:
        await overview()
    assert exc.value.code == "too_large"


@respx.mock
async def test_client_retries_rate_limit_then_succeeds():
    route = respx.get(f"{API}/bootstrap-static/").mock(
        side_effect=[httpx.Response(429), httpx.Response(200, json={"ok": True})]
    )
    async with httpx.AsyncClient() as http:
        assert await FplClient(http, backoff_seconds=0).bootstrap() == {"ok": True}
    assert route.call_count == 2


@respx.mock
async def test_client_gives_up_after_retries():
    respx.get(f"{API}/bootstrap-static/").respond(503)
    async with httpx.AsyncClient() as http:
        with pytest.raises(FplError):
            await FplClient(http, max_retries=2, backoff_seconds=0).bootstrap()


@respx.mock
def test_endpoint_returns_error_code_for_frontend():
    respx.get(f"{API}/bootstrap-static/").respond(json=BOOTSTRAP)
    respx.get(f"{API}/leagues-classic/42/standings/").respond(404)

    with TestClient(app) as client:
        response = client.get("/api/leagues/42")

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "not_found"
