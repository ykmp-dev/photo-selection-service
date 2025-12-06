// スタジオ管理画面のロジック（Supabase対応版 - カテゴリ対応）
let selectedFiles = [];
let isUploading = false;
let currentGallery = null; // 作成中のギャラリー

document.addEventListener('DOMContentLoaded', () => {
    initializeStudio();
});

function initializeStudio() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const createGalleryBtn = document.getElementById('createGalleryBtn');
    const addPhotosBtn = document.getElementById('addPhotosBtn');
    const finalizeGalleryBtn = document.getElementById('finalizeGalleryBtn');
    const generatePasswordBtn = document.getElementById('generatePassword');

    // パスワード自動生成
    generatePasswordBtn.addEventListener('click', () => {
        const password = generateRandomPassword();
        document.getElementById('galleryPassword').value = password;
    });

    // 全カット納品モードのトグル
    const allPhotosDeliveryCheckbox = document.getElementById('allPhotosDelivery');
    const maxSelectionsGroup = document.getElementById('maxSelectionsGroup');
    const maxSelectionsInput = document.getElementById('maxSelections');

    allPhotosDeliveryCheckbox.addEventListener('change', () => {
        if (allPhotosDeliveryCheckbox.checked) {
            maxSelectionsGroup.style.opacity = '0.5';
            maxSelectionsInput.disabled = true;
        } else {
            maxSelectionsGroup.style.opacity = '1';
            maxSelectionsInput.disabled = false;
        }
    });

    // ドラッグ&ドロップイベント
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });

    // クリックでファイル選択（labelクリックは除外）
    uploadArea.addEventListener('click', (e) => {
        // labelタグからのクリックは無視（labelが自動的にfileInputを開く）
        if (e.target.tagName === 'LABEL' || e.target.closest('label')) {
            return;
        }
        if (!isUploading) {
            fileInput.click();
        }
    });

    fileInput.addEventListener('change', (e) => {
        console.log('ファイル選択イベント発火:', e.target.files.length, '個のファイル');
        if (e.target.files.length === 0) {
            console.log('ファイルが選択されませんでした');
            return;
        }
        handleFiles(e.target.files);
    });

    // ギャラリー名入力監視
    const galleryNameInput = document.getElementById('galleryName');
    if (galleryNameInput) {
        galleryNameInput.addEventListener('input', () => {
            const galleryName = galleryNameInput.value.trim();
            createGalleryBtn.disabled = !galleryName;
        });
    }

    // イベントリスナー
    createGalleryBtn.addEventListener('click', createGallery);
    addPhotosBtn.addEventListener('click', addPhotosToGallery);
    finalizeGalleryBtn.addEventListener('click', finalizeGallery);

    // 既存ギャラリーの読み込み
    loadGalleries();
}

function handleFiles(files) {
    console.log('handleFiles呼び出し:', files.length, '個のファイル');
    const fileArray = Array.from(files).filter(file => file.type.startsWith('image/'));
    console.log('画像ファイル:', fileArray.length, '個');

    if (fileArray.length === 0) {
        alert('画像ファイルが選択されませんでした。\nJPG、PNG、GIF形式の画像を選択してください。');
        return;
    }

    fileArray.forEach(file => {
        selectedFiles.push(file);
        console.log('追加:', file.name, file.type, file.size, 'bytes');
    });

    console.log('合計選択:', selectedFiles.length, '個');
    updatePreview();
    updateAddButton();
}

function updatePreview() {
    const previewArea = document.getElementById('previewArea');
    previewArea.innerHTML = '';

    selectedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'preview-item';

        const img = document.createElement('img');
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        img.alt = file.name;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = '×';
        removeBtn.onclick = () => {
            selectedFiles.splice(index, 1);
            updatePreview();
            updateAddButton();
        };

        item.appendChild(img);
        item.appendChild(removeBtn);
        previewArea.appendChild(item);
    });
}

function updateAddButton() {
    const addBtn = document.getElementById('addPhotosBtn');
    const category = document.getElementById('photoCategory').value.trim();
    addBtn.disabled = !(selectedFiles.length > 0 && category) || isUploading;
}

