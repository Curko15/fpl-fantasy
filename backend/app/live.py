"""Live gameweek: provisional scores and the league table while a gameweek is being played.

Scores are each manager's picks times the players' live points. The picks' multipliers
already carry the captain (x2), Triple Captain (x3) and Bench Boost (bench x1). Auto-subs
and the vice-captain stepping in are only applied by FPL once the gameweek is processed,
so live scores are provisional, before auto-subs.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.league import LeagueOverview, Manager, competition_ranks
from app.transfers import Player, players_by_id, unknown_player


class LiveManager(BaseModel):
    entry_id: int
    player_name: str
    team_name: str
    rank: int  # live league rank
    pre_rank: int  # league rank before this gameweek
    points: int  # live gameweek points after hits
    transfers_cost: int
    total: int  # league total before the gameweek plus live points
    chip: str | None
    captain: Player | None
    captain_points: int  # including the multiplier
    players_left: int  # counting players whose team still has a match to start


class LiveLeague(BaseModel):
    event: int | None
    live: bool  # True while `event` is being played
    managers: list[LiveManager]  # by live rank; empty when there's nothing to show
    updated_at: datetime | None  # when FPL's live points were fetched


def score_picks(picks: dict[str, Any], points: dict[int, int]) -> tuple[int, int | None, int]:
    """(points before hits, captain element, captain points incl. multiplier)."""
    total = 0
    captain: int | None = None
    captain_points = 0
    for pick in picks["picks"]:
        mult = pick["multiplier"]
        base = points.get(pick["element"], 0)
        total += base * mult
        if pick.get("is_captain", mult > 1):
            captain, captain_points = pick["element"], base * mult
    return total, captain, captain_points


def teams_left(fixtures: list[dict[str, Any]]) -> set[int]:
    """Teams with a match this gameweek that hasn't kicked off yet."""
    return {
        team
        for f in fixtures
        if not f.get("started") and not f.get("finished")
        for team in (f["team_h"], f["team_a"])
    }


def _total_before(manager: Manager, event: int) -> int:
    before = [h.total for h in manager.history if h.event < event]
    return before[-1] if before else 0


def build_live_league(
    overview: LeagueOverview,
    event: int,
    *,
    live: bool,
    bootstrap: dict[str, Any],
    picks_by_entry: dict[int, dict[str, Any]],
    points: dict[int, int],
    fixtures: list[dict[str, Any]],
    updated_at: datetime | None,
) -> LiveLeague:
    players = players_by_id(bootstrap)
    team_of = {e["id"]: e["team"] for e in bootstrap["elements"]}
    waiting = teams_left(fixtures)

    # Managers without picks (joined the game after this gameweek) are left out.
    members = [m for m in overview.managers if m.entry_id in picks_by_entry]
    before = {m.entry_id: _total_before(m, event) for m in members}
    rows: dict[int, dict[str, Any]] = {}
    for m in members:
        picks = picks_by_entry[m.entry_id]
        gross, captain, captain_points = score_picks(picks, points)
        gw = next((h for h in m.history if h.event == event), None)
        cost = (picks.get("entry_history") or {}).get("event_transfers_cost")
        if cost is None:
            cost = gw.transfers_cost if gw else 0
        rows[m.entry_id] = {
            "points": gross - cost,
            "cost": cost,
            "chip": picks.get("active_chip") or (gw.chip if gw else None),
            "captain": captain,
            "captain_points": captain_points,
            "left": sum(
                1
                for p in picks["picks"]
                if p["multiplier"] > 0 and team_of.get(p["element"]) in waiting
            ),
        }

    totals = {e: before[e] + r["points"] for e, r in rows.items()}
    pre_ranks = competition_ranks(before)
    ranks = competition_ranks(totals)
    managers = [
        LiveManager(
            entry_id=m.entry_id,
            player_name=m.player_name,
            team_name=m.team_name,
            rank=ranks[m.entry_id],
            pre_rank=pre_ranks[m.entry_id],
            points=rows[m.entry_id]["points"],
            transfers_cost=rows[m.entry_id]["cost"],
            total=totals[m.entry_id],
            chip=rows[m.entry_id]["chip"],
            captain=(
                players.get(c) or unknown_player(c)
                if (c := rows[m.entry_id]["captain"]) is not None
                else None
            ),
            captain_points=rows[m.entry_id]["captain_points"],
            players_left=rows[m.entry_id]["left"],
        )
        for m in members
    ]
    managers.sort(key=lambda r: (r.rank, r.pre_rank, r.team_name.lower()))
    return LiveLeague(event=event, live=live, managers=managers, updated_at=updated_at)
