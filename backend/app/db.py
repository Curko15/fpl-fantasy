"""Database tables and engine.

We store FPL's raw responses rather than a normalised schema: every page is computed
from them on request, so new features (like awards) need no migrations or refetching.
"""

from datetime import UTC, datetime
from typing import Any, ClassVar

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, Integer, String, TypeDecorator
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.pool import StaticPool


def utcnow() -> datetime:
    return datetime.now(UTC)


class UtcDateTime(TypeDecorator[datetime]):
    """Stores UTC; always hands back timezone-aware datetimes (SQLite drops the zone)."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Any) -> datetime | None:
        if value is not None and value.tzinfo is not None:
            value = value.astimezone(UTC)
        return value

    def process_result_value(self, value: datetime | None, dialect: Any) -> datetime | None:
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value


class Base(DeclarativeBase):
    type_annotation_map: ClassVar[dict[Any, Any]] = {
        dict[str, Any]: JSON,
        list[Any]: JSON,
        datetime: UtcDateTime,
    }


class BootstrapRow(Base):
    """`/bootstrap-static/`: players, teams, gameweeks, chips. Single row."""

    __tablename__ = "bootstrap"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    data: Mapped[dict[str, Any]]
    fetched_at: Mapped[datetime]


class LeagueRow(Base):
    __tablename__ = "leagues"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    standings: Mapped[dict[str, Any]]  # first page of /leagues-classic/{id}/standings/
    fetched_at: Mapped[datetime]
    last_viewed_at: Mapped[datetime]


class EntryRow(Base):
    """One manager's season: `/entry/{id}/history/` and `/entry/{id}/transfers/`."""

    __tablename__ = "entries"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    history: Mapped[dict[str, Any]]
    transfers: Mapped[list[Any]]
    fetched_at: Mapped[datetime]


class PicksRow(Base):
    """`/entry/{id}/event/{gw}/picks/`. Final once the gameweek is finished."""

    __tablename__ = "picks"

    entry_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    event: Mapped[int] = mapped_column(Integer, primary_key=True)
    data: Mapped[dict[str, Any]]
    final: Mapped[bool] = mapped_column(Boolean)
    fetched_at: Mapped[datetime]


class LiveRow(Base):
    """Points per player for a gameweek, reduced from `/event/{gw}/live/` to {id: points}."""

    __tablename__ = "event_live"

    event: Mapped[int] = mapped_column(Integer, primary_key=True)
    points: Mapped[dict[str, Any]]  # JSON object keys are strings
    final: Mapped[bool] = mapped_column(Boolean)
    fetched_at: Mapped[datetime]


def make_engine(url: str) -> AsyncEngine:
    if url in ("sqlite+aiosqlite://", "sqlite+aiosqlite:///:memory:"):
        # In-memory SQLite (tests): every connection must share the one database.
        return create_async_engine(
            url, poolclass=StaticPool, connect_args={"check_same_thread": False}
        )
    return create_async_engine(url, pool_pre_ping=True)


def make_sessionmaker(engine: AsyncEngine) -> async_sessionmaker:
    return async_sessionmaker(engine, expire_on_commit=False)


async def create_tables(engine: AsyncEngine) -> None:
    # The schema is a handful of JSON tables; switch to Alembic once it needs migrating.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
