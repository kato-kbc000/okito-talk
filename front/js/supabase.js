// front/js/supabase.js

/*
 * Supabaseプロジェクトの接続情報
 */

// Supabase Project URL
const SUPABASE_URL =
    "https://xmqshtkpfigsfpbqmuhf.supabase.co";

// Supabase Publishable key
const SUPABASE_KEY =
    "sb_publishable_lyCwlzkrGuxPbhayhl-d-g_7CC88S0Q";

/*
 * HTML側でSupabaseのCDNが読み込まれているか確認
 */
if (!window.supabase) {
    throw new Error(
        "Supabaseライブラリが読み込まれていません。HTMLのscriptタグを確認してください。"
    );
}

/*
 * 接続情報が未入力の場合
 */
if (
    SUPABASE_URL.includes("ここに") ||
    SUPABASE_KEY.includes("ここに")
) {
    throw new Error(
        "supabase.jsにProject URLとPublishable Keyを設定してください。"
    );
}

/*
 * Supabaseクライアントを作成
 */
export const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    }
);