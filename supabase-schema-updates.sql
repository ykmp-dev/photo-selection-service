-- ダウンロード追跡とアップセル機能のためのスキーマ更新
-- Supabase SQL Editorで実行してください

-- 1. galleriesテーブルにダウンロード追跡カラムを追加
ALTER TABLE galleries
ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS first_download_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS download_expires_at TIMESTAMP WITH TIME ZONE;

-- インデックスを追加（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_galleries_download_expires_at
ON galleries(download_expires_at);

-- 2. ダウンロード履歴テーブル
CREATE TABLE IF NOT EXISTS download_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gallery_id UUID REFERENCES galleries(id) ON DELETE CASCADE,
    downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_download_history_gallery_id
ON download_history(gallery_id);

CREATE INDEX IF NOT EXISTS idx_download_history_downloaded_at
ON download_history(downloaded_at);

-- 3. 追加ダウンロードパス購入記録テーブル
CREATE TABLE IF NOT EXISTS download_passes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gallery_id UUID REFERENCES galleries(id) ON DELETE CASCADE,
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    payment_id TEXT,
    amount INTEGER,
    status TEXT DEFAULT 'active', -- active, expired, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_download_passes_gallery_id
ON download_passes(gallery_id);

CREATE INDEX IF NOT EXISTS idx_download_passes_status
ON download_passes(status);

-- 4. Row Level Security (RLS) ポリシー

-- download_historyテーブルのRLS
ALTER TABLE download_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert to download_history"
ON download_history
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow public read download_history"
ON download_history
FOR SELECT
TO public
USING (true);

-- download_passesテーブルのRLS
ALTER TABLE download_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert to download_passes"
ON download_passes
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow public read download_passes"
ON download_passes
FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public update download_passes"
ON download_passes
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- 5. データ有効期限チェック関数
CREATE OR REPLACE FUNCTION check_gallery_expiration()
RETURNS TABLE (
    gallery_id UUID,
    gallery_name TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    download_expires_at TIMESTAMP WITH TIME ZONE,
    is_expired BOOLEAN,
    is_download_expired BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        g.id,
        g.name,
        g.expires_at,
        g.download_expires_at,
        (g.expires_at < NOW()) as is_expired,
        (g.download_expires_at IS NOT NULL AND g.download_expires_at < NOW()) as is_download_expired
    FROM galleries g
    WHERE g.expires_at < NOW() OR (g.download_expires_at IS NOT NULL AND g.download_expires_at < NOW());
END;
$$ LANGUAGE plpgsql;

-- 6. ダウンロード統計関数
CREATE OR REPLACE FUNCTION get_download_stats(p_gallery_id UUID)
RETURNS TABLE (
    total_downloads BIGINT,
    first_download TIMESTAMP WITH TIME ZONE,
    last_download TIMESTAMP WITH TIME ZONE,
    has_active_pass BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(dh.id) as total_downloads,
        MIN(dh.downloaded_at) as first_download,
        MAX(dh.downloaded_at) as last_download,
        EXISTS(
            SELECT 1 FROM download_passes dp
            WHERE dp.gallery_id = p_gallery_id
            AND dp.status = 'active'
            AND (dp.expires_at IS NULL OR dp.expires_at > NOW())
        ) as has_active_pass
    FROM download_history dh
    WHERE dh.gallery_id = p_gallery_id;
END;
$$ LANGUAGE plpgsql;

-- 完了メッセージ
DO $$
BEGIN
    RAISE NOTICE '✅ スキーマ更新完了！';
    RAISE NOTICE '以下のテーブルが追加/更新されました：';
    RAISE NOTICE '  - galleries (download_count, first_download_at, download_expires_at)';
    RAISE NOTICE '  - download_history (新規)';
    RAISE NOTICE '  - download_passes (新規)';
    RAISE NOTICE '関数：';
    RAISE NOTICE '  - check_gallery_expiration()';
    RAISE NOTICE '  - get_download_stats(gallery_id)';
END $$;