// カテゴリ入力監視
document.addEventListener('DOMContentLoaded', () => {
    const categoryInput = document.getElementById('photoCategory');
    if (categoryInput) {
        categoryInput.addEventListener('input', updateAddButton);
    }
});

// ステップ1: ギャラリー基本情報のみ作成
async function createGallery() {
    const galleryName = document.getElementById('galleryName').value.trim();
    const galleryPassword = document.getElementById('galleryPassword').value.trim();
    const allPhotosDelivery = document.getElementById('allPhotosDelivery').checked;
    const maxSelections = allPhotosDelivery ? null : (parseInt(document.getElementById('maxSelections').value) || 30);

    if (!galleryName) {
        alert('ギャラリー名を入力してください');
        return;
    }

    if (!allPhotosDelivery && (maxSelections < 1 || maxSelections > 100)) {
        alert('選択可能枚数は1〜100枚の範囲で指定してください');
        return;
    }

    const createBtn = document.getElementById('createGalleryBtn');
    const originalText = createBtn.textContent;
    createBtn.disabled = true;
    createBtn.textContent = 'ギャラリー作成中...';

    try {
        // ギャラリーを作成（写真はまだ追加しない）
        const gallery = await supabaseStorage.createGallery({
            name: galleryName,
            password: galleryPassword || null,
            maxSelections: maxSelections,
            allPhotosDelivery: allPhotosDelivery
        });

        currentGallery = gallery;

        // ステップ1を非表示、ステップ2を表示
        document.getElementById('createSection').style.display = 'none';
        document.getElementById('uploadSection').style.display = 'block';

        // 現在のギャラリー情報を表示
        updateCurrentGalleryInfo();

        alert(`✅ ギャラリー「${galleryName}」を作成しました！\n次に写真をカテゴリ毎に追加してください。`);

    } catch (error) {
        console.error('ギャラリー作成エラー:', error);
        alert('ギャラリーの作成中にエラーが発生しました。\nもう一度お試しください。');
    } finally {
        createBtn.disabled = false;
        createBtn.textContent = originalText;
    }
}

// ステップ2: カテゴリ付きで写真を追加
async function addPhotosToGallery() {
    if (!currentGallery) {
        alert('先にギャラリーを作成してください');
        return;
    }

    const category = document.getElementById('photoCategory').value.trim();

    if (!category || selectedFiles.length === 0) {
        alert('カテゴリ名と写真を入力してください');
        return;
    }

    if (isUploading) {
        return;
    }

    isUploading = true;
    const addBtn = document.getElementById('addPhotosBtn');
    const originalText = addBtn.textContent;
    addBtn.disabled = true;

    try {
        const totalFiles = selectedFiles.length;
        for (let i = 0; i < totalFiles; i++) {
            const file = selectedFiles[i];
            addBtn.textContent = `アップロード中... (${i + 1}/${totalFiles})`;

            // EXIFメタデータからレーティングを抽出
            let rating = 0;
            try {
                if (window.exifr) {
                    const exifData = await exifr.parse(file, {
                        xmp: true,
                        iptc: true,
                        ifd0: true,
                        exif: true
                    });

                    // XMP Rating または IPTC Rating を取得
                    rating = exifData?.Rating || exifData?.rating || 0;
                    console.log(`${file.name} のレーティング:`, rating);
                }
            } catch (exifError) {
                console.log(`${file.name} のEXIF読み取りエラー:`, exifError);
                // エラーの場合は rating = 0 のまま続行
            }

            // 画像を圧縮
            const compressedFile = await supabaseStorage.compressImage(file);

            // Supabaseにアップロード（カテゴリ付き）
            await supabaseStorage.uploadPhoto(currentGallery.id, compressedFile, {
                rating: rating,
                category: category
            });
        }

        // プレビューをクリア
        selectedFiles = [];
        document.getElementById('fileInput').value = '';
        document.getElementById('photoCategory').value = '';
        updatePreview();
        updateAddButton();

        // ギャラリー情報を更新
        await updateCurrentGalleryInfo();

        alert(`✅ ${totalFiles}枚の写真を「${category}」カテゴリで追加しました！\n\n続けて別のカテゴリの写真を追加するか、「完了してURLを取得」ボタンを押してください。`);

    } catch (error) {
        console.error('写真追加エラー:', error);
        alert('写真の追加中にエラーが発生しました。\nもう一度お試しください。');
    } finally {
        isUploading = false;
        addBtn.textContent = originalText;
        updateAddButton();
    }
}

