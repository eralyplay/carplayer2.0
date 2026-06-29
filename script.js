let songsList = [];
let songIndex = 0;
let isPlaying = false;
let realGpsSpeed = 0;
let map = null;
let carMarker = null;

const audio = document.getElementById('audio-player');
const playBtn = document.getElementById('btn-play');
const miniPlayBtn = document.getElementById('mini-play');
const progressRange = document.getElementById('progress-range');
const currentTimeEl = document.getElementById('current-time');
const totalDurationEl = document.getElementById('total-duration');
const speedNumEl = document.getElementById('speed-num');
const fileUpload = document.getElementById('file-upload');
const playlistTracks = document.getElementById('playlist-tracks');
const songCountEl = document.getElementById('song-count');
const themeToggleBtn = document.getElementById('theme-toggle');

// Список доступных классов тем оформления
const themes = ['theme-classic', 'theme-aero', 'theme-windows'];
let currentThemeIndex = 0;

// Циклическое переключение тем (Classic -> Aero -> Windows)
themeToggleBtn.addEventListener('click', () => {
    document.body.classList.remove(themes[currentThemeIndex]);
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    document.body.classList.add(themes[currentThemeIndex]);
});

// Переключение экранов
document.querySelectorAll('.nav-item').forEach(navItem => {
    navItem.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
        
        navItem.classList.add('active');
        const targetScreen = navItem.getAttribute('data-target');
        document.getElementById(targetScreen).classList.add('active');

        if(targetScreen === 'screen-home' && map) {
            setTimeout(() => map.invalidateSize(), 200);
        }
    });
});

// Часы
function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    document.getElementById('time').innerHTML = `${String(hours).padStart(2, '0')}:${minutes} <span class="ampm">${ampm}</span>`;
    document.getElementById('date').innerText = now.toLocaleDateString('ru-RU', { weekday: 'long', month: 'numeric', day: 'numeric' });
}
setInterval(updateClock, 1000); updateClock();

// GPS и Карта
function initGpsSystem() {
    map = L.map('map', { zoomControl: false }).setView([51.1605, 71.4704], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    carMarker = L.marker([51.1605, 71.4704]).addTo(map);

    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(position => {
            const lat = position.coords.latitude; const lon = position.coords.longitude;
            map.setView([lat, lon], map.getZoom()); carMarker.setLatLng([lat, lon]);
            if (position.coords.speed) realGpsSpeed = Math.round(position.coords.speed * 3.6);
            
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`)
                .then(res => res.json()).then(data => {
                    document.getElementById('weather-temp').innerText = `${Math.round(data.current_weather.temperature)}°C`;
                }).catch(() => {});
        }, error => {}, { enableHighAccuracy: true, maximumAge: 0 });
    }
}
initGpsSystem();
setInterval(() => { speedNumEl.innerText = realGpsSpeed; }, 250);

// Исправлено под iOS: Загрузка музыки с мягкой проверкой типов
fileUpload.addEventListener('change', (e) => {
    Array.from(e.target.files).forEach(file => {
        const fileName = file.name.toLowerCase();
        
        // Если это видеофайл, пропускаем его, чтобы не ломать аудиоплеер
        if (file.type.startsWith('video/') || fileName.endsWith('.mp4') || fileName.endsWith('.mov') || fileName.endsWith('.avi')) {
            alert(`Файл "${file.name}" является видео. Пожалуйста, выбирайте только аудиоформаты.`);
            return;
        }

        const blobUrl = URL.createObjectURL(file);
        const trackData = { title: file.name.replace(/\.[^/.]+$/, ""), artist: "Неизвестен", src: blobUrl, art: "https://via.placeholder.com/250/0a4e5c/ffffff?text=No+Art" };

        jsmediatags.read(file, {
            onSuccess: function(tag) {
                if (tag.tags.title) trackData.title = tag.tags.title;
                if (tag.tags.artist) trackData.artist = tag.tags.artist;
                if (tag.tags.picture) {
                    const { data, format } = tag.tags.picture;
                    let base64String = "";
                    for (let i = 0; i < data.length; i++) base64String += String.fromCharCode(data[i]);
                    trackData.art = `data:${format};base64,${window.btoa(base64String)}`;
                }
                addTrackToSystem(trackData);
            },
            onError: function() { addTrackToSystem(trackData); }
        });
    });
    // Очищаем значение, чтобы можно было выбирать файлы повторно
    fileUpload.value = '';
});

function addTrackToSystem(track) {
    songsList.push(track);
    songCountEl.innerText = `(${songsList.length})`;
    const index = songsList.length - 1;
    const li = document.createElement('li');
    li.classList.add('song-item');
    li.innerHTML = `<img class="song-item-art" src="${track.art}"><div><div>${track.title}</div><small class="track-artist-text">${track.artist}</small></div>`;
    li.addEventListener('click', () => { songIndex = index; loadSong(songsList[songIndex]); isPlaying = false; togglePlay(); });
    playlistTracks.appendChild(li);
    if (songsList.length === 1) loadSong(songsList[0]);
}

function loadSong(song) {
    if(!song) return;
    document.getElementById('track-title').innerText = song.title;
    document.getElementById('track-artist').innerText = song.artist;
    document.getElementById('track-art').src = song.art;
    
    document.getElementById('mini-title').innerText = song.title;
    document.getElementById('mini-artist').innerText = song.artist;
    document.getElementById('mini-art').src = song.art;

    audio.src = song.src;
    
    document.querySelectorAll('.song-item').forEach((item, idx) => {
        if(idx === songIndex) item.classList.add('playing');
        else item.classList.remove('playing');
    });
}

function togglePlay() {
    if (songsList.length === 0) return;
    if (isPlaying) {
        audio.pause();
        playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        miniPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    } else {
        audio.play().catch(() => {});
        playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        miniPlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    }
    isPlaying = !isPlaying;
}

// Исправлено под iOS: Принудительный .play() внутри событий смены треков
function nextSong() { songIndex = (songIndex + 1) % songsList.length; loadSong(songsList[songIndex]); if (isPlaying) audio.play().catch(() => {}); }
function prevSong() { songIndex = (songIndex - 1 + songsList.length) % songsList.length; loadSong(songsList[songIndex]); if (isPlaying) audio.play().catch(() => {}); }

audio.addEventListener('timeupdate', (e) => {
    const { duration, currentTime } = e.srcElement;
    if (duration) {
        progressRange.value = (currentTime / duration) * 100;
        currentTimeEl.innerText = `${Math.floor(currentTime / 60)}:${String(Math.floor(currentTime % 60)).padStart(2, '0')}`;
        totalDurationEl.innerText = `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}`;
    }
});

progressRange.addEventListener('input', () => { if(audio.duration) audio.currentTime = (progressRange.value / 100) * audio.duration; });

playBtn.addEventListener('click', togglePlay);
miniPlayBtn.addEventListener('click', togglePlay);
document.getElementById('btn-next').addEventListener('click', nextSong);
document.getElementById('mini-next').addEventListener('click', nextSong);
document.getElementById('btn-prev').addEventListener('click', prevSong);
document.getElementById('mini-prev').addEventListener('click', prevSong);
audio.addEventListener('ended', nextSong);