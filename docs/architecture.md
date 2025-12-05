# システムアーキテクチャ設計

## 1. 技術スタック

### フロントエンド
```
- フレームワーク: React + Next.js
- 状態管理: Zustand または React Context
- スタイリング: Tailwind CSS
- UI コンポーネント: Shadcn/ui
- 画像処理: sharp (サーバー側)、canvas (クライアント側)
- 決済UI: Stripe Elements
```

**選定理由:**
- React: コンポーネント設計しやすい、エコシステム豊富
- Next.js: SSR/SSG、ルーティング、API Routes
- Tailwind: 高速開発、レスポンシブ対応が簡単
- Shadcn/ui: アクセシビリティ、カスタマイズ性

### バックエンド
```
- プラットフォーム: Supabase
  - 認証: Supabase Auth
  - データベース: PostgreSQL
  - ストレージ: Supabase Storage
  - API: Supabase Client + Edge Functions
```

**選定理由:**
- オールインワン: 認証、DB、ストレージが統合
- 無料枠が充実: 初期コスト抑制
- リアルタイム機能: WebSocket対応
- スケーラブル: 成長に応じて拡張可能

### 決済
```
- Stripe
  - Checkout Session API
  - Webhook連携
```

### ホスティング
```
- フロントエンド: Vercel
- バックエンド: Supabase
- 画像配信: Supabase Storage + CDN
```

---

## 2. システム構成図

```
┌─────────────────────────────────────────────────────────────┐
│                        ユーザー                              │
│              （ブラウザ / スマホアプリ）                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Vercel (Next.js)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ スタジオ管理  │  │ お客様選択    │  │ 決済フロー    │      │
│  │    画面      │  │    画面      │  │             │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
         ▼           ▼           ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  Supabase   │ │  Supabase   │ │   Stripe    │
│    Auth     │ │     DB      │ │   Payment   │
│  (認証)     │ │ (PostgreSQL)│ │             │
└─────────────┘ └─────────────┘ └─────────────┘
                     │
                     ▼
            ┌─────────────────┐
            │  Supabase       │
            │   Storage       │
            │  (画像保存)      │
            └─────────────────┘
```

---

## 3. データベース設計

### ER図

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  studios     │         │  galleries   │         │    photos    │
├──────────────┤         ├──────────────┤         ├──────────────┤
│ id (PK)      │◄────────│ studio_id(FK)│◄────────│ gallery_id(FK)│
│ name         │         │ id (PK)      │         │ id (PK)      │
│ email        │         │ name         │         │ file_name    │
│ created_at   │         │ password_hash│         │ storage_path │
└──────────────┘         │ expires_at   │         │ thumbnail_url│
                         │ plan_type    │         │ order        │
                         │ status       │         │ created_at   │
                         │ created_at   │         └──────────────┘
                         └──────────────┘                │
                                 │                       │
                                 │                       │
                         ┌───────┴────────┐             │
                         │                │             │
                         ▼                ▼             │
                ┌──────────────┐  ┌──────────────┐     │
                │  selections  │  │    orders    │     │
                ├──────────────┤  ├──────────────┤     │
                │ id (PK)      │  │ id (PK)      │     │
                │ gallery_id(FK)│  │ gallery_id(FK)│     │
                │ photo_id (FK)│  │ order_type   │     │
                │ selected_at  │  │ status       │     │
                └──────────────┘  │ total_amount │     │
                        ▲         │ paid_at      │     │
                        │         │ created_at   │     │
                        │         └──────────────┘     │
                        │                 │            │
                        │                 ▼            │
                        │         ┌──────────────┐     │
                        │         │ order_photos │     │
                        │         ├──────────────┤     │
                        │         │ id (PK)      │     │
                        │         │ order_id (FK)│     │
                        └─────────│ photo_id (FK)│◄────┘
                                  │ order_index  │
                                  └──────────────┘
```

### テーブル定義

#### studios（スタジオ）
```sql
CREATE TABLE studios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### galleries（ギャラリー）
```sql
CREATE TABLE galleries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  studio_id UUID REFERENCES studios(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),  -- NULL = パスワード不要
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  plan_type VARCHAR(50) DEFAULT 'basic',  -- basic, premium
  status VARCHAR(50) DEFAULT 'active',    -- active, expired, deleted
  max_selections INTEGER DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_galleries_studio_id ON galleries(studio_id);
CREATE INDEX idx_galleries_status ON galleries(status);
CREATE INDEX idx_galleries_expires_at ON galleries(expires_at);
```

