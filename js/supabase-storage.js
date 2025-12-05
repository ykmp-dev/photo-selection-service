// Supabase統合ストレージ管理
class SupabasePhotoStorage {
    constructor() {
        this.supabase = window.supabaseClient;
        this.bucket = 'photos';
    }

    // ギャラリーを作成
    async createGallery(galleryData) {
        try {
            const { data, error } = await this.supabase
                .from('galleries')
                .insert([{
                    name: galleryData.name,
                    password_hash: galleryData.password || null,
                    expires_at: galleryData.expiresAt || this.getDefaultExpiryDate(),
                    max_selections: 30
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('ギャラリー作成エラー:', error);
            throw error;
        }
    }

    // 写真をアップロード
    async uploadPhoto(galleryId, file) {
        try {
            // ファイル名を生成（UUID + 元のファイル名）
            const fileExt = file.name.split('.').pop();
            const fileName = `${galleryId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

            // Supabase Storageにアップロード
            const { data: uploadData, error: uploadError } = await this.supabase.storage
                .from(this.bucket)
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            // 公開URLを取得
            const { data: { publicUrl } } = this.supabase.storage
                .from(this.bucket)
                .getPublicUrl(fileName);

            // データベースに写真情報を保存
            const { data: photoData, error: dbError } = await this.supabase
                .from('photos')
                .insert([{
                    gallery_id: galleryId,
                    file_name: file.name,
                    storage_path: fileName,
                    thumbnail_url: publicUrl,
                    file_size: file.size
                }])
                .select()
                .single();

            if (dbError) throw dbError;

            return {
                ...photoData,
                url: publicUrl
            };
        } catch (error) {
            console.error('写真アップロードエラー:', error);
            throw error;
        }
    }

    // ギャラリーの写真一覧を取得
    async getGalleryPhotos(galleryId) {
        try {
            const { data, error } = await this.supabase
                .from('photos')
                .select('*')
                .eq('gallery_id', galleryId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            // 各写真の公開URLを付与
            return data.map(photo => ({
                ...photo,
                url: this.supabase.storage.from(this.bucket).getPublicUrl(photo.storage_path).data.publicUrl
            }));
        } catch (error) {
            console.error('写真取得エラー:', error);
            throw error;
        }
    }

    // ギャラリー情報を取得
    async getGallery(galleryId) {
        try {
            const { data, error } = await this.supabase
                .from('galleries')
                .select('*')
                .eq('id', galleryId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('ギャラリー取得エラー:', error);
            throw error;
        }
    }

    // すべてのギャラリーを取得（スタジオ管理用）
    async getAllGalleries() {
        try {
            const { data, error } = await this.supabase
                .from('galleries')
                .select('*, photos(count)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('ギャラリー一覧取得エラー:', error);
            throw error;
        }
    }

    // 写真選択を保存
    async saveSelection(galleryId, photoId) {
        try {
            const { data, error } = await this.supabase
                .from('selections')
                .upsert([{
                    gallery_id: galleryId,
                    photo_id: photoId
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('選択保存エラー:', error);
            throw error;
        }
    }

    // 写真選択を解除
    async removeSelection(galleryId, photoId) {
        try {
            const { error } = await this.supabase
                .from('selections')
                .delete()
                .eq('gallery_id', galleryId)
                .eq('photo_id', photoId);

            if (error) throw error;
        } catch (error) {
            console.error('選択解除エラー:', error);
            throw error;
        }
    }

    // ギャラリーの選択情報を取得
    async getSelections(galleryId) {
        try {
            const { data, error } = await this.supabase
                .from('selections')
                .select('photo_id')
                .eq('gallery_id', galleryId);

            if (error) throw error;
            return data.map(s => s.photo_id);
        } catch (error) {
            console.error('選択情報取得エラー:', error);
            throw error;
        }
    }

    // ギャラリーを削除
    async deleteGallery(galleryId) {
        try {
            // 関連する写真をStorageから削除
            const photos = await this.getGalleryPhotos(galleryId);
            for (const photo of photos) {
                await this.supabase.storage
                    .from(this.bucket)
                    .remove([photo.storage_path]);
            }

            // データベースから削除（CASCADE設定により関連データも削除される）
            const { error } = await this.supabase
                .from('galleries')
                .delete()
                .eq('id', galleryId);

            if (error) throw error;
        } catch (error) {
            console.error('ギャラリー削除エラー:', error);
            throw error;
        }
    }

    // デフォルトの有効期限（30日後）
    getDefaultExpiryDate() {
        const date = new Date();
        date.setDate(date.getDate() + 30);
        return date.toISOString();
    }

    // 画像を圧縮（ブラウザ側で処理）
    compressImage(file, maxWidth = 1920) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                    }, 'image/jpeg', 0.85);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
}

// グローバルインスタンス
const supabaseStorage = new SupabasePhotoStorage();
