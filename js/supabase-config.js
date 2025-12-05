// Supabase設定
// 注意: 本番環境では環境変数から読み込むべきですが、
// GitHub Pagesでの動作を考慮してハードコードしています

const SUPABASE_URL = 'https://wrgmbkkhgmxholzlgiic.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndyZ21ia2toZ214aG9semxnaWljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MDU1OTEsImV4cCI6MjA4MDQ4MTU5MX0.rlPK7Km7yvK64fnRsFOIgrFVKPrJsTxaDsZ7jSwGUYk';

// Supabaseクライアントの初期化
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// エクスポート（グローバル変数として使用）
window.supabaseClient = supabaseClient;
