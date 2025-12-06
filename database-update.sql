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

-- 確認
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'galleries'
ORDER BY ordinal_position;
