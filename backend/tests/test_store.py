from datetime import timedelta

import pytest
import respx
from sqlalchemy import update

from app.config import settings
from app.db import LeagueRow, utcnow
from app.fpl_client import FplClient
from app.league import LeagueError
from app.refresh import refresh_recent_leagues
from app.store import FplStore
from tests.fpl_data import API, gw, history, live, mock_fpl, picks, row, standings

LEAGUE = standings([row(1, 1, 100), row(2, 2, 90)])
HISTORIES = {
    1: history(gw(1, 50), gw(2, 30), gw(3, 20)),
    2: history(gw(2, 50), gw(3, 40)),  # joined in GW2
}


def mock_picks_and_live(fpl_mock: respx.MockRouter) -> dict[str, respx.Route]:
    routes = {}
    for entry in (1, 2):
        for event in (1, 2, 3):
            routes[f"picks-{entry}-{event}"] = fpl_mock.get(
                f"{API}/entry/{entry}/event/{event}/picks/"
            ).respond(json=picks((1, 2), (2, 1)))
    for event in (1, 2, 3):
        routes[f"live-{event}"] = fpl_mock.get(f"{API}/event/{event}/live/").respond(
            json=live({1: event, 2: 10})
        )
    return routes


async def test_first_visit_fetches_then_reads_from_database(
    store: FplStore, fpl_mock: respx.MockRouter
):
    routes = mock_fpl(fpl_mock, league=LEAGUE, histories=HISTORIES)

    first = await store.league(42)
    second = await store.league(42)

    assert routes["standings"].call_count == 1
    assert routes["history-1"].call_count == 1
    assert second.histories == first.histories == HISTORIES
    assert second.fetched_at == first.fetched_at


async def test_data_survives_a_restart(store: FplStore, fpl_mock: respx.MockRouter):
    routes = mock_fpl(fpl_mock, league=LEAGUE, histories=HISTORIES)
    await store.league(42)

    restarted = FplStore(FplClient(store._fpl._http), store._sessions)
    data = await restarted.league(42)
    await restarted.bootstrap()

    assert data.histories == HISTORIES
    assert routes["standings"].call_count == 1
    assert routes["bootstrap"].call_count == 1


async def test_unsupported_league_is_not_stored(store: FplStore, fpl_mock: respx.MockRouter):
    mock_fpl(fpl_mock)
    fpl_mock.get(f"{API}/leagues-classic/42/standings/").respond(404)

    with pytest.raises(LeagueError) as exc:
        await store.league(42)

    assert exc.value.code == "not_found"
    assert await store.recent_league_ids() == []


async def test_page_view_fetches_only_missing_picks(store: FplStore, fpl_mock: respx.MockRouter):
    mock_fpl(fpl_mock, league=LEAGUE, histories=HISTORIES)
    routes = mock_picks_and_live(fpl_mock)

    await store.picks(1, [1, 2, 3])
    result = await store.picks(1, [1, 2, 3])
    points = await store.live([1, 2])
    points_again = await store.live([1, 2])

    assert routes["picks-1-3"].call_count == 1  # even the provisional GW: no refetch on view
    assert result[1]["picks"][0] == {"element": 1, "multiplier": 2}
    assert points == points_again == {1: {1: 1, 2: 10}, 2: {1: 2, 2: 10}}
    assert routes["live-1"].call_count == 1


async def test_backfill_refetches_only_the_unfinished_gameweek(
    store: FplStore, fpl_mock: respx.MockRouter
):
    mock_fpl(fpl_mock, league=LEAGUE, histories=HISTORIES)
    routes = mock_picks_and_live(fpl_mock)
    await store.league(42)

    await store.backfill_picks(42)
    await store.backfill_picks(42)

    # GW1 and GW2 are finished: fetched once. GW3 is in progress: refetched each run.
    assert routes["picks-1-1"].call_count == 1
    assert routes["picks-2-2"].call_count == 1
    assert routes["picks-1-3"].call_count == 2
    assert routes["picks-2-1"].call_count == 0  # manager 2 joined in GW2
    assert (routes["live-2"].call_count, routes["live-3"].call_count) == (1, 2)


async def test_stale_league_is_refreshed_in_background(
    store: FplStore, monkeypatch: pytest.MonkeyPatch, fpl_mock: respx.MockRouter
):
    routes = mock_fpl(fpl_mock, league=LEAGUE, histories=HISTORIES)
    mock_picks_and_live(fpl_mock)
    await store.league(42)
    async with store._sessions.begin() as session:
        await session.execute(update(LeagueRow).values(fetched_at=utcnow() - timedelta(hours=30)))

    monkeypatch.setattr(settings, "background_jobs", True)
    stale = await store.league(42)
    await store.wait_for_background()
    fresh = await store.league(42)

    assert routes["standings"].call_count == 2
    assert fresh.fetched_at > stale.fetched_at


async def test_only_recently_viewed_leagues_are_refreshed(
    store: FplStore, fpl_mock: respx.MockRouter
):
    mock_fpl(fpl_mock, league=LEAGUE, histories=HISTORIES)
    await store.league(42)
    assert await store.recent_league_ids() == [42]

    async with store._sessions.begin() as session:
        await session.execute(
            update(LeagueRow).values(last_viewed_at=utcnow() - timedelta(days=30))
        )
    assert await store.recent_league_ids() == []


async def test_daily_refresh_keeps_going_when_one_league_fails(
    store: FplStore, fpl_mock: respx.MockRouter
):
    mock_fpl(fpl_mock, league=LEAGUE, histories=HISTORIES)
    mock_picks_and_live(fpl_mock)
    other = standings([row(1, 1, 100)], league_id=7)
    other_route = fpl_mock.get(f"{API}/leagues-classic/7/standings/").respond(json=other)
    await store.league(42)
    await store.league(7)

    # League 42 now fails at FPL; league 7 must still be refreshed.
    fpl_mock.get(f"{API}/leagues-classic/42/standings/").respond(503)
    await refresh_recent_leagues(store)

    assert other_route.call_count == 2
