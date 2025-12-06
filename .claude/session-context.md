# Claude Code セッションコンテキスト

**最終更新:** 2025-12-06
**前回のセッション:** Claude Code Web
**次のセッション:** Claude Code Desktop/CLI

---

## プロジェクト概要

写真選択サービス - フォトスタジオ向けWebアプリケーション
- Supabaseバックエンド (PostgreSQL + Storage)
- JavaScript フロントエンド
- GitHub Pages デプロイ

---

## 最近完了した作業

### 1. UX整合性の改善 (コミット: 4fbfd75)
- カウンター表示を統一: `選択: 0 / 30枚`
- ボタン用語を統一: `選択を確認` → `確定する`
- 0枚選択時のメッセージ改善
- 全てのalert()を統一モーダルUIに変更

### 2. データベースセットアップの簡素化
- `supabase-reset-and-setup.sql` 作成 (コミット: 7033c50)
- cleanup + create を1ファイルに統合
- README.md と SETUP.md を更新

---

## 現在の状況

### Supabase設定
- **Project URL:** `https://wrgmbkkhgmxholzlgiic.supabase.co`
- **Project Reference:** `wrgmbkkhgmxholzlgiic`
- **設定ファイル:** `js/supabase-config.js`

### データベース状態
**未確認** - 以下のどちらかの状態：
1. スキーマ未実行（テーブル存在しない）
2. 古いスキーマ（download_count等のカラムがない）
3. 新しいスキーマで正常

**確認方法:**
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'galleries'
ORDER BY ordinal_position;
```

### 必要なテーブル
1. galleries (download追跡カラム含む)
2. photos
3. selections
4. download_history
5. download_passes

---

## 次のステップ

### 1. Supabase MCP接続（優先）

**Desktop/CLI版で実行:**
```bash
claude mcp add --scope project --transport http supabase "https://mcp.supabase.com/mcp?project_ref=wrgmbkkhgmxholzlgiic&features=database"
```

これでClaude Codeから直接SQL実行可能になる。

### 2. データベーススキーマ確認

MCPが接続できたら：
```
galleriesテーブルの構造を確認して
```

### 3. スキーマ未適用の場合

`supabase-reset-and-setup.sql` を実行（MCPから直接実行可能）

---

## 重要なファイル

### SQL
- `supabase-reset-and-setup.sql` - オールインワンセットアップ（推奨）
- `supabase-cleanup.sql` - クリーンアップのみ
- `supabase-schema-updates.sql` - 作成のみ（古い）

### JavaScript
- `js/supabase-config.js` - Supabase認証情報
- `js/client.js` - 顧客側UI（UX改善済み）
- `js/supabase-storage.js` - データ操作API

### ドキュメント
- `README.md` - プロジェクト概要
- `SETUP.md` - セットアップガイド

---

## ブランチ情報

- **現在のブランチ:** `claude/photo-selection-service-01VxWQG7eDQbS5keud69LGwd`
- **最新コミット:** `12599f7` (README修正)
- **状態:** すべてプッシュ済み

---

## トラブルシューティング

### Supabase MCP接続失敗
- Web版では不安定
- Desktop/CLI版を推奨

### データベースエラー
- `relation 'galleries' does not exist` → `supabase-reset-and-setup.sql`実行
- `column does not exist` → 古いスキーマ、リセット必要

---

## 復帰時の最初のコマンド

Desktop/CLI版起動後、以下を実行：

```
このプロジェクトのREADMEと.claude/session-context.mdを読んで現状を把握して。
次にSupabase MCPを設定して、galleriesテーブルの状態を確認したい。
```

これで自動的にコンテキストを理解して作業を継続できます。
