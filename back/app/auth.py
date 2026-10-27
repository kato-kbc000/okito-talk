"""Supabase のアクセストークン（Authorization: Bearer ...）を検証する。

JWT シークレットを持たず、Supabase Auth の /auth/v1/user に問い合わせて確認するため、
サーバー側に秘密鍵を置く必要がありません。
"""
from dataclasses import dataclass

import httpx
from fastapi import Depends, Header, HTTPException, status

from .config import Settings, get_settings


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str | None
    token: str


async def get_current_user(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    if not settings.auth_configured:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "サーバーに SUPABASE_URL / SUPABASE_KEY が設定されていません。")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "ログインが必要です。")

    token = authorization[7:].strip()
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(
                f"{settings.supabase_url}/auth/v1/user",
                headers={"apikey": settings.supabase_key, "Authorization": f"Bearer {token}"},
            )
    except httpx.HTTPError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "認証サーバーに接続できませんでした。")

    if response.status_code != 200:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "ログインの有効期限が切れています。")
    data = response.json()
    return CurrentUser(id=data["id"], email=data.get("email"), token=token)
