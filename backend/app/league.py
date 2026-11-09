"""Builds the league overview: standings plus per-gameweek league rank history."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.config import settings


class LeagueError(Exception):
    """A league we refuse to show; `code` is stable for the frontend."""

    def __init__(self, code: str, message: str, status: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


class GameweekEntry(BaseModel):
    event: int
    points: int  # GW points after hits
    total: int  # league total (counts only from the league's start gameweek)
    league_rank: int
    overall_rank: int | None
    transfers_cost: int
    chip: str | None


class Manager(BaseModel):
    entry_id: int
    player_name: str
    team_name: str
    rank: int
    last_rank: int  # 0 when the manager is new to the standings
    total: int
    event_total: int
    history: list[GameweekEntry]  # only gameweeks the manager played (late joiners have gaps)


class LeagueInfo(BaseModel):
    id: int
    name: str
    start_event: int


class ChipDefinition(BaseModel):
    """One playable chip as FPL defines it this season (e.g. first-half wildcard)."""

    name: str
    start_event: int
    stop_event: int


class LeagueOverview(BaseModel):
    league: LeagueInfo
    current_event: int | None
    current_event_finished: bool
    events: list[int]
    managers: list[Manager]
    chips: list[ChipDefinition]
    last_updated: datetime


def _current_event(bootstrap: dict[str, Any]) -> tuple[int | None, bool]:
    current = [e for e in bootstrap["events"] if e["is_current"]]
    if not current:
        return None, False
    return current[0]["id"], bool(current[0].get("finished"))


def _chip_definitions(bootstrap: dict[str, Any]) -> list[ChipDefinition]:
    chips = [
        ChipDefinition(name=c["name"], start_event=c["start_event"], stop_event=c["stop_event"])
        # A chip with number > 1 can be played that many times in its window.
        for c in bootstrap.get("chips", [])
        for _ in range(c.get("number", 1))
    ]
    return sorted(chips, key=lambda c: (c.start_event, c.name))


def _competition_ranks(totals: dict[int, int]) -> dict[int, int]:
    """1,2,2,4 style ranking (ties share a rank)."""
    ordered = sorted(totals.values(), reverse=True)
    return {entry: ordered.index(total) + 1 for entry, total in totals.items()}


def validate_standings(standings: dict[str, Any]) -> None:
    """Reject leagues we don't support, before fetching anything else."""
    if standings["league"].get("scoring") != "c":
        raise LeagueError(
            "not_classic", "Head-to-head leagues aren't supported yet, only classic leagues.", 422
        )
    results = standings["standings"]["results"]
    if standings["standings"]["has_next"] or len(results) > settings.max_league_size:
        raise LeagueError(
            "too_large",
            f"This league has more than {settings.max_league_size} managers, "
            "which is the most we support.",
            422,
        )


def build_league_overview(
    standings: dict[str, Any],
    histories: dict[int, dict[str, Any]],
    bootstrap: dict[str, Any],
    fetched_at: datetime,
) -> LeagueOverview:
    league = standings["league"]
    results = standings["standings"]["results"]
    current_event, current_finished = _current_event(bootstrap)
    start_event = league.get("start_event") or 1
    # Per manager: {event: (gw points after hits, league total so far, row)}
    per_manager: dict[int, dict[int, tuple[int, int, dict[str, Any]]]] = {}
    chips_by_manager: dict[int, dict[int, str]] = {}
    for row in results:
        entry = row["entry"]
        history = histories[entry]
        chips_by_manager[entry] = {c["event"]: c["name"] for c in history.get("chips", [])}
        running = 0
        gws: dict[int, tuple[int, int, dict[str, Any]]] = {}
        for gw in sorted(history["current"], key=lambda g: g["event"]):
            if gw["event"] < start_event:
                continue
            net = gw["points"] - gw["event_transfers_cost"]
            running += net
            gws[gw["event"]] = (net, running, gw)
        per_manager[entry] = gws

    events = sorted({e for gws in per_manager.values() for e in gws})

    league_ranks: dict[int, dict[int, int]] = {}
    for event in events:
        totals = {entry: gws[event][1] for entry, gws in per_manager.items() if event in gws}
        league_ranks[event] = _competition_ranks(totals)

    managers = [
        Manager(
            entry_id=row["entry"],
            player_name=row["player_name"],
            team_name=row["entry_name"],
            rank=row["rank"],
            last_rank=row["last_rank"],
            total=row["total"],
            event_total=row["event_total"],
            history=[
                GameweekEntry(
                    event=event,
                    points=net,
                    total=total,
                    league_rank=league_ranks[event][row["entry"]],
                    overall_rank=gw.get("overall_rank"),
                    transfers_cost=gw["event_transfers_cost"],
                    chip=chips_by_manager[row["entry"]].get(event),
                )
                for event, (net, total, gw) in per_manager[row["entry"]].items()
            ],
        )
        for row in results
    ]

    return LeagueOverview(
        league=LeagueInfo(id=league["id"], name=league["name"], start_event=start_event),
        current_event=current_event,
        current_event_finished=current_finished,
        events=events,
        managers=managers,
        chips=_chip_definitions(bootstrap),
        last_updated=fetched_at,
    )
