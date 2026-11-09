from datetime import UTC, datetime

from app.league import GameweekEntry, LeagueInfo, LeagueOverview, Manager
from app.manager import build_manager_detail

BOOTSTRAP = {
    "teams": [{"id": 1, "short_name": "LIV"}],
    "element_types": [{"id": 3, "singular_name_short": "MID"}],
    "elements": [
        {"id": i, "web_name": name, "team": 1, "element_type": 3}
        for i, name in [(1, "Salah"), (2, "Saka"), (3, "Palmer"), (4, "Bench"), (5, "Sub")]
    ],
}


def gw(event, chip=None):
    return GameweekEntry(
        event=event,
        points=60,
        total=60 * event,
        league_rank=1,
        overall_rank=None,
        transfers_cost=0,
        chip=chip,
    )


MANAGER = Manager(
    entry_id=7,
    player_name="P",
    team_name="T",
    rank=1,
    last_rank=1,
    total=120,
    event_total=60,
    history=[gw(1), gw(2, chip="3xc")],
)


def overview(finished=True):
    return LeagueOverview(
        league=LeagueInfo(id=42, name="Friends", start_event=1),
        current_event=2,
        current_event_finished=finished,
        events=[1, 2],
        managers=[MANAGER],
        chips=[],
        last_updated=datetime.now(UTC),
    )


def pick(element, multiplier):
    return {"element": element, "multiplier": multiplier}


PICKS = {
    # GW1: Salah captain didn't play, so vice Saka gets the armband (multiplier 2).
    # "Sub" came on for him (multiplier 1); "Bench" stayed on the bench.
    1: {"picks": [pick(1, 1), pick(2, 2), pick(3, 1), pick(5, 1), pick(4, 0)]},
    # GW2: Triple Captain on Salah.
    2: {"picks": [pick(1, 3), pick(2, 1), pick(3, 1), pick(4, 0), pick(5, 0)]},
}
LIVE = {
    1: {1: 0, 2: 10, 3: 6, 4: 9, 5: 2},
    2: {1: 12, 2: 3, 3: 8, 4: 1, 5: 0},
}


def detail(finished=True):
    return build_manager_detail(overview(finished), MANAGER, BOOTSTRAP, PICKS, LIVE)


def test_contributors_count_only_points_that_counted():
    result = detail()
    by_name = {c.player.name: c for c in result.contributors}

    assert [c.player.name for c in result.contributors][:2] == ["Salah", "Saka"]
    assert (by_name["Salah"].points, by_name["Salah"].captain_points) == (36, 24)
    assert (by_name["Salah"].starts, by_name["Salah"].captained) == (2, 1)
    assert (by_name["Saka"].points, by_name["Saka"].captain_points) == (23, 10)
    assert by_name["Sub"].points == 2
    # Bench never counted, so never a contributor
    assert "Bench" not in by_name


def test_gameweek_log_newest_first_with_captain_and_bench():
    result = detail()

    gw2, gw1 = result.gameweeks
    assert (gw2.event, gw2.chip, gw2.captain.name, gw2.captain_points) == (2, "3xc", "Salah", 36)
    assert gw2.bench_points == 1
    assert (gw1.captain.name, gw1.captain_points, gw1.bench_points) == ("Saka", 20, 9)
    assert result.provisional_event is None


def test_unfinished_gameweek_is_flagged_provisional():
    assert detail(finished=False).provisional_event == 2
