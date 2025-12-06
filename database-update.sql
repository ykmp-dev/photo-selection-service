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
