# 📸 写真セレクトサービス

フォトスタジオ向けの写真選択Webサービスです。撮影した写真をお客様と共有し、お気に入りの写真を選んでもらうことができます。

## 🌐 アクセスURL (GitHub Pages)

- **管理画面（スタジオ用）**: https://ykmp-dev.github.io/photo-selection-service/
- **お客様選択画面**: https://ykmp-dev.github.io/photo-selection-service/client.html?gallery=xxx
- **選択済みギャラリー**: https://ykmp-dev.github.io/photo-selection-service/selected-gallery.html?gallery=xxx

## 🚀 クイックスタート

### 必須: データベースセットアップ

このアプリケーションを使用する前に、**必ず**データベーススキーマを作成してください：

1. **`supabase-reset-and-setup.sql`** のファイルを開く
2. 内容を全てコピー（約200行）
3. Supabase SQL Editorに貼り付けて実行

**1つのファイルで完了します**（既存テーブルのクリーンアップ＋新規作成）

詳細は **[SETUP.md](./SETUP.md)** を参照してください。

## 特徴

- 🎨 シンプルで使いやすいUI
- 📱 スマホ・タブレット対応（レスポンシブデザイン）
- 🔒 パスワード保護機能（オプション）
- ☁️ Supabaseバックエンド（PostgreSQL + Storage）
- 🖼️ 写真の拡大表示・比較機能
- ✅ お客様の選択結果をリアルタイムで確認
- 📥 選択写真のZIPダウンロード機能（最大30枚）

## 機能

### スタジオ側（管理画面）
- 写真の一括アップロード（ドラッグ&ドロップ対応）
- ギャラリー作成とパスワード設定
- お客様用共有URLの生成
- 選択結果の確認
- ギャラリーの管理・削除

### お客様側（選択画面）
- 写真の閲覧
- グリッド表示と拡大表示
- お気に入り写真の選択（○×マーク）
- 選択結果の送信
- キーボードナビゲーション対応

## 使い方

### 1. サーバーの起動

```bash
# Python 3がインストールされている場合
npm start
# または
python3 -m http.server 8000
```

ブラウザで `http://localhost:8000` にアクセスしてください。

### 2. ギャラリーの作成（スタジオ側）

1. `index.html` を開きます（管理画面）
2. ギャラリー名（お客様名など）を入力
3. 必要に応じてパスワードを設定
4. 写真をドラッグ&ドロップまたはファイル選択
5. 「ギャラリーを作成」ボタンをクリック
6. お客様用URLをコピーして共有

### 3. 写真の選択（お客様側）

1. 共有されたURLにアクセス
2. パスワードが設定されている場合は入力
3. 写真をクリックして選択（チェックマークが表示されます）
4. 写真をダブルクリックで拡大表示
5. すべて選び終わったら「選択を送信」

### 4. 結果の確認（スタジオ側）

1. 管理画面のギャラリーリストから「結果確認」をクリック
2. 選択された写真の枚数を確認
3. 選択された写真を新しいタブで表示

## キーボードショートカット

写真拡大時（ライトボックス表示中）：
- `←` / `→` : 前/次の写真に移動
- `Space` / `Enter` : 写真を選択/解除
- `Esc` : 拡大表示を閉じる

## ファイル構成

```
photo-selection-service/
├── index.html          # スタジオ管理画面
├── client.html         # お客様選択画面
├── package.json        # プロジェクト設定
├── css/
│   └── style.css           # スタイルシート
├── js/
│   ├── storage.js          # レガシーストレージ（LocalStorage）
│   ├── supabase-config.js  # Supabase接続設定
│   ├── supabase-storage.js # Supabaseデータ操作
│   ├── studio.js           # スタジオ側のロジック
│   └── client.js           # お客様側のロジック
├── docs/                   # ドキュメント
│   ├── requirements.md     # 要件定義書
│   ├── screen-flow.md      # 画面遷移図
│   ├── wireframes.md       # ワイヤーフレーム
│   ├── architecture.md     # システムアーキテクチャ
│   └── supabase-setup.md   # Supabaseセットアップガイド
└── README.md               # このファイル
```

## ドキュメント

詳細な設計ドキュメントは [`docs/`](./docs) フォルダをご覧ください：

- **[Supabaseセットアップガイド](./docs/supabase-setup.md)**: バックエンドの初期設定手順
- **[要件定義書](./docs/requirements.md)**: ビジネスフロー、機能要件、データ設計
- **[画面遷移図](./docs/screen-flow.md)**: 全15画面の遷移パターン
- **[ワイヤーフレーム](./docs/wireframes.md)**: 主要画面のレイアウト設計
- **[システムアーキテクチャ](./docs/architecture.md)**: 技術スタック、DB設計、API設計

## 技術仕様

- **フロントエンド**: Pure JavaScript (ES6+)
- **バックエンド**: Supabase (PostgreSQL + Storage)
- **画像処理**: Canvas API（画像圧縮）
- **ファイル操作**: JSZip（ZIPダウンロード）
- **対応ブラウザ**: Chrome, Firefox, Safari, Edge（最新版）

## 注意事項

- ⚠️ Supabaseのセットアップが必要です（[セットアップガイド](./docs/supabase-setup.md)参照）
- ⚠️ 写真の選択は最大30枚までです
- ⚠️ 大量の写真をアップロードする場合は時間がかかる場合があります
- ⚠️ Supabase無料プランには容量制限があります（500MB Storage）

## 今後の拡張予定

- [x] バックエンド実装（Supabase）✅
- [x] 写真のダウンロード機能（ZIP）✅
- [ ] フォトブック注文機能
- [ ] 銀塩プリント注文機能（6-20枚、複数デザイン）
- [ ] ユーザー認証機能
- [ ] コメント機能
- [ ] 評価システム（星評価など）
- [ ] メール通知機能
- [ ] 期限設定機能

## ライセンス

MIT

## 開発者向け

このプロジェクトは以下の構成で動作します：

- **supabase-config.js**: Supabase接続設定とクライアント初期化
- **supabase-storage.js**: Supabase API操作（CRUD、Storage）
- **studio.js**: 写真のアップロード、ギャラリー作成、URL生成
- **client.js**: 写真の表示、選択、ライトボックス機能

### セットアップ手順

#### 1. データベースのセットアップ（必須）

**重要: 最初にデータベーススキーマを作成してください**

1. Supabaseダッシュボードにログイン
2. **SQL Editor** を開く
3. **`supabase-reset-and-setup.sql` の内容を全てコピー**
4. SQL Editorに貼り付けて **Run** をクリック

```bash
# SQLファイルの内容を確認
cat supabase-reset-and-setup.sql
```

成功すると「✅ データベース完全セットアップ完了！」のメッセージが表示されます。

詳細は **[SETUP.md](./SETUP.md)** を参照してください。

#### 2. Supabase接続設定

1. Supabaseダッシュボードの **Settings** → **API** を開く
2. Project URLとanon public keyをコピー
3. `js/supabase-config.js` に設定を記入

#### 3. Storageバケットの作成

1. Supabaseの **Storage** セクションを開く
2. バケット名 `gallery-photos` を作成
3. **Public bucket** に設定

#### 4. デプロイ

- GitHub Pagesにプッシュ、またはローカルサーバーで起動

カスタマイズやバグ報告は、リポジトリのIssuesまでお願いします。
