"""Gameweek awards and the season Hall of Fame / Hall of Shame.

Everything here is computed from stored picks and live points, using FPL's final pick
multipliers: 0 = on the bench, 1 = played, 2 = captain, 3 = triple captain. When a captain
doesn't play, FPL moves them to the bench (multiplier 0) and gives the vice-captain 2.
"""

from collections import Counter, defaultdict
from typing import Any, Literal

from pydantic import BaseModel

from app.league import LeagueOverview, Manager
from app.transfers import Player, players_by_id, unknown_player

AwardKey = Literal[
    "manager_of_week",
    "loser_of_week",
    "bench_loser",
    "lucky_sub",
    "vice_saviour",
    "captain_fail",
    "hit_regret",
    "sold_too_soon",
    "chip_flop",
]
AWARD_ORDER: list[AwardKey] = [
    "manager_of_week",
    "loser_of_week",
    "bench_loser",
    "lucky_sub",
    "vice_saviour",
    "captain_fail",
    "hit_regret",
    "sold_too_soon",
    "chip_flop",
]

# A sold player has to have scored at least this much for "Sold Too Soon".
SOLD_TOO_SOON_MIN_POINTS = 6
# An auto-sub has to do more than just turn up (2 appearance points) to be "lucky".
LUCKY_SUB_MIN_POINTS = 3
# Captain Fail gets extra shame when the league's favourite captain scored at least this.
CAPTAIN_HAUL_POINTS = 10
FLOP_CHIPS = {"bboost", "3xc", "freehit"}


class AwardWinner(BaseModel):
    entry_id: int
    value: int  # the headline number (points, hit cost…), see each award
    player: Player | None = None
    other_player: Player | None = None  # replaced starter (lucky sub), missing captain (vice)
    secondary: int | None = None  # bench total, points bought, season average…
    chip: str | None = None


class Award(BaseModel):
    key: AwardKey
    winners: list[AwardWinner]  # several on a tie
    # Captain Fail only: what most of the league captained, when it hauled
    popular_captain: Player | None = None
    popular_captain_count: int | None = None
    popular_captain_points: int | None = None
    popular_captain_of: int | None = None  # managers who played that gameweek


class GameweekAwards(BaseModel):
    event: int
    awards: list[Award]  # awards nobody qualified for are left out


class HallEntry(BaseModel):
    entry_id: int
    wins: int


class HallOfFame(BaseModel):
    key: AwardKey
    ranking: list[HallEntry]  # most wins first, managers with no wins left out


class LeagueAwards(BaseModel):
    gameweeks: list[GameweekAwards]  # newest first
    hall: list[HallOfFame]
    pending_events: list[int]  # finished gameweeks whose team data is still being fetched


class _Team:
    """One manager's gameweek, with helpers over their picks."""

    def __init__(
        self,
        manager: Manager,
        event: int,
        picks: dict[str, Any],
        points: dict[int, int],
        players: dict[int, Player],
    ) -> None:
        gw = next(h for h in manager.history if h.event == event)
        self.entry_id = manager.entry_id
        self.gw = gw
        self.chip = picks.get("active_chip") or gw.chip
        self.picks = picks["picks"]
        self.auto_subs = picks.get("automatic_subs", [])
        self._points = points
        self._players = players

    def pts(self, element: int) -> int:
        return self._points.get(element, 0)

    def player(self, element: int) -> Player:
        return self._players.get(element) or unknown_player(element)

    def captain(self) -> dict[str, Any]:
        """The pick whose points were multiplied (vice if the captain didn't play)."""
        multiplied = [p for p in self.picks if p["multiplier"] > 1]
        if multiplied:
            return multiplied[0]
        return next(p for p in self.picks if p.get("is_captain"))


def _best(candidates: list[tuple[tuple[int, ...], AwardWinner]], key: AwardKey) -> Award | None:
    """Winners are the candidates sharing the highest sort key (ties all win)."""
    if not candidates:
        return None
    top = max(score for score, _ in candidates)
    return Award(key=key, winners=[w for score, w in candidates if score == top])


