from datetime import UTC, datetime, timedelta

import respx
from fastapi.testclient import TestClient

from app.league import build_league_overview
from app.live import build_live_league, score_picks, teams_left
from app.store import FplStore
from tests.fpl_data import API, BOOTSTRAP, gw, history, live, mock_fpl, picks, row, standings

NOW = datetime(2026, 11, 13, 15, 0, tzinfo=UTC)

# GW3 is in progress (see BOOTSTRAP). League totals before it: 1 -> 100, 2 -> 90, 3 -> 90.
LEAGUE = standings([row(1, 1, 100), row(2, 2, 90), row(3, 3, 90)])
HISTORIES = {
    1: history(gw(1, 50), gw(2, 50)),
    2: history(gw(1, 45), gw(2, 45)),
    3: history(gw(2, 90)),
}
POINTS = {1: 10, 2: 6, 3: 2, 4: 8, 5: 1}


def overview(histories=HISTORIES):
    return build_league_overview(LEAGUE, histories, BOOTSTRAP, NOW)


def picks_with(*elements, chip=None, cost=0):
    data = picks(*elements)
    data["active_chip"] = chip
    data["entry_history"] = {"event": 3, "event_transfers_cost": cost}
    return data


def build(picks_by_entry, *, fixtures=(), histories=HISTORIES):
    return build_live_league(
        overview(histories),
        3,
        live=True,
        bootstrap=BOOTSTRAP,
        picks_by_entry=picks_by_entry,
        points=POINTS,
        fixtures=list(fixtures),
        updated_at=NOW,
    )


def test_captain_counts_double_and_bench_not_at_all():
    # Salah (10) captain, Saka 6, Palmer 2 on the field; Bench (8) and Sub (1) benched.
    result = score_picks(picks((1, 2), (2, 1), (3, 1), (4, 0), (5, 0)), POINTS)
    assert result == (28, 1, 20)


def test_triple_captain_and_bench_boost():
    triple = picks((1, 3), (2, 1), (3, 1), (4, 0), (5, 0))
    boost = picks((1, 2), (2, 1), (3, 1), (4, 1), (5, 1))
    assert score_picks(triple, POINTS) == (38, 1, 30)
    assert score_picks(boost, POINTS) == (37, 1, 20)


def test_is_captain_flag_wins_over_multiplier():
    # Captain blanked with multiplier 2 still set: FPL marks him with is_captain.
    data = picks((1, 1), (2, 2))
    data["picks"][1]["is_captain"] = True
    data["picks"][0]["is_captain"] = False
    assert score_picks(data, POINTS) == (22, 2, 12)


def test_live_table_with_hits_ranks_and_ties():
    result = build(
        {
            1: picks_with((3, 2), (5, 1)),  # 5 -> total 105
            2: picks_with((1, 2), (2, 1), cost=4),  # 26 - 4 = 22 -> 112
            3: picks_with((1, 1), (4, 2), (2, 0)),  # 26 -> 116
        }
    )

    assert [m.entry_id for m in result.managers] == [3, 2, 1]
    by_id = {m.entry_id: m for m in result.managers}
    assert (by_id[2].points, by_id[2].transfers_cost, by_id[2].total) == (22, 4, 112)
    assert (by_id[3].rank, by_id[3].pre_rank) == (1, 2)  # tied 2nd before the gameweek
    assert (by_id[1].rank, by_id[1].pre_rank) == (3, 1)
    assert by_id[3].captain.name == "Bench"
    assert by_id[3].captain_points == 16
    assert result.live and result.event == 3 and result.updated_at == NOW


def test_equal_live_totals_share_a_rank_and_keep_pre_gameweek_order():
    result = build({1: picks_with((3, 1)), 2: picks_with((1, 1), (3, 1)), 3: picks_with((3, 1))})
    # 1 -> 102, 2 -> 102, 3 -> 92
    assert [(m.entry_id, m.rank) for m in result.managers] == [(1, 1), (2, 1), (3, 3)]


def test_chip_and_players_left_to_play():
    fixtures = [
        {"team_h": 1, "team_a": 2, "started": False, "finished": False},
        {"team_h": 3, "team_a": 4, "started": True, "finished": False},
    ]
    result = build(
        {
            1: picks_with((1, 2), (2, 1), (4, 1), (5, 1), chip="bboost"),
            2: picks_with((1, 2), (4, 0)),
            3: picks_with((1, 1)),
        },
        fixtures=fixtures,
    )
    by_id = {m.entry_id: m for m in result.managers}
    assert (by_id[1].chip, by_id[1].players_left) == ("bboost", 4)
    assert (by_id[2].chip, by_id[2].players_left) == (None, 1)  # benched player doesn't count


