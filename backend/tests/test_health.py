from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_refresh_is_disabled_without_a_token(monkeypatch) -> None:
    monkeypatch.setattr(settings, "refresh_token", "")
    assert client.post("/api/refresh", headers={"Authorization": "Bearer "}).status_code == 401


def test_refresh_needs_the_right_token(monkeypatch, client) -> None:
    monkeypatch.setattr(settings, "refresh_token", "s3cret")
    assert client.post("/api/refresh", headers={"Authorization": "Bearer nope"}).status_code == 401
    response = client.post("/api/refresh", headers={"Authorization": "Bearer s3cret"})
    assert response.status_code == 202
