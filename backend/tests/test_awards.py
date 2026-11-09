from datetime import UTC, datetime
from typing import Any

from app.awards import build_league_awards
from app.league import GameweekEntry, LeagueInfo, LeagueOverview, Manager
from tests.fpl_data import BOOTSTRAP

SALAH, SAKA, PALMER, BENCH, SUB = 1, 2, 3, 4, 5
GHOST = 6  # not in bootstrap; didn't play


def gw(event: int, points: int, cost: int = 0, chip: str | None = None) -> GameweekEntry:
    return GameweekEntry(
        event=event,
        points=points,
        total=0,
        league_rank=1,
        overall_rank=None,
        transfers_cost=cost,
        chip=chip,
    )


def manager(entry_id: int, *history: GameweekEntry) -> Manager:
    return Manager(
        entry_id=entry_id,
        player_name=f"P{entry_id}",
        team_name=f"T{entry_id}",
        rank=entry_id,
        last_rank=entry_id,
        total=0,
        event_total=0,
        history=list(history),
    )


def overview(*managers: Manager) -> LeagueOverview:
    return LeagueOverview(
        league=LeagueInfo(id=42, name="Friends", start_event=1),
        current_event=3,
        current_event_finished=False,
        events=sorted({h.event for m in managers for h in m.history}),
        managers=list(managers),
        chips=[],
        last_updated=datetime.now(UTC),
    )


def pick(element: int, multiplier: int, captain: bool = False, vice: bool = False) -> dict:
    return {
        "element": element,
        "multiplier": multiplier,
        "is_captain": captain,
        "is_vice_captain": vice,
    }


def picks(*p: dict, chip: str | None = None, subs: list[tuple[int, int]] = ()) -> dict[str, Any]:
    return {
        "picks": list(p),
        "active_chip": chip,
        "automatic_subs": [{"element_in": i, "element_out": o} for i, o in subs],
    }


def transfer(event: int, element_in: int, element_out: int) -> dict[str, Any]:
    return {"event": event, "element_in": element_in, "element_out": element_out}


LIVE_GW1 = {SALAH: 12, SAKA: 10, PALMER: 2, BENCH: 9, SUB: 3, GHOST: 0}
LIVE_GW1_LOW_SUB = {**LIVE_GW1, SUB: 2}  # sub only got appearance points


def awards_by_key(result, event: int = 1) -> dict[str, Any]:
    gw_awards = next(g for g in result.gameweeks if g.event == event)
    return {a.key: a for a in gw_awards.awards}


def test_every_award_in_one_gameweek():
    m1 = manager(1, gw(1, 70), gw(2, 60))
    m2 = manager(2, gw(1, 40, cost=8), gw(2, 60))
    m3 = manager(3, gw(1, 30, chip="3xc"), gw(2, 60))
    picks_by_entry = {
        # Salah captained and played; Bench (9) and Sub (3) left on the bench.
        1: {
            1: picks(
                pick(SALAH, 2, captain=True), pick(SAKA, 1, vice=True), pick(BENCH, 0), pick(SUB, 0)
            )
        },
        # Captain didn't play: vice Saka doubled; Sub came on for them.
        2: {
            1: picks(
                pick(GHOST, 0, captain=True),
                pick(SAKA, 2, vice=True),
                pick(SUB, 1),
                subs=[(SUB, GHOST)],
            )
        },
        # Triple Captain on Palmer, who scored 2.
        3: {1: picks(pick(PALMER, 3, captain=True), pick(SAKA, 1, vice=True), chip="3xc")},
    }
    transfers = {2: [transfer(1, PALMER, BENCH)]}  # -8 hit; bought Palmer (2), sold Bench (9)

    result = build_league_awards(
        overview(m1, m2, m3), BOOTSTRAP, picks_by_entry, {1: LIVE_GW1}, transfers
    )

    a = awards_by_key(result)
    assert [(w.entry_id, w.value) for w in a["manager_of_week"].winners] == [(1, 70)]
    assert [(w.entry_id, w.value) for w in a["loser_of_week"].winners] == [(3, 30)]
    bench = a["bench_loser"].winners[0]
    assert (bench.entry_id, bench.player.name, bench.value, bench.secondary) == (1, "Bench", 9, 12)
    sub = a["lucky_sub"].winners[0]
    assert (sub.entry_id, sub.player.name, sub.other_player.name, sub.value) == (
        2,
        "Sub",
        "Player 6",
        3,
    )
    vice = a["vice_saviour"].winners[0]
    assert (vice.entry_id, vice.player.name, vice.value) == (2, "Saka", 20)
    fail = a["captain_fail"].winners[0]
    assert (fail.entry_id, fail.player.name, fail.value) == (3, "Palmer", 2)
    assert a["captain_fail"].popular_captain is None
    regret = a["hit_regret"].winners[0]
    assert (regret.entry_id, regret.value, regret.secondary) == (2, 8, 2)
    sold = a["sold_too_soon"].winners[0]
    assert (sold.entry_id, sold.player.name, sold.value) == (2, "Bench", 9)
    flop = a["chip_flop"].winners[0]
    assert (flop.entry_id, flop.chip, flop.value, flop.secondary) == (3, "3xc", 30, 60)

    # GW2 is finished but its picks aren't stored yet; GW3 isn't finished.
    assert result.pending_events == [2]
    assert [g.event for g in result.gameweeks] == [1]


