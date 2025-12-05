// お客様向け選択画面のロジック（Supabase対応版）
let currentGallery = null;
let currentPhotos = [];
let selectedPhotoIds = new Set();
let currentPhotoIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded - client.js起動');
    console.log('supabaseClient:', window.supabaseClient);
    console.log('supabaseStorage:', window.supabaseStorage);
    initializeClient();
});

async function initializeClient() {
    console.log('initializeClient開始');
    const urlParams = new URLSearchParams(window.location.search);
    const galleryId = urlParams.get('gallery');
    console.log('ギャラリーID:', galleryId);

    if (!galleryId) {
        console.error('ギャラリーIDが指定されていません');
        document.body.innerHTML = '<div style="text-align: center; padding: 50px;"><h1>無効なURLです</h1><p>ギャラリーIDが指定されていません。</p></div>';
        return;
    }

    // supabaseStorageの存在確認
    if (!window.supabaseStorage) {
        console.error('supabaseStorageが初期化されていません');
        document.body.innerHTML = '<div style="text-align: center; padding: 50px;"><h1>初期化エラー</h1><p>システムの初期化に失敗しました。ページを再読み込みしてください。</p></div>';
        return;
    }

    try {
        console.log('ギャラリー情報を取得中...');
        // ギャラリー情報を取得
        const gallery = await supabaseStorage.getGallery(galleryId);
        console.log('取得したギャラリー:', gallery);

        if (!gallery) {
            console.error('ギャラリーが見つかりません');
            document.body.innerHTML = '<div style="text-align: center; padding: 50px;"><h1>ギャラリーが見つかりません</h1><p>このギャラリーは削除されたか、存在しません。</p></div>';
            return;
        }

        currentGallery = gallery;
        console.log('currentGallery設定完了');

        // パスワード確認
        if (gallery.password_hash) {
            console.log('パスワード認証が必要');
            setupPasswordAuth();
        } else {
            console.log('パスワード不要、ギャラリー表示');
            await showGallery();
        }
    } catch (error) {
        console.error('ギャラリー読み込みエラー詳細:', error);
        document.body.innerHTML = '<div style="text-align: center; padding: 50px;"><h1>エラー</h1><p>ギャラリーの読み込みに失敗しました。</p><pre style="color: red; text-align: left; margin-top: 20px; padding: 10px; background: #f5f5f5; border-radius: 5px;">' + (error.message || error) + '</pre></div>';
    }
}

