-- 既存テーブルを削除して最初からやり直す
-- Supabase SQL Editorで実行してください

-- ⚠️ 警告: このスクリプトはすべてのデータを削除します
-- テスト段階での実行を想定しています

-- 1. 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Allow public insert to galleries" ON galleries;
DROP POLICY IF EXISTS "Allow public read galleries" ON galleries;
DROP POLICY IF EXISTS "Allow public update galleries" ON galleries;
DROP POLICY IF EXISTS "Allow public delete galleries" ON galleries;
DROP POLICY IF EXISTS "Allow public insert to photos" ON photos;
DROP POLICY IF EXISTS "Allow public read photos" ON photos;
DROP POLICY IF EXISTS "Allow public delete photos" ON photos;
DROP POLICY IF EXISTS "Allow public insert to selections" ON selections;
DROP POLICY IF EXISTS "Allow public read selections" ON selections;
DROP POLICY IF EXISTS "Allow public delete selections" ON selections;
DROP POLICY IF EXISTS "Allow public insert to download_history" ON download_history;
DROP POLICY IF EXISTS "Allow public read download_history" ON download_history;
DROP POLICY IF EXISTS "Allow public insert to download_passes" ON download_passes;
DROP POLICY IF EXISTS "Allow public read download_passes" ON download_passes;
DROP POLICY IF EXISTS "Allow public update download_passes" ON download_passes;

-- 2. 既存のテーブルを削除（CASCADE で関連データも削除）
DROP TABLE IF EXISTS download_passes CASCADE;
DROP TABLE IF EXISTS download_history CASCADE;
DROP TABLE IF EXISTS selections CASCADE;
DROP TABLE IF EXISTS photos CASCADE;
DROP TABLE IF EXISTS galleries CASCADE;

-- 3. 関数も削除
DROP FUNCTION IF EXISTS check_gallery_expiration();
DROP FUNCTION IF EXISTS get_download_stats(UUID);

-- 完了メッセージ
DO $$
BEGIN
    RAISE NOTICE '✅ 既存テーブルを削除しました';
    RAISE NOTICE '次のステップ: supabase-schema-updates.sql を実行してください';
END $$;