def test_teams_left_ignores_started_and_finished_matches():
    fixtures = [
        {"team_h": 1, "team_a": 2, "started": True, "finished": True},
        {"team_h": 3, "team_a": 4, "started": True, "finished": False},
        {"team_h": 5, "team_a": 6, "started": False, "finished": False},
    ]
    assert teams_left(fixtures) == {5, 6}


def test_managers_without_picks_are_left_out():
    result = build({1: picks_with((1, 1)), 2: picks_with((2, 1))})
    assert {m.entry_id for m in result.managers} == {1, 2}


# ---- store and endpoint ----------------------------------------------------------------


def mock_live_gameweek(fpl_mock: respx.MockRouter) -> dict[str, respx.Route]:
    routes = mock_fpl(fpl_mock, league=LEAGUE, histories=HISTORIES)
    for entry in (1, 2, 3):
        routes[f"picks-{entry}"] = fpl_mock.get(f"{API}/entry/{entry}/event/3/picks/").respond(
            json=picks_with((1, 2), (2, 1))
        )
    routes["live"] = fpl_mock.get(f"{API}/event/3/live/").respond(json=live(POINTS))
    routes["fixtures"] = fpl_mock.get(f"{API}/fixtures/", params={"event": 3}).respond(json=[])
    return routes


async def test_live_points_are_cached_for_a_minute(store: FplStore, fpl_mock: respx.MockRouter):
    routes = mock_live_gameweek(fpl_mock)

    first = await store.live_event(3)
    again = await store.live_event(3)
    store._live_events[3].fetched_at -= timedelta(seconds=61)
    later = await store.live_event(3)

    assert first is again and first.points == POINTS
    assert later.points == POINTS
    assert routes["live"].call_count == 2
    assert routes["fixtures"].call_count == 2
    # Stored as provisional points too, for transfers and awards.
    assert (await store.stored_live())[3] == POINTS


async def test_picks_for_a_gameweek_are_fetched_once(store: FplStore, fpl_mock: respx.MockRouter):
    routes = mock_live_gameweek(fpl_mock)

    await store.event_picks([1, 2, 3], 3)
    result = await store.event_picks([1, 2, 3], 3)

    assert set(result) == {1, 2, 3}
    assert routes["picks-1"].call_count == 1


def test_live_endpoint_while_a_gameweek_is_in_progress(
    client: TestClient, fpl_mock: respx.MockRouter
):
    mock_live_gameweek(fpl_mock)

    body = client.get("/api/leagues/42/live").json()

    assert body["live"] is True and body["event"] == 3
    # Everyone scored 26: 100 + 26, then 90 + 26 twice.
    assert [(m["entry_id"], m["rank"], m["total"]) for m in body["managers"]] == [
        (1, 1, 126),
        (2, 2, 116),
        (3, 2, 116),
    ]
    assert body["managers"][0]["captain"]["name"] == "Salah"


def test_live_endpoint_when_nothing_is_live(client: TestClient, fpl_mock: respx.MockRouter):
    finished = {**BOOTSTRAP, "events": [{**e, "finished": True} for e in BOOTSTRAP["events"]]}
    mock_fpl(fpl_mock, league=LEAGUE, histories=HISTORIES)
    fpl_mock.get(f"{API}/bootstrap-static/").respond(json=finished)

    body = client.get("/api/leagues/42/live").json()

    assert body == {"event": 3, "live": False, "managers": [], "updated_at": None}


def test_live_endpoint_for_an_earlier_gameweek(client: TestClient, fpl_mock: respx.MockRouter):
    routes = mock_live_gameweek(fpl_mock)
    for entry in (1, 2):
        fpl_mock.get(f"{API}/entry/{entry}/event/1/picks/").respond(json=picks((1, 1)))
    fpl_mock.get(f"{API}/event/1/live/").respond(json=live(POINTS))

    body = client.get("/api/leagues/42/live?event=1").json()
    future = client.get("/api/leagues/42/live?event=4")

    assert body["live"] is False and body["event"] == 1
    # Manager 3 joined in GW2, so has no GW1 picks.
    assert [m["entry_id"] for m in body["managers"]] == [1, 2]
    assert routes["fixtures"].call_count == 0
    assert future.status_code == 404
    assert future.json()["detail"]["code"] == "event_not_found"
