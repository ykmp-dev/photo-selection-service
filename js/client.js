// お客様向け選択画面のロジック
let currentGallery = null;
let currentPhotoIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
    initializeClient();
});

function initializeClient() {
    const urlParams = new URLSearchParams(window.location.search);
    const galleryId = urlParams.get('gallery');

    if (!galleryId) {
        document.body.innerHTML = '<div style="text-align: center; padding: 50px;"><h1>無効なURLです</h1><p>ギャラリーIDが指定されていません。</p></div>';
        return;
    }

    const gallery = photoStorage.getGallery(galleryId);

    if (!gallery) {
        document.body.innerHTML = '<div style="text-align: center; padding: 50px;"><h1>ギャラリーが見つかりません</h1><p>このギャラリーは削除されたか、存在しません。</p></div>';
        return;
    }

    currentGallery = gallery;

    // パスワード確認
    if (gallery.password) {
        setupPasswordAuth();
    } else {
        showGallery();
    }
}

function setupPasswordAuth() {
    const authSection = document.getElementById('authSection');
    const authButton = document.getElementById('authButton');
    const passwordInput = document.getElementById('passwordInput');
    const authError = document.getElementById('authError');

    authButton.addEventListener('click', () => {
        const enteredPassword = passwordInput.value;

        if (enteredPassword === currentGallery.password) {
            authSection.style.display = 'none';
            showGallery();
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

function showGallery() {
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('galleryTitle').textContent = currentGallery.name;

    updatePhotoGrid();
    updateSelectionCount();

    // イベントリスナー
    document.getElementById('submitSelection').addEventListener('click', submitSelection);

    // ライトボックスの設定
    setupLightbox();
}

function updatePhotoGrid() {
    const photoGrid = document.getElementById('photoGrid');
    photoGrid.innerHTML = '';

    currentGallery.photos.forEach((photo, index) => {
        const item = document.createElement('div');
        item.className = 'photo-item' + (photo.selected ? ' selected' : '');

        const img = document.createElement('img');
        img.src = photo.data;
        img.alt = `Photo ${index + 1}`;

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

function togglePhotoSelection(index) {
    currentGallery.photos[index].selected = !currentGallery.photos[index].selected;
    updatePhotoGrid();
    updateSelectionCount();
}

function updateSelectionCount() {
    const selectedCount = currentGallery.photos.filter(p => p.selected).length;
    document.getElementById('selectedCount').textContent = selectedCount;
    document.getElementById('totalCount').textContent = currentGallery.photos.length;
}

function submitSelection() {
    const selectedCount = currentGallery.photos.filter(p => p.selected).length;

    if (selectedCount === 0) {
        if (!confirm('写真が1枚も選択されていません。このまま送信しますか？')) {
            return;
        }
    }

    // ギャラリーを保存
    photoStorage.saveGallery(currentGallery);

    alert(`選択を送信しました！\n\n選択枚数: ${selectedCount}枚 / ${currentGallery.photos.length}枚\n\nありがとうございました。`);

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

    lightboxImg.src = currentGallery.photos[index].data;
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
        currentPhotoIndex = currentGallery.photos.length - 1;
    } else if (currentPhotoIndex >= currentGallery.photos.length) {
        currentPhotoIndex = 0;
    }

    const lightboxImg = document.getElementById('lightboxImg');
    lightboxImg.src = currentGallery.photos[currentPhotoIndex].data;

    updateLightboxSelection();
}

function updateLightboxSelection() {
    const toggleBtn = document.getElementById('toggleSelection');
    const isSelected = currentGallery.photos[currentPhotoIndex].selected;

    if (isSelected) {
        toggleBtn.textContent = '選択解除 ✓';
        toggleBtn.style.background = '#48bb78';
    } else {
        toggleBtn.textContent = '選択する';
        toggleBtn.style.background = '#667eea';
    }
}
