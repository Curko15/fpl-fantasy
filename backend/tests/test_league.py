from datetime import UTC, datetime

import pytest

from app.league import LeagueError, build_league_overview, validate_standings
from tests.fpl_data import BOOTSTRAP, gw, history, row, standings

NOW = datetime(2026, 11, 9, tzinfo=UTC)


def test_league_ranks_per_gameweek_with_ties_hits_and_late_joiner():
    result = build_league_overview(
        standings([row(1, 1, 150), row(2, 2, 146), row(3, 3, 60)]),
        {
            1: history(gw(1, 50), gw(2, 40), gw(3, 60)),
            # Takes a -4 hit in GW2, which drops them level with manager 1
            2: history(
                gw(1, 60), gw(2, 34, cost=4), gw(3, 56), chips=[{"name": "wildcard", "event": 2}]
            ),
            # Joined in GW3
            3: history(gw(3, 60)),
        },
        BOOTSTRAP,
        NOW,
    )

    assert result.events == [1, 2, 3]
    assert result.current_event == 3
    assert result.last_updated == NOW
    by_id = {m.entry_id: m for m in result.managers}
    assert [(h.event, h.league_rank) for h in by_id[1].history] == [(1, 2), (2, 1), (3, 1)]
    assert [(h.event, h.league_rank) for h in by_id[2].history] == [(1, 1), (2, 1), (3, 2)]
    gw2 = by_id[2].history[1]
    assert (gw2.points, gw2.total, gw2.transfers_cost, gw2.chip) == (30, 90, 4, "wildcard")
    assert [(h.event, h.league_rank) for h in by_id[3].history] == [(3, 3)]


def test_league_totals_count_from_league_start_event():
    result = build_league_overview(
        standings([row(1, 1, 100)], start_event=2),
        {1: history(gw(1, 80), gw(2, 40), gw(3, 60))},
        BOOTSTRAP,
        NOW,
    )

    assert result.events == [2, 3]
    assert [h.total for h in result.managers[0].history] == [40, 100]


def test_chip_definitions_come_from_bootstrap():
    result = build_league_overview(
        standings([row(1, 1, 10)]), {1: history(gw(1, 10))}, BOOTSTRAP, NOW
    )

    assert [(c.name, c.start_event, c.stop_event) for c in result.chips] == [
        ("bboost", 1, 38),
        ("bboost", 1, 38),
        ("wildcard", 2, 19),
        ("wildcard", 20, 38),
    ]
    assert (result.current_event, result.current_event_finished) == (3, False)


def test_head_to_head_league_rejected():
    with pytest.raises(LeagueError) as exc:
        validate_standings(standings([row(1, 1, 10)], scoring="h"))
    assert exc.value.code == "not_classic"


def test_league_over_size_cap_rejected():
    with pytest.raises(LeagueError) as exc:
        validate_standings(standings([row(i, i, 10) for i in range(1, 51)], has_next=True))
    assert exc.value.code == "too_large"
