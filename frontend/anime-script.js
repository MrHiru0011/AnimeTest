// ===== CONFIG =====
const API_URL = 'http://localhost:5000';
let currentAnime = null;
let library = [];

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎬 HilzNime Loading...');
    await loadLibrary();
    updateStats();
    
    // File input label
    document.getElementById('videoFile').addEventListener('change', (e) => {
        const fileName = e.target.files[0]?.name || 'Pilih file video...';
        document.getElementById('fileLabel').textContent = fileName;
    });
    
    // Upload form
    document.getElementById('uploadForm').addEventListener('submit', handleUpload);
});

// ===== LOAD LIBRARY =====
async function loadLibrary() {
    try {
        const response = await fetch(`${API_URL}/api/library`);
        const data = await response.json();
        library = data.anime || [];
        renderAnimeCards();
        renderWatchlist();
    } catch (err) {
        console.error('Error loading library:', err);
        showNotification('Gagal load library', 'error');
    }
}

// ===== RENDER ANIME CARDS =====
function renderAnimeCards() {
    const grid = document.getElementById('animeGrid');
    grid.innerHTML = '';
    
    library.forEach(anime => {
        const card = document.createElement('div');
        card.className = 'anime-card';
        card.innerHTML = `
            <div class="anime-card-image">🎬</div>
            <div class="anime-card-content">
                <div class="anime-card-title">${anime.title}</div>
                <div class="anime-card-episode">Episode ${anime.episode}</div>
                <div class="anime-card-progress">
                    <div class="anime-card-progress-bar" style="width: ${anime.progress}%"></div>
                </div>
                <div class="anime-card-rating">
                    ${anime.rating > 0 ? '⭐ ' + anime.rating + '/5' : 'Belum di-rate'}
                </div>
                <div class="anime-card-buttons">
                    <button class="btn-small" onclick="playAnime(${anime.id})">▶️ Play</button>
                    <button class="btn-small" onclick="addToWatchlist(${anime.id})">➕ Watchlist</button>
                    <button class="btn-small danger" onclick="deleteAnime(${anime.id})">🗑️ Hapus</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
    
    if (library.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-secondary); padding: 40px; text-align: center;">Belum ada anime. Upload video dulu!</p>';
    }
}

// ===== FILTER ANIME =====
function filterAnime() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const cards = document.querySelectorAll('.anime-card');
    
    cards.forEach(card => {
        const title = card.querySelector('.anime-card-title').textContent.toLowerCase();
        card.style.display = title.includes(search) ? 'block' : 'none';
    });
}

// ===== UPLOAD VIDEO =====
async function handleUpload(e) {
    e.preventDefault();
    
    const title = document.getElementById('animeTitle').value;
    const episode = document.getElementById('animeEpisode').value;
    const file = document.getElementById('videoFile').files[0];
    
    if (!file) {
        showNotification('Pilih file video dulu!', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('title', title);
    formData.append('episode', episode);
    formData.append('file', file);
    
    document.getElementById('uploadProgress').style.display = 'block';
    
    try {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                document.querySelector('.progress-fill').style.width = percentComplete + '%';
                document.getElementById('uploadStatus').textContent = `Uploading... ${Math.round(percentComplete)}%`;
            }
        });
        
        xhr.addEventListener('load', async () => {
            if (xhr.status === 200) {
                showNotification('✅ Video berhasil di-upload!', 'success');
                document.getElementById('uploadForm').reset();
                document.getElementById('fileLabel').textContent = 'Pilih file video...';
                await loadLibrary();
                showSection('library');
            } else {
                showNotification('❌ Upload gagal!', 'error');
            }
            document.getElementById('uploadProgress').style.display = 'none';
        });
        
        xhr.open('POST', `${API_URL}/api/upload`);
        xhr.send(formData);
    } catch (err) {
        console.error('Error:', err);
        showNotification('❌ Error uploading!', 'error');
        document.getElementById('uploadProgress').style.display = 'none';
    }
}

// ===== PLAY ANIME =====
async function playAnime(animeId) {
    const anime = library.find(a => a.id === animeId);
    if (!anime) return;
    
    currentAnime = anime;
    
    document.getElementById('playerTitle').textContent = `${anime.title} - Episode ${anime.episode}`;
    document.getElementById('videoPlayer').src = `${API_URL}/api/video/${anime.filename}`;
    document.getElementById('progressSlider').value = anime.progress;
    document.getElementById('progressPercent').textContent = anime.progress + '%';
    document.getElementById('notesArea').value = anime.notes;
    
    // Rating stars
    document.querySelectorAll('.star').forEach((star, idx) => {
        star.classList.toggle('active', idx < anime.rating);
    });
    
    // Subtitle support
    addSubtitleTrack(anime);
    
    document.getElementById('playerModal').style.display = 'flex';
}

// ===== SUBTITLE SUPPORT =====
function addSubtitleTrack(anime) {
    const video = document.getElementById('videoPlayer');
    
    // Clear existing tracks
    Array.from(video.querySelectorAll('track')).forEach(t => t.remove());
    
    // Cek apakah ada subtitle file
    const subtitleLangs = [
        { lang: 'id', label: '🇮🇩 Subtitle Indo' },
        { lang: 'en', label: '🇬🇧 English Subtitle' },
        { lang: 'ja', label: '🇯🇵 Japanese (Original)' }
    ];
    
    const subtitleContainer = document.querySelector('.subtitle-track') || createSubtitleContainer();
    subtitleContainer.innerHTML = '';
    
    subtitleLangs.forEach(({ lang, label }) => {
        const btn = document.createElement('button');
        btn.className = 'subtitle-btn';
        btn.textContent = label;
        btn.onclick = () => loadSubtitle(anime, lang, subtitleLangs, btn);
        subtitleContainer.appendChild(btn);
    });
}

function createSubtitleContainer() {
    const container = document.createElement('div');
    container.className = 'subtitle-track';
    const controlsDiv = document.querySelector('.player-controls');
    controlsDiv.insertBefore(container, controlsDiv.firstChild);
    return container;
}

function loadSubtitle(anime, lang, langs, btn) {
    const subtitlePath = `${anime.title.toLowerCase().replace(/\s+/g, '_')}_ep${anime.episode}_${lang}.vtt`;
    const video = document.getElementById('videoPlayer');
    
    // Clear previous tracks
    Array.from(video.querySelectorAll('track')).forEach(t => t.remove());
    
    const track = document.createElement('track');
    track.kind = 'captions';
    track.srclang = lang;
    track.label = langs.find(l => l.lang === lang)?.label;
    track.src = subtitlePath;
    
    video.appendChild(track);
    
    // Update button status
    document.querySelectorAll('.subtitle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    showNotification(`Subtitle ${btn.textContent} dimuat!`, 'success');
}

// ===== CLOSE PLAYER =====
function closePlayer() {
    document.getElementById('playerModal').style.display = 'none';
}

// ===== UPDATE PROGRESS =====
function updateProgress() {
    const value = document.getElementById('progressSlider').value;
    document.getElementById('progressPercent').textContent = value + '%';
}

// ===== SET RATING =====
function setRating(rating) {
    document.querySelectorAll('.star').forEach((star, idx) => {
        star.classList.toggle('active', idx < rating);
    });
}

// ===== SAVE PROGRESS =====
async function saveAnimeProgress() {
    if (!currentAnime) return;
    
    const progress = parseInt(document.getElementById('progressSlider').value);
    const rating = document.querySelectorAll('.star.active').length;
    const notes = document.getElementById('notesArea').value;
    
    try {
        const response = await fetch(`${API_URL}/api/anime/${currentAnime.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ progress, rating, notes })
        });
        
        if (response.ok) {
            showNotification('✅ Progress tersimpan!', 'success');
            await loadLibrary();
        }
    } catch (err) {
        console.error('Error:', err);
        showNotification('❌ Gagal menyimpan progress!', 'error');
    }
}