#### photos（写真）
```sql
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gallery_id UUID REFERENCES galleries(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500),
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_photos_gallery_id ON photos(gallery_id);
CREATE INDEX idx_photos_order_index ON photos(gallery_id, order_index);
```

#### selections（選択）
```sql
CREATE TABLE selections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gallery_id UUID REFERENCES galleries(id) ON DELETE CASCADE,
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
  selected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(gallery_id, photo_id)
);

CREATE INDEX idx_selections_gallery_id ON selections(gallery_id);
CREATE INDEX idx_selections_photo_id ON selections(photo_id);
```

#### orders（注文）
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gallery_id UUID REFERENCES galleries(id) ON DELETE CASCADE,
  order_type VARCHAR(50) NOT NULL,  -- photobook, album
  status VARCHAR(50) DEFAULT 'pending',  -- pending, paid, processing, completed, cancelled
  total_amount INTEGER NOT NULL,  -- 金額（円）
  stripe_payment_intent_id VARCHAR(255),
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_orders_gallery_id ON orders(gallery_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_stripe_payment_intent_id ON orders(stripe_payment_intent_id);
```

#### album_orders（アルバム注文詳細）
```sql
CREATE TABLE album_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  design_id VARCHAR(50) NOT NULL,  -- classic, modern, natural, etc.
  photo_count INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_album_orders_order_id ON album_orders(order_id);
```

#### order_photos（注文写真）
```sql
CREATE TABLE order_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,  -- アルバム内での順序
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(order_id, photo_id)
);

