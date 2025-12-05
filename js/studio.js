// スタジオ管理画面のロジック（Supabase対応版）
let selectedFiles = [];
let isUploading = false;

document.addEventListener('DOMContentLoaded', () => {
    initializeStudio();
});

function initializeStudio() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const createGalleryBtn = document.getElementById('createGallery');
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

    // ギャラリー作成
    createGalleryBtn.addEventListener('click', createGallery);

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
    updateCreateButton();
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
            updateCreateButton();
        };

        item.appendChild(img);
        item.appendChild(removeBtn);
        previewArea.appendChild(item);
    });
}

function updateCreateButton() {
    const createBtn = document.getElementById('createGallery');
    const galleryName = document.getElementById('galleryName').value.trim();

    createBtn.disabled = !(galleryName && selectedFiles.length > 0) || isUploading;
}

// ギャラリー名の入力監視
document.addEventListener('DOMContentLoaded', () => {
    const galleryNameInput = document.getElementById('galleryName');
    if (galleryNameInput) {
        galleryNameInput.addEventListener('input', updateCreateButton);
    }
});

async function createGallery() {
    const galleryName = document.getElementById('galleryName').value.trim();
    const galleryPassword = document.getElementById('galleryPassword').value.trim();

    if (!galleryName || selectedFiles.length === 0) {
        alert('ギャラリー名と写真を入力してください');
        return;
    }

    if (isUploading) {
        return;
    }

    isUploading = true;
    const createBtn = document.getElementById('createGallery');
    const originalText = createBtn.textContent;
    createBtn.disabled = true;

    try {
        // ギャラリーを作成
        createBtn.textContent = 'ギャラリー作成中...';
        const gallery = await supabaseStorage.createGallery({
            name: galleryName,
            password: galleryPassword || null
        });

        // 写真を1枚ずつアップロード
        const totalFiles = selectedFiles.length;
        for (let i = 0; i < totalFiles; i++) {
            const file = selectedFiles[i];
            createBtn.textContent = `アップロード中... (${i + 1}/${totalFiles})`;

            // 画像を圧縮
            const compressedFile = await supabaseStorage.compressImage(file);

            // Supabaseにアップロード
            await supabaseStorage.uploadPhoto(gallery.id, compressedFile);
        }

        // フォームをリセット
        document.getElementById('galleryName').value = '';
        document.getElementById('galleryPassword').value = '';
        document.getElementById('fileInput').value = '';
        selectedFiles = [];
        updatePreview();
        updateCreateButton();

        // ギャラリーリストを更新
        await loadGalleries();

        // メール文面を表示
        showEmailTemplate(gallery.id, galleryName, galleryPassword, totalFiles);

    } catch (error) {
        console.error('ギャラリー作成エラー:', error);
        alert('ギャラリーの作成中にエラーが発生しました。\nもう一度お試しください。');
    } finally {
        isUploading = false;
        createBtn.textContent = originalText;
        updateCreateButton();
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

            const passwordDisplay = gallery.password_hash ?
                `<div style="margin-top: 5px; font-size: 0.9em; color: #667eea;">パスワード: <strong>${gallery.password_hash}</strong></div>` : '';

            item.innerHTML = `
                <div class="gallery-info">
                    <h3>${hasPassword} ${gallery.name}</h3>
                    <div class="gallery-meta">
                        写真: ${photoCount}枚 |
                        選択済み: ${selectedPhotoIds.length}枚 |
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
        const galleryList = document.getElementById('galleryList');
        galleryList.innerHTML = '<p class="empty-message">ギャラリーの読み込みに失敗しました</p>';
    }
}

function viewGallery(galleryId) {
    const url = `${window.location.origin}${window.location.pathname.replace('index.html', '')}client.html?gallery=${galleryId}`;

    navigator.clipboard.writeText(url).then(() => {
        alert('お客様用URLをコピーしました！\n\n' + url);
    }).catch(() => {
        prompt('お客様用URLをコピーしてください:', url);
    });
}

async function viewResults(galleryId) {
    try {
        const gallery = await supabaseStorage.getGallery(galleryId);
        const photos = await supabaseStorage.getGalleryPhotos(galleryId);
        const selectedPhotoIds = await supabaseStorage.getSelections(galleryId);

        console.log('結果確認:', { gallery, photos: photos.length, selectedPhotoIds });

        if (!gallery) {
            alert('ギャラリーが見つかりません');
            return;
        }

        const selectedPhotos = photos.filter(p => selectedPhotoIds.includes(p.id));
        const message = `${gallery.name}\n\n全${photos.length}枚中、${selectedPhotos.length}枚が選択されています。`;

        if (selectedPhotos.length > 0) {
            if (confirm(message + '\n\n選択された写真を新しいタブで表示しますか？')) {
                showSelectedPhotos(selectedPhotos, gallery.name);
            }
        } else {
            alert(message);
        }
    } catch (error) {
        console.error('結果確認エラー詳細:', error);
        alert('結果の確認中にエラーが発生しました\n\nエラー: ' + (error.message || error));
    }
}

function showSelectedPhotos(photos, galleryName) {
    const newWindow = window.open('', '_blank');
    newWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${galleryName} - 選択された写真</title>
            <style>
                body { font-family: sans-serif; padding: 20px; background: #f5f5f5; margin: 0; }
                h1 { text-align: center; color: #333; }
                .grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 20px;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .photo {
                    background: white;
                    padding: 10px;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                img { width: 100%; border-radius: 4px; display: block; }
                .filename {
                    margin-top: 8px;
                    font-size: 0.9em;
                    color: #666;
                    text-align: center;
                    word-break: break-all;
                }
            </style>
        </head>
        <body>
            <h1>${galleryName} - 選択された写真 (${photos.length}枚)</h1>
            <div class="grid">
                ${photos.map((p, i) => `
                    <div class="photo">
                        <img src="${p.url}" alt="${p.file_name}" loading="lazy">
                        <div class="filename">${p.file_name}</div>
                    </div>
                `).join('')}
            </div>
        </body>
        </html>
    `);
}

