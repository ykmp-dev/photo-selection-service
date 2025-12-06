// お客様向け選択画面のロジック（Supabase対応版）
let currentGallery = null;
let currentPhotos = [];
let selectedPhotoIds = new Set();
let currentPhotoIndex = 0;
let filterMode = 'all'; // 'all' or 'unselected'
let categoryFilter = null; // null or category name

// 汎用エラーモーダル表示関数
function showErrorModal(title, message) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
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
        padding: 30px;
        max-width: 500px;
        width: 100%;
        text-align: center;
    `;

    content.innerHTML = `
        <div style="font-size: 60px; margin-bottom: 15px;">⚠️</div>
        <h2 style="margin: 0 0 15px 0; color: var(--notion-text);">${title}</h2>
        <p style="color: var(--notion-text-secondary); margin: 0 0 25px 0; line-height: 1.6;">${message}</p>
        <button id="errorModalCloseBtn" class="btn btn-primary" style="padding: 12px 30px;">
            OK
        </button>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    const closeModal = () => document.body.removeChild(modal);
    document.getElementById('errorModalCloseBtn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

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

    // パスワード入力画面を表示
    authSection.style.display = 'block';

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

        // max_selectionsを表示に反映
        const maxSelections = currentGallery.max_selections || 30;
        document.getElementById('maxSelectionsDisplay').textContent = maxSelections;

        updatePhotoGrid();
        updateSelectionCount();
        setupCategoryFilters();

        console.log('イベントリスナー設定');
        // イベントリスナー
        document.getElementById('submitSelection').addEventListener('click', submitSelection);
        document.getElementById('autoSelectBtn').addEventListener('click', autoSelectRemaining);
        document.getElementById('filterUnselectedBtn').addEventListener('click', toggleUnselectedFilter);
        document.getElementById('showSelectedBtn').addEventListener('click', showSelectedPhotosModal);

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
        showErrorModal('ギャラリー表示エラー', 'ギャラリーの表示中にエラーが発生しました。<br><br>エラー: ' + (error.message || error));
    }
}

function updatePhotoGrid() {
    const photoGrid = document.getElementById('photoGrid');
    photoGrid.innerHTML = '';

    // フィルターモードに応じて表示する写真を決定
    let photosToDisplay = currentPhotos;

    // 未選択フィルター
    if (filterMode === 'unselected') {
        photosToDisplay = photosToDisplay.filter(photo => !selectedPhotoIds.has(photo.id));
    }

    // カテゴリフィルター
    if (categoryFilter) {
        photosToDisplay = photosToDisplay.filter(photo => photo.category === categoryFilter);
    }

    if (photosToDisplay.length === 0) {
        let message = '写真がありません';
        if (filterMode === 'unselected') {
            message = '未選択の写真はありません';
        } else if (categoryFilter) {
            message = `「${categoryFilter}」の写真はありません`;
        }
        photoGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--notion-text-secondary);">${message}</div>`;
        return;
    }

    photosToDisplay.forEach((photo, displayIndex) => {
        // 元のインデックスを保持
        const originalIndex = currentPhotos.indexOf(photo);

        const item = document.createElement('div');
        item.className = 'photo-item' + (selectedPhotoIds.has(photo.id) ? ' selected' : '');

        const img = document.createElement('img');
        img.src = photo.url;
        img.alt = photo.file_name;
        img.loading = 'lazy';

        item.appendChild(img);

        // レーティング ≥ 1 の場合、おすすめバッジを表示
        if (photo.rating && photo.rating >= 1) {
            const badge = document.createElement('div');
            badge.className = 'recommended-badge';
            badge.innerHTML = '⭐';
            badge.title = `おすすめ (評価: ${photo.rating})`;
            badge.style.cssText = `
                position: absolute;
                top: 8px;
                left: 8px;
                background: rgba(255, 215, 0, 0.95);
                color: #333;
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 14px;
                font-weight: bold;
                z-index: 5;
                pointer-events: none;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            `;
            item.appendChild(badge);
        }

        // クリックでトグル
        item.addEventListener('click', () => {
            togglePhotoSelection(originalIndex);
        });

        // 長押しまたはダブルクリックで拡大
        let touchTimer;
        item.addEventListener('touchstart', () => {
            touchTimer = setTimeout(() => openLightbox(originalIndex), 500);
        });
        item.addEventListener('touchend', () => {
            clearTimeout(touchTimer);
        });
        item.addEventListener('dblclick', () => {
            openLightbox(originalIndex);
        });

        photoGrid.appendChild(item);
    });
}