function setupPasswordAuth() {
    const authSection = document.getElementById('authSection');
    const authButton = document.getElementById('authButton');
    const passwordInput = document.getElementById('passwordInput');
    const authError = document.getElementById('authError');

    authButton.addEventListener('click', async () => {
        const enteredPassword = passwordInput.value;

        // パスワード照合（暗号化されたパスワードと復号化して比較）
        const correctPassword = currentGallery.decryptedPassword || currentGallery.password_hash;
        if (enteredPassword === correctPassword) {
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
        console.log('showGallery開始');
        // 写真一覧を取得
        console.log('写真一覧を取得中...', currentGallery.id);
        currentPhotos = await supabaseStorage.getGalleryPhotos(currentGallery.id);
        console.log('取得した写真数:', currentPhotos.length);

        // 選択情報を取得
        console.log('選択情報を取得中...');
        const selectedIds = await supabaseStorage.getSelections(currentGallery.id);
        console.log('選択済みID:', selectedIds);
        selectedPhotoIds = new Set(selectedIds);

        console.log('UI更新開始');
        document.getElementById('mainContent').style.display = 'block';
        document.getElementById('galleryTitle').textContent = currentGallery.name;

        updatePhotoGrid();
        updateSelectionCount();

        console.log('イベントリスナー設定');
        // イベントリスナー
        document.getElementById('submitSelection').addEventListener('click', submitSelection);

        // ライトボックスの設定
        setupLightbox();

        // 確定済みチェック
        if (currentGallery.confirmed_at) {
            console.log('確定済みギャラリー: 読み取り専用モード');
            makeReadOnly();
        }

        console.log('showGallery完了');
    } catch (error) {
        console.error('ギャラリー表示エラー:', error);
        alert('ギャラリーの表示中にエラーが発生しました。\n\nエラー: ' + (error.message || error));
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
    const count = selectedPhotoIds.size;
    document.getElementById('selectedCount').textContent = count;
    document.getElementById('floatingCount').textContent = count;

    // カウントに応じてアニメーション
    const floatingCounter = document.getElementById('floatingCounter');
    floatingCounter.style.transform = 'scale(1.1)';
    setTimeout(() => {
        floatingCounter.style.transform = 'scale(1)';
    }, 200);
}

async function submitSelection() {
    const selectedCount = selectedPhotoIds.size;
    const selectedPhotos = currentPhotos.filter(p => selectedPhotoIds.has(p.id));

    if (selectedCount === 0) {
        if (!confirm('写真が1枚も選択されていません。このまま送信しますか？')) {
            return;
        }
    }

    // 確認画面を表示
    showConfirmationModal(selectedPhotos);
}

function showConfirmationModal(selectedPhotos) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
        overflow-y: auto;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 30px;
        max-width: 800px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
    `;

    const thumbnailsHTML = selectedPhotos.map((photo, i) => `
        <img src="${photo.url}" alt="${photo.file_name}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 4px; margin: 5px;">
    `).join('');

    content.innerHTML = `
        <h2 style="margin-top: 0; color: #333; text-align: center;">📸 選択確認</h2>
        <p style="color: #666; text-align: center; font-size: 18px; margin: 20px 0;">
            <strong>${selectedPhotos.length}枚</strong>の写真を選択しました
        </p>
        <div style="display: flex; flex-wrap: wrap; justify-content: center; margin: 20px 0; max-height: 300px; overflow-y: auto; border: 1px solid #eee; border-radius: 8px; padding: 10px;">
            ${thumbnailsHTML}
        </div>
        <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0; color: #856404; font-weight: bold; text-align: center;">
                ⚠️ 重要なお知らせ
            </p>
            <p style="margin: 10px 0 0 0; color: #856404; text-align: center;">
                一度確定すると、選択内容を変更することはできません。<br>
                本当にこの選択で確定してもよろしいですか？
            </p>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button id="cancelConfirmBtn" class="btn" style="flex: 1; background: #6c757d; padding: 15px;">戻る</button>
            <button id="confirmSubmitBtn" class="btn btn-success" style="flex: 1; padding: 15px; font-size: 16px;">確定する</button>
        </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // イベントリスナー
    document.getElementById('cancelConfirmBtn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    document.getElementById('confirmSubmitBtn').addEventListener('click', async () => {
        try {
            document.getElementById('confirmSubmitBtn').disabled = true;
            document.getElementById('confirmSubmitBtn').textContent = '確定中...';

            // Supabaseで選択を確定
            await supabaseStorage.confirmSelection(currentGallery.id);

            document.body.removeChild(modal);

            // 成功画面を表示
            showSuccessScreen(selectedPhotos);

            // UIを読み取り専用に
            makeReadOnly();

        } catch (error) {
            console.error('確定エラー:', error);
            alert('確定処理中にエラーが発生しました。\n\nエラー: ' + (error.message || error));
            document.getElementById('confirmSubmitBtn').disabled = false;
            document.getElementById('confirmSubmitBtn').textContent = '確定する';
        }
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

function showSuccessScreen(selectedPhotos) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 40px;
        max-width: 600px;
        width: 100%;
        text-align: center;
    `;

    content.innerHTML = `
        <div style="font-size: 80px; margin-bottom: 20px;">✅</div>
        <h2 style="margin: 0 0 10px 0; color: #333;">選択を確定しました！</h2>
        <p style="color: #666; margin: 20px 0;">
            ${selectedPhotos.length}枚の写真を選択いただきありがとうございました。<br>
            選択された写真をダウンロードできます。
        </p>
        <div style="margin-top: 30px;">
            <button id="downloadNowBtn" class="btn btn-primary" style="padding: 15px 30px; font-size: 16px; margin-bottom: 10px;">
                📥 今すぐダウンロード
            </button>
        </div>
        <button id="closeSuccessBtn" class="btn" style="margin-top: 10px; background: #6c757d;">閉じる</button>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    document.getElementById('downloadNowBtn').addEventListener('click', async () => {
        document.body.removeChild(modal);
        await downloadSelectedPhotos();
    });

    document.getElementById('closeSuccessBtn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
}

function makeReadOnly() {
    // すべての写真の選択を無効化
    const photoItems = document.querySelectorAll('.photo-item');
    photoItems.forEach(item => {
        item.style.pointerEvents = 'none';
        item.style.opacity = '0.8';
    });

    // ボタンを無効化
    document.getElementById('submitSelection').disabled = true;
    document.getElementById('submitSelection').textContent = '確定済み';

    // メッセージを表示
    const controls = document.querySelector('.controls');
    if (controls) {
        const message = document.createElement('div');
        message.style.cssText = `
            background: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
        `;
        message.textContent = '✅ 選択が確定されました。変更はできません。';
        controls.parentNode.insertBefore(message, controls);
    }
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
