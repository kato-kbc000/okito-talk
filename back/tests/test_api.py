import httpx
import pytest
from fastapi.testclient import TestClient

from back.app import auth, geocode as geo
from back.app.config import Settings, get_settings
from back.app.main import app

SETTINGS = Settings("https://example.supabase.co", "pub-key", "", ())


@pytest.fixture()
def client():
    app.dependency_overrides[get_settings] = lambda: SETTINGS
    yield TestClient(app)
    app.dependency_overrides.clear()


def fake_transport(handler):
    real = httpx.AsyncClient

    def factory(*args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        return real(*args, **kwargs)

    return factory


def test_health(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok" and body["auth_configured"] is True


def test_requires_login(client):
    assert client.get("/api/me").status_code == 401
    assert client.get("/api/geocode", params={"q": "那覇"}).status_code == 401


def test_invalid_token(client, monkeypatch):
    monkeypatch.setattr(auth.httpx, "AsyncClient", fake_transport(lambda r: httpx.Response(401, json={})))
    r = client.get("/api/me", headers={"Authorization": "Bearer bad"})
    assert r.status_code == 401


def test_me_returns_profile_and_unread(client, monkeypatch):
    def handler(request: httpx.Request):
        if request.url.path == "/auth/v1/user":
            return httpx.Response(200, json={"id": "u1", "email": "a@b.c"})
        if request.url.path == "/rest/v1/profiles":
            return httpx.Response(200, json=[{"id": "u1", "username": "taro"}])
        if request.url.path == "/rest/v1/messages":
            return httpx.Response(206, json=[], headers={"content-range": "0-0/3"})
        return httpx.Response(404)

    factory = fake_transport(handler)
    monkeypatch.setattr(auth.httpx, "AsyncClient", factory)
    from back.app import main
    monkeypatch.setattr(main.httpx, "AsyncClient", factory)
    r = client.get("/api/me", headers={"Authorization": "Bearer good"})
    assert r.status_code == 200
    assert r.json() == {"id": "u1", "email": "a@b.c", "profile": {"id": "u1", "username": "taro"}, "unread_messages": 3}


def test_geocode_filters_outside_okinawa(monkeypatch):
    import asyncio

    def handler(request: httpx.Request):
        return httpx.Response(200, json=[{"lat": "35.68", "lon": "139.76", "display_name": "東京"}])

    monkeypatch.setattr(geo.httpx, "AsyncClient", fake_transport(handler))
    assert asyncio.run(geo.geocode("東京駅")) is None


def test_geocode_okinawa(monkeypatch):
    import asyncio

    def handler(request: httpx.Request):
        return httpx.Response(200, json=[{"lat": "26.21", "lon": "127.68", "display_name": "那覇市"}])

    monkeypatch.setattr(geo.httpx, "AsyncClient", fake_transport(handler))
    found = asyncio.run(geo.geocode("那覇市"))
    assert found and found["latitude"] == 26.21


def test_places_search_returns_candidates_and_flags_approximate(monkeypatch):
    import asyncio

    def handler(request: httpx.Request):
        if "places.googleapis.com" in str(request.url):
            assert request.headers["X-Goog-Api-Key"] == "server-key"
            return httpx.Response(200, json={"places": [
                {"displayName": {"text": "吉野家 331号線糸満店"}, "formattedAddress": "沖縄県糸満市772-1", "location": {"latitude": 26.12, "longitude": 127.66}},
                {"displayName": {"text": "東京の店"}, "formattedAddress": "東京都", "location": {"latitude": 35.6, "longitude": 139.7}},
            ]})
        return httpx.Response(500)

    monkeypatch.setattr(geo.httpx, "AsyncClient", fake_transport(handler))
    found = asyncio.run(geo.search_places("吉野家糸満店", "server-key"))
    assert [c["name"] for c in found] == ["吉野家 331号線糸満店"]  # 沖縄県外は除外
    assert found[0]["approximate"] is False


def test_geocoder_fallback_marks_city_center_as_approximate(monkeypatch):
    import asyncio

    def handler(request: httpx.Request):
        if "places.googleapis.com" in str(request.url):
            return httpx.Response(403, json={})
        if "maps/api/geocode" in str(request.url):
            return httpx.Response(200, json={"results": [
                {"formatted_address": "糸満市役所", "geometry": {"location": {"lat": 26.123, "lng": 127.665}, "location_type": "GEOMETRIC_CENTER"}, "partial_match": True}]})
        return httpx.Response(500)

    monkeypatch.setattr(geo.httpx, "AsyncClient", fake_transport(handler))
    found = asyncio.run(geo.search_places("糸満市772-1", "server-key"))
    assert found[0]["approximate"] is True


def test_geocode_endpoint_returns_candidates(client, monkeypatch):
    from back.app import main

    async def fake_search(q, key):
        return [{"latitude": 26.2, "longitude": 127.7, "name": "A", "address": "那覇市", "approximate": False},
                {"latitude": 26.3, "longitude": 127.8, "name": "B", "address": "浦添市", "approximate": True}]

    monkeypatch.setattr(main, "search_places", fake_search)
    monkeypatch.setattr(auth.httpx, "AsyncClient", fake_transport(lambda r: httpx.Response(200, json={"id": "u1", "email": None})))
    r = client.get("/api/geocode", params={"q": "那覇"}, headers={"Authorization": "Bearer t"})
    body = r.json()
    assert r.status_code == 200 and body["name"] == "A" and len(body["candidates"]) == 2


def test_normalize_query():
    assert geo.normalize_query("国際通り") == "沖縄県 国際通り"
    assert geo.normalize_query("沖縄県那覇市") == "沖縄県那覇市"


def test_static_pages_served_but_secrets_not(client):
    assert client.get("/front/html/login.html").status_code == 200
    assert client.get("/", follow_redirects=False).status_code in (302, 307)
    assert client.get("/back/.env").status_code == 404
    assert client.get("/supabase/setup.sql").status_code == 404
