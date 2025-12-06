-- 既存のphotosテーブルにrating/categoryカラムを追加
-- 既存データを保持したまま更新

ALTER TABLE photos ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 0;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS category TEXT;
CREATE INDEX IF NOT EXISTS idx_photos_rating ON photos(rating);
CREATE INDEX IF NOT EXISTS idx_photos_category ON photos(category);

-- 確認
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'photos'
ORDER BY ordinal_position;

-- galleriesテーブルに全カット納品フラグを追加
ALTER TABLE galleries ADD COLUMN IF NOT EXISTS all_photos_delivery BOOLEAN DEFAULT false;

-- galleriesテーブルにダウンロード追跡カラムを追加
ALTER TABLE galleries ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0;
ALTER TABLE galleries ADD COLUMN IF NOT EXISTS first_download_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE galleries ADD COLUMN IF NOT EXISTS download_expires_at TIMESTAMP WITH TIME ZONE;

-- download_historyテーブルを作成（ダウンロード履歴記録）
CREATE TABLE IF NOT EXISTS download_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gallery_id UUID REFERENCES galleries(id) ON DELETE CASCADE,
    downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- download_historyテーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_download_history_gallery_id ON download_history(gallery_id);
CREATE INDEX IF NOT EXISTS idx_download_history_downloaded_at ON download_history(downloaded_at);

-- download_historyテーブルのRLS
ALTER TABLE download_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow public insert to download_history"
ON download_history FOR INSERT TO public WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow public read download_history"
ON download_history FOR SELECT TO public USING (true);

-- 確認
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'galleries'
ORDER BY ordinal_position;