// 現在のギャラリー情報を更新表示
async function updateCurrentGalleryInfo() {
    if (!currentGallery) return;

    try {
        // 写真一覧を取得してカテゴリ毎にグループ化
        const photos = await supabaseStorage.getGalleryPhotos(currentGallery.id);
        const categoryGroups = {};
        photos.forEach(photo => {
            const cat = photo.category || '未分類';
            if (!categoryGroups[cat]) {
                categoryGroups[cat] = [];
            }
            categoryGroups[cat].push(photo);
        });

        const infoDiv = document.getElementById('currentGalleryInfo');
        const deliveryModeText = currentGallery.all_photos_delivery
            ? '<p style="margin: 0 0 10px 0;"><strong>配信モード:</strong> 🎁 全カット納品</p>'
            : `<p style="margin: 0 0 10px 0;"><strong>選択可能枚数:</strong> ${currentGallery.max_selections || 30}枚</p>`;

        infoDiv.innerHTML = `
            <p style="margin: 0 0 10px 0;"><strong>名前:</strong> ${currentGallery.name}</p>
            ${deliveryModeText}
            <p style="margin: 0 0 15px 0;"><strong>追加済み写真:</strong> ${photos.length}枚</p>
            <div id="categoryAccordion"></div>
        `;

        // カテゴリごとのアコーディオンを作成
        const accordion = document.getElementById('categoryAccordion');
        Object.entries(categoryGroups).forEach(([category, categoryPhotos]) => {
            const categorySection = createCategorySection(category, categoryPhotos);
            accordion.appendChild(categorySection);
        });

    } catch (error) {
        console.error('ギャラリー情報取得エラー:', error);
    }
}

