# 写真選択サービス セットアップガイド

## 1. Supabaseプロジェクトのセットアップ

### データベーススキーマの作成

**オールインワンスクリプト（推奨）:**

1. **Supabaseダッシュボード** にログイン
2. 左メニューから **SQL Editor** を選択
3. **`supabase-reset-and-setup.sql`** の内容を全てコピー
4. SQL Editorに貼り付けて **Run** をクリック

```bash
# ファイルの内容を確認
cat supabase-reset-and-setup.sql
```

このスクリプト1つで以下を実行：
- ✅ 既存テーブルの削除（クリーンアップ）
- ✅ 全テーブルの新規作成
- ✅ RLSポリシーの設定
- ✅ ヘルパー関数の作成

### 作成されるデータベース構造

実行すると以下が作成されます：

#### テーブル（5つ）
1. **galleries** - ギャラリー情報（ダウンロード追跡含む）
2. **photos** - 写真データ
3. **selections** - お客様の選択情報
4. **download_history** - ダウンロード履歴
5. **download_passes** - 追加ダウンロードパス購入記録

#### 関数（2つ）
1. **check_gallery_expiration()** - 有効期限チェック
2. **get_download_stats(gallery_id)** - ダウンロード統計

#### セキュリティ
- すべてのテーブルでRow Level Security (RLS) が有効
- publicアクセスポリシーが設定済み

### 実行確認

成功すると以下のメッセージが表示されます：

```
✅ データベーススキーマ作成完了！

作成されたテーブル：
  1. galleries - ギャラリー情報（ダウンロード追跡含む）
  2. photos - 写真データ
  3. selections - お客様の選択情報
  4. download_history - ダウンロード履歴
  5. download_passes - 追加ダウンロードパス購入記録

作成された関数：
  - check_gallery_expiration() - 有効期限チェック
  - get_download_stats(gallery_id) - ダウンロード統計

すべてのテーブルでRLSが有効化され、publicアクセスポリシーが設定されました。
```

---

## 2. Supabase Storageの設定

### バケットの作成

1. Supabaseダッシュボードの **Storage** セクションを開く
2. **New bucket** をクリック
3. バケット名: `gallery-photos`
4. **Public bucket** にチェックを入れる
5. **Create bucket** をクリック

### アクセスポリシーの確認

- publicアクセスが有効になっていることを確認
- 必要に応じてCORSの設定を確認

---

## 3. 接続設定

### Supabase認証情報の取得

1. Supabaseダッシュボードの **Settings** → **API** を開く
2. 以下の情報をコピー：
   - **Project URL**
   - **anon public key**

### 設定ファイルの更新

`js/supabase-config.js` を開いて、取得した情報を設定：

```javascript
const SUPABASE_URL = 'あなたのProject URL';
const SUPABASE_ANON_KEY = 'あなたのanon public key';
```

---

## 4. デプロイ

### GitHub Pagesへのデプロイ

1. GitHubリポジトリの **Settings** → **Pages** を開く
2. **Source** で main/master ブランチを選択
3. **Save** をクリック
4. 数分待つとURLが表示されます

### 動作確認

1. 管理画面 (`admin.html`) でギャラリーを作成
2. 写真をアップロード
3. お客様用URL (`client.html?gallery=xxx`) で動作確認

---

## トラブルシューティング

### データベースエラー

**エラー:** `relation 'galleries' does not exist`

**解決策:**
- `supabase-schema-updates.sql` を最初から実行し直してください
- このファイルは既存テーブルの有無にかかわらず安全に実行できます（`CREATE TABLE IF NOT EXISTS`を使用）

### 写真が表示されない

**確認事項:**
- Storageバケット `gallery-photos` が作成されているか
- バケットがpublicに設定されているか
- 写真のアップロードが成功しているか（photosテーブルを確認）

### パスワードが機能しない

**確認事項:**
- `js/supabase-storage.js` のパスワード暗号化関数が正しく動作しているか
- ブラウザコンソールでエラーが出ていないか
- `galleries.password_hash` カラムにデータが保存されているか

---

## 開発メモ

### データ保管期限

- ギャラリー作成時に `expires_at` を設定（推奨: 1年後）
- 期限後は自動的にデータ削除（バッチ処理で実装予定）

### ダウンロード追跡

- 初回ダウンロード: 無料 + 7日間の無料再ダウンロード期間
- 7日後: ¥500の追加ダウンロードパスが必要
- 商品注文時: 無料ダウンロードパス付与

### セキュリティ

- パスワードは暗号化して保存（AES-GCM + PBKDF2）
- RLSでデータアクセス制御
- クライアント側でスクリーンショット防止対策実装済み