def _manager_of_week(teams: list[_Team], lowest: bool) -> Award | None:
    sign = -1 if lowest else 1
    return _best(
        [
            ((sign * t.gw.points,), AwardWinner(entry_id=t.entry_id, value=t.gw.points))
            for t in teams
        ],
        "loser_of_week" if lowest else "manager_of_week",
    )


def _bench_loser(teams: list[_Team]) -> Award | None:
    candidates = []
    for t in teams:
        if t.chip == "bboost":
            continue
        bench = [p for p in t.picks if p["multiplier"] == 0]
        if not bench:
            continue
        top = max(bench, key=lambda p: t.pts(p["element"]))
        top_pts = t.pts(top["element"])
        if top_pts <= 0:
            continue
        total = sum(t.pts(p["element"]) for p in bench)
        candidates.append(
            (
                (top_pts, total),
                AwardWinner(
                    entry_id=t.entry_id,
                    value=top_pts,
                    player=t.player(top["element"]),
                    secondary=total,
                ),
            )
        )
    return _best(candidates, "bench_loser")


def _lucky_sub(teams: list[_Team]) -> Award | None:
    candidates = []
    for t in teams:
        for sub in t.auto_subs:
            pts = t.pts(sub["element_in"])
            if pts >= LUCKY_SUB_MIN_POINTS:
                candidates.append(
                    (
                        (pts,),
                        AwardWinner(
                            entry_id=t.entry_id,
                            value=pts,
                            player=t.player(sub["element_in"]),
                            other_player=t.player(sub["element_out"]),
                        ),
                    )
                )
    return _best(candidates, "lucky_sub")


def _vice_saviour(teams: list[_Team]) -> Award | None:
    candidates = []
    for t in teams:
        vice = next((p for p in t.picks if p.get("is_vice_captain") and p["multiplier"] > 1), None)
        captain = next((p for p in t.picks if p.get("is_captain")), None)
        if vice is None or captain is None:
            continue
        doubled = t.pts(vice["element"]) * vice["multiplier"]
        if doubled <= 0:
            continue
        candidates.append(
            (
                (doubled,),
                AwardWinner(
                    entry_id=t.entry_id,
                    value=doubled,
                    player=t.player(vice["element"]),
                    other_player=t.player(captain["element"]),
                ),
            )
        )
    return _best(candidates, "vice_saviour")


def _captain_fail(teams: list[_Team]) -> Award | None:
    if not teams:
        return None
    captains = {t.entry_id: t.captain()["element"] for t in teams}
    # Tiebreak: lower gameweek score. When half the league captains the same flop,
    # the shame goes to whoever it hurt most rather than to everyone.
    award = _best(
        [
            (
                (-t.pts(captains[t.entry_id]), -t.gw.points),
                AwardWinner(
                    entry_id=t.entry_id,
                    value=t.pts(captains[t.entry_id]),
                    player=t.player(captains[t.entry_id]),
                ),
            )
            for t in teams
        ],
        "captain_fail",
    )
    assert award is not None
    # Extra shame: most of the league captained someone who hauled.
    popular, count = Counter(captains.values()).most_common(1)[0]
    popular_pts = teams[0].pts(popular)
    failed = {captains[w.entry_id] for w in award.winners}
    if count > len(teams) / 2 and popular_pts >= CAPTAIN_HAUL_POINTS and popular not in failed:
        award.popular_captain = teams[0].player(popular)
        award.popular_captain_count = count
        award.popular_captain_points = popular_pts
        award.popular_captain_of = len(teams)
    return award


