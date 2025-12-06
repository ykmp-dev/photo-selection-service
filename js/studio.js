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
    const maxSelections = parseInt(document.getElementById('maxSelections').value) || 30;

    if (!galleryName) {
        alert('ギャラリー名を入力してください');
        return;
    }

    if (maxSelections < 1 || maxSelections > 100) {
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
            maxSelections: maxSelections
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
        // 写真一覧を取得してカテゴリ毎に集計
        const photos = await supabaseStorage.getGalleryPhotos(currentGallery.id);
        const categoryCount = {};
        photos.forEach(photo => {
            const cat = photo.category || '未分類';
            categoryCount[cat] = (categoryCount[cat] || 0) + 1;
        });

        const categoryListHTML = Object.entries(categoryCount)
            .map(([cat, count]) => `<li>${cat}: ${count}枚</li>`)
            .join('');

        const infoDiv = document.getElementById('currentGalleryInfo');
        infoDiv.innerHTML = `
            <p style="margin: 0 0 10px 0;"><strong>名前:</strong> ${currentGallery.name}</p>
            <p style="margin: 0 0 10px 0;"><strong>選択可能枚数:</strong> ${currentGallery.max_selections || 30}枚</p>
            <p style="margin: 0 0 5px 0;"><strong>追加済み写真:</strong> ${photos.length}枚</p>
            ${categoryListHTML ? `<ul style="margin: 5px 0 0 20px; padding: 0;">${categoryListHTML}</ul>` : ''}
        `;
    } catch (error) {
        console.error('ギャラリー情報取得エラー:', error);
    }
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

            item.innerHTML = `
                <div class="gallery-info">
                    <h3>${hasPassword} ${gallery.name}</h3>
                    <div class="gallery-meta">
                        写真: ${photoCount}枚 |
                        選択済み: ${selectedPhotoIds.length}/${gallery.max_selections || 30}枚 |
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