CREATE INDEX idx_order_photos_order_id ON order_photos(order_id);
CREATE INDEX idx_order_photos_order_index ON order_photos(order_id, order_index);
```

---

## 4. API設計

### エンドポイント一覧

#### スタジオ側API

**認証**
```
POST   /api/auth/login              スタジオログイン
POST   /api/auth/logout             ログアウト
POST   /api/auth/register           スタジオ登録
```

**ギャラリー管理**
```
GET    /api/galleries               ギャラリー一覧取得
POST   /api/galleries               ギャラリー作成
GET    /api/galleries/:id           ギャラリー詳細取得
PATCH  /api/galleries/:id           ギャラリー更新
DELETE /api/galleries/:id           ギャラリー削除
```

**写真管理**
```
POST   /api/galleries/:id/photos    写真アップロード
DELETE /api/photos/:id              写真削除
GET    /api/galleries/:id/selections 選択状況取得
GET    /api/galleries/:id/download  選択写真のZIPダウンロード
```

#### お客様側API

**ギャラリーアクセス**
```
GET    /api/client/galleries/:id    ギャラリー情報取得
POST   /api/client/galleries/:id/auth パスワード認証
```

**写真選択**
```
GET    /api/client/galleries/:id/photos 写真一覧取得
POST   /api/client/selections       写真選択
DELETE /api/client/selections/:id   選択解除
GET    /api/client/galleries/:id/download 選択写真ダウンロード
```

**注文**
```
POST   /api/client/orders           注文作成
GET    /api/client/orders/:id       注文詳細取得
POST   /api/client/orders/:id/checkout Stripe Checkout作成
```

**Webhook**
```
POST   /api/webhooks/stripe         Stripe Webhookハンドラー
```

---

## 5. ストレージ構造

### Supabase Storage バケット構成

```
photo-selection-service/
├── galleries/
│   ├── {gallery_id}/
│   │   ├── originals/
│   │   │   ├── photo1.jpg
│   │   │   ├── photo2.jpg
│   │   │   └── ...
│   │   ├── thumbnails/
│   │   │   ├── photo1_thumb.jpg
│   │   │   ├── photo2_thumb.jpg
│   │   │   └── ...
│   │   └── downloads/
│   │       └── selected_photos.zip  (一時ファイル)
```

### ストレージポリシー

**originals/**
- スタジオ: 読み書き可能
- お客様: 読み取りのみ（認証済み）

**thumbnails/**
- スタジオ: 読み書き可能
- お客様: 読み取りのみ

**downloads/**
- スタジオ: 読み書き可能
- お客様: 読み取りのみ（認証済み、有効期限付き署名URL）

---

## 6. セキュリティ設計

### 認証・認可

**スタジオ側**
- Supabase Auth（メール + パスワード）
- JWTトークンによるセッション管理
- Row Level Security (RLS) でデータ分離

**お客様側**
- パスワード認証（オプション）
- セッショントークン（有効期限付き）
- ギャラリーIDベースのアクセス制御

### データ保護

**転送中**
- HTTPS (TLS 1.3)
- Strict-Transport-Security ヘッダー

**保存時**
- パスワードのbcryptハッシュ化
- Supabase Storage暗号化
- 機密情報の環境変数管理

### 脆弱性対策

- CSRF トークン
- XSS対策（Content Security Policy）
- SQLインジェクション対策（prepared statements）
- ファイルアップロード検証
  - MIME type チェック
  - ファイルサイズ制限
  - 拡張子ホワイトリスト

---

## 7. パフォーマンス最適化

### 画像最適化

**アップロード時**
1. オリジナル保存（フルサイズ）
2. サムネイル生成（300x300px、WebP）
3. プレビュー生成（1200px幅、WebP）

**配信時**
- CDN経由で配信（Supabase Storage CDN）
- レスポンシブ画像（srcset）
- 遅延読み込み（Intersection Observer）

### データベース最適化

- 適切なインデックス作成
- N+1問題の回避（JOIN活用）
- ページネーション実装
- キャッシュ戦略
  - ギャラリー情報（5分）
  - 写真一覧（10分）

### フロントエンド最適化

- コード分割（Next.js dynamic import）
- 画像遅延読み込み
- Virtual scrolling（大量写真対応）
- Service Worker（オフライン対応）

---

## 8. 運用設計

### 監視・ログ

**メトリクス**
- Vercel Analytics（ページビュー、パフォーマンス）
- Supabase Dashboard（DB負荷、ストレージ使用量）
- Stripe Dashboard（決済状況）

**ログ**
- アプリケーションログ（Vercel Logs）
- エラーログ（Sentry連携）
- アクセスログ

**アラート**
- エラー率が閾値超過
- ストレージ容量80%到達
- 決済失敗
- 有効期限切れギャラリー

### バックアップ

**データベース**
- Supabase自動バックアップ（日次）
- ポイントインタイムリカバリ（PITR）

**ストレージ**
- 定期的なエクスポート（週次）
- 重要ギャラリーの手動バックアップ

### データ削除ポリシー

- 公開期限切れギャラリー: 30日後に自動削除
- 削除前7日に通知メール
- ソフトデリート（status='deleted'）で30日間保持
- 完全削除後は復元不可

---

## 9. スケーラビリティ

### 段階的拡張計画

**フェーズ1: MVP（〜100ギャラリー/月）**
- Supabase無料枠
- Vercel Hobby
- 手動対応でカバー

**フェーズ2: 成長期（100〜1,000ギャラリー/月）**
- Supabase Pro（$25/月）
- Vercel Pro（$20/月）
- 自動化・最適化

**フェーズ3: スケール期（1,000+ギャラリー/月）**
- Supabase Team/Enterprise
- AWS S3 + CloudFront移行検討
- マイクロサービス化検討

### ボトルネック対策

**ストレージ**
- CDN活用
- S3への段階的移行
- 古いデータのアーカイブ

**データベース**
- Read Replica追加
- パーティショニング
- キャッシュ層追加（Redis）

**処理**
- バックグラウンドジョブ（画像処理など）
- Queue導入（BullMQ）
- Edge Functions活用

---

## 10. コスト試算

### 初期フェーズ（月間50ギャラリー想定）

| サービス | プラン | 月額 |
|---------|--------|------|
| Supabase | 無料 | $0 |
| Vercel | Hobby | $0 |
| Stripe | 決済手数料のみ | 変動 |
| **合計** | | **$0〜** |

### 成長フェーズ（月間500ギャラリー想定）

| サービス | プラン | 月額 |
|---------|--------|------|
| Supabase | Pro | $25 |
| Vercel | Pro | $20 |
| Stripe | 決済手数料 | 変動 |
| **合計** | | **$45〜** |

---

## 変更履歴
- 2025-12-05: 初版作成
