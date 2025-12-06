# Claude Code 設定ディレクトリ

このディレクトリには Claude Code のセッション情報と設定が含まれています。

## ファイル一覧

### `session-context.md`
現在のプロジェクト状況と作業履歴。
Claude Code Desktop/CLI で新しいセッションを開始する際に読み込んでください。

**使い方:**
```
.claude/session-context.mdを読んで現状を把握して
```

### `mcp-config-template.json`
Supabase MCP サーバー設定のテンプレート。

**使い方 (Desktop/CLI):**
```bash
# コマンドラインから
claude mcp add --scope project --transport http supabase "https://mcp.supabase.com/mcp?project_ref=wrgmbkkhgmxholzlgiic&features=database"

# または settings.json に手動追加
cp .claude/mcp-config-template.json .claude/settings.json
```

## セッション引き継ぎ手順

### Claude Code Web → Desktop/CLI への移行

1. **Desktop/CLI をインストール**
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

2. **プロジェクトディレクトリで起動**
   ```bash
   cd /home/user/test
   claude-code
   ```

3. **コンテキストを読み込む**
   最初のメッセージで：
   ```
   .claude/session-context.mdを読んで、プロジェクトの現状と次のステップを教えて
   ```

4. **Supabase MCP を設定**
   ```
   Supabase MCPを設定して、データベースに接続したい
   ```

5. **作業を継続**
   ```
   galleriesテーブルの構造を確認して
   ```

これで Claude Code Web での作業がシームレスに引き継がれます。

## 注意事項

- このディレクトリはgit管理されています
- 機密情報（APIキーなど）は含めないでください
- セッション間の情報共有用です