// カテゴリセクションを作成（トグル展開可能）
function createCategorySection(category, photos) {
    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom: 15px; border: 1px solid var(--notion-border); border-radius: 8px; overflow: hidden;';

    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; background: var(--notion-hover); cursor: pointer; user-select: none;';
    header.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span class="toggle-icon" style="font-size: 12px; transition: transform 0.2s;">▶</span>
            <strong>${category}</strong>
            <span style="color: var(--notion-text-secondary); font-size: 14px;">(${photos.length}枚)</span>
        </div>
        <div>
            <button class="btn add-to-category-btn" style="padding: 4px 12px; font-size: 13px; margin-right: 8px;">📷 追加</button>
            <button class="btn delete-selected-btn" style="padding: 4px 12px; font-size: 13px; background: var(--notion-red); color: white;">🗑️ 選択削除</button>
        </div>
    `;

    const content = document.createElement('div');
    content.style.cssText = 'display: none; padding: 15px; background: white;';
    content.className = 'category-content';

    // 写真グリッド
    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 8px;';

    photos.forEach(photo => {
        const item = document.createElement('div');
        item.style.cssText = 'position: relative; aspect-ratio: 1; border: 2px solid transparent; border-radius: 4px; overflow: hidden;';
        item.className = 'photo-tile';
        item.dataset.photoId = photo.id;

        item.innerHTML = `
            <img src="${photo.url}" style="width: 100%; height: 100%; object-fit: cover;">
            <input type="checkbox" class="photo-checkbox" data-photo-id="${photo.id}" style="position: absolute; top: 4px; right: 4px; width: 18px; height: 18px; cursor: pointer;">
        `;

        grid.appendChild(item);
    });

    content.appendChild(grid);
    section.appendChild(header);
    section.appendChild(content);

    // トグル機能
    const toggleIcon = header.querySelector('.toggle-icon');
    let isOpen = false;

    header.addEventListener('click', (e) => {
        // ボタンクリックは無視
        if (e.target.closest('button')) return;

        isOpen = !isOpen;
        content.style.display = isOpen ? 'block' : 'none';
        toggleIcon.style.transform = isOpen ? 'rotate(90deg)' : 'rotate(0deg)';
    });

    // 追加ボタン
    header.querySelector('.add-to-category-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        showAddPhotosDialog(category);
    });

    // 削除ボタン
    header.querySelector('.delete-selected-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        const checkboxes = content.querySelectorAll('.photo-checkbox:checked');
        if (checkboxes.length === 0) {
            alert('削除する写真を選択してください');
            return;
        }

        if (!confirm(`${checkboxes.length}枚の写真を削除しますか？`)) {
            return;
        }

        try {
            for (const checkbox of checkboxes) {
                const photoId = checkbox.dataset.photoId;
                const photo = photos.find(p => p.id === photoId);
                if (photo) {
                    // Storageから削除
                    await supabaseStorage.supabase.storage
                        .from(supabaseStorage.bucket)
                        .remove([photo.file_path]);

                    // DBから削除
                    await supabaseStorage.supabase
                        .from('photos')
                        .delete()
                        .eq('id', photoId);
                }
            }

            alert(`✅ ${checkboxes.length}枚の写真を削除しました`);
            await updateCurrentGalleryInfo();
        } catch (error) {
            console.error('削除エラー:', error);
            alert('削除に失敗しました');
        }
    });

    return section;
}

// カテゴリに写真を追加するダイアログ
function showAddPhotosDialog(category) {
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
        max-width: 600px;
        width: 100%;
    `;

    content.innerHTML = `
        <h2 style="margin-top: 0;">「${category}」に写真を追加</h2>
        <div class="upload-area" id="dialogUploadArea" style="margin: 20px 0; padding: 40px; border: 2px dashed var(--notion-border); border-radius: 8px; text-align: center; cursor: pointer;">
            <div style="font-size: 48px; margin-bottom: 10px;">📁</div>
            <p>写真をドラッグ&ドロップ</p>
            <p style="color: var(--notion-text-secondary); font-size: 14px;">または</p>
            <label for="dialogFileInput" class="btn btn-primary" style="cursor: pointer; margin-top: 10px;">ファイルを選択</label>
            <input type="file" id="dialogFileInput" multiple accept="image/*" style="display: none;">
        </div>
        <div id="dialogPreviewArea" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 8px; margin: 20px 0;"></div>
        <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button id="dialogCancelBtn" class="btn" style="flex: 1;">キャンセル</button>
            <button id="dialogUploadBtn" class="btn btn-primary" style="flex: 1;" disabled>アップロード</button>
        </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    let dialogSelectedFiles = [];

    const dialogFileInput = document.getElementById('dialogFileInput');
    const dialogUploadArea = document.getElementById('dialogUploadArea');
    const dialogPreviewArea = document.getElementById('dialogPreviewArea');
    const dialogUploadBtn = document.getElementById('dialogUploadBtn');

    const handleDialogFiles = (files) => {
        const fileArray = Array.from(files).filter(file => file.type.startsWith('image/'));
        dialogSelectedFiles.push(...fileArray);

        // プレビュー更新
        dialogPreviewArea.innerHTML = '';
        dialogSelectedFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.style.cssText = 'position: relative; aspect-ratio: 1;';

            const img = document.createElement('img');
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
            img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; border-radius: 4px;';

            const removeBtn = document.createElement('button');
            removeBtn.textContent = '×';
            removeBtn.style.cssText = 'position: absolute; top: 2px; right: 2px; background: var(--notion-red); color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 14px; line-height: 1;';
            removeBtn.onclick = () => {
                dialogSelectedFiles.splice(index, 1);
                handleDialogFiles([]);
            };

            item.appendChild(img);
            item.appendChild(removeBtn);
            dialogPreviewArea.appendChild(item);
        });

        dialogUploadBtn.disabled = dialogSelectedFiles.length === 0;
    };

    dialogFileInput.addEventListener('change', (e) => {
        handleDialogFiles(e.target.files);
    });

    dialogUploadArea.addEventListener('click', () => {
        dialogFileInput.click();
    });

    dialogUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dialogUploadArea.style.borderColor = 'var(--notion-blue)';
    });

    dialogUploadArea.addEventListener('dragleave', () => {
        dialogUploadArea.style.borderColor = 'var(--notion-border)';
    });

    dialogUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dialogUploadArea.style.borderColor = 'var(--notion-border)';
        handleDialogFiles(e.dataTransfer.files);
    });

    document.getElementById('dialogCancelBtn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    dialogUploadBtn.addEventListener('click', async () => {
        dialogUploadBtn.disabled = true;
        dialogUploadBtn.textContent = 'アップロード中...';

        try {
            for (let i = 0; i < dialogSelectedFiles.length; i++) {
                const file = dialogSelectedFiles[i];
                dialogUploadBtn.textContent = `アップロード中... (${i + 1}/${dialogSelectedFiles.length})`;

                // EXIF読み取り
                let rating = 0;
                try {
                    if (window.exifr) {
                        const exifData = await exifr.parse(file, {
                            xmp: true,
                            iptc: true,
                            ifd0: true,
                            exif: true
                        });
                        rating = exifData?.Rating || exifData?.rating || 0;
                    }
                } catch (exifError) {
                    console.log('EXIF読み取りエラー:', exifError);
                }

                const compressedFile = await supabaseStorage.compressImage(file);
                await supabaseStorage.uploadPhoto(currentGallery.id, compressedFile, {
                    rating: rating,
                    category: category
                });
            }

            alert(`✅ ${dialogSelectedFiles.length}枚の写真を追加しました`);
            document.body.removeChild(modal);
            await updateCurrentGalleryInfo();
        } catch (error) {
            console.error('アップロードエラー:', error);
            alert('アップロードに失敗しました');
        }
    });
}

// ステップ3: 確定してURLを取得
async function finalizeGallery() {
    if (!currentGallery) {
        alert('先にギャラリーを作成してください');
        return;
    }

    // 写真が追加されているか確認
    try {
        const photos = await supabaseStorage.getGalleryPhotos(currentGallery.id);
        if (photos.length === 0) {
            if (!confirm('まだ写真が1枚も追加されていません。\nこのまま確定しますか？')) {
                return;
            }
        }

        // メール文面を表示
        showEmailTemplate(
            currentGallery.id,
            currentGallery.name,
            currentGallery.plainPassword || '',
            photos.length,
            currentGallery.max_selections || 30
        );

        // ギャラリーリストを更新
        await loadGalleries();

        // フォームをリセット
        document.getElementById('createSection').style.display = 'block';
        document.getElementById('uploadSection').style.display = 'none';
        document.getElementById('galleryName').value = '';
        document.getElementById('galleryPassword').value = '';
        document.getElementById('maxSelections').value = '30';
        currentGallery = null;

    } catch (error) {
        console.error('確定エラー:', error);
        alert('確定処理中にエラーが発生しました。');
    }
}

async function loadGalleries() {
    try {
        const galleries = await supabaseStorage.getAllGalleries();
        const galleryList = document.getElementById('galleryList');

        if (galleries.length === 0) {
            galleryList.innerHTML = '<p class="empty-message">まだギャラリーがありません</p>';
            return;
        }

        galleryList.innerHTML = '';

        for (const gallery of galleries) {
            // 選択情報を取得
            const selectedPhotoIds = await supabaseStorage.getSelections(gallery.id);
            const photoCount = gallery.photos?.[0]?.count || 0;
            const hasPassword = gallery.password_hash ? '🔒' : '';

            const item = document.createElement('div');
            item.className = 'gallery-item';

            const passwordDisplay = gallery.decryptedPassword ?
                `<div style="margin-top: 5px; font-size: 0.9em; color: #667eea;">パスワード: <strong>${gallery.decryptedPassword}</strong></div>` : '';

            // 全カット納品モードか通常モードかで表示を変更
            const deliveryInfo = gallery.all_photos_delivery
                ? '🎁 全カット納品'
                : `選択済み: ${selectedPhotoIds.length}/${gallery.max_selections || 30}枚`;

            item.innerHTML = `
                <div class="gallery-info">
                    <h3>${hasPassword} ${gallery.name}</h3>
                    <div class="gallery-meta">
                        写真: ${photoCount}枚 |
                        ${deliveryInfo} |
                        作成日: ${new Date(gallery.created_at).toLocaleDateString('ja-JP')}
                    </div>
                    ${passwordDisplay}
                </div>
                <div class="gallery-actions">
                    <button class="btn btn-primary" onclick="viewGallery('${gallery.id}')">
                        URLをコピー
                    </button>
                    <button class="btn" onclick="viewResults('${gallery.id}')">
                        結果確認
                    </button>
                    <button class="btn" onclick="deleteGallery('${gallery.id}')" style="background: #e53e3e;">
                        削除
                    </button>
                </div>
            `;

            galleryList.appendChild(item);
        }
    } catch (error) {
        console.error('ギャラリー一覧取得エラー:', error);
    }
}

function viewGallery(galleryId) {
    const url = `${window.location.origin}${window.location.pathname.replace('index.html', '')}client.html?gallery=${galleryId}`;
    navigator.clipboard.writeText(url).then(() => {
        alert('✅ お客様用URLをクリップボードにコピーしました！\n\n' + url);
    }).catch(err => {
        alert('URL: ' + url);
    });
}

async function viewResults(galleryId) {
    try {
        const selectedPhotoIds = await supabaseStorage.getSelections(galleryId);
        const photos = await supabaseStorage.getGalleryPhotos(galleryId);
        const selectedPhotos = photos.filter(p => selectedPhotoIds.includes(p.id));

        if (selectedPhotoIds.length === 0) {
            alert('まだ写真が選択されていません');
            return;
        }

        alert(`選択された写真: ${selectedPhotoIds.length}枚\n\nファイル名:\n${selectedPhotos.map(p => p.file_name).join('\n')}`);
    } catch (error) {
        console.error('結果確認エラー:', error);
        alert('結果の取得に失敗しました');
    }
}

async function deleteGallery(galleryId) {
    if (!confirm('本当にこのギャラリーを削除しますか？\n写真データも全て削除されます。')) {
        return;
    }

    try {
        await supabaseStorage.deleteGallery(galleryId);
        await loadGalleries();
        alert('✅ ギャラリーを削除しました');
    } catch (error) {
        console.error('削除エラー:', error);
        alert('削除に失敗しました');
    }
}

function showEmailTemplate(galleryId, galleryName, password, photoCount, maxSelections) {
    const url = `${window.location.origin}${window.location.pathname.replace('index.html', '')}client.html?gallery=${galleryId}`;

    const passwordText = password ? `パスワード: ${password}` : 'パスワード: なし';

    const emailBody = `
${galleryName} 様

お撮影いただきました写真をご確認いただけるようになりました。
下記URLより、お気に入りの写真を${maxSelections}枚お選びください。

【写真選択URL】
${url}

${passwordText}

写真枚数: ${photoCount}枚
選択可能枚数: ${maxSelections}枚

※選択期限: 〇〇日まで

ご不明点がございましたら、お気軽にお問い合わせください。
    `.trim();

    // モーダル表示
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
        max-width: 700px;
        width: 100%;
    `;

    content.innerHTML = `
        <h2 style="margin-top: 0;">📧 お客様へ送信するメール文面</h2>
        <textarea id="emailTemplateText" style="width: 100%; height: 400px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 14px; line-height: 1.6;">${emailBody}</textarea>
        <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button id="copyEmailBtn" class="btn btn-primary" style="flex: 1;">
                📋 コピー
            </button>
            <button id="closeEmailBtn" class="btn" style="flex: 1;">
                閉じる
            </button>
        </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    document.getElementById('copyEmailBtn').addEventListener('click', () => {
        const textarea = document.getElementById('emailTemplateText');
        textarea.select();
        navigator.clipboard.writeText(textarea.value).then(() => {
            alert('✅ メール文面をコピーしました！');
        });
    });

    document.getElementById('closeEmailBtn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

function generateRandomPassword() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}
