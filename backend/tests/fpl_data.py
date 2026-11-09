"""Builders for fake FPL API payloads, shared by the tests."""

from typing import Any

import respx

from app.config import settings

API = settings.fpl_api_base

BOOTSTRAP: dict[str, Any] = {
    "events": [
        {"id": 1, "is_current": False, "finished": True},
        {"id": 2, "is_current": False, "finished": True},
        {"id": 3, "is_current": True, "finished": False},
    ],
    "chips": [
        {"name": "wildcard", "number": 1, "start_event": 20, "stop_event": 38},
        {"name": "wildcard", "number": 1, "start_event": 2, "stop_event": 19},
        {"name": "bboost", "number": 2, "start_event": 1, "stop_event": 38},
    ],
    "teams": [{"id": 1, "short_name": "LIV"}],
    "element_types": [{"id": 3, "singular_name_short": "MID"}],
    "elements": [
        {"id": i, "web_name": name, "team": 1, "element_type": 3}
        for i, name in [(1, "Salah"), (2, "Saka"), (3, "Palmer"), (4, "Bench"), (5, "Sub")]
    ],
}


def standings(
    results: list[dict[str, Any]],
    *,
    league_id: int = 42,
    scoring: str = "c",
    has_next: bool = False,
    start_event: int = 1,
) -> dict[str, Any]:
    return {
        "league": {
            "id": league_id,
            "name": "Friends",
            "scoring": scoring,
            "start_event": start_event,
        },
        "standings": {"has_next": has_next, "page": 1, "results": results},
    }


def row(entry: int, rank: int, total: int, last_rank: int = 0, event_total: int = 0) -> dict:
    return {
        "entry": entry,
        "entry_name": f"Team {entry}",
        "player_name": f"Player {entry}",
        "rank": rank,
        "last_rank": last_rank,
        "total": total,
        "event_total": event_total,
    }


def gw(event: int, points: int, cost: int = 0) -> dict[str, Any]:
    return {
        "event": event,
        "points": points,
        "event_transfers_cost": cost,
        "overall_rank": 1000 * event,
    }


def history(*gws: dict[str, Any], chips: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return {"current": list(gws), "chips": chips or []}


def picks(*elements: tuple[int, int]) -> dict[str, Any]:
    """`picks((element, multiplier), ...)`"""
    return {"picks": [{"element": e, "multiplier": m} for e, m in elements]}


def live(points: dict[int, int]) -> dict[str, Any]:
    return {"elements": [{"id": i, "stats": {"total_points": p}} for i, p in points.items()]}


def mock_fpl(
    router: respx.MockRouter,
    *,
    league: dict[str, Any] | None = None,
    histories: dict[int, dict[str, Any]] | None = None,
    transfers: dict[int, list[Any]] | None = None,
    league_id: int = 42,
) -> dict[str, respx.Route]:
    """Register FPL routes on `router`; returns them for call counting."""
    routes = {"bootstrap": router.get(f"{API}/bootstrap-static/").respond(json=BOOTSTRAP)}
    if league is not None:
        routes["standings"] = router.get(f"{API}/leagues-classic/{league_id}/standings/").respond(
            json=league
        )
    for entry, h in (histories or {}).items():
        routes[f"history-{entry}"] = router.get(f"{API}/entry/{entry}/history/").respond(json=h)
        routes[f"transfers-{entry}"] = router.get(f"{API}/entry/{entry}/transfers/").respond(
            json=(transfers or {}).get(entry, [])
        )
    return routes
