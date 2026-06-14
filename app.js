document.addEventListener("DOMContentLoaded", () => {
    const API_BASE_URL = "http://localhost:5000/api";

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

    // Nav arrow history stack
    let viewHistory = [];
    let viewHistoryIndex = -1;

    const mainScrollArea  = document.getElementById("mainScrollArea");
    const playBtn         = document.getElementById("play");
    const prevBtn         = document.getElementById("prev");
    const nextBtn         = document.getElementById("next");
    const shuffleBtn      = document.getElementById("shuffle");
    const loopBtn         = document.getElementById("loop");
    const progressBar     = document.getElementById("progressBar");
    const volumeBar       = document.getElementById("volumeBar");
    const currentTimeText = document.getElementById("currentTime");
    const totalTimeText   = document.getElementById("totalTime");
    const footerCover     = document.getElementById("footerCover");
    const footerTitle     = document.getElementById("footerTitle");
    const footerArtist    = document.getElementById("footerArtist");
    const footerEqualizer = document.getElementById("footerEqualizer");
    const coverRingWrap   = document.getElementById("coverRingWrap");
    const footerGlow      = document.getElementById("footerGlow");

    // DB mein coverPath bhi ho sakta hai, cover bhi — dono handle karo
    function getCover(track) {
        return track.cover || track.coverPath || '';
    }
    function getAudioSrc(track) {
        return track.songUrl || track.filePath || '';
    }

    // =========================================================
    // NAV HISTORY — back / forward arrows
    // =========================================================
    function pushView(renderFn) {
        if (viewHistoryIndex < viewHistory.length - 1) {
            viewHistory = viewHistory.slice(0, viewHistoryIndex + 1);
        }
        viewHistory.push(renderFn);
        viewHistoryIndex = viewHistory.length - 1;
        updateNavArrows();
        renderFn();
    }

    function updateNavArrows() {
        const backBtn    = document.getElementById("backBtn");
        const forwardBtn = document.getElementById("forwardBtn");
        if (backBtn)    backBtn.disabled    = viewHistoryIndex <= 0;
        if (forwardBtn) forwardBtn.disabled = viewHistoryIndex >= viewHistory.length - 1;
    }

    document.getElementById("backBtn").addEventListener("click", () => {
        if (viewHistoryIndex > 0) {
            viewHistoryIndex--;
            updateNavArrows();
            viewHistory[viewHistoryIndex]();
        }
    });

    document.getElementById("forwardBtn").addEventListener("click", () => {
        if (viewHistoryIndex < viewHistory.length - 1) {
            viewHistoryIndex++;
            updateNavArrows();
            viewHistory[viewHistoryIndex]();
        }
    });

    // =========================================================
    // PLAY STATE SYNC — footer, cards, rows + animations
    // =========================================================
    function syncPlayingUI(playing) {
        isPlaying = playing;
        playBtn.innerHTML = playing
            ? `<i class="fa-solid fa-circle-pause"></i>`
            : `<i class="fa-solid fa-circle-play"></i>`;

        const activeId = currentPlaylistTracks[currentTrackIndex]
            ? (currentPlaylistTracks[currentTrackIndex]._id || currentPlaylistTracks[currentTrackIndex].id)
            : null;

        // Song cards — glow border + equalizer badge
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

        // Track rows — highlight + equalizer in index column
        document.querySelectorAll(".spotify-track-row").forEach(row => {
            const isActive = row.getAttribute("data-id") === activeId;
            row.classList.toggle("active-playing", isActive);
            const eq  = row.querySelector(".equalizer");
            const num = row.querySelector(".track-index-number");
            if (eq && num) {
                const showEq = isActive && playing;
                eq.classList.toggle("playing", showEq);
                eq.classList.toggle("hidden", !showEq);
                num.classList.toggle("hidden", showEq);
            }
        });

        // Footer — equalizer + pulse ring + ambient glow
        footerEqualizer.classList.toggle("playing", playing && currentTrackIndex !== -1);
        coverRingWrap.classList.toggle("playing", playing && currentTrackIndex !== -1);
        footerGlow.classList.toggle("active", playing && currentTrackIndex !== -1);
    }

    // =========================================================
    // 1. CARD GENERATOR
    // =========================================================
    function generateCards(tracks) {
        if (!tracks || tracks.length === 0)
            return `<p class="empty-msg">No tracks found.</p>`;

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

    // =========================================================
    // 2. EXPLORE VIEW — grid layout Spotify jaisa
    // =========================================================
    function renderExploreView() {
        if (dbTracks.length === 0) {
            mainScrollArea.innerHTML = `<div class="loading-placeholder">No tracks in database.</div>`;
            return;
        }

        // Category wise grouping
        const categories = {};
        dbTracks.forEach(t => {
            const cat = t.category || 'trending';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(t);
        });

        let html = '';
        Object.entries(categories).forEach(([cat, tracks]) => {
            const label = cat.charAt(0).toUpperCase() + cat.slice(1);
            html += `
                <div class="section">
                    <h2>${label} Tracks</h2>
                    <div class="song-grid">${generateCards(tracks)}</div>
                </div>`;
        });

        mainScrollArea.innerHTML = html;
    }

    // =========================================================
    // 3. DATABASE SYNC
    // =========================================================
    async function syncDatabaseInstance() {
        try {
            mainScrollArea.innerHTML = `<div class="loading-placeholder"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>`;
            const token = localStorage.getItem("token");
            const authH = token ? { "Authorization": "Bearer " + token } : {};

            const [songsRes, playlistsRes, userRes] = await Promise.all([
                fetch(`${API_BASE_URL}/songs`).catch(() => null),
                fetch(`${API_BASE_URL}/playlists/all`, { headers: authH }).catch(() => null),
                fetch(`${API_BASE_URL}/auth/profile`, { headers: authH }).catch(() => null)
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
        } catch (err) {
            console.error("Sync error:", err);
            mainScrollArea.innerHTML = `
                <div class="loading-placeholder error">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    Backend connection failed.
                </div>`;
        }
    }

    // =========================================================
    // 4. SEARCH
    // =========================================================
    const searchBar   = document.getElementById("searchbar");
    const clearSearch = document.getElementById("clearSearch");

    searchBar.addEventListener("input", (e) => {
        const val = e.target.value.trim().toLowerCase();
        clearSearch.style.display = val ? "block" : "none";
        if (!val) { renderExploreView(); return; }

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

    // =========================================================
    // 5. PLAYBACK ENGINE
    // =========================================================
    function loadTrack(index) {
        if (index < 0 || index >= currentPlaylistTracks.length) return;
        currentTrackIndex = index;
        const track = currentPlaylistTracks[index];

        audio.src = getAudioSrc(track);
        audio.load();

        footerCover.src          = getCover(track);
        footerTitle.textContent  = track.songName   || 'Unknown Title';
        footerArtist.textContent = track.artistName || 'Unknown Artist';
    }

    function togglePlay() {
        if (currentTrackIndex === -1 && currentPlaylistTracks.length > 0) loadTrack(0);
        if (!audio.src && currentPlaylistTracks.length > 0) loadTrack(Math.max(0, currentTrackIndex));

        if (isPlaying) {
            audio.pause();
        } else {
            audio.play()
                .then(() => syncPlayingUI(true))
                .catch(err => console.warn("Playback blocked:", err));
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

    shuffleBtn.addEventListener("click", () => { isShuffle = !isShuffle; shuffleBtn.classList.toggle("active", isShuffle); });
    loopBtn.addEventListener("click",    () => { isLoop    = !isLoop;    loopBtn.classList.toggle("active", isLoop); });

    audio.addEventListener("ended", () => {
        if (isLoop) { audio.currentTime = 0; audio.play().then(() => syncPlayingUI(true)).catch(() => {}); }
        else nextBtn.click();
    });

    // Browser-level play/pause events (autoplay block lift, media keys, etc.)
    audio.addEventListener("play",  () => syncPlayingUI(true));
    audio.addEventListener("pause", () => syncPlayingUI(false));

    audio.addEventListener("timeupdate", () => {
        if (audio.duration) {
            progressBar.value = (audio.currentTime / audio.duration) * 100;
            currentTimeText.textContent = formatTime(audio.currentTime);
            totalTimeText.textContent   = formatTime(audio.duration);
        }
    });

    progressBar.addEventListener("input", () => {
        if (audio.duration) audio.currentTime = (progressBar.value / 100) * audio.duration;
    });
    volumeBar.addEventListener("input", () => { audio.volume = volumeBar.value / 100; });

    document.getElementById("volumeIcon").addEventListener("click", () => {
        audio.muted = !audio.muted;
        document.getElementById("volumeIcon").className =
            audio.muted ? "fa-solid fa-volume-xmark" : "fa-solid fa-volume-high";
    });

    function formatTime(secs) {
        const m = Math.floor(secs / 60), s = Math.floor(secs % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    // =========================================================
    // 6. OTHER VIEW RENDERERS
    // =========================================================
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
                                    <img src="${getCover(t)}" alt="${t.songName}"
                                         onerror="this.style.display='none'">
                                    <div class="track-title-info">
                                        <h4>${t.songName || 'Unknown'}</h4>
                                        <p>${t.artistName || 'Unknown'}</p>
                                    </div>
                                </div>
                                <div class="track-album">${t.album || 'Single'}</div>
                                <div class="track-row-actions">
                                    <i class="fa-solid fa-heart heart-icon ${isLiked ? 'liked' : ''}"
                                       data-id="${trackId}"></i>
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

    // =========================================================
    // 7. NAV CHIPS
    // =========================================================
    document.querySelectorAll(".nav-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            document.querySelectorAll(".nav-chip").forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            const target = chip.getAttribute("data-target");
            if (target === "explore")   pushView(renderExploreView);
            if (target === "liked")     pushView(() => renderPlaylistInnerSections("Liked Songs", dbLikedSongsIds, true));
            if (target === "playlists") pushView(renderPlaylistsDirectory);
        });
    });

    // =========================================================
    // 8. PROFILE DROPDOWN
    // =========================================================
    const profileAvatarBtn = document.getElementById("profileAvatarBtn");
    const profileDropdown  = document.getElementById("profileDropdown");
    profileAvatarBtn.addEventListener("click", (e) => { e.stopPropagation(); profileDropdown.classList.toggle("show"); });
    document.addEventListener("click", (e) => {
        if (!profileDropdown.contains(e.target) && e.target !== profileAvatarBtn)
            profileDropdown.classList.remove("show");
    });

    // =========================================================
    // SEARCH — mobile expand + resize state fix
    // =========================================================
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
        } else {
            if (!searchWrapper.classList.contains("mobile-expanded")) {
                searchBar.style.display = "";
                if (!searchBar.value) clearSearch.style.display = "none";
            }
        }
    });

    // =========================================================
    // 9. API HELPERS
    // =========================================================
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
    const updateLikeStatusOnDB    = (id, add)  => authFetch(`${API_BASE_URL}/user/like`,      { method: "POST", body: JSON.stringify({ songId: id, isAdding: add }) }).catch(console.error);
    const createPlaylistOnDB      = (name)     => authFetch(`${API_BASE_URL}/playlists`,      { method: "POST", body: JSON.stringify({ name }) }).catch(console.error);
    const addTrackToPlaylistOnDB  = (pName, id) => authFetch(`${API_BASE_URL}/playlists/add`, { method: "PUT",  body: JSON.stringify({ playlistName: pName, trackId: id }) }).catch(console.error);

    // =========================================================
    // 10. GLOBAL EVENT DELEGATION
    // =========================================================
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
            if (name?.trim() && !dbPlaylists[name.trim()]) {
                dbPlaylists[name.trim()] = [];
                await createPlaylistOnDB(name.trim());
                renderPlaylistsDirectory();
            } else if (name?.trim()) { alert("Playlist already exists."); }
            return;
        }

        const folder = e.target.closest(".playlist-folder-card");
        if (folder) {
            const pName = folder.getAttribute("data-playlist");
            pushView(() => renderPlaylistInnerSections(pName, dbPlaylists[pName], false));
            return;
        }

        const heart = e.target.closest(".heart-icon");
        if (heart) {
            e.stopPropagation();
            const id = heart.getAttribute("data-id");
            const adding = !dbLikedSongsIds.includes(id);
            if (adding) { dbLikedSongsIds.push(id); heart.classList.add("liked"); }
            else { dbLikedSongsIds = dbLikedSongsIds.filter(i => i !== id); heart.classList.remove("liked"); }
            await updateLikeStatusOnDB(id, adding);
            if (document.querySelector(".nav-chip.active")?.getAttribute("data-target") === "liked")
                renderPlaylistInnerSections("Liked Songs", dbLikedSongsIds, true);
            return;
        }

        const addIcon = e.target.closest(".add-icon");
        if (addIcon) {
            e.stopPropagation();
            const id    = addIcon.getAttribute("data-id");
            const names = Object.keys(dbPlaylists);
            if (!names.length) { alert("Create a playlist first."); return; }
            const target = prompt(`Playlists: ${names.join(", ")}\n\nEnter playlist name:`);
            if (target && dbPlaylists[target] !== undefined) {
                if (!dbPlaylists[target].includes(id)) {
                    dbPlaylists[target].push(id);
                    await addTrackToPlaylistOnDB(target, id);
                    alert(`Added to "${target}".`);
                } else { alert("Already in playlist."); }
            } else if (target) { alert(`"${target}" not found.`); }
            return;
        }

        // Card click — same card = toggle play/pause
        const card = e.target.closest(".song-card:not(.playlist-folder-card)");
        if (card) {
            const trackId = card.getAttribute("data-id");
            currentPlaylistTracks = [...dbTracks];
            const idx = currentPlaylistTracks.findIndex(t => (t._id === trackId || t.id === trackId));
            if (idx === -1) return;

            if (idx === currentTrackIndex) {
                togglePlay();
            } else {
                loadTrack(idx);
                audio.play().then(() => syncPlayingUI(true)).catch(() => {});
            }
            return;
        }

        const row = e.target.closest(".spotify-track-row");
        if (row) {
            const trackId = row.getAttribute("data-id");
            const context = row.getAttribute("data-context");

            currentPlaylistTracks = dbPlaylists[context]
                ? dbTracks.filter(t => dbPlaylists[context].includes(t._id || t.id))
                : context === "Liked Songs"
                    ? dbTracks.filter(t => dbLikedSongsIds.includes(t._id || t.id))
                    : [...dbTracks];

            const idx = currentPlaylistTracks.findIndex(t => (t._id === trackId || t.id === trackId));
            if (idx === -1) return;
            loadTrack(idx);
            audio.play().then(() => syncPlayingUI(true)).catch(() => {});
        }
    });

    // =========================================================
    // 11. AUTH — login / signup / token gate
    // =========================================================

    const authOverlay  = document.getElementById("authOverlay");
    const appShell     = document.getElementById("appShell");
    const loginForm    = document.getElementById("loginForm");
    const signupForm   = document.getElementById("signupForm");

    function bindPasswordToggle(toggleId, inputId) {
        document.getElementById(toggleId).addEventListener("click", () => {
            const inp  = document.getElementById(inputId);
            const icon = document.getElementById(toggleId);
            const show = inp.type === "password";
            inp.type   = show ? "text" : "password";
            icon.className = show ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
        });
    }
    bindPasswordToggle("toggleLoginPass",  "loginPassword");
    bindPasswordToggle("toggleSignupPass", "signupPassword");

    function showLoginForm() {
        signupForm.style.display = "none";
        loginForm.style.display  = "block";
    }
    function showSignupForm() {
        loginForm.style.display  = "none";
        signupForm.style.display = "block";
    }

    document.getElementById("goToSignup").addEventListener("click", () => {
        showSignupForm();
        hideError("signupError");
    });
    document.getElementById("goToLogin").addEventListener("click", () => {
        showLoginForm();
        hideError("loginError");
    });

    function showError(id, msg, positive = false) {
        const el = document.getElementById(id);
        el.textContent = msg;
        el.classList.toggle("positive", positive);
        el.classList.add("show");
    }
    function hideError(id) {
        document.getElementById(id).classList.remove("show");
    }

    function setButtonLoading(btn, loading, idleText, loadingText) {
        btn.disabled = loading;
        btn.classList.toggle("loading", loading);
        btn.querySelector("span").textContent = loading ? loadingText : idleText;
    }

    function showAuth() {
        authOverlay.style.display = "flex";
        appShell.style.display    = "none";
    }
    function showApp() {
        authOverlay.style.display = "none";
        appShell.style.display    = "flex";
    }

    function updateHeaderProfile(profile) {
        const nameEl   = document.getElementById("dropdownProfileName");
        const planEl   = document.getElementById("dropdownAccountStatus");
        const avatarEl = document.getElementById("profileAvatarBtn");
        if (nameEl)   nameEl.textContent   = profile.name  || "User";
        if (planEl)   planEl.textContent   = profile.plan  || "Free";
        if (avatarEl) avatarEl.textContent = (profile.name || "U").charAt(0).toUpperCase();
    }

    // LOGIN
    const loginBtn = document.getElementById("loginBtn");
    loginBtn.addEventListener("click", async () => {
        const email    = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;

        if (!email || !password) {
            showError("loginError", "Please enter your email and password.");
            return;
        }

        setButtonLoading(loginBtn, true, "Log In", "Logging in...");
        hideError("loginError");

        try {
            const res  = await fetch(`${API_BASE_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();

            if (!res.ok) {
                showError("loginError", data.msg || "Invalid email or password.");
            } else {
                localStorage.setItem("token", data.token);
                if (data.profile) {
                    dbUserProfile = data.profile;
                    updateHeaderProfile(data.profile);
                }
                if (data.likedSongs) dbLikedSongsIds = data.likedSongs;
                showApp();
                syncDatabaseInstance();
            }
        } catch (err) {
            showError("loginError", "Could not connect to server. Is the backend running?");
        } finally {
            setButtonLoading(loginBtn, false, "Log In", "Logging in...");
        }
    });

    ["loginEmail", "loginPassword"].forEach(id => {
        document.getElementById(id).addEventListener("keydown", (e) => {
            if (e.key === "Enter") loginBtn.click();
        });
    });

    // SIGNUP
    const signupBtn = document.getElementById("signupBtn");
    signupBtn.addEventListener("click", async () => {
        const username = document.getElementById("signupUsername").value.trim();
        const email    = document.getElementById("signupEmail").value.trim();
        const password = document.getElementById("signupPassword").value;

        if (!username || !email || !password) {
            showError("signupError", "All fields are required.");
            return;
        }
        if (password.length < 6) {
            showError("signupError", "Password must be at least 6 characters.");
            return;
        }

        setButtonLoading(signupBtn, true, "Create Account", "Creating account...");
        hideError("signupError");

        try {
            const res  = await fetch(`${API_BASE_URL}/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password })
            });
            const data = await res.json();

            if (!res.ok) {
                showError("signupError", data.msg || "Signup failed. Please try again.");
            } else {
                showLoginForm();
                showError("loginError", "Account created! Log in to continue.", true);
                document.getElementById("loginEmail").value = email;
            }
        } catch (err) {
            showError("signupError", "Could not connect to server. Is the backend running?");
        } finally {
            setButtonLoading(signupBtn, false, "Create Account", "Creating account...");
        }
    });

    ["signupUsername", "signupEmail", "signupPassword"].forEach(id => {
        document.getElementById(id).addEventListener("keydown", (e) => {
            if (e.key === "Enter") signupBtn.click();
        });
    });

    // =========================================================
    // LOGOUT
    // =========================================================
    document.getElementById("logoutBtn").addEventListener("click", () => {
        localStorage.removeItem("token");

        // Reset all state
        dbTracks = []; dbPlaylists = {}; dbLikedSongsIds = [];
        dbUserProfile = { name: "User", plan: "Free", minutesStreamed: 0 };
        currentPlaylistTracks = []; currentTrackIndex = -1;
        audio.pause(); audio.src = "";
        viewHistory = []; viewHistoryIndex = -1;

        // Reset footer + animations
        footerTitle.textContent  = "Select a track";
        footerArtist.textContent = "Ready to stream";
        footerCover.src = "";
        syncPlayingUI(false);

        // Reset auth forms to clean state
        document.getElementById("loginEmail").value    = "";
        document.getElementById("loginPassword").value = "";
        hideError("loginError");
        hideError("signupError");
        showLoginForm();

        showAuth();
    });

    // =========================================================
    // 12. INIT — check token on load
    // =========================================================
    const hour  = new Date().getHours();
    const greet = document.getElementById("welcomeGreeting");
    if (greet) greet.textContent = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

    audio.volume = volumeBar.value / 100;
    updateNavArrows();

    if (localStorage.getItem("token")) {
        showApp();
        syncDatabaseInstance();
    } else {
        showAuth();
    }
});