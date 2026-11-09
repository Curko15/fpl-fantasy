"""Thin async client for the public FPL API with throttling and retries."""

import asyncio
import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

RETRY_STATUSES = {429, 500, 502, 503, 504}


class FplError(Exception):
    """FPL API could not be reached or kept failing."""


class FplNotFound(FplError):
    """FPL API returned 404 (unknown league / entry)."""


class FplClient:
    def __init__(
        self,
        http: httpx.AsyncClient,
        *,
        max_concurrency: int = settings.fpl_max_concurrency,
        max_retries: int = 3,
        backoff_seconds: float = 1.0,
    ) -> None:
        self._http = http
        self._semaphore = asyncio.Semaphore(max_concurrency)
        self._max_retries = max_retries
        self._backoff = backoff_seconds

    async def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        url = f"{settings.fpl_api_base}{path}"
        for attempt in range(self._max_retries + 1):
            async with self._semaphore:
                try:
                    response = await self._http.get(url, params=params)
                except httpx.TransportError as exc:
                    error: str = f"{type(exc).__name__}: {exc}"
                else:
                    if response.status_code == 404:
                        raise FplNotFound(path)
                    if response.status_code not in RETRY_STATUSES:
                        response.raise_for_status()
                        return response.json()
                    error = f"HTTP {response.status_code}"
            if attempt < self._max_retries:
                delay = self._backoff * 2**attempt
                logger.warning("FPL %s failed (%s), retrying in %.1fs", path, error, delay)
                await asyncio.sleep(delay)
        raise FplError(f"FPL request {path} failed after retries: {error}")

    async def bootstrap(self) -> dict[str, Any]:
        return await self.get("/bootstrap-static/")

    async def league_standings(self, league_id: int, page: int = 1) -> dict[str, Any]:
        return await self.get(
            f"/leagues-classic/{league_id}/standings/", params={"page_standings": page}
        )

    async def entry_history(self, entry_id: int) -> dict[str, Any]:
        return await self.get(f"/entry/{entry_id}/history/")

    async def entry_transfers(self, entry_id: int) -> list[dict[str, Any]]:
        return await self.get(f"/entry/{entry_id}/transfers/")

    async def entry_picks(self, entry_id: int, event: int) -> dict[str, Any]:
        return await self.get(f"/entry/{entry_id}/event/{event}/picks/")

    async def event_live(self, event: int) -> dict[str, Any]:
        return await self.get(f"/event/{event}/live/")


def make_http_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=httpx.Timeout(15.0),
        headers={"User-Agent": "fpl-league-tracker"},
    )
