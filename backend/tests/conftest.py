from collections.abc import AsyncIterator, Iterator

import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from app.config import settings
from app.db import create_tables, make_engine, make_sessionmaker
from app.fpl_client import FplClient
from app.main import app
from app.store import FplStore


@pytest.fixture(autouse=True)
def test_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    """Every test gets a fresh in-memory database and no scheduler/background jobs."""
    monkeypatch.setattr(settings, "database_url", "sqlite+aiosqlite://")
    monkeypatch.setattr(settings, "background_jobs", False)
    monkeypatch.setattr(settings, "fpl_retry_backoff_seconds", 0)


@pytest.fixture
def fpl_mock() -> Iterator[respx.MockRouter]:
    with respx.mock(assert_all_called=False) as mock:
        yield mock


@pytest.fixture
async def store(fpl_mock: respx.MockRouter) -> AsyncIterator[FplStore]:
    engine = make_engine(settings.database_url)
    await create_tables(engine)
    async with httpx.AsyncClient() as http:
        yield FplStore(FplClient(http, backoff_seconds=0), make_sessionmaker(engine))
    await engine.dispose()


@pytest.fixture
def client(fpl_mock: respx.MockRouter) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client
