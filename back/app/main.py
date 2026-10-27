"""おきとーーーーーーく  FastAPI サーバー

  - フロント（front/ と images/）をそのまま配信する
  - ログイン確認つきの API（/api/...）を提供する

起動（プロジェクトのルートで）:
    pip install -r back/requirements.txt
    uvicorn back.app.main:app --reload --port 8000
"""
import httpx
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from .auth import CurrentUser, get_current_user
from .config import ROOT_DIR, Settings, get_settings
from .geocode import search_places

app = FastAPI(title="おきとーーーーーーく API", version="1.0.0")

_settings = get_settings()
if _settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(_settings.cors_origins),
        allow_methods=["GET"],
        allow_headers=["Authorization", "Content-Type"],
    )


@app.get("/api/health")
async def health(settings: Settings = Depends(get_settings)):
    return {"status": "ok", "auth_configured": settings.auth_configured, "geocoding": "google+osm" if settings.google_geocoding_key else "osm"}


@app.get("/api/me")
async def me(user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)):
    """ログイン中ユーザーのプロフィールと未読メッセージ数。RLS が効くよう本人のトークンで Supabase に問い合わせる。"""
    headers = {"apikey": settings.supabase_key, "Authorization": f"Bearer {user.token}"}
    try:
        async with httpx.AsyncClient(timeout=8, base_url=f"{settings.supabase_url}/rest/v1") as client:
            profile = await client.get("/profiles", params={"id": f"eq.{user.id}", "select": "*"}, headers=headers)
            unread = await client.get(
                "/messages",
                params={"receiver_id": f"eq.{user.id}", "is_read": "eq.false", "select": "id"},
                headers={**headers, "Prefer": "count=exact", "Range-Unit": "items", "Range": "0-0"},
            )
    except httpx.HTTPError:
        raise HTTPException(502, "データベースに接続できませんでした。")
    if profile.status_code != 200:
        raise HTTPException(502, "プロフィールを取得できませんでした。")
    rows = profile.json()
    total = 0
    if unread.status_code in (200, 206):
        total = int(unread.headers.get("content-range", "*/0").split("/")[-1] or 0)
    return {"id": user.id, "email": user.email, "profile": rows[0] if rows else None, "unread_messages": total}


@app.get("/api/geocode")
async def geocode_endpoint(
    q: str = Query(..., min_length=1, max_length=160, description="店名・住所"),
    _user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """沖縄県内の場所候補（最大5件）。先頭の候補は latitude/longitude/address にも入れて返す。"""
    candidates = await search_places(q, settings.google_geocoding_key)
    if not candidates:
        raise HTTPException(404, "沖縄県内の場所を確認できませんでした。店名・市町村名・番地を確認してください。")
    return {**candidates[0], "candidates": candidates}


# ---- 静的ファイル（.env や supabase/ などは公開しない） ----
@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse("/front/html/login.html")


app.mount("/front", StaticFiles(directory=ROOT_DIR / "front"), name="front")
app.mount("/images", StaticFiles(directory=ROOT_DIR / "images"), name="images")
