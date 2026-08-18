# おきとーーーーーーく

沖縄県民向けのローカルSNSプロトタイプです。Supabase Auth / Database と静的HTML・JavaScriptで動作します。

## 起動

1. SupabaseのSQL Editorで `back/supabase_schema.sql`、`back/supabase_profile_migration.sql`、`back/community_member_features.sql` の順に実行します。
2. `front/js/supabase.js` の公開用Project URL・Publishable keyを確認します。
3. リポジトリ直下をHTTPサーバーで配信します（例: `python -m http.server 8000`）。
4. `http://localhost:8000/` を開きます。

`file://` でHTMLを直接開くと、ブラウザのES Modules制限により動作しません。

## 今回完成した優先機能

- タイムラインを30件単位でページングし、「過去の投稿をさらに見る」で古い投稿を取得
- プロフィールのフォロー中・フォロワー数と一覧表示
- コミュニティコメントへのJPEG / PNG / WebP / GIF画像添付（最大3MB）
- 投稿場所を現在地、地図クリック、住所・施設名検索から選択

コミュニティ投稿・コメントは現在ブラウザのローカル保存を使用しています。本番の複数ユーザー共有には、専用テーブルとStorageへの移行が必要です。
