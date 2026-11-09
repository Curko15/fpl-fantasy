"""Manager page: which players earned the points, and a gameweek-by-gameweek log."""

import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

from pydantic import BaseModel

from app.league import LeagueOverview, Manager
from app.transfers import Player, players_by_id, unknown_player

PicksLoader = Callable[[int], Awaitable[dict[str, Any]]]
LiveLoader = Callable[[int], Awaitable[dict[int, int]]]


class Contributor(BaseModel):
    player: Player
    points: int  # points that counted for this manager, captaincy included
    captain_points: int  # the extra part that came from captaincy
    starts: int  # gameweeks the player's points counted (started or auto-subbed on)
    captained: int  # gameweeks as (effective) captain


class GameweekDetail(BaseModel):
    event: int
    points: int  # after hits
    total: int
    league_rank: int
    overall_rank: int | None
    transfers_cost: int
    chip: str | None
    bench_points: int
    captain: Player | None
    captain_points: int  # captain's points including the multiplier


class ManagerDetail(BaseModel):
    manager: Manager
    contributors: list[Contributor]
    gameweeks: list[GameweekDetail]  # newest first
    provisional_event: int | None  # set while the current gameweek's points can still change


def live_points(live: dict[str, Any]) -> dict[int, int]:
    """Reduce the large /event/{gw}/live/ payload to {player id: points}."""
    return {e["id"]: e["stats"]["total_points"] for e in live["elements"]}


async def build_manager_detail(
    overview: LeagueOverview,
    manager: Manager,
    bootstrap: dict[str, Any],
    load_picks: PicksLoader,
    load_live: LiveLoader,
) -> ManagerDetail:
    players = players_by_id(bootstrap)
    events = [h.event for h in manager.history]
    picks_list, live_list = await asyncio.gather(
        asyncio.gather(*(load_picks(e) for e in events)),
        asyncio.gather(*(load_live(e) for e in events)),
    )

    contributors: dict[int, Contributor] = {}
    gameweeks: list[GameweekDetail] = []
    for gw, picks, points in zip(manager.history, picks_list, live_list, strict=True):
        bench = 0
        captain: Player | None = None
        captain_points = 0
        for pick in picks["picks"]:
            element = pick["element"]
            mult = pick["multiplier"]
            base = points.get(element, 0)
            if mult == 0:
                bench += base
                continue
            player = players.get(element) or unknown_player(element)
            c = contributors.setdefault(
                element,
                Contributor(player=player, points=0, captain_points=0, starts=0, captained=0),
            )
            c.points += base * mult
            c.starts += 1
            if mult > 1:
                c.captain_points += base * (mult - 1)
                c.captained += 1
                captain, captain_points = player, base * mult
        gameweeks.append(
            GameweekDetail(
                event=gw.event,
                points=gw.points,
                total=gw.total,
                league_rank=gw.league_rank,
                overall_rank=gw.overall_rank,
                transfers_cost=gw.transfers_cost,
                chip=gw.chip,
                bench_points=bench,
                captain=captain,
                captain_points=captain_points,
            )
        )

    provisional = (
        overview.current_event
        if overview.current_event in events and not overview.current_event_finished
        else None
    )
    return ManagerDetail(
        manager=manager,
        contributors=sorted(contributors.values(), key=lambda c: (-c.points, c.player.name)),
        gameweeks=list(reversed(gameweeks)),
        provisional_event=provisional,
    )
