# Supabase セットアップガイド

このガイドでは、写真セレクトサービスにSupabaseを統合する手順を説明します。

## 1. Supabaseプロジェクトの作成（スマホから実行）

### 1.1 アカウント作成

1. **Supabaseにアクセス**
   - https://supabase.com にアクセス
   - 「Start your project」をタップ

2. **サインアップ**
   - GitHubアカウントでサインイン（推奨）
   - または、メールアドレスでサインアップ

### 1.2 プロジェクト作成

1. **ダッシュボードにアクセス**
   - https://supabase.com/dashboard

2. **新規プロジェクト作成**
   - 「New Project」をタップ
   - Organization: 新規作成または既存を選択
   - プロジェクト設定：
     - **Name**: `photo-selection-service`
     - **Database Password**: 強力なパスワードを設定（メモしておく）
     - **Region**: `Northeast Asia (Tokyo)` を選択
     - **Pricing Plan**: Free を選択

3. **作成を待つ**
   - 数分かかります（1〜2分）

### 1.3 APIキーの取得

プロジェクトが作成されたら：

1. **Settings** → **API** にアクセス

2. **以下をメモ**：
   - `Project URL`: `https://xxxxx.supabase.co`
   - `anon public` key: `eyJhbGc...` （長いキー）

---

## 2. データベーステーブルの作成

### 2.1 SQL Editorでテーブル作成

1. **SQL Editor** にアクセス
   - 左メニューから「SQL Editor」をタップ

2. **以下のSQLを実行**

コピーして「New query」に貼り付け → 「Run」をタップ：

```sql
-- ギャラリーテーブル
CREATE TABLE galleries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  max_selections INTEGER DEFAULT 30,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 写真テーブル
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gallery_id UUID REFERENCES galleries(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500),
  file_size INTEGER,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 選択テーブル
CREATE TABLE selections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gallery_id UUID REFERENCES galleries(id) ON DELETE CASCADE,
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
  selected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(gallery_id, photo_id)
);

-- インデックス作成
CREATE INDEX idx_photos_gallery_id ON photos(gallery_id);
CREATE INDEX idx_selections_gallery_id ON selections(gallery_id);
CREATE INDEX idx_galleries_status ON galleries(status);

-- Row Level Security (RLS) を有効化
ALTER TABLE galleries ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE selections ENABLE ROW LEVEL SECURITY;

-- 公開アクセスポリシー（誰でも読み取り可能）
CREATE POLICY "Allow public read access to galleries"
  ON galleries FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access to photos"
  ON photos FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access to selections"
  ON selections FOR SELECT
  USING (true);

-- 書き込みポリシー（認証不要で誰でも作成・更新可能 - 後で制限）
CREATE POLICY "Allow public insert to galleries"
  ON galleries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public insert to photos"
  ON photos FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public insert/update to selections"
  ON selections FOR ALL
  USING (true)
  WITH CHECK (true);
```

3. **実行結果を確認**
   - 「Success. No rows returned」と表示されればOK

---

## 3. Storageバケットの設定

### 3.1 バケット作成

1. **Storage** にアクセス
   - 左メニューから「Storage」をタップ

2. **新規バケット作成**
   - 「New bucket」をタップ
   - **Name**: `photos`
   - **Public bucket**: チェックを入れる（公開バケット）
   - 「Create bucket」をタップ

### 3.2 ストレージポリシー設定

1. **Policies** タブに移動

2. **新規ポリシー作成**
   - 「New policy」をタップ
   - テンプレートから選択または以下を設定：

**読み取りポリシー:**
```
Policy name: Public read access
Allowed operations: SELECT
Target roles: public
USING expression: true
```

**アップロードポリシー:**
```
Policy name: Public upload access
Allowed operations: INSERT
Target roles: public
WITH CHECK expression: true
```

---

## 4. 環境変数の設定

ローカル開発用に環境変数ファイルを作成します。

### 4.1 `.env.local` ファイル作成

プロジェクトルートに `.env.local` を作成：

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

**重要**:
- `xxxxx` を実際のProject URLに置き換え
- `eyJhbGc...` を実際のanon keyに置き換え

### 4.2 `.gitignore` に追加

`.env.local` をgitにコミットしないように：

```
# .gitignore
.env.local
.env
node_modules/
```

---

## 5. フロントエンドの実装

次のステップでフロントエンドコードを実装します：

1. Supabase JSクライアントのインストール
2. 写真アップロード機能の実装
3. ギャラリー作成・取得機能の実装
4. 選択機能の実装

---

## トラブルシューティング

### データベース接続エラー

- Project URLとAPIキーが正しいか確認
- Supabaseダッシュボードでプロジェクトが「Active」か確認

### ストレージアップロードエラー

- バケットが「Public」に設定されているか確認
- ストレージポリシーが正しく設定されているか確認

### RLSエラー

- Row Level Securityポリシーが正しく設定されているか確認
- テーブルのRLSが有効化されているか確認

---

## 次のステップ

セットアップが完了したら、以下を実行してください：

1. Project URLとAPIキーを開発者に共有
2. フロントエンド実装を確認
3. テスト用の写真でアップロードテスト

---

## 参考リンク

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Storage Guide](https://supabase.com/docs/guides/storage)
- [Supabase Database Guide](https://supabase.com/docs/guides/database)