async function deleteGallery(galleryId) {
    if (!confirm('このギャラリーを削除してもよろしいですか？\n\n※ 写真とすべての選択情報も削除されます。')) {
        return;
    }

    try {
        await supabaseStorage.deleteGallery(galleryId);
        await loadGalleries();
        alert('ギャラリーを削除しました');
    } catch (error) {
        console.error('ギャラリー削除エラー:', error);
        alert('ギャラリーの削除中にエラーが発生しました');
    }
}

// パスワード生成関数（8文字、覚えやすい英数字）
function generateRandomPassword() {
    const chars = 'abcdefghijkmnopqrstuvwxyz23456789'; // 紛らわしい文字を除外 (l, 1, 0, o)
    const length = 8;
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

// メール文面テンプレートを表示
function showEmailTemplate(galleryId, galleryName, password, photoCount) {
    const url = `${window.location.origin}${window.location.pathname.replace('index.html', '')}client.html?gallery=${galleryId}`;

    const passwordText = password ? `パスワード: ${password}\n` : '';
    const emailBody = `${galleryName}様

いつもご利用いただきありがとうございます。
撮影写真をアップロードいたしました。

以下のURLより写真をご確認いただき、お気に入りの写真を最大30枚までお選びください。

【写真選択ページ】
${url}

${passwordText}
【写真枚数】
${photoCount}枚

【選択期限】
ご都合の良い時にお選びください

ご不明な点がございましたら、お気軽にお問い合わせください。

よろしくお願いいたします。`;

    // モーダルを表示
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
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
        max-height: 80vh;
        overflow-y: auto;
    `;

    content.innerHTML = `
        <h2 style="margin-top: 0; color: #333;">✅ ギャラリー作成完了</h2>
        <p style="color: #666;">お客様への送信用メール文面です。必要に応じて編集してお使いください。</p>
        <textarea id="emailTemplate" style="width: 100%; min-height: 300px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; font-family: sans-serif; font-size: 14px; line-height: 1.6; resize: vertical;">${emailBody}</textarea>
        <div style="margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
            <button id="copyEmailBtn" class="btn btn-primary" style="flex: 1; min-width: 150px;">📋 メール文面をコピー</button>
            <button id="copyUrlBtn" class="btn" style="flex: 1; min-width: 150px;">🔗 URLのみコピー</button>
            <button id="closeModalBtn" class="btn" style="background: #e53e3e; color: white;">閉じる</button>
        </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // イベントリスナー
    document.getElementById('copyEmailBtn').addEventListener('click', () => {
        const textarea = document.getElementById('emailTemplate');
        textarea.select();
        navigator.clipboard.writeText(textarea.value).then(() => {
            alert('メール文面をコピーしました！');
        });
    });

    document.getElementById('copyUrlBtn').addEventListener('click', () => {
        navigator.clipboard.writeText(url).then(() => {
            alert('URLをコピーしました！');
        });
    });

    document.getElementById('closeModalBtn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}