async function togglePhotoSelection(index) {
    const maxSelections = currentGallery.max_selections || 30;
    const photo = currentPhotos[index];
    const isCurrentlySelected = selectedPhotoIds.has(photo.id);

    // 選択する場合（現在未選択 → 選択）
    if (!isCurrentlySelected) {
        if (selectedPhotoIds.size >= maxSelections) {
            showErrorModal('選択上限に達しました', `最大${maxSelections}枚までしか選択できません。<br>他の写真を選択する場合は、先に選択済みの写真を解除してください。`);
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
        showErrorModal('選択エラー', '選択の保存中にエラーが発生しました。');
    }
}

function updateSelectionCount() {
    const count = selectedPhotoIds.size;
    const maxSelections = currentGallery.max_selections || 30;
    const percentage = Math.round((count / maxSelections) * 100);
    const remaining = maxSelections - count;

    // カウント更新
    document.getElementById('selectedCount').textContent = count;

    // プログレスバー更新
    const progressBar = document.getElementById('progressBar');
    const progressPercentage = document.getElementById('progressPercentage');
    const remainingMessage = document.getElementById('remainingMessage');
    const autoSelectBtn = document.getElementById('autoSelectBtn');

    if (progressBar) {
        progressBar.style.width = percentage + '%';

        // 進捗に応じて色を変更
        if (percentage === 100) {
            progressBar.style.background = 'var(--notion-green)';
        } else if (percentage >= 80) {
            progressBar.style.background = 'linear-gradient(90deg, var(--notion-blue), var(--notion-green))';
        } else {
            progressBar.style.background = 'var(--notion-blue)';
        }
    }

    if (progressPercentage) {
        progressPercentage.textContent = percentage + '%';
    }

    if (remainingMessage) {
        if (remaining > 0) {
            remainingMessage.textContent = `あと${remaining}枚選択してください`;
            remainingMessage.style.color = 'var(--notion-text-secondary)';
        } else if (remaining === 0) {
            remainingMessage.textContent = '✅ 選択完了！確認ボタンを押してください';
            remainingMessage.style.color = 'var(--notion-green)';
        } else {
            remainingMessage.textContent = `⚠️ ${Math.abs(remaining)}枚超過しています`;
            remainingMessage.style.color = 'var(--notion-red)';
        }
    }

    // 自動選択ボタンの表示制御
    if (autoSelectBtn) {
        if (remaining > 0 && remaining <= currentPhotos.length - count) {
            autoSelectBtn.style.display = 'inline-block';
        } else {
            autoSelectBtn.style.display = 'none';
        }
    }
}

// 残りを自動選択
async function autoSelectRemaining() {
    const maxSelections = currentGallery.max_selections || 30;
    const remaining = maxSelections - selectedPhotoIds.size;

    if (remaining <= 0) {
        return;
    }

    try {
        // 未選択の写真を取得
        const unselectedPhotos = currentPhotos.filter(p => !selectedPhotoIds.has(p.id));

        // ランダムに選択（または先頭から）
        const photosToSelect = unselectedPhotos.slice(0, remaining);

        // バッチで選択を保存
        for (const photo of photosToSelect) {
            await supabaseStorage.saveSelection(currentGallery.id, photo.id);
            selectedPhotoIds.add(photo.id);
        }

        updatePhotoGrid();
        updateSelectionCount();

        // 完了メッセージ
        const message = document.createElement('div');
        message.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--notion-green);
            color: white;
            padding: 20px 40px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            z-index: 10000;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        `;
        message.textContent = `✅ ${photosToSelect.length}枚を自動選択しました！`;
        document.body.appendChild(message);

        setTimeout(() => {
            document.body.removeChild(message);
        }, 2000);
    } catch (error) {
        console.error('自動選択エラー:', error);
        showErrorModal('自動選択エラー', '自動選択中にエラーが発生しました。');
    }
}

// 未選択フィルター切り替え
function toggleUnselectedFilter() {
    const btn = document.getElementById('filterUnselectedBtn');

    if (filterMode === 'all') {
        filterMode = 'unselected';
        btn.textContent = '全て表示';
        btn.style.background = 'var(--notion-blue)';
        btn.style.color = 'white';
        btn.style.borderColor = 'var(--notion-blue)';
    } else {
        filterMode = 'all';
        btn.textContent = '未選択のみ表示';
        btn.style.background = '';
        btn.style.color = '';
        btn.style.borderColor = '';
    }

    updatePhotoGrid();
}

// カテゴリフィルターをセットアップ
function setupCategoryFilters() {
    // カテゴリを抽出
    const categories = [...new Set(currentPhotos
        .map(photo => photo.category)
        .filter(cat => cat && cat.trim() !== ''))];

    if (categories.length === 0) {
        return; // カテゴリがない場合は何もしない
    }

    // カテゴリフィルターボタンを追加
    const controlButtons = document.querySelector('.control-buttons');

    // 既存のカテゴリボタンを削除
    const existingCategoryBtns = document.querySelectorAll('.category-filter-btn');
    existingCategoryBtns.forEach(btn => btn.remove());

    // "カテゴリ:" ラベルを追加
    const categoryLabel = document.createElement('span');
    categoryLabel.className = 'category-filter-btn';
    categoryLabel.textContent = 'カテゴリ:';
    categoryLabel.style.cssText = 'margin-right: 4px; font-weight: 500; color: var(--notion-text-secondary);';
    controlButtons.insertBefore(categoryLabel, controlButtons.firstChild);

    // "全て" ボタンを追加
    const allBtn = document.createElement('button');
    allBtn.className = 'btn category-filter-btn';
    allBtn.textContent = '全て';
    allBtn.style.marginRight = '8px';
    if (!categoryFilter) {
        allBtn.style.background = 'var(--notion-blue)';
        allBtn.style.color = 'white';
        allBtn.style.borderColor = 'var(--notion-blue)';
    }
    allBtn.addEventListener('click', () => {
        categoryFilter = null;
        setupCategoryFilters();
        updatePhotoGrid();
    });
    controlButtons.insertBefore(allBtn, document.getElementById('autoSelectBtn'));

    // 各カテゴリのボタンを追加
    categories.forEach(category => {
        const btn = document.createElement('button');
        btn.className = 'btn category-filter-btn';
        btn.textContent = category;
        btn.style.marginRight = '8px';

        if (categoryFilter === category) {
            btn.style.background = 'var(--notion-blue)';
            btn.style.color = 'white';
            btn.style.borderColor = 'var(--notion-blue)';
        }

        btn.addEventListener('click', () => {
            categoryFilter = category;
            setupCategoryFilters();
            updatePhotoGrid();
        });

        controlButtons.insertBefore(btn, document.getElementById('autoSelectBtn'));
    });
}

// 選択済み写真一覧モーダル
function showSelectedPhotosModal() {
    const selectedPhotos = currentPhotos.filter(p => selectedPhotoIds.has(p.id));

    if (selectedPhotos.length === 0) {
        showErrorModal('選択なし', 'まだ写真が選択されていません。');
        return;
    }

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
        max-width: 1000px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
    `;

    const thumbnailsHTML = selectedPhotos.map((photo, i) => {
        const originalIndex = currentPhotos.indexOf(photo);
        return `
            <div style="position: relative; cursor: pointer;" data-index="${originalIndex}">
                <img src="${photo.url}" alt="${photo.file_name}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 4px;">
                <button class="remove-selected-btn" data-photo-id="${photo.id}" style="position: absolute; top: 4px; right: 4px; background: var(--notion-red); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-size: 14px; line-height: 1; transition: background 0.15s;">×</button>
                <div style="font-size: 11px; color: var(--notion-text-secondary); margin-top: 4px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${i + 1}</div>
            </div>
        `;
    }).join('');

    const maxSelections = currentGallery.max_selections || 30;

    content.innerHTML = `
        <h2 style="margin-top: 0; color: var(--notion-text); text-align: center;">📸 選択済み写真一覧</h2>
        <p style="color: var(--notion-text-secondary); text-align: center; font-size: 16px; margin: 15px 0;">
            <strong>${selectedPhotos.length}枚</strong> / ${maxSelections}枚 選択中
        </p>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px; margin: 20px 0; max-height: 60vh; overflow-y: auto; border: 1px solid var(--notion-border); border-radius: 8px; padding: 15px;">
            ${thumbnailsHTML}
        </div>
        <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button id="clearAllSelectionsBtn" class="btn" style="flex: 1; background: var(--notion-red); color: white; border-color: var(--notion-red);">全て解除</button>
            <button id="closeSelectedModalBtn" class="btn btn-primary" style="flex: 1;">閉じる</button>
        </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // サムネイルクリックでライトボックス
    content.querySelectorAll('[data-index]').forEach(el => {
        el.addEventListener('click', (e) => {
            if (!e.target.classList.contains('remove-selected-btn')) {
                const index = parseInt(el.dataset.index);
                openLightbox(index);
                document.body.removeChild(modal);
            }
        });
    });

    // 個別削除ボタン
    content.querySelectorAll('.remove-selected-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const photoId = btn.dataset.photoId;
            try {
                await supabaseStorage.removeSelection(currentGallery.id, photoId);
                selectedPhotoIds.delete(photoId);
                updatePhotoGrid();
                updateSelectionCount();

                // モーダルを再描画
                document.body.removeChild(modal);
                showSelectedPhotosModal();
            } catch (error) {
                console.error('選択解除エラー:', error);
                showErrorModal('選択解除エラー', '選択の解除中にエラーが発生しました。');
            }
        });
    });

    // 全て解除ボタン
    document.getElementById('clearAllSelectionsBtn').addEventListener('click', async () => {
        if (!confirm('選択中の写真を全て解除しますか？')) {
            return;
        }

        try {
            for (const photoId of selectedPhotoIds) {
                await supabaseStorage.removeSelection(currentGallery.id, photoId);
            }
            selectedPhotoIds.clear();
            updatePhotoGrid();
            updateSelectionCount();
            document.body.removeChild(modal);
        } catch (error) {
            console.error('全解除エラー:', error);
            showErrorModal('全解除エラー', '選択の解除中にエラーが発生しました。');
        }
    });

    // 閉じるボタン
    document.getElementById('closeSelectedModalBtn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    // 背景クリックで閉じる
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

async function submitSelection() {
    const selectedCount = selectedPhotoIds.size;
    const selectedPhotos = currentPhotos.filter(p => selectedPhotoIds.has(p.id));
    const maxSelections = currentGallery.max_selections || 30;

    if (selectedCount === 0) {
        if (!confirm('写真が1枚も選択されていません。このまま送信しますか？')) {
            return;
        }
    }

    if (selectedCount < maxSelections) {
        showErrorModal(
            '選択枚数が不足しています',
            `${maxSelections}枚選択してください。<br>現在の選択数: ${selectedCount}枚`
        );
        return;
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
            showErrorModal('確定エラー', '確定処理中にエラーが発生しました。<br><br>エラー: ' + (error.message || error));
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
        max-width: 700px;
        width: 100%;
        text-align: center;
    `;

    content.innerHTML = `
        <div style="font-size: 80px; margin-bottom: 20px;">✅</div>
        <h2 style="margin: 0 0 10px 0; color: #333;">お写真セレクトありがとうございました。</h2>
        <p style="color: #666; margin: 20px 0;">
            ${selectedPhotos.length}枚の写真を選択いただきました。<br>
            次のステップをお選びください。
        </p>

        <div style="display: flex; flex-direction: column; gap: 15px; margin-top: 30px;">
            <button id="viewGalleryBtn" class="option-btn" style="padding: 20px; background: #48bb78; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; transition: all 0.3s;">
                📸 ギャラリーページで写真をダウンロード
            </button>

            <button id="orderPhotobookBtn" class="option-btn" style="padding: 20px; background: #667eea; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; transition: all 0.3s;">
                📖 フォトブックを注文する
            </button>

            <button id="orderPrintsBtn" class="option-btn" style="padding: 20px; background: #f56565; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; transition: all 0.3s;">
                🖼️ 写真プリントを注文する
            </button>

            <button id="orderAlbumBtn" class="option-btn" style="padding: 20px; background: #ed8936; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; transition: all 0.3s;">
                📚 プレミアムアルバムを注文する
            </button>
        </div>

        <p style="color: #999; margin-top: 20px; font-size: 14px;">
            ※ ギャラリーページでは1枚ずつ、またはZIPで一括ダウンロードできます
        </p>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // ホバーエフェクト
    const optionBtns = content.querySelectorAll('.option-btn');
    optionBtns.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'scale(1.02)';
            btn.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = 'none';
        });
    });

    // ギャラリーページへ遷移
    document.getElementById('viewGalleryBtn').addEventListener('click', () => {
        const galleryUrl = `${window.location.origin}${window.location.pathname.replace('client.html', '')}selected-gallery.html?gallery=${currentGallery.id}`;
        window.location.href = galleryUrl;
    });

    // フォトブック注文
    document.getElementById('orderPhotobookBtn').addEventListener('click', () => {
        document.body.removeChild(modal);
        showOrderScreen('photobook', selectedPhotos);
    });

    // プリント注文
    document.getElementById('orderPrintsBtn').addEventListener('click', () => {
        document.body.removeChild(modal);
        showOrderScreen('prints', selectedPhotos);
    });

    // アルバム注文
    document.getElementById('orderAlbumBtn').addEventListener('click', () => {
        document.body.removeChild(modal);
        showOrderScreen('album', selectedPhotos);
    });
}

// 選択された写真をダウンロード
async function downloadSelectedPhotos(selectedPhotos) {
    try {
        // 30枚チェック
        const maxSelections = currentGallery.max_selections || 30;
        if (selectedPhotos.length < maxSelections) {
            showErrorModal(
                'ダウンロードできません',
                `${maxSelections}枚選択した場合のみダウンロードできます。<br>現在の選択数: ${selectedPhotos.length}枚`
            );
            return;
        }

        // ダウンロード権限チェック
        const permission = await supabaseStorage.checkDownloadPermission(currentGallery.id);

        if (!permission.allowed) {
            if (permission.reason === 'data_expired') {
                showExpiredDataScreen();
                return;
            } else if (permission.reason === 'download_expired' && permission.needsPurchase) {
                showDownloadExpiredScreen(selectedPhotos);
                return;
            }
        }

        // ダウンロード準備中メッセージを表示
        const message = document.createElement('div');
        message.id = 'downloadMessage';
        message.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10001;
            text-align: center;
        `;
        message.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 10px;">📦</div>
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">ダウンロード準備中...</div>
            <div id="downloadProgress" style="color: #666;">0 / ${selectedPhotos.length}</div>
        `;
        document.body.appendChild(message);

        // JSZipを使用してZIPファイルを作成
        const zip = new JSZip();
        const folder = zip.folder('selected_photos');

        // 各写真をダウンロードしてZIPに追加
        let failedCount = 0;
        for (let i = 0; i < selectedPhotos.length; i++) {
            const photo = selectedPhotos[i];
            const progressEl = document.getElementById('downloadProgress');
            if (progressEl) {
                progressEl.textContent = `${i + 1} / ${selectedPhotos.length}`;
            }

            try {
                const response = await fetch(photo.url);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const blob = await response.blob();
                folder.file(photo.file_name, blob);
            } catch (error) {
                console.error(`写真 ${photo.file_name} のダウンロードエラー:`, error);
                failedCount++;
            }
        }

        if (failedCount > 0) {
            console.warn(`${failedCount}枚の写真のダウンロードに失敗しました`);
        }

        // ZIPファイルを生成（圧縮レベルを下げてメモリ使用量を削減）
        const progressEl = document.getElementById('downloadProgress');
        if (progressEl) {
            progressEl.textContent = 'ZIP生成中...';
        }

        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: {
                level: 6  // デフォルトの9から下げて高速化・メモリ削減
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

        // メッセージを削除
        document.body.removeChild(message);

        // ダウンロード後のアップセル画面を表示
        showPostDownloadUpsell(selectedPhotos);
    } catch (error) {
        console.error('ダウンロードエラー:', error);
        const msg = document.getElementById('downloadMessage');
        if (msg && msg.parentNode) {
            document.body.removeChild(msg);
        }

        // エラーの詳細を表示
        let errorMessage = 'ダウンロード中にエラーが発生しました。';

        if (error.name === 'QuotaExceededError' || error.message.includes('quota')) {
            errorMessage = 'デバイスの空き容量が不足しています。<br>空き容量を確保してから再度お試しください。';
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorMessage = 'ネットワークエラーが発生しました。<br>インターネット接続を確認して再度お試しください。';
        } else if (error.message.includes('Out of memory')) {
            errorMessage = 'メモリ不足のため処理できませんでした。<br>他のアプリを閉じてから再度お試しください。';
        } else {
            errorMessage += `<br><br>エラー詳細: ${error.message}`;
        }

        showErrorModal('ダウンロードエラー', errorMessage);
    }
}

// 注文画面を表示
function showOrderScreen(orderType, selectedPhotos) {
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

    const titles = {
        photobook: '📖 フォトブック注文',
        prints: '🖼️ 写真プリント注文',
        album: '📚 プレミアムアルバム注文'
    };

    const descriptions = {
        photobook: 'フォトブック注文機能は準備中です。',
        prints: '写真プリント注文機能は準備中です。',
        album: 'プレミアムアルバム注文機能は準備中です。'
    };

    content.innerHTML = `
        <div style="font-size: 80px; margin-bottom: 20px;">🚧</div>
        <h2 style="margin: 0 0 10px 0; color: #333;">${titles[orderType]}</h2>
        <p style="color: #666; margin: 20px 0;">
            ${descriptions[orderType]}<br>
            しばらくお待ちください。
        </p>
        <p style="color: #999; margin: 20px 0; font-size: 14px;">
            選択された写真: ${selectedPhotos.length}枚
        </p>
        <div style="margin-top: 30px; display: flex; gap: 10px;">
            <button id="downloadFromOrderBtn" class="btn btn-primary" style="flex: 1; padding: 15px;">
                📥 写真をダウンロード
            </button>
            <button id="closeOrderBtn" class="btn" style="flex: 1; padding: 15px; background: #6c757d;">
                閉じる
            </button>
        </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    document.getElementById('downloadFromOrderBtn').addEventListener('click', async () => {
        await downloadSelectedPhotos(selectedPhotos);
    });

    document.getElementById('closeOrderBtn').addEventListener('click', () => {
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

    // ボタンを無効化して再ダウンロードボタンに変更
    const submitBtn = document.getElementById('submitSelection');
    submitBtn.disabled = false;
    submitBtn.textContent = '選択した写真をダウンロード';
    submitBtn.className = 'btn btn-primary';

    // クリックイベントを上書き
    const newSubmitBtn = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);

    newSubmitBtn.addEventListener('click', async () => {
        // 選択済み写真を取得
        const selectedPhotos = currentPhotos.filter(p => selectedPhotoIds.has(p.id));
        await downloadSelectedPhotos(selectedPhotos);
    });

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
        message.innerHTML = '✅ 選択が確定されました。<br>下のボタンから写真をダウンロードできます。';
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

// ===== ダウンロード期限管理とアップセル =====

// データ期限切れ画面
function showExpiredDataScreen() {
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
        max-width: 500px;
        width: 100%;
        text-align: center;
    `;

    content.innerHTML = `
        <div style="font-size: 80px; margin-bottom: 20px;">⏰</div>
        <h2 style="margin: 0 0 10px 0; color: var(--notion-text);">データ保管期限終了</h2>
        <p style="color: var(--notion-text-secondary); margin: 20px 0;">
            このギャラリーのデータ保管期限が終了しました。<br>
            写真データは既に削除されています。
        </p>
        <p style="color: var(--notion-text-secondary); font-size: 14px; margin: 20px 0;">
            次回は早めのダウンロードをお勧めします。
        </p>
        <button onclick="window.location.reload()" class="btn btn-primary" style="margin-top: 20px;">
            戻る
        </button>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);
}

// ダウンロード期限切れ画面
function showDownloadExpiredScreen(selectedPhotos) {
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

    // ギャラリー情報から有効期限を計算
    const expiresAt = new Date(currentGallery.expires_at);
    const remainingDays = Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24));

    content.innerHTML = `
        <div style="font-size: 80px; margin-bottom: 20px;">💳</div>
        <h2 style="margin: 0 0 10px 0; color: var(--notion-text);">無料ダウンロード期間終了</h2>
        <p style="color: var(--notion-text-secondary); margin: 20px 0;">
            無料ダウンロード期間（7日間）が終了しました。<br>
            引き続きダウンロードするには追加ダウンロードパスが必要です。
        </p>

        <div style="background: var(--notion-bg-secondary); padding: 20px; border-radius: 8px; margin: 20px 0;">
            <div style="font-size: 24px; font-weight: bold; color: var(--notion-text); margin-bottom: 10px;">
                ¥500
            </div>
            <div style="color: var(--notion-text-secondary); font-size: 14px;">
                追加ダウンロードパス（1年間）
            </div>
        </div>

        <div style="text-align: left; margin: 20px 0; padding: 20px; background: #fff3cd; border-radius: 8px;">
            <div style="font-weight: bold; margin-bottom: 10px; color: #856404;">
                📌 データ保管期限
            </div>
            <div style="color: #856404; font-size: 14px;">
                残り ${remainingDays > 0 ? remainingDays + '日' : '期限切れ間近'}
            </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 30px;">
            <button id="purchasePassBtn" class="btn btn-primary" style="padding: 15px; font-size: 16px;">
                💳 追加ダウンロードパスを購入（¥500）
            </button>

            <div style="margin: 15px 0; color: var(--notion-text-secondary); font-size: 14px;">
                または、商品注文でダウンロード無料
            </div>

            <button id="orderPhotobookFromExpired" class="btn" style="padding: 12px; background: var(--notion-purple); color: white;">
                📖 フォトブックを注文する
            </button>

            <button id="closeExpiredBtn" class="btn" style="margin-top: 10px; background: var(--notion-hover);">
                閉じる
            </button>
        </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // イベントリスナー
    document.getElementById('purchasePassBtn').addEventListener('click', () => {
        // 決済処理（プレースホルダー）
        showErrorModal('準備中', '決済機能は準備中です。<br>実装時にStripeなどの決済サービスと連携します。');
    });

    document.getElementById('orderPhotobookFromExpired').addEventListener('click', () => {
        document.body.removeChild(modal);
        showOrderScreen('photobook', selectedPhotos);
    });

    document.getElementById('closeExpiredBtn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
}

// ダウンロード後のアップセル画面
function showPostDownloadUpsell(selectedPhotos) {
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
        max-width: 700px;
        width: 100%;
        text-align: center;
    `;

    content.innerHTML = `
        <div style="font-size: 80px; margin-bottom: 20px;">✅</div>
        <h2 style="margin: 0 0 10px 0; color: var(--notion-text);">ダウンロード完了！</h2>
        <p style="color: var(--notion-text-secondary); margin: 20px 0;">
            ${selectedPhotos.length}枚の写真をダウンロードしました。
        </p>

        <div style="background: var(--notion-bg-secondary); padding: 25px; border-radius: 8px; margin: 30px 0;">
            <div style="font-size: 18px; font-weight: 600; color: var(--notion-text); margin-bottom: 15px;">
                📸 思い出をカタチに
            </div>
            <p style="color: var(--notion-text-secondary); font-size: 14px; margin-bottom: 20px;">
                選んでいただいた写真で、素敵なフォトブックや<br>
                プリントを作成しませんか？
            </p>

            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                <button id="upsellPhotobookBtn" class="btn" style="padding: 12px 20px; background: var(--notion-purple); color: white;">
                    📖 フォトブック
                </button>
                <button id="upsellPrintsBtn" class="btn" style="padding: 12px 20px; background: var(--notion-blue); color: white;">
                    🖼️ プリント
                </button>
                <button id="upsellAlbumBtn" class="btn" style="padding: 12px 20px; background: var(--notion-green); color: white;">
                    📚 アルバム
                </button>
            </div>
        </div>

        <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <div style="font-size: 14px; color: #0c5aa6;">
                💡 再ダウンロードは7日間無料です
            </div>
        </div>

        <button id="closeUpsellBtn" class="btn" style="margin-top: 15px; background: var(--notion-hover);">
            今は注文しない
        </button>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // イベントリスナー
    document.getElementById('upsellPhotobookBtn').addEventListener('click', () => {
        document.body.removeChild(modal);
        showOrderScreen('photobook', selectedPhotos);
    });

    document.getElementById('upsellPrintsBtn').addEventListener('click', () => {
        document.body.removeChild(modal);
        showOrderScreen('prints', selectedPhotos);
    });

    document.getElementById('upsellAlbumBtn').addEventListener('click', () => {
        document.body.removeChild(modal);
        showOrderScreen('album', selectedPhotos);
    });

    document.getElementById('closeUpsellBtn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
}

