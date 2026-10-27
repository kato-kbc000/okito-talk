import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / "back" / ".env")


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_key: str
    google_geocoding_key: str
    cors_origins: tuple[str, ...]

    @property
    def auth_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_key)


def get_settings() -> Settings:
    origins = tuple(o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip())
    return Settings(
        supabase_url=os.getenv("SUPABASE_URL", "").rstrip("/"),
        supabase_key=os.getenv("SUPABASE_KEY", ""),
        google_geocoding_key=os.getenv("GOOGLE_GEOCODING_KEY", ""),
        cors_origins=origins,
    )
