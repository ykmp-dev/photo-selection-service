// お客様向け選択画面のロジック（Supabase対応版）
let currentGallery = null;
let currentPhotos = [];
let selectedPhotoIds = new Set();
let currentPhotoIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
    initializeClient();
});

async function initializeClient() {
    const urlParams = new URLSearchParams(window.location.search);
    const galleryId = urlParams.get('gallery');

    if (!galleryId) {
        document.body.innerHTML = '<div style="text-align: center; padding: 50px;"><h1>無効なURLです</h1><p>ギャラリーIDが指定されていません。</p></div>';
        return;
    }

    try {
        // ギャラリー情報を取得
        const gallery = await supabaseStorage.getGallery(galleryId);

        if (!gallery) {
            document.body.innerHTML = '<div style="text-align: center; padding: 50px;"><h1>ギャラリーが見つかりません</h1><p>このギャラリーは削除されたか、存在しません。</p></div>';
            return;
        }

        currentGallery = gallery;

        // パスワード確認
        if (gallery.password_hash) {
            setupPasswordAuth();
        } else {
            await showGallery();
        }
    } catch (error) {
        console.error('ギャラリー読み込みエラー:', error);
        document.body.innerHTML = '<div style="text-align: center; padding: 50px;"><h1>エラー</h1><p>ギャラリーの読み込みに失敗しました。</p></div>';
    }
}

function setupPasswordAuth() {
    const authSection = document.getElementById('authSection');
    const authButton = document.getElementById('authButton');
    const passwordInput = document.getElementById('passwordInput');
    const authError = document.getElementById('authError');

    authButton.addEventListener('click', async () => {
        const enteredPassword = passwordInput.value;

        // パスワード照合（簡易版：ハッシュ化せず直接比較）
        if (enteredPassword === currentGallery.password_hash) {
            authSection.style.display = 'none';
            await showGallery();
        } else {
            authError.textContent = 'パスワードが正しくありません';
            authError.style.display = 'block';
            passwordInput.value = '';
            passwordInput.focus();
        }
    });

    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            authButton.click();
        }
    });
}

async function showGallery() {
    try {
        // 写真一覧を取得
        currentPhotos = await supabaseStorage.getGalleryPhotos(currentGallery.id);

        // 選択情報を取得
        const selectedIds = await supabaseStorage.getSelections(currentGallery.id);
        selectedPhotoIds = new Set(selectedIds);

        document.getElementById('mainContent').style.display = 'block';
        document.getElementById('galleryTitle').textContent = currentGallery.name;

        updatePhotoGrid();
        updateSelectionCount();

        // イベントリスナー
        document.getElementById('downloadSelection').addEventListener('click', downloadSelectedPhotos);
        document.getElementById('submitSelection').addEventListener('click', submitSelection);

        // ライトボックスの設定
        setupLightbox();
    } catch (error) {
        console.error('ギャラリー表示エラー:', error);
        alert('ギャラリーの表示中にエラーが発生しました。');
    }
}

function updatePhotoGrid() {
    const photoGrid = document.getElementById('photoGrid');
    photoGrid.innerHTML = '';

    currentPhotos.forEach((photo, index) => {
        const item = document.createElement('div');
        item.className = 'photo-item' + (selectedPhotoIds.has(photo.id) ? ' selected' : '');

        const img = document.createElement('img');
        img.src = photo.url;
        img.alt = photo.file_name;
        img.loading = 'lazy';

        item.appendChild(img);

        // クリックでトグル
        item.addEventListener('click', () => {
            togglePhotoSelection(index);
        });

        // 長押しまたはダブルクリックで拡大
        let touchTimer;
        item.addEventListener('touchstart', () => {
            touchTimer = setTimeout(() => openLightbox(index), 500);
        });
        item.addEventListener('touchend', () => {
            clearTimeout(touchTimer);
        });
        item.addEventListener('dblclick', () => {
            openLightbox(index);
        });

        photoGrid.appendChild(item);
    });
}

async function togglePhotoSelection(index) {
    const MAX_SELECTIONS = 30;
    const photo = currentPhotos[index];
    const isCurrentlySelected = selectedPhotoIds.has(photo.id);

    // 選択する場合（現在未選択 → 選択）
    if (!isCurrentlySelected) {
        if (selectedPhotoIds.size >= MAX_SELECTIONS) {
            alert(`最大${MAX_SELECTIONS}枚までしか選択できません。\n他の写真を選択する場合は、先に選択済みの写真を解除してください。`);
            return;
        }
    }

    try {
        // Supabaseに保存
        if (isCurrentlySelected) {
            await supabaseStorage.removeSelection(currentGallery.id, photo.id);
            selectedPhotoIds.delete(photo.id);
        } else {
            await supabaseStorage.saveSelection(currentGallery.id, photo.id);
            selectedPhotoIds.add(photo.id);
        }

        updatePhotoGrid();
        updateSelectionCount();
    } catch (error) {
        console.error('選択の切り替えエラー:', error);
        alert('選択の保存中にエラーが発生しました。');
    }
}

