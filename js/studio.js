// スタジオ管理画面のロジック
let selectedFiles = [];

document.addEventListener('DOMContentLoaded', () => {
    initializeStudio();
});

function initializeStudio() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const createGalleryBtn = document.getElementById('createGallery');

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

    // クリックでファイル選択
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    // ギャラリー作成
    createGalleryBtn.addEventListener('click', createGallery);

    // 既存ギャラリーの読み込み
    loadGalleries();
}

async function handleFiles(files) {
    const fileArray = Array.from(files).filter(file => file.type.startsWith('image/'));

    for (const file of fileArray) {
        try {
            const base64 = await photoStorage.fileToBase64(file);
            const compressed = await photoStorage.compressImage(base64);

            selectedFiles.push({
                id: 'photo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                name: file.name,
                data: compressed,
                selected: false
            });
        } catch (error) {
            console.error('Error processing file:', error);
        }
    }

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
        img.src = file.data;
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

    createBtn.disabled = !(galleryName && selectedFiles.length > 0);
}

// ギャラリー名の入力監視
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('galleryName').addEventListener('input', updateCreateButton);
});

async function createGallery() {
    const galleryName = document.getElementById('galleryName').value.trim();
    const galleryPassword = document.getElementById('galleryPassword').value.trim();

    if (!galleryName || selectedFiles.length === 0) {
        alert('ギャラリー名と写真を入力してください');
        return;
    }

    const gallery = {
        id: photoStorage.generateId(),
        name: galleryName,
        password: galleryPassword || null,
        photos: selectedFiles,
        createdAt: new Date().toISOString(),
        selections: []
    };

    photoStorage.saveGallery(gallery);

    // フォームをリセット
    document.getElementById('galleryName').value = '';
    document.getElementById('galleryPassword').value = '';
    selectedFiles = [];
    updatePreview();
    updateCreateButton();

    // ギャラリーリストを更新
    loadGalleries();

    alert('ギャラリーを作成しました！');
}

function loadGalleries() {
    const galleries = photoStorage.getAllGalleries();
    const galleryList = document.getElementById('galleryList');

    if (galleries.length === 0) {
        galleryList.innerHTML = '<p class="empty-message">まだギャラリーがありません</p>';
        return;
    }

    galleryList.innerHTML = '';

    galleries.forEach(gallery => {
        const item = document.createElement('div');
        item.className = 'gallery-item';

        const selectedCount = gallery.photos.filter(p => p.selected).length;
        const hasPassword = gallery.password ? '🔒' : '';

        item.innerHTML = `
            <div class="gallery-info">
                <h3>${hasPassword} ${gallery.name}</h3>
                <div class="gallery-meta">
                    写真: ${gallery.photos.length}枚 |
                    選択済み: ${selectedCount}枚 |
                    作成日: ${new Date(gallery.createdAt).toLocaleDateString('ja-JP')}
                </div>
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
    });
}

function viewGallery(galleryId) {
    const url = `${window.location.origin}${window.location.pathname.replace('index.html', '')}client.html?gallery=${galleryId}`;

    navigator.clipboard.writeText(url).then(() => {
        alert('お客様用URLをコピーしました！\n\n' + url);
    }).catch(() => {
        prompt('お客様用URLをコピーしてください:', url);
    });
}

function viewResults(galleryId) {
    const gallery = photoStorage.getGallery(galleryId);
    if (!gallery) {
        alert('ギャラリーが見つかりません');
        return;
    }

    const selectedPhotos = gallery.photos.filter(p => p.selected);
    const message = `${gallery.name}\n\n全${gallery.photos.length}枚中、${selectedPhotos.length}枚が選択されています。`;

    if (selectedPhotos.length > 0) {
        if (confirm(message + '\n\n選択された写真を新しいタブで表示しますか？')) {
            showSelectedPhotos(selectedPhotos);
        }
    } else {
        alert(message);
    }
}

function showSelectedPhotos(photos) {
    const newWindow = window.open('', '_blank');
    newWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>選択された写真</title>
            <style>
                body { font-family: sans-serif; padding: 20px; background: #f5f5f5; }
                h1 { text-align: center; }
                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
                .photo { background: white; padding: 10px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
                img { width: 100%; border-radius: 4px; }
            </style>
        </head>
        <body>
            <h1>選択された写真 (${photos.length}枚)</h1>
            <div class="grid">
                ${photos.map((p, i) => `
                    <div class="photo">
                        <img src="${p.data}" alt="Photo ${i + 1}">
                    </div>
                `).join('')}
            </div>
        </body>
        </html>
    `);
}

function deleteGallery(galleryId) {
    if (confirm('このギャラリーを削除してもよろしいですか？')) {
        photoStorage.deleteGallery(galleryId);
        loadGalleries();
        alert('ギャラリーを削除しました');
    }
}