def test_ties_share_the_award_and_count_in_the_hall():
    m1 = manager(1, gw(1, 50), gw(2, 70))
    m2 = manager(2, gw(1, 50), gw(2, 40))
    same = picks(pick(SALAH, 2, captain=True), pick(SAKA, 1, vice=True))
    live = {1: LIVE_GW1, 2: LIVE_GW1}

    result = build_league_awards(
        overview(m1, m2), BOOTSTRAP, {1: {1: same, 2: same}, 2: {1: same, 2: same}}, live, {}
    )

    assert [g.event for g in result.gameweeks] == [2, 1]
    assert {w.entry_id for w in awards_by_key(result)["manager_of_week"].winners} == {1, 2}
    hall = {h.key: [(e.entry_id, e.wins) for e in h.ranking] for h in result.hall}
    assert hall["manager_of_week"] == [(1, 2), (2, 1)]
    assert hall["loser_of_week"] == [(2, 2), (1, 1)]


def test_captain_fail_extra_shame_when_the_league_captained_a_haul():
    managers = [manager(i, gw(1, 50)) for i in (1, 2, 3)]
    on_salah = picks(pick(SALAH, 2, captain=True), pick(SAKA, 1, vice=True))
    on_palmer = picks(pick(PALMER, 2, captain=True), pick(SAKA, 1, vice=True))

    result = build_league_awards(
        overview(*managers),
        BOOTSTRAP,
        {1: {1: on_salah}, 2: {1: on_salah}, 3: {1: on_palmer}},
        {1: LIVE_GW1},
        {},
    )

    fail = awards_by_key(result)["captain_fail"]
    assert [w.entry_id for w in fail.winners] == [3]
    assert (fail.popular_captain.name, fail.popular_captain_count, fail.popular_captain_points) == (
        "Salah",
        2,
        12,
    )
    assert fail.popular_captain_of == 3


def test_awards_nobody_qualified_for_are_left_out():
    m1 = manager(1, gw(1, 80, chip="bboost"))
    # Bench Boost: bench players count (multiplier 1); no hits, transfers or missed captain.
    boosted = picks(
        pick(SALAH, 2, captain=True), pick(SAKA, 1, vice=True), pick(BENCH, 1), chip="bboost"
    )

    result = build_league_awards(overview(m1), BOOTSTRAP, {1: {1: boosted}}, {1: LIVE_GW1}, {})

    assert set(awards_by_key(result)) == {"manager_of_week", "loser_of_week", "captain_fail"}


def test_captain_fail_tiebreak_and_lucky_sub_minimum():
    # Everyone captains Palmer (2): the lowest gameweek score takes the shame.
    managers = [manager(1, gw(1, 50)), manager(2, gw(1, 35)), manager(3, gw(1, 60))]
    on_palmer = picks(
        pick(PALMER, 2, captain=True), pick(SAKA, 1, vice=True), pick(SUB, 1), subs=[(SUB, GHOST)]
    )

    result = build_league_awards(
        overview(*managers),
        BOOTSTRAP,
        {i: {1: on_palmer} for i in (1, 2, 3)},
        {1: LIVE_GW1_LOW_SUB},
        {},
    )

    a = awards_by_key(result)
    assert [w.entry_id for w in a["captain_fail"].winners] == [2]
    assert "lucky_sub" not in a  # 2 points is just turning up
