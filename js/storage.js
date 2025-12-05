// データストレージ管理
class PhotoStorage {
    constructor() {
        this.storageKey = 'photoGalleries';
    }

    // すべてのギャラリーを取得
    getAllGalleries() {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : [];
    }

    // 特定のギャラリーを取得
    getGallery(id) {
        const galleries = this.getAllGalleries();
        return galleries.find(g => g.id === id);
    }

    // ギャラリーを保存
    saveGallery(gallery) {
        const galleries = this.getAllGalleries();
        const existingIndex = galleries.findIndex(g => g.id === gallery.id);

        if (existingIndex >= 0) {
            galleries[existingIndex] = gallery;
        } else {
            galleries.push(gallery);
        }

        localStorage.setItem(this.storageKey, JSON.stringify(galleries));
        return gallery;
    }

    // ギャラリーを削除
    deleteGallery(id) {
        const galleries = this.getAllGalleries();
        const filtered = galleries.filter(g => g.id !== id);
        localStorage.setItem(this.storageKey, JSON.stringify(filtered));
    }

    // ギャラリーIDを生成
    generateId() {
        return 'gallery_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // 写真をBase64に変換
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // 画像を圧縮（オプション）
    compressImage(base64, maxWidth = 1920) {
        return new Promise((resolve) => {
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

                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.src = base64;
        });
    }
}

// グローバルインスタンス
const photoStorage = new PhotoStorage();