def _hit_regret(teams: list[_Team], transfers: dict[int, list[Any]]) -> Award | None:
    candidates = []
    for t in teams:
        cost = t.gw.transfers_cost
        if cost <= 0:
            continue
        bought = [
            x["element_in"] for x in transfers.get(t.entry_id, []) if x["event"] == t.gw.event
        ]
        bought_pts = sum(t.pts(e) for e in bought)
        if bought_pts >= cost:
            continue
        candidates.append(
            (
                (cost - bought_pts,),
                AwardWinner(entry_id=t.entry_id, value=cost, secondary=bought_pts),
            )
        )
    return _best(candidates, "hit_regret")


def _sold_too_soon(teams: list[_Team], transfers: dict[int, list[Any]]) -> Award | None:
    candidates = []
    for t in teams:
        for x in transfers.get(t.entry_id, []):
            if x["event"] != t.gw.event:
                continue
            pts = t.pts(x["element_out"])
            if pts >= SOLD_TOO_SOON_MIN_POINTS:
                candidates.append(
                    (
                        (pts,),
                        AwardWinner(
                            entry_id=t.entry_id,
                            value=pts,
                            player=t.player(x["element_out"]),
                            other_player=t.player(x["element_in"]),
                            secondary=t.pts(x["element_in"]),
                        ),
                    )
                )
    return _best(candidates, "sold_too_soon")


def _chip_flop(teams: list[_Team], averages: dict[int, float | None]) -> Award | None:
    candidates = []
    for t in teams:
        avg = averages.get(t.entry_id)
        if t.chip not in FLOP_CHIPS or avg is None or t.gw.points >= avg:
            continue
        candidates.append(
            (
                (round((avg - t.gw.points) * 10),),
                AwardWinner(
                    entry_id=t.entry_id, value=t.gw.points, secondary=round(avg), chip=t.chip
                ),
            )
        )
    return _best(candidates, "chip_flop")


def build_league_awards(
    overview: LeagueOverview,
    bootstrap: dict[str, Any],
    picks: dict[int, dict[int, dict[str, Any]]],
    live: dict[int, dict[int, int]],
    transfers: dict[int, list[Any]],
) -> LeagueAwards:
    players = players_by_id(bootstrap)
    finished = {e["id"] for e in bootstrap["events"] if e.get("finished")}
    events = [e for e in overview.events if e in finished]

    # Average GW score over each manager's other finished gameweeks (for Chip Flop).
    def average_without(manager: Manager, event: int) -> float | None:
        others = [h.points for h in manager.history if h.event in finished and h.event != event]
        return sum(others) / len(others) if others else None

    gameweeks: list[GameweekAwards] = []
    pending: list[int] = []
    for event in events:
        playing = [m for m in overview.managers if any(h.event == event for h in m.history)]
        if event not in live or any(event not in picks.get(m.entry_id, {}) for m in playing):
            pending.append(event)
            continue
        teams = [_Team(m, event, picks[m.entry_id][event], live[event], players) for m in playing]
        averages = {m.entry_id: average_without(m, event) for m in playing}
        candidates = [
            _manager_of_week(teams, lowest=False),
            _manager_of_week(teams, lowest=True),
            _bench_loser(teams),
            _lucky_sub(teams),
            _vice_saviour(teams),
            _captain_fail(teams),
            _hit_regret(teams, transfers),
            _sold_too_soon(teams, transfers),
            _chip_flop(teams, averages),
        ]
        awards = [a for a in candidates if a is not None]
        gameweeks.append(GameweekAwards(event=event, awards=awards))

    wins: dict[AwardKey, Counter[int]] = defaultdict(Counter)
    for gw in gameweeks:
        for award in gw.awards:
            for winner in award.winners:
                wins[award.key][winner.entry_id] += 1
    hall = [
        HallOfFame(
            key=key,
            ranking=[
                HallEntry(entry_id=entry, wins=n)
                for entry, n in sorted(wins[key].items(), key=lambda kv: (-kv[1], kv[0]))
            ],
        )
        for key in AWARD_ORDER
    ]

    return LeagueAwards(
        gameweeks=list(reversed(gameweeks)), hall=hall, pending_events=sorted(pending)
    )
