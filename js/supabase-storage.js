// Supabase統合ストレージ管理
class SupabasePhotoStorage {
    constructor() {
        this.supabase = window.supabaseClient;
        this.bucket = 'photos';
        // 暗号化キー（本番環境では環境変数などで管理すべき）
        this.encryptionKey = 'photo-select-service-2024-secure-key';
    }

    // パスワードを暗号化
    async encryptPassword(password) {
        if (!password) return null;

        try {
            // キーを生成
            const encoder = new TextEncoder();
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                encoder.encode(this.encryptionKey),
                'PBKDF2',
                false,
                ['deriveBits', 'deriveKey']
            );

            const key = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: encoder.encode('photo-select-salt'),
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            );

            // パスワードを暗号化
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encodedPassword = encoder.encode(password);
            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encodedPassword
            );

            // IVと暗号化データを結合してBase64エンコード
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv, 0);
            combined.set(new Uint8Array(encrypted), iv.length);

            return btoa(String.fromCharCode.apply(null, combined));
        } catch (error) {
            console.error('暗号化エラー:', error);
            throw error;
        }
    }

    // パスワードを復号化
    async decryptPassword(encryptedPassword) {
        if (!encryptedPassword) return null;

        try {
            // キーを生成
            const encoder = new TextEncoder();
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                encoder.encode(this.encryptionKey),
                'PBKDF2',
                false,
                ['deriveBits', 'deriveKey']
            );

            const key = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: encoder.encode('photo-select-salt'),
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            );

            // Base64デコードしてIVと暗号化データを分離
            const combined = Uint8Array.from(atob(encryptedPassword), c => c.charCodeAt(0));
            const iv = combined.slice(0, 12);
            const encrypted = combined.slice(12);

            // 復号化
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encrypted
            );

            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (error) {
            console.error('復号化エラー:', error);
            // 復号化に失敗した場合は元の値を返す（既存の平文パスワード対応）
            return encryptedPassword;
        }
    }

    // ギャラリーを作成
    async createGallery(galleryData) {
        try {
            // パスワードを暗号化
            const encryptedPassword = galleryData.password
                ? await this.encryptPassword(galleryData.password)
                : null;

            const { data, error } = await this.supabase
                .from('galleries')
                .insert([{
                    name: galleryData.name,
                    password_hash: encryptedPassword,
                    expires_at: galleryData.expiresAt || this.getDefaultExpiryDate(),
                    max_selections: 30
                }])
                .select()
                .single();

            if (error) throw error;

            // 管理画面用に平文パスワードも返す
            return {
                ...data,
                plainPassword: galleryData.password
            };
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

            // パスワードを復号化（クライアント認証用に暗号化されたものも保持）
            if (data.password_hash) {
                const decryptedPassword = await this.decryptPassword(data.password_hash);
                return {
                    ...data,
                    decryptedPassword: decryptedPassword
                };
            }

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

            // すべてのギャラリーのパスワードを復号化
            const decryptedGalleries = await Promise.all(
                data.map(async (gallery) => {
                    if (gallery.password_hash) {
                        const decryptedPassword = await this.decryptPassword(gallery.password_hash);
                        return {
                            ...gallery,
                            decryptedPassword: decryptedPassword
                        };
                    }
                    return gallery;
                })
            );

            return decryptedGalleries;
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

    // 選択を確定する
    async confirmSelection(galleryId) {
        try {
            const { data, error } = await this.supabase
                .from('galleries')
                .update({ confirmed_at: new Date().toISOString() })
                .eq('id', galleryId)
                .select();

            if (error) throw error;
            return data && data.length > 0 ? data[0] : null;
        } catch (error) {
            console.error('選択確定エラー:', error);
            throw error;
        }
    }

    // ギャラリーを削除
    async deleteGallery(galleryId) {
        try {
            console.log('=== 削除処理開始 ===');
            console.log('ギャラリーID:', galleryId);

            // 関連する写真をStorageから削除
            console.log('写真一覧を取得中...');
            const photos = await this.getGalleryPhotos(galleryId);
            console.log(`取得した写真数: ${photos.length}枚`);

            if (photos.length > 0) {
                console.log('Storageから写真を削除中...');
                for (const photo of photos) {
                    console.log(`削除中: ${photo.storage_path}`);
                    const { data: removeData, error: removeError } = await this.supabase.storage
                        .from(this.bucket)
                        .remove([photo.storage_path]);

                    if (removeError) {
                        console.error(`Storage削除エラー (${photo.storage_path}):`, removeError);
                    } else {
                        console.log(`Storage削除成功:`, removeData);
                    }
                }
            }

            // データベースから削除（CASCADE設定により関連データも削除される）
            console.log('データベースから削除中...');
            const { data: deleteData, error: deleteError } = await this.supabase
                .from('galleries')
                .delete()
                .eq('id', galleryId)
                .select(); // 削除されたデータを返す

            console.log('削除結果 - data:', deleteData);
            console.log('削除結果 - error:', deleteError);

            if (deleteError) {
                console.error('データベース削除エラー詳細:', {
                    message: deleteError.message,
                    details: deleteError.details,
                    hint: deleteError.hint,
                    code: deleteError.code
                });
                throw deleteError;
            }

            if (!deleteData || deleteData.length === 0) {
                console.warn('警告: 削除対象のデータが見つかりませんでした');
                throw new Error('ギャラリーが見つかりませんでした。既に削除されている可能性があります。');
            }

            console.log('=== 削除処理完了 ===');
            return deleteData;
        } catch (error) {
            console.error('=== ギャラリー削除エラー ===');
            console.error('エラーオブジェクト:', error);
            console.error('エラーメッセージ:', error.message);
            console.error('エラー詳細:', error.details);
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
window.supabaseStorage = supabaseStorage;
console.log('supabaseStorage初期化完了');
