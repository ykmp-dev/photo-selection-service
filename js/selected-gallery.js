// 選択済み写真ギャラリー
let currentGallery = null;
let selectedPhotos = [];
let currentPhotoIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
    initializeSelectedGallery();
});

async function initializeSelectedGallery() {
    const urlParams = new URLSearchParams(window.location.search);
    const galleryId = urlParams.get('gallery');

    if (!galleryId) {
        document.body.innerHTML = '<div style="text-align: center; padding: 50px;"><h1>無効なURLです</h1></div>';
        return;
    }

    try {
        // ギャラリー情報を取得
        const gallery = await supabaseStorage.getGallery(galleryId);
        if (!gallery) {
            document.body.innerHTML = '<div style="text-align: center; padding: 50px;"><h1>ギャラリーが見つかりません</h1></div>';
            return;
        }

        currentGallery = gallery;
        document.getElementById('galleryTitle').textContent = gallery.name;

        // 選択済み写真を取得
        const allPhotos = await supabaseStorage.getGalleryPhotos(galleryId);
        const selectedIds = await supabaseStorage.getSelections(galleryId);
        selectedPhotos = allPhotos.filter(p => selectedIds.includes(p.id));

        document.getElementById('photoCount').textContent = selectedPhotos.length;

        if (selectedPhotos.length === 0) {
            document.getElementById('mainContent').innerHTML = '<div style="text-align: center; padding: 50px;"><h2>まだ写真が選択されていません</h2></div>';
            return;
        }

        displayPhotos();
        setupLightbox();
        setupDownloadAll();

    } catch (error) {
        console.error('初期化エラー:', error);
        document.body.innerHTML = '<div style="text-align: center; padding: 50px;"><h1>エラー</h1><p>ギャラリーの読み込みに失敗しました。</p></div>';
    }
}

function displayPhotos() {
    const photoGrid = document.getElementById('photoGrid');
    photoGrid.innerHTML = '';

    selectedPhotos.forEach((photo, index) => {
        const item = document.createElement('div');
        item.className = 'photo-item';
        item.style.cursor = 'pointer';

        const img = document.createElement('img');
        img.src = photo.url;
        img.alt = photo.file_name;
        img.loading = 'lazy';

        item.appendChild(img);

        // クリックで拡大
        item.addEventListener('click', () => {
            openLightbox(index);
        });

        photoGrid.appendChild(item);
    });
}

function setupLightbox() {
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const closeBtn = document.querySelector('.lightbox-close');
    const prevBtn = document.getElementById('prevPhoto');
    const nextBtn = document.getElementById('nextPhoto');
    const downloadBtn = document.getElementById('downloadSingleBtn');

    closeBtn.addEventListener('click', closeLightbox);

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });

    prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigatePhoto(-1);
    });

    nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigatePhoto(1);
    });

    downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadSinglePhoto();
    });

    // キーボードナビゲーション
    document.addEventListener('keydown', (e) => {
        if (lightbox.classList.contains('active')) {
            if (e.key === 'Escape') {
                closeLightbox();
            } else if (e.key === 'ArrowLeft') {
                navigatePhoto(-1);
            } else if (e.key === 'ArrowRight') {
                navigatePhoto(1);
            } else if (e.key === 'd' || e.key === 'D') {
                e.preventDefault();
                downloadSinglePhoto();
            }
        }
    });
}

function openLightbox(index) {
    currentPhotoIndex = index;
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');

    lightboxImg.src = selectedPhotos[index].url;
    lightbox.classList.add('active');
    lightbox.style.display = 'flex';
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    lightbox.classList.remove('active');
    lightbox.style.display = 'none';
}

function navigatePhoto(direction) {
    currentPhotoIndex += direction;

    if (currentPhotoIndex < 0) {
        currentPhotoIndex = selectedPhotos.length - 1;
    } else if (currentPhotoIndex >= selectedPhotos.length) {
        currentPhotoIndex = 0;
    }

    const lightboxImg = document.getElementById('lightboxImg');
    lightboxImg.src = selectedPhotos[currentPhotoIndex].url;
}

async function downloadSinglePhoto() {
    const photo = selectedPhotos[currentPhotoIndex];

    try {
        const response = await fetch(photo.url);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = photo.file_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // 短いメッセージ表示
        showToast('✅ ダウンロード開始');
    } catch (error) {
        console.error('ダウンロードエラー:', error);
        showToast('❌ ダウンロードに失敗しました');
    }
}

function setupDownloadAll() {
    const downloadAllBtn = document.getElementById('downloadAllZipBtn');

    downloadAllBtn.addEventListener('click', async () => {
        try {
            downloadAllBtn.disabled = true;
            downloadAllBtn.textContent = 'ZIP生成中...';

            // JSZipを使用してZIPファイルを作成
            const zip = new JSZip();
            const folder = zip.folder('selected_photos');

            // 各写真をダウンロードしてZIPに追加
            for (let i = 0; i < selectedPhotos.length; i++) {
                const photo = selectedPhotos[i];
                downloadAllBtn.textContent = `ダウンロード中... (${i + 1}/${selectedPhotos.length})`;

                try {
                    const response = await fetch(photo.url);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const blob = await response.blob();
                    folder.file(photo.file_name, blob);
                } catch (error) {
                    console.error(`${photo.file_name} のダウンロードエラー:`, error);
                }
            }

            // ZIPファイルを生成
            downloadAllBtn.textContent = 'ZIP圧縮中...';
            const zipBlob = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: {
                    level: 6
                }
            });

            // ダウンロード
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentGallery.name || 'selected_photos'}_${selectedPhotos.length}枚.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // ダウンロード履歴を記録
            await supabaseStorage.recordDownload(currentGallery.id);

            showToast('✅ ZIPダウンロード完了！');

        } catch (error) {
            console.error('ZIPダウンロードエラー:', error);
            showToast('❌ ZIPダウンロードに失敗しました');
        } finally {
            downloadAllBtn.disabled = false;
            downloadAllBtn.textContent = '📦 全ての写真をZIPでダウンロード';
        }
    });
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 15px 30px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        z-index: 10001;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) {
            document.body.removeChild(toast);
        }
    }, 2000);
}
