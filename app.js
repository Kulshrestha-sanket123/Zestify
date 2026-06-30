document.addEventListener("DOMContentLoaded", () => {
    const API_BASE_URL = "https://zestify-backend-ts1c.onrender.com";
    const SESSION_KEY  = "zestify_session";

    let dbTracks = [];
    let dbPlaylists = {};
    let dbLikedSongsIds = [];
    let dbUserProfile = { name: "User", plan: "Free", minutesStreamed: 0 };
    let audio = new Audio();
    let currentPlaylistTracks = [];
    let currentTrackIndex = -1;
    let isPlaying = false;
    let isShuffle = false;
    let isLoop = false;
    let viewHistory = [];
    let viewHistoryIndex = -1;
    let _lastSaveTime = 0;
    let _currentAccentHex = null;

    const mainScrollArea = document.getElementById("mainScrollArea");
    const playBtn = document.getElementById("play");
    const prevBtn = document.getElementById("prev");
    const nextBtn = document.getElementById("next");
    const shuffleBtn = document.getElementById("shuffle");
    const loopBtn = document.getElementById("loop");
    const progressBar = document.getElementById("progressBar");
    const volumeBar = document.getElementById("volumeBar");
    const currentTimeText = document.getElementById("currentTime");
    const totalTimeText = document.getElementById("totalTime");
    const footerCover = document.getElementById("footerCover");
    const footerTitle = document.getElementById("footerTitle");
    const footerArtist = document.getElementById("footerArtist");
    const footerEqualizer = document.getElementById("footerEqualizer");
    const coverRingWrap = document.getElementById("coverRingWrap");
    const footerGlow = document.getElementById("footerGlow");
    const appShell = document.getElementById("appShell");

    //Mobile Specific References
    const mobileProgressBar = document.getElementById("mobileProgressBar");
    const mobileCurrentTime = document.getElementById("mobileCurrentTime");
    const mobileTotalTime = document.getElementById("mobileTotalTime");
    const mobileShuffleBtn = document.getElementById("mobileShuffleBtn");
    const mobileLoopBtn = document.getElementById("mobileLoopBtn");

    //Volume References
    const volumeIconBtn = document.getElementById("volumeIconBtn");
    const volumeIcon = document.getElementById("volumeIcon");
    const volPopup = document.getElementById("volPopup");
    const volVerticalTrack = document.getElementById("volVerticalTrack");
    const volVerticalFill = document.getElementById("volVerticalFill");
    const volVerticalThumb = document.getElementById("volVerticalThumb");
    const volPopupPct = document.getElementById("volPopupPct");

    function getCover(track) {
        return track.cover || track.coverPath || '';
    }
    function getAudioSrc(track) {
        return track.songUrl || track.filePath || '';
    }
    function formatTime(secs) {
        const m = Math.floor(secs / 60), s = Math.floor(secs % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    //function for updating the colours of both progress & Volume bars
    function updateRangeFill(inputEl) {
        if (!inputEl) return;
        const min = parseFloat(inputEl.min) || 0;
        const max = parseFloat(inputEl.max) || 100;
        const val = parseFloat(inputEl.value) || 0;
        const pct = ((val - min) / (max - min)) * 100;
        inputEl.style.setProperty('--fill-pct', pct.toFixed(1) + '%');
    }
    //Updation as per the current values of both bars
    if (progressBar)     updateRangeFill(progressBar);
    if (mobileProgressBar) updateRangeFill(mobileProgressBar);
    if (volumeBar)       { audio.volume = (volumeBar.value / 100); updateRangeFill(volumeBar); }


    //Session save & Restore
    function saveSession() {
        const now = Date.now();
        if (now - _lastSaveTime < 5000) return;
        _lastSaveTime = now;
        const track = currentPlaylistTracks[currentTrackIndex];
        if (!track) return;
        try {
            localStorage.setItem(SESSION_KEY, JSON.stringify({
                trackId:   track._id || track.id,
                timestamp: audio.currentTime || 0,
                volume:    audio.volume,
                isShuffle,
                isLoop
            }));
        } catch (e) {
            console.warn("Session save failed:", e);
        }
    }

    function saveSessionNow() {
        _lastSaveTime = 0; saveSession();
    }

    function restoreSession() {
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            if (!raw) return;
            const s = JSON.parse(raw);
            if (!s?.trackId) return;

            const idx = currentPlaylistTracks.findIndex(
                t => t._id === s.trackId || t.id === s.trackId
            );
            if (idx === -1) return;

            if (s.isShuffle) {
                isShuffle = true;
                syncShuffleLoop();
            }
            if (s.isLoop) {
                isLoop = true;
                syncShuffleLoop();
            }

            const vol = parseFloat(s.volume);
            if (!isNaN(vol)) {
                audio.volume = vol;
                if (volumeBar) {
                    volumeBar.value = Math.round(vol * 100);
                    updateRangeFill(volumeBar);
                }
                syncVerticalVolume(Math.round(vol * 100));
            }

            loadTrack(idx);

            audio.addEventListener("loadedmetadata", () => {
                if (s.timestamp > 0 && s.timestamp < audio.duration) {
                    audio.currentTime = s.timestamp;
                    const pct = (s.timestamp / audio.duration) * 100;
                    if (progressBar) {
                        progressBar.value = pct;
                        updateRangeFill(progressBar);
                    }
                    if (mobileProgressBar) {
                        mobileProgressBar.value = pct;
                        updateRangeFill(mobileProgressBar);
                    }
                    currentTimeText.textContent = formatTime(s.timestamp);
                    totalTimeText.textContent   = formatTime(audio.duration);
                    if (mobileCurrentTime) {
                        mobileCurrentTime.textContent = formatTime(s.timestamp);
                    }
                    if (mobileTotalTime) {
                        mobileTotalTime.textContent   = formatTime(audio.duration);
                    }
                }
            }, { once: true });

            syncPlayingUI(false);
        } catch (e) {
            console.warn("Session restore failed:", e);
        }
    }


    //DYNAMIC COLOR EXTRACTION
    const _colorCanvas = document.createElement("canvas");
    _colorCanvas.width = _colorCanvas.height = 64;
    const _colorCtx = _colorCanvas.getContext("2d", { willReadFrequently: true });

    function extractDominantColor(imageUrl, callback) {
        if(!imageUrl) {
            callback(null);
            return;
        }
        const img = new Image();
        img.crossOrigin = "anonymous";

        img.onload = () => {
            try {
                _colorCtx.drawImage(img, 0, 0, 64, 64);
                const data = _colorCtx.getImageData(0, 0, 64, 64).data;

                const buckets = {};
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
                    if (a < 128) continue;

                    const max = Math.max(r, g, b), min = Math.min(r, g, b);
                    if (max === 0) continue;

                    const saturation = (max - min) / max;
                    const brightness = (r + g + b) / 3;

                    if (brightness < 25 || brightness > 230) continue;
                    if (saturation < 0.15) continue;

                    const key = `${Math.round(r/40)*40},${Math.round(g/40)*40},${Math.round(b/40)*40}`;
                    buckets[key] = (buckets[key] || 0) + (1 + saturation * 2);
                }

                let bestKey = null, bestScore = 0;
                for (const [key, score] of Object.entries(buckets)) {
                    if (score > bestScore) {
                        bestScore = score;
                        bestKey = key;
                    }
                }

                if (!bestKey) {
                    callback(null);
                    return;
                }
                let [r, g, b] = bestKey.split(",").map(Number);

                const mix = 0.42;
                r = Math.round(r * mix + 18 * (1 - mix));
                g = Math.round(g * mix + 18 * (1 - mix));
                b = Math.round(b * mix + 18 * (1 - mix));

                callback({ r, g, b });
            } catch (e) {
                callback(null);
            }
        };
        img.onerror = () => callback(null);
        img.src = imageUrl;
    }

    function rgbToHex(r, g, b) {
        return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
    }

    function applyAccentColor(color) {
        if (!color) {
            resetAccentColor();
            return;
        }

        const hex = rgbToHex(color.r, color.g, color.b);
        if (hex === _currentAccentHex) return;
        _currentAccentHex = hex;

        const { r, g, b } = color;

        const header = document.querySelector(".sticky-top-wrapper");
        if (header) {
            header.style.transition = "background 1.4s ease";
            header.style.background = `linear-gradient(to bottom, rgba(${r},${g},${b},0.12) 0%, rgba(10,10,16,0.55) 100%)`;
            const greeting = document.getElementById("welcomeGreeting");
            if (greeting) greeting.style.color = "#ffffff";
        }

        if (footerGlow) {
            footerGlow.style.transition = "background 1.4s ease";
            footerGlow.style.background =`radial-gradient(ellipse at 8% 50%, rgba(${r},${g},${b},0.28), transparent 60%)`;
        }

        let blob = document.getElementById("dynamicBlob");
        if (!blob) {
            blob = document.createElement("div");
            blob.id = "dynamicBlob";
            Object.assign(blob.style, {
                position: "fixed", width: "520px", height: "520px",
                borderRadius: "50%", filter: "blur(130px)", zIndex: "0",
                pointerEvents: "none", top: "-180px", left: "-140px",
                transition: "background 1.6s ease"
            });
            document.body.prepend(blob);
        }
        blob.style.background = `rgba(${r},${g},${b},0.16)`;

        let blob2 = document.getElementById("dynamicBlob2");
        if (!blob2) {
            blob2 = document.createElement("div");
            blob2.id = "dynamicBlob2";
            Object.assign(blob2.style, {
                position: "fixed", width: "440px", height: "440px",
                borderRadius: "50%", filter: "blur(140px)", zIndex: "0",
                pointerEvents: "none", bottom: "-180px", right: "-140px",
                transition: "background 1.8s ease"
            });
            document.body.appendChild(blob2);
        }
        blob2.style.background = `rgba(${Math.round(r*0.7)},${Math.round(g*0.6)},${Math.min(255,Math.round(b*1.3))},0.11)`;
    }

    function resetAccentColor() {
        _currentAccentHex = null;

        const header = document.querySelector(".sticky-top-wrapper");
        if (header) {
            header.style.transition = "background 1.4s ease";
            header.style.background = "";
        }
        const greeting = document.getElementById("welcomeGreeting");
        if (greeting) greeting.style.color = "";

        if (footerGlow) {
            footerGlow.style.transition = "background 1.4s ease";
            footerGlow.style.background = "";
        }

        const blob = document.getElementById("dynamicBlob");
        if (blob) blob.style.background = "rgba(20,200,200,0.18)";
        const blob2 = document.getElementById("dynamicBlob2");
        if (blob2) blob2.style.background = "rgba(120,70,255,0.12)";
    }


    // NAVIGATION HISTORY
    function pushView(renderFn) {
        if (viewHistoryIndex < viewHistory.length - 1)
            viewHistory = viewHistory.slice(0, viewHistoryIndex + 1);
        viewHistory.push(renderFn);
        viewHistoryIndex = viewHistory.length - 1;
        updateNavArrows();
        renderFn();
    }

    function updateNavArrows() {
        const back    = document.getElementById("backBtn");
        const forward = document.getElementById("forwardBtn");
        if (back) back.disabled = viewHistoryIndex <= 0;
        if (forward) forward.disabled = viewHistoryIndex >= viewHistory.length - 1;
    }

    document.getElementById("backBtn").addEventListener("click", () => {
        if(viewHistoryIndex > 0) {
            viewHistoryIndex--; updateNavArrows();
            viewHistory[viewHistoryIndex]();
        }
    });
    document.getElementById("forwardBtn").addEventListener("click", () => {
        if(viewHistoryIndex < viewHistory.length - 1) {
            viewHistoryIndex++;
            updateNavArrows();
            viewHistory[viewHistoryIndex]();
        }
    });


    // PLAY STATE SYNC
    function syncPlayingUI(playing) {
        isPlaying = playing;
        playBtn.innerHTML = playing
            ? `<i class="fa-solid fa-circle-pause"></i>`
            : `<i class="fa-solid fa-circle-play"></i>`;

        const activeId = currentPlaylistTracks[currentTrackIndex]
            ? (currentPlaylistTracks[currentTrackIndex]._id || currentPlaylistTracks[currentTrackIndex].id)
            : null;

        document.querySelectorAll(".song-card:not(.playlist-folder-card)").forEach(card => {
            const isActive = card.getAttribute("data-id") === activeId;
            const playIcon = card.querySelector(".play-hover i");
            const eqBadge  = card.querySelector(".card-eq-badge");
            card.classList.toggle("card-active", isActive && playing);
            if (playIcon) playIcon.className = (isActive && playing) ? "fa-solid fa-pause" : "fa-solid fa-play";
            if (eqBadge) {
                const eq = eqBadge.querySelector(".equalizer");
                if (eq) eq.classList.toggle("playing", isActive && playing);
                eqBadge.classList.toggle("hidden", !(isActive && playing));
            }
        });

        document.querySelectorAll(".spotify-track-row").forEach(row => {
            const isActive = row.getAttribute("data-id") === activeId;
            row.classList.toggle("active-playing", isActive);
            const eq  = row.querySelector(".equalizer");
            const num = row.querySelector(".track-index-number");
            if (eq && num) {
                const show = isActive && playing;
                eq.classList.toggle("playing", show);
                eq.classList.toggle("hidden", !show);
                num.classList.toggle("hidden", show);
            }
        });

        const hasTrack = currentTrackIndex !== -1;
        footerEqualizer.classList.toggle("playing", playing && hasTrack);
        coverRingWrap.classList.toggle("playing", playing && hasTrack);
        footerGlow.classList.toggle("active", playing && hasTrack);
    }


    // SONG CARD GENERATOR FUNCTION
    function generateCards(tracks) {
        if (!tracks || tracks.length === 0) return `<p class="empty-msg">No tracks found.</p>`;

        const activeId = currentPlaylistTracks[currentTrackIndex]
            ? (currentPlaylistTracks[currentTrackIndex]._id || currentPlaylistTracks[currentTrackIndex].id)
            : null;

        return tracks.map(t => {
            const trackId  = t._id || t.id;
            const isLiked  = dbLikedSongsIds.includes(trackId);
            const isActive = trackId === activeId && isPlaying;
            const cover    = getCover(t);
            return `
                <div class="song-card${isActive ? ' card-active' : ''}" data-id="${trackId}">
                    <div class="card-img${cover ? '' : ' img-placeholder'}">
                        ${cover
                            ? `<img src="${cover}" alt="${t.songName || ''}" onerror="this.style.display='none';this.parentElement.classList.add('img-placeholder')">`
                            : `<i class="fa-solid fa-music"></i>`
                        }
                        <div class="card-eq-badge${isActive ? '' : ' hidden'}">
                            <div class="equalizer${isActive ? ' playing' : ''}">
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                        <div class="add-icon" data-id="${trackId}" title="Add to Playlist">
                            <i class="fa-solid fa-plus"></i>
                        </div>
                        <div class="card-img-heart-wrap">
                            <i class="fa-solid fa-heart heart-icon ${isLiked ? 'liked' : ''}" data-id="${trackId}"></i>
                        </div>
                        <div class="play-hover">
                            <i class="fa-solid ${isActive ? 'fa-pause' : 'fa-play'}"></i>
                        </div>
                    </div>
                    <div class="song-info">
                        <h3>${t.songName || 'Unknown Title'}</h3>
                        <p>${t.artistName || 'Unknown Artist'}</p>
                    </div>
                </div>`;
        }).join('');
    }


    // EXPLORE VIEW FEATURE
    function renderExploreView() {
        if (dbTracks.length === 0) {
            mainScrollArea.innerHTML = `<div class="loading-placeholder">No tracks in database.</div>`;
            return;
        }
        const categories = {};
        dbTracks.forEach(t => {
            const cat = t.category || 'trending';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(t);
        });
        let html = '';
        Object.entries(categories).forEach(([cat, tracks]) => {
            const label = cat
                .replace(/([a-z])([A-Z])/g, '$1 $2')
                .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
                .split(/[\s_-]+/)
                .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                .join(' ');
            html += `<div class="section"><h2>${label} Tracks</h2><div class="song-grid">${generateCards(tracks)}</div></div>`;
        });
        mainScrollArea.innerHTML = html;
    }


    // DATABASE SYNC
    async function syncDatabaseInstance() {
        try {
            mainScrollArea.innerHTML = `<div class="loading-placeholder"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>`;
            const token = localStorage.getItem("token");
            const authH = token ? { "Authorization": "Bearer " + token } : {};

            const [songsRes, playlistsRes, userRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/songs`).catch(() => null),
                fetch(`${API_BASE_URL}/api/playlists/all`, { headers: authH }).catch(() => null),
                fetch(`${API_BASE_URL}/api/auth/profile`,  { headers: authH }).catch(() => null)
            ]);

            if (songsRes?.ok) {
                const d = await songsRes.json();
                dbTracks = Array.isArray(d) ? d : (d.data || []);
            }
            if (playlistsRes?.ok) {
                const d = await playlistsRes.json();
                dbPlaylists = {};
                if (Array.isArray(d)) d.forEach(p => { dbPlaylists[p.name] = p.tracks || []; });
            }
            if (userRes?.ok) {
                const d = await userRes.json();
                dbUserProfile   = d.profile || dbUserProfile;
                dbLikedSongsIds = d.likedSongs || [];
                updateHeaderProfile(dbUserProfile);
            }

            currentPlaylistTracks = [...dbTracks];
            pushView(renderExploreView);
            restoreSession();
        } catch (err) {
            console.error("Sync error:", err);
            mainScrollArea.innerHTML = `
                <div class="loading-placeholder error">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    Backend connection failed.
                </div>`;
        }
    }


    // SEARCH FEATURE
    const searchBar   = document.getElementById("searchbar");
    const clearSearch = document.getElementById("clearSearch");

    searchBar.addEventListener("input", (e) => {
        const val = e.target.value.trim().toLowerCase();
        clearSearch.style.display = val ? "block" : "none";
        if (!val) {
            renderExploreView();
            return;
        }
        const filtered = dbTracks.filter(t =>
            (t.songName   || '').toLowerCase().includes(val) ||
            (t.artistName || '').toLowerCase().includes(val)
        );
        mainScrollArea.innerHTML = `
            <div class="section">
                <h2>Search Results <span class="result-count">(${filtered.length})</span></h2>
                <div class="song-grid">${generateCards(filtered)}</div>
            </div>`;
    });
    clearSearch.addEventListener("click", () => {
        searchBar.value = "";
        clearSearch.style.display = "none";
        renderExploreView();
    });


    // PLAYBACK ENGINE FUNCTION
    function loadTrack(index) {
        if (index < 0 || index >= currentPlaylistTracks.length) return;
        currentTrackIndex = index;
        const track = currentPlaylistTracks[index];
        const cover = getCover(track);

        audio.src = getAudioSrc(track);
        audio.load();

        footerCover.src = cover;
        footerTitle.textContent = track.songName || 'Unknown Title';
        footerArtist.textContent = track.artistName || 'Unknown Artist';

        saveSessionNow();

        lyricsBtn.disabled = false;
        lyricsSongTitle.textContent = track.songName || '—';
        lyricsArtistName.textContent = track.artistName || '—';

        if (_lyricsOpen) {
            fetchAndShowLyrics(track.songName, track.artistName);
        } else {
            lyricsBody.innerHTML = `<p class="lyrics-placeholder">Click Lyrics to view.</p>`;
        }

        extractDominantColor(cover, applyAccentColor);
    }

    function togglePlay() {
        if (currentTrackIndex === -1 && currentPlaylistTracks.length > 0) loadTrack(0);
        if (!audio.src && currentPlaylistTracks.length > 0) loadTrack(Math.max(0, currentTrackIndex));
        if (isPlaying) {
            audio.pause();
        } else {
            audio.play().then(() => syncPlayingUI(true)).catch(err => console.warn("Playback blocked:", err));
        }
    }

    playBtn.addEventListener("click", togglePlay);

    nextBtn.addEventListener("click", () => {
        const idx = isShuffle
            ? Math.floor(Math.random() * currentPlaylistTracks.length)
            : (currentTrackIndex + 1) % currentPlaylistTracks.length;
        loadTrack(idx);
        audio.play().then(() => syncPlayingUI(true)).catch(() => {});
    });

    prevBtn.addEventListener("click", () => {
        if (audio.currentTime > 3) {
            audio.currentTime = 0;
        } else {
            const idx = currentTrackIndex <= 0 ? currentPlaylistTracks.length - 1 : currentTrackIndex - 1;
            loadTrack(idx);
        }
        if (isPlaying) audio.play().then(() => syncPlayingUI(true)).catch(() => {});
    });


    //SHUFFLE FEATURE FUNCTION
    function syncShuffleLoop() {
        shuffleBtn.classList.toggle("active", isShuffle);
        mobileShuffleBtn?.classList.toggle("active", isShuffle);
        loopBtn.classList.toggle("active", isLoop);
        mobileLoopBtn?.classList.toggle("active", isLoop);
    }

    shuffleBtn.addEventListener("click", () => {
        isShuffle = !isShuffle; syncShuffleLoop(); saveSessionNow();
    });
    loopBtn.addEventListener("click", () => {
        isLoop = !isLoop; syncShuffleLoop(); saveSessionNow();
    });
    mobileShuffleBtn?.addEventListener("click", () => {
        isShuffle = !isShuffle; syncShuffleLoop(); saveSessionNow();
    });
    mobileLoopBtn?.addEventListener("click", () => {
        isLoop = !isLoop; syncShuffleLoop(); saveSessionNow();
    });

    audio.addEventListener("ended", () => {
        if (isLoop) { audio.currentTime = 0; audio.play().then(() => syncPlayingUI(true)).catch(() => {}); }
        else nextBtn.click();
    });

    audio.addEventListener("play",  () => syncPlayingUI(true));
    audio.addEventListener("pause", () => { syncPlayingUI(false); saveSessionNow(); });

    audio.addEventListener("timeupdate", () => {
        if (!audio.duration) return;
        const pct = (audio.currentTime / audio.duration) * 100;
        const cur = formatTime(audio.currentTime);
        const tot = formatTime(audio.duration);

        // Desktop progress bar
        if (progressBar) {
            progressBar.value = pct;
            updateRangeFill(progressBar);
        }
        currentTimeText.textContent = cur;
        totalTimeText.textContent   = tot;

        // Mobile progress bar
        if (mobileProgressBar) {
            mobileProgressBar.value = pct;
            updateRangeFill(mobileProgressBar);
        }
        if (mobileCurrentTime) mobileCurrentTime.textContent = cur;
        if (mobileTotalTime)   mobileTotalTime.textContent   = tot;

        // Sync lyrics highlight if open
        if (_lyricsOpen && _syncedLyricLines.length > 0) {
            syncLyricHighlight(audio.currentTime);
        }

        if (isPlaying) saveSession();
    });

    // Desktop progress bar scrub
    if (progressBar) {
        progressBar.addEventListener("input", () => {
            if (audio.duration) {
                audio.currentTime = (progressBar.value / 100) * audio.duration;
                updateRangeFill(progressBar);
                if (mobileProgressBar) { mobileProgressBar.value = progressBar.value; updateRangeFill(mobileProgressBar); }
            }
        });
    }

    // Mobile progress bar scrub
    if (mobileProgressBar) {
        mobileProgressBar.addEventListener("input", () => {
            if (audio.duration) {
                audio.currentTime = (mobileProgressBar.value / 100) * audio.duration;
                updateRangeFill(mobileProgressBar);
                if (progressBar) { progressBar.value = mobileProgressBar.value; updateRangeFill(progressBar); }
            }
        });
    }

    // Desktop volume bar
    if (volumeBar) {
        volumeBar.addEventListener("input", () => {
            audio.volume = volumeBar.value / 100;
            updateRangeFill(volumeBar);
            syncVerticalVolume(parseInt(volumeBar.value));
            updateVolumeIcon(audio.volume);
            saveSessionNow();
        });
    }


    // VOLUME ICON — mute toggle
    function updateVolumeIcon(vol) {
        if (!volumeIcon) return;
        if (audio.muted || vol === 0) {
            volumeIcon.className = "fa-solid fa-volume-xmark";
        } else if (vol < 0.4) {
            volumeIcon.className = "fa-solid fa-volume-low";
        } else {
            volumeIcon.className = "fa-solid fa-volume-high";
        }
    }

    // Desktop Volume Icon Mute feature
    if (volumeIconBtn && window.innerWidth > 768) {
        volumeIconBtn.addEventListener("click", () => {
            audio.muted = !audio.muted;
            updateVolumeIcon(audio.muted ? 0 : audio.volume);
        });
    }


    // VERTICAL VOLUME bar (mobile)
    let _volPopupOpen = false;
    let _volDragging  = false;

    function syncVerticalVolume(volPct) {
        if (!volVerticalFill || !volVerticalThumb || !volPopupPct) return;
        const clampedPct = Math.min(100, Math.max(0, volPct));
        volVerticalFill.style.height  = clampedPct + '%';
        volVerticalThumb.style.top    = `calc(${100 - clampedPct}% - 6px)`;
        volPopupPct.textContent        = clampedPct + '%';
    }

    function openVolPopup() {
        if (!volPopup) return;
        _volPopupOpen = true;
        volPopup.classList.add("vol-popup-open");
        volumeIconBtn.classList.add("vol-active");
    }
    function closeVolPopup() {
        if (!volPopup) return;
        _volPopupOpen = false;
        volPopup.classList.remove("vol-popup-open");
        volumeIconBtn.classList.remove("vol-active");
    }

    if (volumeIconBtn) {
        volumeIconBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (window.innerWidth <= 768) {
                _volPopupOpen ? closeVolPopup() : openVolPopup();
            } else {
                audio.muted = !audio.muted;
                updateVolumeIcon(audio.muted ? 0 : audio.volume);
            }
        });
    }

    // Vertical track drag
    function getVolFromPointer(clientY) {
        if (!volVerticalTrack) return 70;
        const rect = volVerticalTrack.getBoundingClientRect();
        const y    = Math.min(rect.height, Math.max(0, clientY - rect.top));
        return Math.round((1 - y / rect.height) * 100);
    }

    function applyVolValue(vol) {
        const clamped = Math.min(100, Math.max(0, vol));
        audio.volume  = clamped / 100;
        if (volumeBar) { volumeBar.value = clamped; updateRangeFill(volumeBar); }
        syncVerticalVolume(clamped);
        updateVolumeIcon(clamped / 100);
        saveSessionNow();
    }

    if (volVerticalTrack) {
        volVerticalTrack.addEventListener("mousedown", (e) => {
            _volDragging = true;
            applyVolValue(getVolFromPointer(e.clientY));
        });
        volVerticalTrack.addEventListener("touchstart", (e) => {
            _volDragging = true;
            applyVolValue(getVolFromPointer(e.touches[0].clientY));
        }, { passive: true });
    }

    document.addEventListener("mousemove", (e) => {
        if (_volDragging) applyVolValue(getVolFromPointer(e.clientY));
    });
    document.addEventListener("touchmove", (e) => {
        if (_volDragging) applyVolValue(getVolFromPointer(e.touches[0].clientY));
    }, { passive: true });
    document.addEventListener("mouseup",  () => { _volDragging = false; });
    document.addEventListener("touchend", () => { _volDragging = false; });

    // Close volume bar popup
    document.addEventListener("click", (e) => {
        if (_volPopupOpen && volumeIconBtn && !volumeIconBtn.closest(".volume-wrapper").contains(e.target)) {
            closeVolPopup();
        }
    });


    // LYRICS PANEL
    const lyricsBtn         = document.getElementById("lyricsBtn");
    const lyricsPanel       = document.getElementById("lyricsPanel");
    const lyricsCloseBtn    = document.getElementById("lyricsCloseBtn");
    const lyricsBody        = document.getElementById("lyricsBody");
    const lyricsSongTitle   = document.getElementById("lyricsSongTitle");
    const lyricsArtistName  = document.getElementById("lyricsArtistName");

    let _lyricsCache          = {};
    let _lyricsOpen           = false;
    let _lyricsFetchController = null;
    let _syncedLyricLines     = [];
    let _currentLyricIdx      = -1;

    function openLyricsPanel() {
        if (window.innerWidth > 768) {
            const stickyWrapper = document.querySelector(".sticky-top-wrapper");
            if (stickyWrapper) lyricsPanel.style.top = stickyWrapper.offsetHeight + "px";
        } else {
            lyricsPanel.style.top = "";
        }
        _lyricsOpen = true;
        lyricsPanel.classList.add("open");
        appShell.classList.add("lyrics-open");
        lyricsBtn.classList.add("active");
    }

    function closeLyricsPanel() {
        _lyricsOpen = false;
        lyricsPanel.classList.remove("open");
        appShell.classList.remove("lyrics-open");
        lyricsBtn.classList.remove("active");
    }

    function toggleLyricsPanel() {
        if (_lyricsOpen) {
            closeLyricsPanel();
        } else {
            openLyricsPanel();
            const track = currentPlaylistTracks[currentTrackIndex];
            if (track && lyricsBody.querySelector(".lyrics-placeholder")) {
                fetchAndShowLyrics(track.songName, track.artistName);
            }
        }
    }

    //Lyrics Highlightning
    function syncLyricHighlight(currentTime) {
        if (_syncedLyricLines.length === 0) return;

        let newIdx = 0;
        for (let i = 0; i < _syncedLyricLines.length; i++) {
            if (_syncedLyricLines[i].time <= currentTime) newIdx = i;
            else break;
        }

        if (newIdx === _currentLyricIdx) return;
        _currentLyricIdx = newIdx;

        _syncedLyricLines.forEach((line, i) => {
            if (!line.el) return;
            line.el.classList.remove("lyric-active", "lyric-past");
            if (i < newIdx) line.el.classList.add("lyric-past");
            else if (i === newIdx) {
                line.el.classList.add("lyric-active");
                line.el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        });
    }

    //Parse LRC timestamps
    function parseLRC(lrc) {
        const lines  = [];
        const regex  = /\[(\d{2}):(\d{2})[.:](\d{2,3})\](.*)/g;
        let match;
        while ((match = regex.exec(lrc)) !== null) {
            const mins  = parseInt(match[1]);
            const secs  = parseInt(match[2]);
            const ms    = parseInt(match[3].padEnd(3, '0'));
            const time  = mins * 60 + secs + ms / 1000;
            const text  = match[4].trim();
            if (text) lines.push({ time, text });
        }
        lines.sort((a, b) => a.time - b.time);
        return lines;
    }

    async function fetchAndShowLyrics(songName, artistName) {
        if (!songName || !artistName) {
            lyricsBody.innerHTML = `<p class="lyrics-error"><i class="fa-solid fa-circle-exclamation"></i>Song info not available.</p>`;
            return;
        }

        const cacheKey = `${artistName}||${songName}`;
        if (_lyricsCache[cacheKey]) {
            renderLyrics(_lyricsCache[cacheKey].text, _lyricsCache[cacheKey].synced, _lyricsCache[cacheKey].lang);
            return;
        }

        lyricsBody.innerHTML = `<p class="lyrics-loading"><i class="fa-solid fa-spinner fa-spin"></i>Fetching lyrics…</p>`;
        _syncedLyricLines = [];
        _currentLyricIdx  = -1;

        if (_lyricsFetchController) _lyricsFetchController.abort();
        _lyricsFetchController = new AbortController();
        const signal = _lyricsFetchController.signal;

        function cleanSongName(name) {
            return name
                .replace(/\s*[\(\[\{][^\)\]\}]*[\)\]\}]/g, '')
                .replace(/\s*-\s*(feat|ft|prod|mix|remix|version|official|lyric|audio|video).*/i, '')
                .trim();
        }
        function cleanArtistName(name) {
            return name
                .split(/[,&x×\/|]/)[0]
                .replace(/\s*(feat|ft)\..*/i, '')
                .replace(/\s*[\(\[\{][^\)\]\}]*[\)\]\}]/g, '')
                .trim();
        }

        const cleanSong   = cleanSongName(songName);
        const cleanArtist = cleanArtistName(artistName);

        const searchStrategies = [
            `https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanSong)}&artist_name=${encodeURIComponent(cleanArtist)}`,
            `https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanSong)}&artist_name=${encodeURIComponent(artistName.split(',')[0].trim())}`,
            `https://lrclib.net/api/search?q=${encodeURIComponent(cleanSong + ' ' + cleanArtist)}`
        ];

        try {
            for (const url of searchStrategies) {
                const res  = await fetch(url, { signal });
                if (!res.ok) continue;

                const data = await res.json();
                const match = Array.isArray(data) && data.find(r => r.plainLyrics || r.syncedLyrics);

                if (match) {
                    if (match.syncedLyrics) {
                        const parsed = parseLRC(match.syncedLyrics);
                        if (parsed.length > 0) {
                            const lang = detectLang(parsed.map(l => l.text).join(' '));
                            _lyricsCache[cacheKey] = { text: null, synced: parsed, lang };
                            renderLyrics(null, parsed, lang);
                            return;
                        }
                    }

                    if (match.plainLyrics) {
                        const cleaned = match.plainLyrics
                            .replace(/\r\n/g, '\n')
                            .replace(/\r/g, '\n')
                            .replace(/\n{3,}/g, '\n\n')
                            .trim();
                        const lang = detectLang(cleaned);
                        _lyricsCache[cacheKey] = { text: cleaned, synced: null, lang };
                        renderLyrics(cleaned, null, lang);
                        return;
                    }
                }
            }
            showLyricsNotFound(songName, artistName);
        } catch (err) {
            if (err.name === "AbortError") return;
            showLyricsNotFound(songName, artistName);
        }
    }

    function renderLyrics(plainText, syncedLines, lang = "en") {
        _syncedLyricLines = [];
        _currentLyricIdx  = -1;

        const langNote = lang === "hi"
            ? `<div class="lyrics-lang-note"><i class="fa-solid fa-language"></i> Hindi lyrics</div>`
            : '';

        lyricsBody.innerHTML = '';

        if (langNote) {
            const noteEl = document.createElement('div');
            noteEl.innerHTML = langNote;
            lyricsBody.appendChild(noteEl.firstElementChild);
        }

        if (syncedLines && syncedLines.length > 0) {
            // Render synced lyrics as individual clickable lines
            syncedLines.forEach((lineData, idx) => {
                const lineEl = document.createElement('div');
                lineEl.className = 'lyric-line';
                lineEl.textContent = lineData.text;
                lineEl.addEventListener('click', () => {
                    audio.currentTime = lineData.time;
                    if (!isPlaying) {
                        audio.play().then(() => syncPlayingUI(true)).catch(() => {});
                    }
                });
                lyricsBody.appendChild(lineEl);
                _syncedLyricLines.push({ time: lineData.time, text: lineData.text, el: lineEl });
            });

            if (audio.currentTime > 0) {
                syncLyricHighlight(audio.currentTime);
            }
        } else if (plainText) {
            const pre = document.createElement('pre');
            pre.className = 'lyrics-text';
            pre.textContent = plainText;
            lyricsBody.appendChild(pre);
        }

        const sourceNote = document.createElement('div');
        sourceNote.className = 'lyrics-source-note';
        sourceNote.innerHTML = `<i class="fa-solid fa-music"></i> via lrclib.net`;
        lyricsBody.appendChild(sourceNote);

        lyricsBody.scrollTop = 0;
    }

    function detectLang(text) {
        const ascii = (text.match(/[a-zA-Z]/g) || []).length;
        const total = text.replace(/\s/g, '').length;
        return total > 0 && (ascii / total) > 0.3 ? "en" : "hi";
    }

    function showLyricsNotFound(song, artist) {
        const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(song + ' ' + artist + ' lyrics')}`;
        const geniusUrl = `https://genius.com/search?q=${encodeURIComponent(song + ' ' + artist)}`;
        _syncedLyricLines = [];
        lyricsBody.innerHTML = `
            <div class="lyrics-not-found">
                <div class="lyrics-nf-icon"><i class="fa-regular fa-file-lines"></i></div>
                <p class="lyrics-nf-title">Lyrics not available</p>
                <p class="lyrics-nf-sub">Couldn't find lyrics for<br><strong>${escapeHtml(song)}</strong></p>
                <div class="lyrics-nf-links">
                    <a href="${googleUrl}" target="_blank" rel="noopener" class="lyrics-nf-link">
                        <i class="fa-brands fa-google"></i> Search Google
                    </a>
                    <a href="${geniusUrl}" target="_blank" rel="noopener" class="lyrics-nf-link">
                        <i class="fa-solid fa-brain"></i> Try Genius
                    </a>
                </div>
            </div>`;
    }

    function escapeHtml(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    lyricsBtn.addEventListener("click", toggleLyricsPanel);
    lyricsCloseBtn.addEventListener("click", closeLyricsPanel);


    //Playlist Render function
    function renderPlaylistInnerSections(title, trackIdArray, isLikedView = false) {
        const listTracks = dbTracks.filter(t => trackIdArray.includes(t._id || t.id));
        const activeId   = currentPlaylistTracks[currentTrackIndex]
            ? (currentPlaylistTracks[currentTrackIndex]._id || currentPlaylistTracks[currentTrackIndex].id)
            : null;

        const bannerArt = isLikedView
            ? `<div class="playlist-banner-art liked-banner"><i class="fa-solid fa-heart"></i></div>`
            : `<div class="playlist-banner-art"><i class="fa-solid fa-music"></i></div>`;

        mainScrollArea.innerHTML = `
            <div class="playlist-header-banner">
                ${bannerArt}
                <div class="playlist-banner-meta">
                    <span class="subtitle">${isLikedView ? 'Your Library' : 'Playlist'}</span>
                    <h1>${title}</h1>
                    <div class="playlist-user-info">
                        <span class="username">${dbUserProfile.name}</span> •
                        <span>${listTracks.length} track${listTracks.length !== 1 ? 's' : ''}</span>
                    </div>
                </div>
            </div>
            <div class="playlist-section-header-grid">
                <div>#</div><div>Title</div><div>Album</div>
                <div class="header-clock"><i class="fa-regular fa-clock"></i></div>
            </div>
            <div class="playlist-list-wrapper">
                ${listTracks.length === 0
                    ? `<p class="empty-msg">${isLikedView ? 'No liked songs yet.' : 'This playlist is empty.'}</p>`
                    : listTracks.map((t, idx) => {
                        const trackId  = t._id || t.id;
                        const isLiked  = dbLikedSongsIds.includes(trackId);
                        const isActive = trackId === activeId && isPlaying;
                        return `
                            <div class="spotify-track-row ${trackId === activeId ? 'active-playing' : ''}"
                                data-id="${trackId}" data-context="${title}">
                                <div class="track-index">
                                    <span class="track-index-number${isActive ? ' hidden' : ''}">${idx + 1}</span>
                                    <div class="equalizer${isActive ? ' playing' : ' hidden'}">
                                        <span></span><span></span><span></span>
                                    </div>
                                </div>
                                <div class="track-meta-block">
                                    <img src="${getCover(t)}" alt="${t.songName}" onerror="this.style.display='none'">
                                    <div class="track-title-info">
                                        <h4>${t.songName || 'Unknown'}</h4>
                                        <p>${t.artistName || 'Unknown'}</p>
                                    </div>
                                </div>
                                <div class="track-album">${t.album || 'Single'}</div>
                                <div class="track-row-actions">
                                    <i class="fa-solid fa-heart heart-icon ${isLiked ? 'liked' : ''}" data-id="${trackId}"></i>
                                </div>
                            </div>`;
                    }).join('')}
            </div>`;
    }

    function renderPlaylistsDirectory() {
        const names = Object.keys(dbPlaylists);
        mainScrollArea.innerHTML = `
            <div class="create-playlist-header">
                <h2>Your Playlists</h2>
                <button class="create-btn" id="createNewPlaylistBtn">
                    <i class="fa-solid fa-plus"></i> New Playlist
                </button>
            </div>
            <div class="song-grid">
                ${names.length === 0
                    ? `<p class="empty-msg">No playlists yet.</p>`
                    : names.map(pName => `
                        <div class="song-card playlist-folder-card" data-playlist="${pName}">
                            <div class="card-img img-placeholder">
                                <i class="fa-solid fa-music folder-icon"></i>
                            </div>
                            <div class="song-info">
                                <h3>${pName}</h3>
                                <p>${dbPlaylists[pName].length} track${dbPlaylists[pName].length !== 1 ? 's' : ''}</p>
                            </div>
                        </div>`).join('')}
            </div>`;
    }

    function renderProfileInsights() {
        mainScrollArea.innerHTML = `
            <div class="section">
                <h2>Profile Analytics</h2>
                <p class="profile-subtitle">Your listening overview.</p>
                <div class="insights-container">
                    <div class="insight-stat-card"><i class="fa-solid fa-headphones"></i>
                        <h3>${dbUserProfile.minutesStreamed || 0} Mins</h3><p>Total Playtime</p></div>
                    <div class="insight-stat-card"><i class="fa-solid fa-heart"></i>
                        <h3>${dbLikedSongsIds.length}</h3><p>Liked Songs</p></div>
                    <div class="insight-stat-card"><i class="fa-solid fa-music"></i>
                        <h3>${Object.keys(dbPlaylists).length}</h3><p>Playlists</p></div>
                    <div class="insight-stat-card"><i class="fa-solid fa-database"></i>
                        <h3>${dbTracks.length}</h3><p>Library Size</p></div>
                </div>
            </div>`;
    }


    // NAV CHIPS
    document.querySelectorAll(".nav-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            document.querySelectorAll(".nav-chip").forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            const target = chip.getAttribute("data-target");
            if (target === "explore") pushView(renderExploreView);
            if (target === "liked") pushView(() => renderPlaylistInnerSections("Liked Songs", dbLikedSongsIds, true));
            if (target === "playlists") pushView(renderPlaylistsDirectory);
        });
    });


    // PROFILE DROPDOWN
    const profileAvatarBtn = document.getElementById("profileAvatarBtn");
    const profileDropdown  = document.getElementById("profileDropdown");
    profileAvatarBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle("show");
    });
    document.addEventListener("click", (e) => {
        if (!profileDropdown.contains(e.target) && e.target !== profileAvatarBtn)
            profileDropdown.classList.remove("show");
    });


    // SEARCH — mobile expand
    const searchWrapper = document.getElementById("searchWrapper");
    const searchIconEl  = document.getElementById("searchIcon");

    searchIconEl.addEventListener("click", () => {
        if (window.innerWidth <= 768) {
            searchWrapper.classList.toggle("mobile-expanded");
            if (searchWrapper.classList.contains("mobile-expanded")) {
                searchBar.style.display = "block";
                searchBar.focus();
            } else {
                searchBar.style.display = "";
            }
        }
    });
    document.addEventListener("click", (e) => {
        if (window.innerWidth <= 768 &&
            searchWrapper.classList.contains("mobile-expanded") &&
            !searchWrapper.contains(e.target)) {
            searchWrapper.classList.remove("mobile-expanded");
            searchBar.style.display = "";
        }
    });
    window.addEventListener("resize", () => {
        if (window.innerWidth > 768) {
            searchWrapper.classList.remove("mobile-expanded");
            searchBar.style.display = "";
            clearSearch.style.display = searchBar.value ? "block" : "none";
            closeVolPopup();
        } else {
            if (!searchWrapper.classList.contains("mobile-expanded")) {
                searchBar.style.display = "";
                if (!searchBar.value) clearSearch.style.display = "none";
            }
        }
    });


    // API HELPERS
    function authFetch(url, opts = {}) {
        const token = localStorage.getItem("token");
        return fetch(url, {
            ...opts,
            headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": "Bearer " + token } : {}),
                ...(opts.headers || {})
            }
        });
    }
    const updateLikeStatusOnDB = (id, add) => authFetch(`${API_BASE_URL}/user/like`, { method: "POST", body: JSON.stringify({ songId: id, isAdding: add }) }).catch(console.error);
    const createPlaylistOnDB = (name) => authFetch(`${API_BASE_URL}/playlists`, { method: "POST", body: JSON.stringify({ name }) }).catch(console.error);
    const addTrackToPlaylistOnDB = (pName, id) => authFetch(`${API_BASE_URL}/playlists/add`, { method: "PUT",  body: JSON.stringify({ playlistName: pName, trackId: id }) }).catch(console.error);


    // GLOBAL EVENT DELEGATION
    document.addEventListener("click", async (e) => {
        const menuItem = e.target.closest(".menu-item");
        if (menuItem) {
            if (menuItem.getAttribute("data-action") === "profile-insights") {
                pushView(renderProfileInsights);
                document.querySelectorAll(".nav-chip").forEach(c => c.classList.remove("active"));
            }
            profileDropdown.classList.remove("show");
            return;
        }

        if (e.target.closest("#createNewPlaylistBtn")) {
            const name = prompt("Enter playlist name:");
            if(name?.trim() && !dbPlaylists[name.trim()]) {
                dbPlaylists[name.trim()] = [];
                await createPlaylistOnDB(name.trim());
                renderPlaylistsDirectory();
            } else if(name?.trim()) {
                alert("Playlist already exists.");
            }
            return;
        }

        const folder = e.target.closest(".playlist-folder-card");
        if(folder) {
            const pName = folder.getAttribute("data-playlist");
            pushView(() => renderPlaylistInnerSections(pName, dbPlaylists[pName], false));
            return;
        }

        const heart = e.target.closest(".heart-icon");
        if(heart) {
            e.stopPropagation();
            const id = heart.getAttribute("data-id");
            const adding = !dbLikedSongsIds.includes(id);
            if(adding) {
                dbLikedSongsIds.push(id);
                heart.classList.add("liked");
            }
            else {
                dbLikedSongsIds = dbLikedSongsIds.filter(i => i !== id); 
                heart.classList.remove("liked"); 
            }
            await updateLikeStatusOnDB(id, adding);
            if (document.querySelector(".nav-chip.active")?.getAttribute("data-target") === "liked")
                renderPlaylistInnerSections("Liked Songs", dbLikedSongsIds, true);
            return;
        }

        const addIcon = e.target.closest(".add-icon");
        if(addIcon) {
            e.stopPropagation();
            const id    = addIcon.getAttribute("data-id");
            const names = Object.keys(dbPlaylists);
            if(!names.length) {
                alert("Create a playlist first.");
                return;
            }
            const target = prompt(`Playlists: ${names.join(", ")}\n\nEnter playlist name:`);
            if(target && dbPlaylists[target] !== undefined) {
                if(!dbPlaylists[target].includes(id)) {
                    dbPlaylists[target].push(id);
                    await addTrackToPlaylistOnDB(target, id);
                    alert(`Added to "${target}".`);
                } else {
                    alert("Already in playlist.");
                }
            } else if(target) {
                alert(`"${target}" not found.`);
            }
            return;
        }

        const card = e.target.closest(".song-card:not(.playlist-folder-card)");
        if(card) {
            const trackId = card.getAttribute("data-id");
            currentPlaylistTracks = [...dbTracks];
            const idx = currentPlaylistTracks.findIndex(t => t._id === trackId || t.id === trackId);
            if(idx === -1) return;
            if(idx === currentTrackIndex) {
                togglePlay();
            }
            else {
                loadTrack(idx); audio.play().then(() => syncPlayingUI(true)).catch(() => {});
            }
            return;
        }

        const row = e.target.closest(".spotify-track-row");
        if(row) {
            const trackId = row.getAttribute("data-id");
            const context = row.getAttribute("data-context");
            currentPlaylistTracks = dbPlaylists[context]
                ? dbTracks.filter(t => dbPlaylists[context].includes(t._id || t.id))
                : context === "Liked Songs"
                    ? dbTracks.filter(t => dbLikedSongsIds.includes(t._id || t.id))
                    : [...dbTracks];
            const idx = currentPlaylistTracks.findIndex(t => t._id === trackId || t.id === trackId);
            if(idx === -1) return;
            loadTrack(idx);
            audio.play().then(() => syncPlayingUI(true)).catch(() => {});
        }
    });


    // AUTHENTICATION
    const authOverlay = document.getElementById("authOverlay");
    const loginForm   = document.getElementById("loginForm");
    const signupForm  = document.getElementById("signupForm");

    function bindPasswordToggle(toggleId, inputId) {
        document.getElementById(toggleId).addEventListener("click", () => {
            const inp  = document.getElementById(inputId);
            const icon = document.getElementById(toggleId);
            const show = inp.type === "password";
            inp.type = show ? "text" : "password";
            icon.className = show ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
        });
    }
    bindPasswordToggle("toggleLoginPass",  "loginPassword");
    bindPasswordToggle("toggleSignupPass", "signupPassword");

    function showLoginForm() {
        signupForm.style.display = "none";
        loginForm.style.display = "block";
    }
    function showSignupForm() {
        loginForm.style.display = "none";
        signupForm.style.display = "block";
    }

    document.getElementById("goToSignup").addEventListener("click", () => { showSignupForm(); hideError("signupError"); });
    document.getElementById("goToLogin").addEventListener("click",  () => { showLoginForm();  hideError("loginError");  });

    function showError(id, msg, positive = false) {
        const el = document.getElementById(id);
        el.textContent = msg;
        el.classList.toggle("positive", positive);
        el.classList.add("show");
    }
    function hideError(id) { document.getElementById(id).classList.remove("show"); }

    function setButtonLoading(btn, loading, idle, busy) {
        btn.disabled = loading;
        btn.classList.toggle("loading", loading);
        btn.querySelector("span").textContent = loading ? busy : idle;
    }

    function showAuth() { authOverlay.style.display = "flex"; appShell.style.display = "none"; }
    function showApp()  { authOverlay.style.display = "none"; appShell.style.display = "flex"; }

    function updateHeaderProfile(profile) {
        const n = document.getElementById("dropdownProfileName");
        const p = document.getElementById("dropdownAccountStatus");
        const a = document.getElementById("profileAvatarBtn");
        if(n) n.textContent = profile.name || "User";
        if(p) p.textContent = profile.plan || "Free";
        if(a) a.textContent = (profile.name || "U").charAt(0).toUpperCase();
    }

    // LOGIN FUNCTIONALITY
    const loginBtn = document.getElementById("loginBtn");
    loginBtn.addEventListener("click", async () => {
        const email    = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;
        if(!email || !password) {
            showError("loginError", "Please enter your email and password.");
            return;
        }

        setButtonLoading(loginBtn, true, "Log In", "Logging in...");
        hideError("loginError");
        try {
            const res  = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if(!res.ok) {
                showError("loginError", data.msg || "Invalid email or password.");
            } else {
                localStorage.setItem("token", data.token);
                if(data.profile) {
                    dbUserProfile = data.profile;
                    updateHeaderProfile(data.profile);
                }
                if (data.likedSongs) {
                    dbLikedSongsIds = data.likedSongs;
                    showApp();
                    syncDatabaseInstance();
                }
            }
        } catch { showError("loginError", "Could not connect to server. Is the backend running?"); }
        finally  { setButtonLoading(loginBtn, false, "Log In", "Logging in..."); }
    });
    ["loginEmail", "loginPassword"].forEach(id => {
        document.getElementById(id).addEventListener("keydown", e => { if (e.key === "Enter") loginBtn.click(); });
    });

    // SIGNUP FUNCTIONALITY
    const signupBtn = document.getElementById("signupBtn");
    signupBtn.addEventListener("click", async () => {
        const username = document.getElementById("signupUsername").value.trim();
        const email    = document.getElementById("signupEmail").value.trim();
        const password = document.getElementById("signupPassword").value;
        if(!username || !email || !password) {
            showError("signupError", "All fields are required.");
            return;
        }
        if(password.length < 6) {
            showError("signupError", "Password must be at least 6 characters.");
            return;
        }

        setButtonLoading(signupBtn, true, "Create Account", "Creating account...");
        hideError("signupError");
        try {
            const res  = await fetch(`${API_BASE_URL}/api/auth/signup`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password })
            });
            const data = await res.json();
            if(!res.ok) {
                showError("signupError", data.msg || "Signup failed. Please try again.");
            } else {
                showLoginForm();
                showError("loginError", "Account created! Log in to continue.", true);
                document.getElementById("loginEmail").value = email;
            }
        } catch { showError("signupError", "Could not connect to server. Is the backend running?"); }
        finally { setButtonLoading(signupBtn, false, "Create Account", "Creating account..."); }
    });
    ["signupUsername", "signupEmail", "signupPassword"].forEach(id => {
        document.getElementById(id).addEventListener("keydown", e => { if (e.key === "Enter") signupBtn.click(); });
    });

    // LOGOUT FUNCTIONALITY
    document.getElementById("logoutBtn").addEventListener("click", () => {
        localStorage.removeItem("token");
        localStorage.removeItem(SESSION_KEY);

        dbTracks = []; dbPlaylists = {}; dbLikedSongsIds = [];
        dbUserProfile = { name: "User", plan: "Free", minutesStreamed: 0 };
        currentPlaylistTracks = []; currentTrackIndex = -1;
        audio.pause(); audio.src = "";
        viewHistory = []; viewHistoryIndex = -1;

        footerTitle.textContent  = "Select a track";
        footerArtist.textContent = "Ready to stream";
        footerCover.src = "";
        syncPlayingUI(false);
        resetAccentColor();

        closeLyricsPanel();
        lyricsBtn.disabled = true;
        lyricsSongTitle.textContent  = "—";
        lyricsArtistName.textContent = "—";
        lyricsBody.innerHTML = `<p class="lyrics-placeholder">Play a song to see its lyrics.</p>`;
        _lyricsCache = {};
        _syncedLyricLines = [];
        _currentLyricIdx  = -1;

        if(progressBar) {
            progressBar.value = 0;
            updateRangeFill(progressBar);
        }
        if(mobileProgressBar) {
            mobileProgressBar.value = 0;
            updateRangeFill(mobileProgressBar);
        }

        document.getElementById("loginEmail").value = "";
        document.getElementById("loginPassword").value = "";
        hideError("loginError");
        hideError("signupError");
        showLoginForm();
        showAuth();
    });


    // INIT FUNCTION
    function updateGreeting() {
        const h = new Date().getHours();
        const el = document.getElementById("welcomeGreeting");
        if (el) el.textContent = h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
    }
    updateGreeting();
    setInterval(updateGreeting, 3_600_000);

    audio.volume = (volumeBar ? volumeBar.value / 100 : 0.7);
    updateNavArrows();
    syncVerticalVolume(volumeBar ? parseInt(volumeBar.value) : 70);

    if(localStorage.getItem("token")) {
        showApp();
        syncDatabaseInstance();
    }
    else {
        showAuth();
    }
});