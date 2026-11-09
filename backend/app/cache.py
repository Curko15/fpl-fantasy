"""Tiny in-memory TTL cache. Placeholder until the database lands."""

import asyncio
import time
from collections.abc import Awaitable, Callable, Hashable
from typing import Any


class TtlCache:
    def __init__(self, ttl_seconds: float) -> None:
        self._ttl = ttl_seconds
        self._items: dict[Hashable, tuple[float, Any]] = {}
        self._locks: dict[Hashable, asyncio.Lock] = {}

    async def get_or_load(self, key: Hashable, load: Callable[[], Awaitable[Any]]) -> Any:
        # One lock per key, so two visitors opening the same league at once
        # trigger a single round of FPL requests.
        lock = self._locks.setdefault(key, asyncio.Lock())
        async with lock:
            hit = self._items.get(key)
            if hit and time.monotonic() - hit[0] < self._ttl:
                return hit[1]
            value = await load()
            self._items[key] = (time.monotonic(), value)
            return value