// ===== WATCHLIST =====
async function addToWatchlist(animeId) {
    try {
        await fetch(`${API_URL}/api/watchlist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ anime_id: animeId })
        });
        showNotification('✅ Ditambahkan ke Watchlist!', 'success');
        await loadLibrary();
    } catch (err) {
        showNotification('❌ Error!', 'error');
    }
}

function renderWatchlist() {
    // Similar to renderAnimeCards but filtered for watchlist
}

// ===== DELETE ANIME =====
async function deleteAnime(animeId) {
    if (!confirm('Yakin hapus anime ini?')) return;
    
    try {
        await fetch(`${API_URL}/api/anime/${animeId}`, { method: 'DELETE' });
        showNotification('✅ Anime dihapus!', 'success');
        await loadLibrary();
    } catch (err) {
        showNotification('❌ Gagal menghapus!', 'error');
    }
}

// ===== STATS =====
function updateStats() {
    document.getElementById('totalAnime').textContent = library.length;
    document.getElementById('totalEpisodes').textContent = library.reduce((sum, a) => sum + a.episode, 0);
    document.getElementById('totalRated').textContent = library.filter(a => a.rating > 0).length;
}

// ===== NAVIGATION =====
function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(sectionId).classList.add('active');
    event.target.classList.add('active');
}

// ===== NOTIFICATION =====
function showNotification(message, type = 'info') {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        z-index: 2000;
        animation: slideInRight 0.3s ease;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
    `;
    notif.textContent = message;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
          }
