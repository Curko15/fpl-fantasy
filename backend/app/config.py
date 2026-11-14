from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="FPL_")

    fpl_api_base: str = "https://fantasy.premierleague.com/api"
    fpl_max_concurrency: int = 5
    fpl_retry_backoff_seconds: float = 1.0  # doubles on every retry
    max_league_size: int = 50
    # Points deducted per extra transfer. Not exposed by the FPL API.
    hit_cost: int = 4

    # SQLite file locally; set FPL_DATABASE_URL to a Postgres URL in production.
    database_url: str = "sqlite+aiosqlite:///./fpl.db"

    # Daily refresh of every league viewed in the last `refresh_recent_days` days.
    # 06:00 UTC: the previous evening's matches and bonus points are final by then.
    refresh_hour_utc: int = 6
    refresh_minute_utc: int = 0
    refresh_recent_days: int = 14
    # A league older than this is refreshed in the background when someone opens it
    # (covers a missed daily run, e.g. a free-tier server that was asleep).
    stale_after_hours: int = 26
    # Scheduler and background fetching. Turned off in tests.
    background_jobs: bool = True

    # Lets a scheduled job start the daily refresh via POST /api/refresh. Unset: disabled.
    refresh_token: str = ""

    # In production, a JSON list in FPL_CORS_ORIGINS, e.g. ["https://my-app.vercel.app"].
    cors_origins: list[str] = ["http://localhost:5173"]

    @field_validator("database_url")
    @classmethod
    def _async_driver(cls, url: str) -> str:
        # Hosted Postgres (Neon, Supabase, Render) hands out plain postgres:// URLs.
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                url = "postgresql+asyncpg://" + url.removeprefix(prefix)
        if not url.startswith("postgresql+asyncpg://"):
            return url
        # asyncpg rejects libpq's `sslmode` and `channel_binding` (Neon adds both):
        # translate sslmode to asyncpg's `ssl` and drop channel_binding.
        parts = urlsplit(url)
        query = []
        for key, value in parse_qsl(parts.query):
            if key == "sslmode":
                query.append(("ssl", value))
            elif key != "channel_binding":
                query.append((key, value))
        return urlunsplit(parts._replace(query=urlencode(query)))


settings = Settings()
