from datetime import UTC, datetime

from app.league import GameweekEntry, LeagueInfo, LeagueOverview, Manager
from app.transfers import build_league_transfers, tag_gameweek

BOOTSTRAP = {
    "teams": [{"id": 1, "short_name": "ARS"}, {"id": 2, "short_name": "LIV"}],
    "element_types": [{"id": 3, "singular_name_short": "MID"}],
    "elements": [
        {"id": 10, "web_name": "Saka", "team": 1, "element_type": 3},
        {"id": 20, "web_name": "Salah", "team": 2, "element_type": 3},
        {"id": 30, "web_name": "Odegaard", "team": 1, "element_type": 3},
    ],
}


def transfer(element_in, element_out, event, time):
    return {
        "element_in": element_in,
        "element_in_cost": 100,
        "element_out": element_out,
        "element_out_cost": 90,
        "entry": 1,
        "event": event,
        "time": f"2026-09-{time:02d}T10:00:00Z",
    }


def gw(event, cost=0, chip=None):
    return GameweekEntry(
        event=event,
        points=50,
        total=50 * event,
        league_rank=1,
        overall_rank=None,
        transfers_cost=cost,
        chip=chip,
    )


def overview(history, start_event=1):
    return LeagueOverview(
        league=LeagueInfo(id=42, name="Friends", start_event=start_event),
        current_event=5,
        current_event_finished=True,
        chips=[],
        events=[h.event for h in history],
        managers=[
            Manager(
                entry_id=1,
                player_name="P",
                team_name="T",
                rank=1,
                last_rank=1,
                total=100,
                event_total=50,
                history=history,
            )
        ],
        last_updated=datetime.now(UTC),
    )


def test_hit_goes_to_last_transfers_made():
    early, middle, late = transfer(10, 20, 3, 1), transfer(20, 30, 3, 2), transfer(30, 10, 3, 3)
    tagged = tag_gameweek([late, early, middle], chip=None, cost=8)
    assert [(t["time"][8:10], kind) for t, kind in tagged] == [
        ("01", "free"),
        ("02", "hit"),
        ("03", "hit"),
    ]


def test_chip_gameweeks_tag_every_transfer():
    ts = [transfer(10, 20, 3, 1), transfer(20, 30, 3, 2)]
    assert {k for _, k in tag_gameweek(ts, chip="wildcard", cost=0)} == {"wildcard"}
    assert {k for _, k in tag_gameweek(ts, chip="freehit", cost=0)} == {"free_hit"}
    # Bench boost doesn't change how transfers are paid for
    assert [k for _, k in tag_gameweek(ts, chip="bboost", cost=4)] == ["free", "hit"]


def test_league_feed_and_summary():
    transfers = {
        1: [
            transfer(10, 20, 2, 1),
            transfer(20, 30, 3, 5),
            transfer(30, 10, 3, 6),
            transfer(10, 999, 4, 9),  # unknown player id
            transfer(30, 20, 1, 0),  # before the league started
        ]
    }
    data = overview([gw(2), gw(3, cost=4), gw(4, chip="wildcard")], start_event=2)

    result = build_league_transfers(data, transfers, BOOTSTRAP)

    assert [(t.event, t.kind) for t in result.transfers] == [
        (4, "wildcard"),
        (3, "hit"),
        (3, "free"),
        (2, "free"),
    ]
    assert result.transfers[-1].player_in.name == "Saka"
    assert result.transfers[-1].player_out.team == "LIV"
    assert result.transfers[0].player_out.name == "Player 999"
    summary = result.managers[0]
    assert (summary.transfers, summary.hits, summary.hit_cost) == (4, 1, 4)
