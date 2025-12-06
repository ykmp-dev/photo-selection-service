-- 写真選択サービス - 完全リセット＆セットアップ
-- Supabase SQL Editorで実行してください
-- このスクリプト1つで全てクリーンアップ＆再作成します

-- ==========================================
-- STEP 1: クリーンアップ（既存データ削除）
-- ==========================================

-- 既存のテーブルを削除（CASCADEでポリシーも自動削除）
DROP TABLE IF EXISTS download_passes CASCADE;
DROP TABLE IF EXISTS download_history CASCADE;
DROP TABLE IF EXISTS selections CASCADE;
DROP TABLE IF EXISTS photos CASCADE;
DROP TABLE IF EXISTS galleries CASCADE;

-- 既存の関数を削除
DROP FUNCTION IF EXISTS check_gallery_expiration();
DROP FUNCTION IF EXISTS get_download_stats(UUID);

-- ==========================================
-- STEP 2: 新規作成
-- ==========================================

-- UUID拡張を有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. galleriesテーブル
CREATE TABLE galleries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    password_hash TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    max_selections INTEGER DEFAULT 30,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    download_count INTEGER DEFAULT 0,
    first_download_at TIMESTAMP WITH TIME ZONE,
    download_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_galleries_expires_at ON galleries(expires_at);
CREATE INDEX idx_galleries_confirmed_at ON galleries(confirmed_at);
CREATE INDEX idx_galleries_download_expires_at ON galleries(download_expires_at);

-- 2. photosテーブル
CREATE TABLE photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gallery_id UUID REFERENCES galleries(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_photos_gallery_id ON photos(gallery_id);

-- 3. selectionsテーブル
CREATE TABLE selections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gallery_id UUID NOT NULL,
    photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(gallery_id, photo_id)
);

CREATE INDEX idx_selections_gallery_id ON selections(gallery_id);
CREATE INDEX idx_selections_photo_id ON selections(photo_id);

-- 4. download_historyテーブル
CREATE TABLE download_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gallery_id UUID REFERENCES galleries(id) ON DELETE CASCADE,
    downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_download_history_gallery_id ON download_history(gallery_id);
CREATE INDEX idx_download_history_downloaded_at ON download_history(downloaded_at);

-- 5. download_passesテーブル
CREATE TABLE download_passes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gallery_id UUID REFERENCES galleries(id) ON DELETE CASCADE,
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    payment_id TEXT,
    amount INTEGER,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_download_passes_gallery_id ON download_passes(gallery_id);
CREATE INDEX idx_download_passes_status ON download_passes(status);

-- ==========================================
-- STEP 3: Row Level Security (RLS)
-- ==========================================

-- galleries
ALTER TABLE galleries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public insert to galleries" ON galleries FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public read galleries" ON galleries FOR SELECT TO public USING (true);
CREATE POLICY "Allow public update galleries" ON galleries FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete galleries" ON galleries FOR DELETE TO public USING (true);

-- photos
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public insert to photos" ON photos FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public read photos" ON photos FOR SELECT TO public USING (true);
CREATE POLICY "Allow public delete photos" ON photos FOR DELETE TO public USING (true);

-- selections
ALTER TABLE selections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public insert to selections" ON selections FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public read selections" ON selections FOR SELECT TO public USING (true);
CREATE POLICY "Allow public delete selections" ON selections FOR DELETE TO public USING (true);

-- download_history
ALTER TABLE download_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public insert to download_history" ON download_history FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public read download_history" ON download_history FOR SELECT TO public USING (true);

-- download_passes
ALTER TABLE download_passes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public insert to download_passes" ON download_passes FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public read download_passes" ON download_passes FOR SELECT TO public USING (true);
CREATE POLICY "Allow public update download_passes" ON download_passes FOR UPDATE TO public USING (true) WITH CHECK (true);

-- ==========================================
-- STEP 4: ヘルパー関数
-- ==========================================

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

-- ==========================================
-- 完了！
-- ==========================================

DO $$
BEGIN
    RAISE NOTICE '✅ データベース完全セットアップ完了！';
    RAISE NOTICE '';
    RAISE NOTICE '作成されたテーブル（5つ）：';
    RAISE NOTICE '  1. galleries - ギャラリー情報';
    RAISE NOTICE '  2. photos - 写真データ';
    RAISE NOTICE '  3. selections - お客様の選択';
    RAISE NOTICE '  4. download_history - ダウンロード履歴';
    RAISE NOTICE '  5. download_passes - 追加パス購入記録';
    RAISE NOTICE '';
    RAISE NOTICE 'ヘルパー関数（2つ）：';
    RAISE NOTICE '  - check_gallery_expiration()';
    RAISE NOTICE '  - get_download_stats(gallery_id)';
    RAISE NOTICE '';
    RAISE NOTICE '全てのテーブルでRLSが有効化されました。';
END $$;
