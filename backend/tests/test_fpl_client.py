import httpx
import pytest
import respx

from app.fpl_client import FplClient, FplError
from tests.fpl_data import API


async def test_client_retries_rate_limit_then_succeeds(fpl_mock: respx.MockRouter):
    route = fpl_mock.get(f"{API}/bootstrap-static/").mock(
        side_effect=[httpx.Response(429), httpx.Response(200, json={"ok": True})]
    )
    async with httpx.AsyncClient() as http:
        assert await FplClient(http, backoff_seconds=0).bootstrap() == {"ok": True}
    assert route.call_count == 2


async def test_client_gives_up_after_retries(fpl_mock: respx.MockRouter):
    fpl_mock.get(f"{API}/bootstrap-static/").respond(503)
    async with httpx.AsyncClient() as http:
        with pytest.raises(FplError):
            await FplClient(http, max_retries=2, backoff_seconds=0).bootstrap()
