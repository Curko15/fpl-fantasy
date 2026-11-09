"""League-wide transfer feed with each transfer tagged free / hit / wildcard / free hit."""

import asyncio
from collections import defaultdict
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

from app.config import settings
from app.fpl_client import FplClient
from app.league import LeagueOverview

TransferKind = Literal["free", "hit", "wildcard", "free_hit"]

CHIP_KINDS: dict[str, TransferKind] = {"wildcard": "wildcard", "freehit": "free_hit"}


class Player(BaseModel):
    id: int
    name: str
    team: str
    position: str


class Transfer(BaseModel):
    entry_id: int
    event: int
    time: datetime
    player_in: Player
    in_cost: int  # tenths of a million, as FPL reports it
    player_out: Player
    out_cost: int
    kind: TransferKind


class ManagerTransferSummary(BaseModel):
    entry_id: int
    transfers: int
    hits: int  # number of paid transfers
    hit_cost: int  # points spent on hits


class LeagueTransfers(BaseModel):
    transfers: list[Transfer]  # newest first
    managers: list[ManagerTransferSummary]  # league standings order


def _players(bootstrap: dict[str, Any]) -> dict[int, Player]:
    teams = {t["id"]: t["short_name"] for t in bootstrap["teams"]}
    positions = {p["id"]: p["singular_name_short"] for p in bootstrap["element_types"]}
    return {
        e["id"]: Player(
            id=e["id"],
            name=e["web_name"],
            team=teams.get(e["team"], "?"),
            position=positions.get(e["element_type"], "?"),
        )
        for e in bootstrap["elements"]
    }


def _unknown_player(element_id: int) -> Player:
    return Player(id=element_id, name=f"Player {element_id}", team="?", position="?")


def tag_gameweek(
    transfers: list[dict[str, Any]], chip: str | None, cost: int
) -> list[tuple[dict[str, Any], TransferKind]]:
    """Tag one manager's transfers for one gameweek.

    FPL only reports the total hit cost per gameweek, not which transfer was paid.
    Free transfers are used first, so the last `cost / hit` transfers made are the paid ones.
    """
    if chip in CHIP_KINDS:
        return [(t, CHIP_KINDS[chip]) for t in transfers]
    ordered = sorted(transfers, key=lambda t: t["time"])
    paid = min(len(ordered), cost // settings.hit_cost)
    free = len(ordered) - paid
    return [(t, "free" if i < free else "hit") for i, t in enumerate(ordered)]


async def build_league_transfers(
    client: FplClient, overview: LeagueOverview, bootstrap: dict[str, Any]
) -> LeagueTransfers:
    players = _players(bootstrap)
    raw = await asyncio.gather(*(client.entry_transfers(m.entry_id) for m in overview.managers))

    feed: list[Transfer] = []
    summaries: list[ManagerTransferSummary] = []
    for manager, manager_transfers in zip(overview.managers, raw, strict=True):
        gws = {h.event: h for h in manager.history}
        by_event: dict[int, list[dict[str, Any]]] = defaultdict(list)
        for t in manager_transfers:
            # Ignore transfers made before the league started counting.
            if t["event"] >= overview.league.start_event:
                by_event[t["event"]].append(t)

        hits = 0
        for event, transfers in by_event.items():
            gw = gws.get(event)
            chip = gw.chip if gw else None
            cost = gw.transfers_cost if gw else 0
            for t, kind in tag_gameweek(transfers, chip, cost):
                hits += kind == "hit"
                feed.append(
                    Transfer(
                        entry_id=manager.entry_id,
                        event=event,
                        time=t["time"],
                        player_in=players.get(t["element_in"]) or _unknown_player(t["element_in"]),
                        in_cost=t["element_in_cost"],
                        player_out=players.get(t["element_out"])
                        or _unknown_player(t["element_out"]),
                        out_cost=t["element_out_cost"],
                        kind=kind,
                    )
                )

        summaries.append(
            ManagerTransferSummary(
                entry_id=manager.entry_id,
                transfers=sum(len(ts) for ts in by_event.values()),
                hits=hits,
                hit_cost=sum(h.transfers_cost for h in manager.history),
            )
        )

    feed.sort(key=lambda t: t.time, reverse=True)
    return LeagueTransfers(transfers=feed, managers=summaries)
