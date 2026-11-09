"""Daily refresh of recently viewed leagues."""

import logging
from datetime import timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import settings
from app.store import FplStore

logger = logging.getLogger(__name__)


async def refresh_recent_leagues(store: FplStore) -> None:
    """Refetch bootstrap, then every league viewed in the last N days, one at a time."""
    await store.bootstrap(max_age=timedelta(0))  # always refetch
    league_ids = await store.recent_league_ids()
    logger.info("Daily refresh: %d leagues", len(league_ids))
    for league_id in league_ids:
        try:
            await store.refresh_league(league_id)
        except Exception:
            # One failing league (FPL hiccup) must not stop the others.
            logger.exception("Refreshing league %s failed", league_id)


def start_scheduler(store: FplStore) -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        refresh_recent_leagues,
        CronTrigger(hour=settings.refresh_hour_utc, minute=settings.refresh_minute_utc),
        args=[store],
        id="daily-refresh",
        max_instances=1,
        coalesce=True,
        # A run missed while the server was down is not replayed; leagues older than
        # `stale_after_hours` are refreshed when next opened instead (see FplStore.league).
        misfire_grace_time=3600,
    )
    scheduler.start()
    return scheduler
