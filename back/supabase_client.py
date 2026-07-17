import os

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL:
    raise ValueError("SUPABASE_URL が設定されていません")

if not SUPABASE_KEY:
    raise ValueError("SUPABASE_KEY が設定されていません")

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_KEY
)