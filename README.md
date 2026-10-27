# おきとーーーーーーく

沖縄県民向けのローカルSNSです。静的HTML / JavaScript（ES Modules）と Supabase（Auth・Database・Storage・Realtime）で動作します。サーバー側のプログラムはありません。

## セットアップ

1. Supabase の SQL Editor で `supabase/setup.sql` を **全体で1回** 実行します。
   何度実行しても安全です（既存データは削除しません）。内容は次のとおりです。
   - 足りない列・制約・インデックスの追加
   - 全テーブルの RLS（投稿の公開範囲、コミュニティの承認制などをDB側でも強制）
   - 画像用 Storage バケット `post-images` / `community-images` / `profile-images`
   - カテゴリの初期データ、メッセージの Realtime 設定
2. `front/js/supabase.js` の Project URL と Publishable key を自分のプロジェクトのものにします。
3. 投稿の地図表示に使う Google Maps の API キーを `front/js/pages/home.js` の `GOOGLE_MAPS_API_KEY` に設定します。
   Google Cloud 側で **HTTP リファラー制限** をかけてください（キーはブラウザに公開されます）。
4. 起動します（どちらでも動きます）。

   **A. FastAPI サーバー（おすすめ）** — 画面の配信と `/api/...` を1つのサーバーで提供します。
   ```
   pip install -r back/requirements.txt
   copy back\.env.example back\.env     （Mac/Linux: cp back/.env.example back/.env）  → 値を入れる
   uvicorn back.app.main:app --reload --port 8000
   ```
   `http://localhost:8000/` を開きます。API の一覧は `http://localhost:8000/docs` で見られます。

   **B. 画面だけ**（VS Code の Live Server や `python -m http.server 8000`）。
   サーバー経由の機能（住所検索のプロキシ）は使われず、従来どおりブラウザから直接検索します。

   `file://` で直接開くと ES Modules の制限で動きません。

`service_role` キーは **絶対にフロントのコードや Git に入れないでください。**

## バックエンド（FastAPI）

| エンドポイント | 内容 |
|---|---|
| `GET /api/health` | 動作確認 |
| `GET /api/me` | ログイン中ユーザーのプロフィールと未読メッセージ数（要ログイン） |
| `GET /api/geocode?q=店名 住所` | 場所検索（最大5件の候補）。Google Places（店名OK）→ Google Geocoding → OpenStreetMap の順に試し、沖縄県内だけ返す。番地まで特定できない結果は `approximate: true`（要ログイン） |

- ログイン確認はフロントが持つ Supabase のアクセストークン（`Authorization: Bearer …`）を Supabase Auth に照会して行います。サーバーに `service_role` キーは不要です。
- 配信するのは `front/` と `images/` だけです。`back/.env` や `supabase/` は URL から取得できません。
- テスト: `python -m pytest back/tests -q`
- 投稿・コミュニティなど他の機能は、今も画面から Supabase に直接つないでいます（RLS で保護）。サーバー側へ移したい処理があれば `back/app/` に追加していきます。

## 機能

- 登録 / ログイン、プロフィール編集、フォロー / フォロワー
- タイムライン（30件ずつ追加読み込み）、画像（最大4枚）・場所付き投稿（沖縄県の全市町村から地域を選択）、古い投稿の自動読み込み、いいね・保存、公開範囲（全体 / フォロワーのみ / 自分のみ）
- 地図ピン（店名＋住所で候補を出して選ぶ／地図クリック／現在地で位置を決め、ドラッグで微調整。位置を確認してから登録）、現在地共有
- 未読メッセージ数のバッジ（全ページ・リアルタイム）、ログアウト
- ユーザー・投稿検索、ダイレクトメッセージ（未読バッジ・リアルタイム通知）
- コミュニティ
  - 一覧・検索は `community.html` に集約（「すべて／参加中」の切り替え、カテゴリ、並び替え）
  - 作成（ルール・絵文字・カバー画像）、参加 / 退出
  - 公開 = すぐ参加 / 承認制・非公開 = 申請 → オーナー・管理者が承認
  - 投稿（画像・場所）、コメント（画像・自分のコメントの削除）、いいね・保存、メンバー一覧
  - **コミュニティ専用マップ**：メンバーの現在地と、場所つき投稿のピンを表示。投稿の場所は、店名検索かマップのクリックで選べます
  - **現在地の自動追跡**：「現在地を共有して追跡する」を押すだけ（場所名の入力は不要）。移動すると自動で更新され、コミュニティの参加者だけに表示されます。停止するとすぐに消え、ページを閉じた場合も最大30分で自動的に消えます
  - 管理者の「設定」タブに、承認待ちの参加申請の件数を表示
  - 設定（基本情報・公開範囲・メンバー権限・参加リクエスト・削除）

## フォルダ構成

```
index.html                     ログインページへ移動
front/
  css/community-theme.css      コミュニティ画面をホームの見た目に揃えるテーマ
  css/shell.css                サイドバー付きページ共通の見た目（バッジ・ログアウト・入力欄とボタンの比率）
  html/                        画面（login / register / home / loading、home/ 以下に各ページ）
  css/                         共通CSS + pages/ 以下にページ別CSS
  js/api.js                    Supabase への問い合わせを集約
  js/common-header.js          共通ヘッダーと左メニュー（<header class="site-header"></header> と <aside class="side-menu" data-common-sidebar></aside> を置くだけ）
  js/maps.js                   Google Maps の読み込み・場所検索（ホームとコミュニティで共用）
  js/pages/                    ページ別スクリプト
images/                        ヘッダーの太陽・波、背景など
back/                          FastAPI サーバー（app/ と tests/）
supabase/setup.sql             DBセットアップ（更新があったら再実行）
docs/header-design-notes.pdf   ヘッダーのデザイン引き継ぎメモ
```

## 画面の共通部品

- ヘッダー・左メニュー・スマホ用の下部タブバーは `js/common-header.js` が描画します（`<header class="site-header"></header>` と `<aside class="side-menu" data-common-sidebar></aside>` を置くだけ）。
- コミュニティ系ページの色・カードは `css/community-theme.css` でホームに揃えています。

## 補足

- SQLは `supabase/setup.sql` だけを使ってください。古い `supabase_*.sql` や、RLSを丸ごと置き換える別系統のSQLを後から流すと、参加承認や既読が動かなくなります。

- 現在地の追跡は、**ページを開いている間だけ**動きます（ブラウザは閉じたあとの位置追跡ができません）。スマホでは画面をオフにすると止まることがあります。
- 通知（`notifications` テーブル）は画面が未実装です。テーブルとRLSだけ用意してあります。
- 非公開コミュニティは一覧・検索に出ません。URL（`community_home.html?id=…`）を知っている人が参加申請できます。
- 画像の上限: 投稿 1枚5MB・最大4枚、コミュニティ投稿・コメント 3MB、コミュニティ画像・プロフィール画像 2MB。
- ピンの位置が合わないときは、候補の「おおよその位置」表示を確認し、地図のピンをドラッグして合わせてください。Google Cloud で **Places API (New)** を有効にし、キーの制限に含めると、店名での検索精度が上がります。
- 「Bucket not found」「column … does not exist」と出るときは `supabase/setup.sql` が未実行です。
