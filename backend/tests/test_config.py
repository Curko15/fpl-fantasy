from app.config import Settings


def url(raw: str) -> str:
    return Settings(database_url=raw).database_url


def test_sqlite_url_is_untouched():
    assert url("sqlite+aiosqlite:///./fpl.db") == "sqlite+aiosqlite:///./fpl.db"


def test_plain_postgres_url_gets_the_async_driver():
    assert url("postgres://u:p@host/db") == "postgresql+asyncpg://u:p@host/db"


def test_neon_url_params_are_translated_for_asyncpg():
    raw = "postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    assert url(raw) == "postgresql+asyncpg://u:p@ep-x.eu-central-1.aws.neon.tech/neondb?ssl=require"
