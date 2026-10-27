"""場所検索。店名・住所から沖縄県内の候補を最大5件返す。

優先順位:
  1. Google Places「テキスト検索（New）」… 店名で探せる。サーバー用キーがあるときだけ
  2. Google Geocoding API … 住所向け。番地まで特定できなかった結果には approximate=True を付ける
  3. OpenStreetMap Nominatim … キー不要の予備
"""
import httpx

OKINAWA_LAT = (24.0, 28.8)
OKINAWA_LNG = (122.5, 131.5)
MAX_CANDIDATES = 5


def is_okinawa(latitude: float, longitude: float) -> bool:
    return OKINAWA_LAT[0] <= latitude <= OKINAWA_LAT[1] and OKINAWA_LNG[0] <= longitude <= OKINAWA_LNG[1]


def normalize_query(query: str) -> str:
    query = query.strip()
    return query if "沖縄" in query else f"沖縄県 {query}"


async def _google_places(client: httpx.AsyncClient, query: str, key: str) -> list[dict]:
    response = await client.post(
        "https://places.googleapis.com/v1/places:searchText",
        headers={
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location",
        },
        json={
            "textQuery": query,
            "languageCode": "ja",
            "regionCode": "JP",
            "maxResultCount": MAX_CANDIDATES,
            "locationBias": {
                "rectangle": {
                    "low": {"latitude": OKINAWA_LAT[0], "longitude": OKINAWA_LNG[0]},
                    "high": {"latitude": OKINAWA_LAT[1], "longitude": OKINAWA_LNG[1]},
                }
            },
        },
    )
    response.raise_for_status()
    return [
        {
            "latitude": place["location"]["latitude"],
            "longitude": place["location"]["longitude"],
            "name": (place.get("displayName") or {}).get("text", ""),
            "address": place.get("formattedAddress", ""),
            "approximate": False,
        }
        for place in response.json().get("places", [])
    ]


async def _google_geocode(client: httpx.AsyncClient, query: str, key: str) -> list[dict]:
    response = await client.get(
        "https://maps.googleapis.com/maps/api/geocode/json",
        params={
            "address": query, "key": key, "region": "jp", "language": "ja",
            "bounds": f"{OKINAWA_LAT[0]},{OKINAWA_LNG[0]}|{OKINAWA_LAT[1]},{OKINAWA_LNG[1]}",
        },
    )
    response.raise_for_status()
    found = []
    for result in response.json().get("results", [])[:MAX_CANDIDATES]:
        geometry = result["geometry"]
        found.append({
            "latitude": geometry["location"]["lat"],
            "longitude": geometry["location"]["lng"],
            "name": "",
            "address": result.get("formatted_address", ""),
            "approximate": geometry.get("location_type") not in ("ROOFTOP", "RANGE_INTERPOLATED") or bool(result.get("partial_match")),
        })
    return found


async def _nominatim(client: httpx.AsyncClient, query: str) -> list[dict]:
    response = await client.get(
        "https://nominatim.openstreetmap.org/search",
        params={"format": "json", "limit": MAX_CANDIDATES, "countrycodes": "jp", "viewbox": "122.5,28.8,131.5,24", "bounded": 1, "q": query},
        headers={"Accept-Language": "ja", "User-Agent": "okito-talk/1.0"},
    )
    response.raise_for_status()
    return [
        {"latitude": float(row["lat"]), "longitude": float(row["lon"]), "name": row.get("name", ""),
         "address": row.get("display_name", query), "approximate": False}
        for row in response.json()
    ]


def _dedupe(items: list[dict]) -> list[dict]:
    seen, unique = set(), []
    for item in items:
        if not is_okinawa(item["latitude"], item["longitude"]):
            continue
        key = (round(item["latitude"], 5), round(item["longitude"], 5))
        if key not in seen:
            seen.add(key)
            unique.append(item)
    return unique[:MAX_CANDIDATES]


async def search_places(query: str, google_key: str = "") -> list[dict]:
    query = normalize_query(query)
    async with httpx.AsyncClient(timeout=8) as client:
        providers = []
        if google_key:
            providers += [lambda: _google_places(client, query, google_key), lambda: _google_geocode(client, query, google_key)]
        providers.append(lambda: _nominatim(client, query))
        for provider in providers:
            try:
                found = _dedupe(await provider())
            except (httpx.HTTPError, KeyError, ValueError, TypeError):
                continue
            if found:
                return found
    return []


async def geocode(query: str, google_key: str = "") -> dict | None:
    """互換用：先頭の1件だけ返す。"""
    found = await search_places(query, google_key)
    return found[0] if found else None