function updateSelectionCount() {
    document.getElementById('selectedCount').textContent = selectedPhotoIds.size;
}

async function downloadSelectedPhotos() {
    const selectedPhotos = currentPhotos.filter(p => selectedPhotoIds.has(p.id));

    if (selectedPhotos.length === 0) {
        alert('写真が選択されていません。\nダウンロードする写真を選択してください。');
        return;
    }

    try {
        // ダウンロードボタンを無効化
        const downloadBtn = document.getElementById('downloadSelection');
        downloadBtn.disabled = true;
        downloadBtn.textContent = 'ダウンロード準備中...';

        // JSZipインスタンスを作成
        const zip = new JSZip();
        const folder = zip.folder('selected_photos');

        // 各写真をダウンロードしてZIPに追加
        for (let i = 0; i < selectedPhotos.length; i++) {
            const photo = selectedPhotos[i];
            downloadBtn.textContent = `ダウンロード中... (${i + 1}/${selectedPhotos.length})`;

            try {
                // SupabaseのURLから画像をfetch
                const response = await fetch(photo.url);
                const blob = await response.blob();

                // ZIPに追加
                folder.file(photo.file_name, blob);
            } catch (error) {
                console.error(`写真 ${photo.file_name} のダウンロードエラー:`, error);
                // 失敗しても続行
            }
        }

        // ZIPファイルを生成
        downloadBtn.textContent = 'ZIP生成中...';
        const zipBlob = await zip.generateAsync({ type: 'blob' });

        // ダウンロードリンクを作成
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentGallery.name || 'selected_photos'}_${selectedPhotos.length}枚.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // ボタンを元に戻す
        downloadBtn.disabled = false;
        downloadBtn.textContent = 'ダウンロード';

        alert(`${selectedPhotos.length}枚の写真をダウンロードしました！`);
    } catch (error) {
        console.error('ダウンロードエラー:', error);
        alert('ダウンロード中にエラーが発生しました。\nもう一度お試しください。');

        // ボタンを元に戻す
        const downloadBtn = document.getElementById('downloadSelection');
        downloadBtn.disabled = false;
        downloadBtn.textContent = 'ダウンロード';
    }
}

function submitSelection() {
    const selectedCount = selectedPhotoIds.size;

    if (selectedCount === 0) {
        if (!confirm('写真が1枚も選択されていません。このまま送信しますか？')) {
            return;
        }
    }

    // 選択はすでにSupabaseに保存されている
    alert(`選択を送信しました！\n\n選択枚数: ${selectedCount}枚 / ${currentPhotos.length}枚\n\nありがとうございました。`);

    // 送信後は変更不可にする（オプション）
    document.getElementById('submitSelection').disabled = true;
    document.getElementById('submitSelection').textContent = '送信済み';
}

// ライトボックス機能
function setupLightbox() {
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const closeBtn = document.querySelector('.lightbox-close');
    const prevBtn = document.getElementById('prevPhoto');
    const nextBtn = document.getElementById('nextPhoto');
    const toggleBtn = document.getElementById('toggleSelection');

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

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePhotoSelection(currentPhotoIndex);
        updateLightboxSelection();
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
            } else if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                togglePhotoSelection(currentPhotoIndex);
                updateLightboxSelection();
            }
        }
    });
}

function openLightbox(index) {
    currentPhotoIndex = index;
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');

    lightboxImg.src = currentPhotos[index].url;
    lightbox.classList.add('active');
    lightbox.style.display = 'flex';

    updateLightboxSelection();
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    lightbox.classList.remove('active');
    lightbox.style.display = 'none';
}

function navigatePhoto(direction) {
    currentPhotoIndex += direction;

    if (currentPhotoIndex < 0) {
        currentPhotoIndex = currentPhotos.length - 1;
    } else if (currentPhotoIndex >= currentPhotos.length) {
        currentPhotoIndex = 0;
    }

    const lightboxImg = document.getElementById('lightboxImg');
    lightboxImg.src = currentPhotos[currentPhotoIndex].url;

    updateLightboxSelection();
}

function updateLightboxSelection() {
    const toggleBtn = document.getElementById('toggleSelection');
    const isSelected = selectedPhotoIds.has(currentPhotos[currentPhotoIndex].id);

    if (isSelected) {
        toggleBtn.textContent = '選択解除 ✓';
        toggleBtn.style.background = '#48bb78';
    } else {
        toggleBtn.textContent = '選択する';
        toggleBtn.style.background = '#667eea';
    }
}
