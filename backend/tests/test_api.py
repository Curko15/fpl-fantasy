import respx
from fastapi.testclient import TestClient

from tests.fpl_data import API, gw, history, live, mock_fpl, picks, row, standings


def test_league_endpoint(client: TestClient, fpl_mock: respx.MockRouter):
    mock_fpl(fpl_mock, league=standings([row(7, 1, 60)]), histories={7: history(gw(1, 60))})

    response = client.get("/api/leagues/42")

    assert response.status_code == 200
    body = response.json()
    assert body["league"]["name"] == "Friends"
    assert body["managers"][0]["history"][0]["league_rank"] == 1


def test_unknown_league_returns_error_code_for_frontend(
    client: TestClient, fpl_mock: respx.MockRouter
):
    mock_fpl(fpl_mock)
    fpl_mock.get(f"{API}/leagues-classic/42/standings/").respond(404)

    response = client.get("/api/leagues/42")

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "not_found"


def test_fpl_outage_returns_502(client: TestClient, fpl_mock: respx.MockRouter):
    fpl_mock.get(f"{API}/bootstrap-static/").respond(503)

    response = client.get("/api/leagues/42")

    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "fpl_unavailable"


def test_transfers_endpoint(client: TestClient, fpl_mock: respx.MockRouter):
    mock_fpl(
        fpl_mock,
        league=standings([row(7, 1, 60)]),
        histories={7: history(gw(1, 60))},
        transfers={
            7: [
                {
                    "element_in": 1,
                    "element_in_cost": 130,
                    "element_out": 2,
                    "element_out_cost": 100,
                    "entry": 7,
                    "event": 1,
                    "time": "2026-08-20T10:00:00Z",
                }
            ]
        },
    )

    response = client.get("/api/leagues/42/transfers")

    assert response.status_code == 200
    assert response.json()["transfers"][0]["player_in"]["name"] == "Salah"


def test_manager_endpoint(client: TestClient, fpl_mock: respx.MockRouter):
    mock_fpl(fpl_mock, league=standings([row(7, 1, 60)]), histories={7: history(gw(1, 60))})
    fpl_mock.get(f"{API}/entry/7/event/1/picks/").respond(json=picks((2, 2), (1, 1), (4, 0)))
    fpl_mock.get(f"{API}/event/1/live/").respond(json=live({1: 0, 2: 10, 4: 9}))

    ok = client.get("/api/leagues/42/managers/7")
    missing = client.get("/api/leagues/42/managers/8")

    assert ok.status_code == 200
    assert ok.json()["contributors"][0]["player"]["name"] == "Saka"
    assert ok.json()["gameweeks"][0]["bench_points"] == 9
    assert missing.status_code == 404
    assert missing.json()["detail"]["code"] == "manager_not_found"


def test_awards_are_pending_until_picks_are_stored(client: TestClient, fpl_mock: respx.MockRouter):
    mock_fpl(fpl_mock, league=standings([row(7, 1, 60)]), histories={7: history(gw(1, 60))})
    fpl_mock.get(f"{API}/entry/7/event/1/picks/").respond(json=picks((2, 2), (1, 1), (4, 0)))
    fpl_mock.get(f"{API}/event/1/live/").respond(json=live({1: 0, 2: 10, 4: 9}))

    before = client.get("/api/leagues/42/awards").json()
    client.get("/api/leagues/42/managers/7")  # stores GW1 picks and live points
    after = client.get("/api/leagues/42/awards").json()

    assert (before["pending_events"], before["gameweeks"]) == ([1], [])
    assert after["pending_events"] == []
    keys = [a["key"] for a in after["gameweeks"][0]["awards"]]
    assert keys[:2] == ["manager_of_week", "loser_of_week"]
    assert "bench_loser" in keys
