"""Reads FPL data from the database, fetching from FPL only what is missing or stale."""

import asyncio
import logging
from collections.abc import Coroutine, Hashable, Iterable
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.config import settings
from app.db import BootstrapRow, EntryRow, LeagueRow, LiveRow, PicksRow, utcnow
from app.fpl_client import FplClient, FplNotFound
from app.league import LeagueError, validate_standings

logger = logging.getLogger(__name__)

# Bootstrap says which gameweek is current and finished; refetch it at most this often.
BOOTSTRAP_MAX_AGE = timedelta(hours=1)


@dataclass
class LeagueData:
    standings: dict[str, Any]
    histories: dict[int, dict[str, Any]]
    transfers: dict[int, list[Any]]
    fetched_at: datetime


def live_points(live: dict[str, Any]) -> dict[int, int]:
    """Reduce the large /event/{gw}/live/ payload to {player id: points}."""
    return {e["id"]: e["stats"]["total_points"] for e in live["elements"]}


def member_ids(standings: dict[str, Any]) -> list[int]:
    return [r["entry"] for r in standings["standings"]["results"]]


class FplStore:
    def __init__(self, fpl: FplClient, sessions: async_sessionmaker) -> None:
        self._fpl = fpl
        self._sessions = sessions
        self._locks: dict[Hashable, asyncio.Lock] = {}
        self._bootstrap: tuple[datetime, dict[str, Any]] | None = None
        self._background: dict[Hashable, asyncio.Task[None]] = {}

    def _lock(self, key: Hashable) -> asyncio.Lock:
        return self._locks.setdefault(key, asyncio.Lock())

    # ---- bootstrap -------------------------------------------------------------------

    async def bootstrap(self, *, max_age: timedelta | None = None) -> dict[str, Any]:
        """Stored bootstrap data; refetched if missing or older than `max_age`."""
        async with self._lock("bootstrap"):
            if self._bootstrap is None:
                async with self._sessions() as session:
                    row = await session.get(BootstrapRow, 1)
                    if row:
                        self._bootstrap = (row.fetched_at, row.data)
            if self._bootstrap is not None and (
                max_age is None or utcnow() - self._bootstrap[0] < max_age
            ):
                return self._bootstrap[1]

            data = await self._fpl.bootstrap()
            now = utcnow()
            async with self._sessions.begin() as session:
                await session.merge(BootstrapRow(id=1, data=data, fetched_at=now))
            self._bootstrap = (now, data)
            return data

    async def finished_events(self) -> set[int]:
        return {e["id"] for e in (await self.bootstrap())["events"] if e.get("finished")}

    # ---- leagues ---------------------------------------------------------------------

    async def league(self, league_id: int) -> LeagueData:
        """League data for a page view. First visit fetches it; later visits read the DB."""
        data = await self._load_league(league_id)
        if data is None:
            data = await self.sync_league(league_id)
            self.spawn(("backfill", league_id), self.backfill_picks(league_id))
        else:
            await self._mark_viewed(league_id)
            if utcnow() - data.fetched_at > timedelta(hours=settings.stale_after_hours):
                self.spawn(("refresh", league_id), self.refresh_league(league_id))
        return data

    async def sync_league(self, league_id: int) -> LeagueData:
        """Fetch standings plus every member's history and transfers, and store them."""
        async with self._lock(("league", league_id)):
            await self.bootstrap(max_age=BOOTSTRAP_MAX_AGE)
            try:
                standings = await self._fpl.league_standings(league_id)
            except FplNotFound:
                raise LeagueError(
                    "not_found", f"No classic league with ID {league_id} was found.", 404
                ) from None
            validate_standings(standings)

            entries = member_ids(standings)
            histories, transfers = await asyncio.gather(
                asyncio.gather(*(self._fpl.entry_history(e) for e in entries)),
                asyncio.gather(*(self._fpl.entry_transfers(e) for e in entries)),
            )
            now = utcnow()
            async with self._sessions.begin() as session:
                existing = await session.get(LeagueRow, league_id)
                await session.merge(
                    LeagueRow(
                        id=league_id,
                        name=standings["league"]["name"],
                        standings=standings,
                        fetched_at=now,
                        last_viewed_at=existing.last_viewed_at if existing else now,
                    )
                )
                for entry, history, entry_transfers in zip(
                    entries, histories, transfers, strict=True
                ):
                    await session.merge(
                        EntryRow(
                            id=entry, history=history, transfers=entry_transfers, fetched_at=now
                        )
                    )
            return LeagueData(
                standings=standings,
                histories=dict(zip(entries, histories, strict=True)),
                transfers=dict(zip(entries, transfers, strict=True)),
                fetched_at=now,
            )

    async def refresh_league(self, league_id: int) -> None:
        """Daily refresh: league, members, then picks and live points."""
        try:
            await self.sync_league(league_id)
        except LeagueError as exc:
            # League deleted or grew past the cap since it was last viewed.
            logger.info("Skipping league %s: %s", league_id, exc.message)
            return
        await self.backfill_picks(league_id)

    async def recent_league_ids(self) -> list[int]:
        since = utcnow() - timedelta(days=settings.refresh_recent_days)
        async with self._sessions() as session:
            result = await session.scalars(
                select(LeagueRow.id).where(LeagueRow.last_viewed_at >= since)
            )
            return list(result)

    async def _load_league(self, league_id: int) -> LeagueData | None:
        async with self._sessions() as session:
            league = await session.get(LeagueRow, league_id)
            if league is None:
                return None
            ids = member_ids(league.standings)
            rows = {
                r.id: r for r in await session.scalars(select(EntryRow).where(EntryRow.id.in_(ids)))
            }
        if len(rows) < len(ids):
            return None  # a member's data is missing; treat as never fetched
        return LeagueData(
            standings=league.standings,
            histories={i: rows[i].history for i in ids},
            transfers={i: rows[i].transfers for i in ids},
            fetched_at=league.fetched_at,
        )

    async def _mark_viewed(self, league_id: int) -> None:
        async with self._sessions.begin() as session:
            await session.execute(
                update(LeagueRow).where(LeagueRow.id == league_id).values(last_viewed_at=utcnow())
            )

    # ---- picks and live points -------------------------------------------------------

    async def picks(self, entry_id: int, events: Iterable[int]) -> dict[int, dict[str, Any]]:
        """Picks per gameweek; only gameweeks never fetched before are requested."""
        return (await self._picks({entry_id: list(events)}, refetch_provisional=False))[entry_id]

    async def live(self, events: Iterable[int]) -> dict[int, dict[int, int]]:
        return await self._live(set(events), refetch_provisional=False)

    async def backfill_picks(self, league_id: int) -> None:
        """Fetch every member's picks for every gameweek, plus live points.

        Rows for finished gameweeks are final and never refetched; the current
        gameweek's rows are refetched so they end up with the confirmed numbers.
        """
        data = await self._load_league(league_id)
        if data is None:
            return
        start = data.standings["league"].get("start_event") or 1
        all_events: set[int] = set()
        # One manager at a time, so progress is saved even if FPL fails halfway.
        for entry, history in data.histories.items():
            events = [gw["event"] for gw in history["current"] if gw["event"] >= start]
            all_events.update(events)
            await self._picks({entry: events}, refetch_provisional=True)
        await self._live(all_events, refetch_provisional=True)

    async def _picks(
        self, wanted: dict[int, list[int]], *, refetch_provisional: bool
    ) -> dict[int, dict[int, dict[str, Any]]]:
        result: dict[int, dict[int, dict[str, Any]]] = {entry: {} for entry in wanted}
        async with self._sessions() as session:
            rows = await session.scalars(select(PicksRow).where(PicksRow.entry_id.in_(wanted)))
            for row in rows:
                if row.event in wanted[row.entry_id] and (row.final or not refetch_provisional):
                    result[row.entry_id][row.event] = row.data

        missing = [(e, gw) for e, events in wanted.items() for gw in events if gw not in result[e]]
        if not missing:
            return result
        finished = await self.finished_events()
        fetched = await asyncio.gather(*(self._fpl.entry_picks(e, gw) for e, gw in missing))
        now = utcnow()
        async with self._sessions.begin() as session:
            for (entry, gw), data in zip(missing, fetched, strict=True):
                result[entry][gw] = data
                await session.merge(
                    PicksRow(
                        entry_id=entry, event=gw, data=data, final=gw in finished, fetched_at=now
                    )
                )
        return result

    async def _live(
        self, events: set[int], *, refetch_provisional: bool
    ) -> dict[int, dict[int, int]]:
        result: dict[int, dict[int, int]] = {}
        async with self._sessions() as session:
            rows = await session.scalars(select(LiveRow).where(LiveRow.event.in_(events)))
            for row in rows:
                if row.final or not refetch_provisional:
                    result[row.event] = {int(k): v for k, v in row.points.items()}

        missing = sorted(events - result.keys())
        if not missing:
            return result
        finished = await self.finished_events()
        fetched = await asyncio.gather(*(self._fpl.event_live(gw) for gw in missing))
        now = utcnow()
        async with self._sessions.begin() as session:
            for gw, payload in zip(missing, fetched, strict=True):
                points = live_points(payload)
                result[gw] = points
                await session.merge(
                    LiveRow(
                        event=gw,
                        points={str(k): v for k, v in points.items()},
                        final=gw in finished,
                        fetched_at=now,
                    )
                )
        return result

    # ---- background work -------------------------------------------------------------

    def spawn(self, key: Hashable, job: Coroutine[Any, Any, None]) -> None:
        """Run `job` in the background unless the same job is already running."""
        if not settings.background_jobs or key in self._background:
            job.close()
            return

        async def run() -> None:
            try:
                await job
            except Exception:
                logger.exception("Background job %s failed", key)
            finally:
                self._background.pop(key, None)

        self._background[key] = asyncio.create_task(run())

    async def wait_for_background(self) -> None:
        """Used by tests and shutdown."""
        while self._background:
            await asyncio.gather(*self._background.values(), return_exceptions=True)
