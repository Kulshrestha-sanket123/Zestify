let masterAudio = new Audio();
let allSongs = [];
let currentPlaylistSongs = [];
let songIndex = 0;
let isRepeat = false;
let isShuffle = false;
let navHistory = ["Home"];
let historyIndex = 0;
let isNavigating = false;
let likedSongs = JSON.parse(localStorage.getItem("likedSongs")) || [];

const playBtn = document.getElementById("play");
const progressBar = document.getElementById("progressBar");
const welcomeGreeting = document.getElementById("welcomeGreeting");
const searchInput = document.getElementById("searchbar");
const searchDropdown = document.getElementById("searchDropdown");
const clearSearch = document.getElementById("clearSearch");
const wave = document.getElementById("wave");
const volumeBar = document.getElementById("volumeBar");
const volIcon = document.getElementById("volIcon");
const modal = document.getElementById("authModal");
const loginBtn = document.getElementById("loginBtn");
const closeBtn = document.querySelector(".close-btn");
const modalTitle = document.getElementById("modalTitle");
const switchForm = document.getElementById("switchForm");
const usernameField = document.getElementById("username");
const submitBtn = document.getElementById("submitBtn");
const toggleText = document.getElementById("toggleText");
const authForm = document.getElementById("authForm");
const mainScrollArea = document.querySelector(".main-scroll-area");
const backBtn = document.getElementById("backBtn");
const forwardBtn = document.getElementById("forwardBtn");


//Fetching of data
async function initApp() {
    try {
        const response = await fetch("http://localhost:5000/api/songs/all");
        allSongs = await response.json();

        currentPlaylistSongs = [...allSongs];

        console.log("Songs loaded from DB:", allSongs.length);
        renderSections(allSongs);
        updateGreeting();
        updateAuthUI();
        fetchUserPlaylists();
    } catch (err) {
        console.error("Database fetch error:", err);
        welcomeGreeting.innerText = "Error Loading Library";
    }
}


let isLogin = true;
switchForm.onclick = () => {
    isLogin = !isLogin;

    if (isLogin) {
        modalTitle.innerText = "Login to Zestify";
        usernameField.style.display = "none";
        usernameField.required = false;
        submitBtn.innerText = "Login";
        toggleText.innerHTML = `Don't have an account? <span id="switchForm" style="color:#14C8C8; cursor:pointer;">Sign Up</span>`;
    }
    else {
        modalTitle.innerText = "Create your Zestify Account";
        usernameField.style.display = "block";
        usernameField.required = true;
        submitBtn.innerText = "Sign Up";
        toggleText.innerHTML = `Already have an account? <span id="switchForm" style="color:#14C8C8; cursor:pointer;">Login</span>`;
    }
    document.getElementById("switchForm").onclick = switchForm.onclick;
};

authForm.onsubmit = async (e) => {
    e.preventDefault();
    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/signup";
    const payload = {
        email: document.getElementById("email").value,
        password: document.getElementById("password").value
    };
    if (!isLogin) {
        payload.username = document.getElementById("username").value;
    }

    try {
        const response = await fetch(`http://localhost:5000${endpoint}`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (response.ok) {
            alert(isLogin ? "Welcome back!" : "Account Created!");
            if (isLogin) {
                localStorage.setItem("token", data.token);
                localStorage.setItem("username", data.user.username);
                localStorage.setItem("likedSongs", JSON.stringify(data.user.likedSongs || []));
                modal.style.display = "none";
                loginBtn.innerText = data.user.username;
                location.reload();
            }
            else {
                isLogin = true;
                switchForm.click();
            }
        }
        else {
            alert(data.msg || data.message || "Authentication failed");
        }
    }
    catch (err) {
        console.error("Auth error:", err);
        alert("An error occurred. Please try again.");
    }
};

function updateAuthUI() {
    const token = localStorage.getItem("token");

    if (token) {
        loginBtn.innerText = "Logout";
        loginBtn.onclick = () => {
            if (confirm("Do you want to logout?")) {
                logout();
            }
        };
    }
    else {
        loginBtn.innerText = "Login";
        loginBtn.onclick = () => {
            modal.style.display = "block";
            isLogin = true;
            modalTitle.innerText = "Login to Zestify";
            usernameField.style.display = "none";
            submitBtn.innerText = "Login";
            toggleText.innerHTML = `Don't have an account? <span id="switchForm" style="color:#14C8C8; cursor:pointer;">Sign Up</span>`;
            document.getElementById("switchForm").onclick = switchForm.onclick;
        };
    }
}

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("likedSongs");
    localStorage.clear();
    alert("Logged out successfully");
    location.reload();
}

closeBtn.onclick = () => {
    modal.style.display = "none";
}

window.onclick = (event) => {
    if (event.target == modal) {
        modal.style.display = "none";
    }
};


// Sidebar navigation smooth scroll logic
document.querySelectorAll('.sidebar-content ul li').forEach(item => {
    item.addEventListener('click', () => {
        const text = item.innerText.trim();
        const mainScrollArea = document.querySelector(".main-scroll-area");

        if(text.includes("Create Playlist")) {
            createPlaylist();
            return;
        }

        let currentTab = "";
        if (text.includes("Home")) currentTab = "Home";
        else if (text.includes("Explore")) currentTab = "Explore";
        else if (text.includes("Liked Songs")) currentTab = "Liked Songs";
        else if (text.includes("Playlist")) currentTab = "Playlist";

        if (!isNavigating && currentTab && navHistory[historyIndex] !== currentTab) {
            navHistory = navHistory.slice(0, historyIndex + 1);
            navHistory.push(currentTab);
            historyIndex++;
        }
        switchTabContent(currentTab);

        document.querySelectorAll('.sidebar-content ul li').forEach(li => li.classList.remove("active"));
        item.classList.add("active");

        if (text.includes("Liked Songs")) {
            const favoriteSongs = allSongs.filter(song => likedSongs.includes(song._id));

            mainScrollArea.innerHTML = `
            <div class="section">
            <div class="song-container" id="likedSection"></div>
            </div>`;

            renderFilteredSongs(favoriteSongs, "likedSection");
            welcomeGreeting.innerText = "Favorites";
        }
        else if (text.includes("Home")) {
            currentPlaylistSongs = [...allSongs];

            mainScrollArea.innerHTML = `
            <div class="section"><h2>Top Hits</h2><div class="song-container" id="topHits"></div></div>
            <div class="section"><h2>Trending Albums</h2><div class="song-container" id="trendingAlbums"></div></div>
            <div class="section"><h2>New Releases</h2><div class="song-container" id="newReleases"></div></div>
            <div class="section"><h2>Recommended for You</h2><div class="song-container" id="recommended"></div></div>`;

            renderSections(allSongs);
            updateGreeting();
            window.scrollTo({top: 0, behavior: 'smooth'});
        }
        else if (text.includes("Explore")) {
            mainScrollArea.innerHTML = `
            <div class="section">
            <h2>Explore by Category</h2>
            <div class="category-grid">
                <div class="cat-card" onclick="filterByCategory('trending')">🔥 Trending</div>
                    <div class="cat-card" onclick="filterByCategory('topHits')">🎸 Top Hits</div>
                    <div class="cat-card" onclick="filterByCategory('newReleases')">✨ New</div>
                    <div class="cat-card" onclick="filterByCategory('recommended')">🎧 For You</div>
                    </div>
                    <div id="exploreResults" class="song-container"></div>
                    </div>`;
                    welcomeGreeting.innerText = "Explore";
        }
        else if (text.includes("Playlist")) {
            welcomeGreeting.innerText = "Your Playlists";

            mainScrollArea.innerHTML = `
            <div class="section">
            <h2>Your Playlists</h2>
            <div class="playlist-container" id="playlistSectionContainer">
            </div>
        </div>`;
            requestAnimationFrame(() => {
                fetchUserPlaylists();
            });
        }
    });
});

window.filterByCategory = (cat) => {
    document.querySelectorAll('.cat-card').forEach(card => {
        card.classList.remove('active');
        if(card.innerText.toLowerCase().includes(cat.toLowerCase())) {
            card.classList.add('active');
        }
    });

    const filteredSongs = allSongs.filter(s => s.category === cat);
    renderFilteredSongs(filteredSongs, "exploreResults");
};


function renderFilteredSongs(songList, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (songList.length === 0) {
        container.innerHTML = `<p style="color:gray; padding:20px; font-size:1.2rem;">No liked any song yet?</p>`;
        return;
    }
    
    container.innerHTML = "";

    songList.forEach((song, index) => {
        const imagePath = `http://localhost:5000/${song.coverPath}`;
        const isLiked = likedSongs.includes(song._id);

        container.innerHTML += `
                <div class="song-card" id="card-${index}">
                <i class="fas fa-heart heart-icon ${isLiked ? 'liked' : ' '}" onclick="toggleLike(event, '${song._id}', ${index})"></i>
                <i class="fas fa-plus add-icon" onclick="showPlaylistMenu(event, '${song._id}')"></i>
                <div class="card-img">
                <img src="${imagePath}" alt="${song.songName}">

                <div class="play-hover" onClick="playSong(${index})">
                <i class="fas fa-play songItemPlay" id="icon-${index}"></i>
                </div>
                </div>
                <div class="song-info">
                <h3>${song.songName}</h3>
                <p>${song.artistName}</p>
                </div>
                </div>`;
    });
}


function switchTabContent(tabName) {
    const mainScrollArea = document.querySelector(".main-scroll-area");
    if (!mainScrollArea) return;

    document.querySelectorAll(".sidebar-content ul li").forEach(li => {
        li.classList.remove("active");
        if (li.innerText.trim().includes(tabName)) {
            li.classList.add("active");
        }
    });

    if (tabName === "Liked Songs") {
        const favoriteSongs = allSongs.filter(song => likedSongs.includes(song._id));
        mainScrollArea.innerHTML = `
            <div class="section"><div class="song-container" id="likedSection"></div></div>`;
        renderFilteredSongs(favoriteSongs, "likedSection");
        welcomeGreeting.innerText = "Favorites";
    }
    else if (tabName === "Home") {
        currentPlaylistSongs = [...allSongs];
        mainScrollArea.innerHTML = `
            <div class="section"><h2>Top Hits</h2><div class="song-container" id="topHits"></div></div>
            <div class="section"><h2>Trending Albums</h2><div class="song-container" id="trendingAlbums"></div></div>
            <div class="section"><h2>New Releases</h2><div class="song-container" id="newReleases"></div></div>
            <div class="section"><h2>Recommended for You</h2><div class="song-container" id="recommended"></div></div>`;
        renderSections(allSongs);
        updateGreeting();
    }
    else if (tabName === "Explore") {
        mainScrollArea.innerHTML = `
            <div class="section">
            <h2>Explore by Category</h2>
            <div class="category-grid">
                <div class="cat-card" onclick="filterByCategory('trending')">🔥 Trending</div>
                    <div class="cat-card" onclick="filterByCategory('topHits')">🎸 Top Hits</div>
                    <div class="cat-card" onclick="filterByCategory('newReleases')">✨ New</div>
                    <div class="cat-card" onclick="filterByCategory('recommended')">🎧 For You</div>
                    </div>
                    <div id="exploreResults" class="song-container"></div>
                    </div>`;
        welcomeGreeting.innerText = "Explore";
    }
    else if (tabName === "Playlist") {
        welcomeGreeting.innerText = "Your Playlists";
        mainScrollArea.innerHTML = `
            <div class="section">
            <h2>Your Playlists</h2>
            <div class="playlist-container" id="playlistSectionContainer">
            </div>
        </div>`;
        requestAnimationFrame(() => {
            fetchUserPlaylists();
        });
    }
    window.scrollTo({top: 0, behavior: 'smooth'});
}


//Greeting function
function updateGreeting() {
    const hours = new Date().getHours();
    const savedName = localStorage.getItem("username") || "Guest";

    let greeting = "";
    if (hours >= 4 && hours < 12) greeting = `Good Morning, ${savedName}!`;
    else if (hours >= 12 && hours < 17) greeting = `Good Afternoon, ${savedName}!`;
    else if (hours >= 17 && hours < 21) greeting = `Good Evening, ${savedName}!`;
    else greeting = `Good Night, ${savedName}!`;

    if (welcomeGreeting) welcomeGreeting.innerText = greeting;
}


//Rendering songs 🚀 FIXED DYNAMIC ARROW SEPARATION LOGIC
function renderSections(songList) {
    const containers = {
        topHits: document.getElementById("topHits"),
        trendingAlbums: document.getElementById("trendingAlbums"),
        newReleases: document.getElementById("newReleases"),
        recommended: document.getElementById("recommended")
    };

    Object.values(containers).forEach(c => {
        if (c) c.innerHTML = "";
    });

    songList.forEach((song, index) => {
        const container = containers[song.category] || containers.recommended;

        if (container) {
            const isLiked = likedSongs.includes(song._id);
            const imagePath = `http://localhost:5000/${song.coverPath}`;

            container.innerHTML += `
                <div class="song-card" id="card-${index}">
                <i class="fas fa-heart heart-icon ${isLiked ? 'liked' : ' '}" onclick="toggleLike(event, '${song._id}', ${index})"></i>
                <i class="fas fa-plus add-icon pulse-border" onclick="showPlaylistMenu(event, '${song._id}')"></i>
                
                <div class="card-img">
                <img src="${imagePath}" alt="${song.songName}">
                <div class="play-hover" onClick="playSong(${index})">
                <i class="fas fa-play songItemPlay" id="icon-${index}"></i>
                </div>
                </div>
                <div class="song-info">
                <h3>${song.songName}</h3>
                <p>${song.artistName}</p>
                </div>
                </div>`;
        }
    });

    Object.keys(containers).forEach(key => {
        const container = containers[key];
        if (container) {
            const parentSection = container.parentElement;

            if (parentSection) {
                // Duplicate safety check
                const existingArrows = parentSection.querySelectorAll(".scroll-arrow");
                existingArrows.forEach(arrow => arrow.remove());

                const leftArrow = document.createElement("button");
                leftArrow.className = "scroll-arrow left-arrow"; // Matches CSS exact coordinates
                leftArrow.innerHTML = `<i class="fas fa-chevron-left"></i>`;
                leftArrow.onclick = (e) => {
                    e.stopPropagation();
                    container.scrollBy({left: -240, behavior: 'smooth'});
                };

                const rightArrow = document.createElement("button");
                rightArrow.className = "scroll-arrow right-arrow"; // Matches CSS exact coordinates
                rightArrow.innerHTML = `<i class="fas fa-chevron-right"></i>`;
                rightArrow.onclick = (e) => {
                    e.stopPropagation();
                    container.scrollBy({left: 240, behavior: 'smooth'});
                };

                parentSection.appendChild(leftArrow);
                parentSection.appendChild(rightArrow);
            }
        }
    });
}


//Like Button functionality
async function toggleLike(event, songId, index) {
    event.stopPropagation();
    const token = localStorage.getItem("token");

    if (!token) {
        alert("Please login first!");
        modal.style.display = "block";
        return;
    }

    try {
        const response = await fetch("http://localhost:5000/api/songs/like", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({songId: songId})
        });

        const data = await response.json();

        if (response.ok) {
            likedSongs = data.likedSongs;
            localStorage.setItem("likedSongs", JSON.stringify(likedSongs));
                
            if (welcomeGreeting.innerText === "Favorites") {
                const favoriteSongs = allSongs.filter(song => likedSongs.includes(song._id));
                renderFilteredSongs(favoriteSongs, "likedSection");
            }
            else {
                renderSections(allSongs);
            }
        }
    }
    catch (err) {
        console.error("Like Error:", err);
    }
}


//Playback logic
function playSong(index) {
    if (songIndex === index && masterAudio.src !== "") {
        masterAudio.paused ? masterAudio.play() : masterAudio.pause();
        return;
    } 
    songIndex = index;
    const song = currentPlaylistSongs[songIndex];
    if (!song) return;

    masterAudio.src = `http://localhost:5000/${song.filePath}`;

    document.getElementById('playSongName').innerText = song.songName;
    document.getElementById("playArtistName").innerText = song.artistName || "Unknown Artist";
    document.getElementById("footerCover").src = `http://localhost:5000/${song.coverPath}`;
    
    masterAudio.play().catch(err => {
        console.error("Playback Error:", err);
        setTimeout(() => document.getElementById('next').click(), 1000);
    });
}

function updateUI(isPlaying) {
    const song = allSongs[songIndex];
    if (!song) return;

    if (isPlaying) {
        playBtn.classList.replace('fa-play-circle', 'fa-pause-circle');
    } else {
        playBtn.classList.replace('fa-pause-circle', 'fa-play-circle');
    }

    if (wave) wave.classList.toggle("active", isPlaying);

    document.querySelectorAll(".songItemPlay").forEach((icon) => {
            icon.classList.remove('fa-pause');
            icon.classList.add('fa-play');
    });
    
    const currentIcon = document.getElementById(`icon-${songIndex}`);
        if (currentIcon && isPlaying) {
            currentIcon.classList.remove('fa-play');
            currentIcon.classList.add('fa-pause');
        }

    document.querySelectorAll(".song-card").forEach(c => c.classList.remove("active"));
    const currentCard = document.getElementById(`card-${songIndex}`);
    if (currentCard) currentCard.classList.add("active");
}
    
masterAudio.onplay = () => updateUI(true);
masterAudio.onpause = () => updateUI(false);


//Footer play button functionality
playBtn.addEventListener('click', () => {
    if (masterAudio.src === "" && allSongs.length > 0) {
        playSong(0);
        return;
    }
    masterAudio.paused ? masterAudio.play() : masterAudio.pause();
});


//Next & Prev functionality
document.getElementById('next').addEventListener('click', () => {
    let nextIndex = isShuffle ? Math.floor(Math.random() * currentPlaylistSongs.length) : (songIndex + 1) % currentPlaylistSongs.length;
    playSong(nextIndex);
});

document.getElementById('prev').addEventListener('click', () => {
    let prevIndex = (songIndex - 1 + currentPlaylistSongs.length) % currentPlaylistSongs.length;
    playSong(prevIndex);
});


//Shuffle & Repeat functionality
masterAudio.addEventListener("ended", () => {
    if(isRepeat) {
        masterAudio.currentTime = 0;
        masterAudio.play();
    } 
    else {
        let nextIndex = isShuffle ? Math.floor(Math.random() * currentPlaylistSongs.length) : (songIndex + 1) % currentPlaylistSongs.length;
        playSong(nextIndex);
    }
});


//Progress Bar & Volume control
masterAudio.addEventListener("loadedmetadata", () => {
    if (!isNaN(masterAudio.duration)) {
        const totalMins = Math.floor(masterAudio.duration / 60);
        const totalSecs = Math.floor(masterAudio.duration % 60);
        document.getElementById("totalTime").innerText = `${totalMins}:${totalSecs < 10 ? "0" : ""}${totalSecs}`;
    }
});

masterAudio.addEventListener("timeupdate", () => {
    if (!isNaN(masterAudio.duration)) {
        const progress = (masterAudio.currentTime / masterAudio.duration) * 100;
        progressBar.value = progress;
        progressBar.style.background = `linear-gradient(to right, #14C8C8 ${progress}%, rgba(255, 255, 255, 0.1) ${progress}%)`;

        const mins = Math.floor(masterAudio.currentTime / 60);
        const secs = Math.floor(masterAudio.currentTime % 60);
        document.getElementById("currentTime").innerText = `${mins}:${secs < 10 ? "0" : ""}${secs}`;
    }
});

progressBar.addEventListener("input", () => {
    masterAudio.currentTime = (progressBar.value * masterAudio.duration) / 100;
});


let lastVolume = 100;
if (volIcon && volumeBar) {
    volIcon.addEventListener("click", () => {
        if (masterAudio.volume > 0) {
            lastVolume = volumeBar.value;
            masterAudio.volume = 0;
            volumeBar.value = 0;
        }
        else {
            masterAudio.volume = (lastVolume || 10) / 100;
            volumeBar.value = lastVolume || 10;
        }
        updateVolumeUI();
    });

    volumeBar.addEventListener("input", () => {
        masterAudio.volume = volumeBar.value / 100;
        updateVolumeUI();
    });
}

function updateVolumeUI() {
    let val = parseInt(volumeBar.value);

    volumeBar.style.background = `linear-gradient(to right, #14C8C8 ${val}%, rgba(255, 255, 255, 0.1) ${val}%)`;

    volIcon.className = "fas";

    if (val === 0) {
        volIcon.classList.add("fa-volume-mute");
        volIcon.style.color = "#ff4d4d";
    }
    else if (val < 50) {
        volIcon.classList.add("fa-volume-down");
        volIcon.style.color = "#ffffff";
    }
    else {
        volIcon.classList.add("fa-volume-up");
        volIcon.style.color = "#ffffff";
    }
    volIcon.style.display = "inline-block";
    volIcon.style.opacity = "1";
}
updateVolumeUI();


//Search functionality
searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    if(query.length > 0) {
        clearSearch.style.visibility = "visible";
        clearSearch.style.display = "block";

        const results = allSongs.filter(s => s.songName.toLowerCase().includes(query) || s.artistName.toLowerCase().includes(query)
    );
    showDropdown(results);
    }
    else {
        hideDropdown();
    }
});

function showDropdown(results) {
    if (results.length === 0) {
        searchDropdown.innerHTML = `<p style="color:gray; padding:10px;">Oops, No results!</p>`;
    }
    else {
        searchDropdown.innerHTML = results.map(song => {
        const idx = allSongs.indexOf(song);
        return `
        <div class="search-result-item" onClick="playSong(${idx}); hideDropdown();">
        <img src="http://localhost:5000/${song.coverPath}" alt="">
        <div class="search-info">
            <p style="color:white; margin:0; font-weight:600;">${song.songName}</p>
            <p style="color:#14C8C8; margin:0; font-size:12px;">${song.artistName}</p>
        </div>
        </div>`;
    }).join("");
}
    searchDropdown.style.display = "block";
}

function hideDropdown(){
    searchDropdown.style.display = "none";
    clearSearch.style.display = "none";
    searchInput.value = "";
    searchInput.blur();
}

window.addEventListener("click", (e) => {
    if (e.target !== searchInput && !searchDropdown.contains(e.target) && e.target !== clearSearch) {
        hideDropdown();
    }
});

searchInput.onclick = () => {
    if (searchInput.value.length > 0) {
        searchDropdown.style.display = "block";
    }
};

clearSearch.onclick = () => {
    searchInput.value = "";
    clearSearch.style.display = "none";
    hideDropdown();
};


//Playlist Creation 
async function createPlaylist() {
    const token = localStorage.getItem("token");
    if(!token) return alert("Please Login first!");

    const playlistName = prompt("Enter Playlist Name:");
    if(!playlistName) return;

    try {
        const response = await fetch("http://localhost:5000/api/playlists/create", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({name: playlistName})
        });

        const data = await response.json();
        if(response.ok) {
            alert("Playlist Created!");
            await fetchUserPlaylists();
        }
        else {
            alert(data.msg || "Failed to create playlist");
        }
    }
    catch (err) {
        console.error("Error creating playlist:", err);
        alert("Server Error");
    }
}

document.addEventListener('click', (e) => {
    if(e.target.closest("#createNewPlaylistBtn") || e.target.closest(".create-pl-card")) {
        console.log("Main card clicked");
        createPlaylist();
    }
});


//Fetch Playlists
async function fetchUserPlaylists() {
    const token = localStorage.getItem("token");
    if(!token) return;

    try {
        const response = await fetch("http://localhost:5000/api/playlists/all", {
            headers: {"Authorization": `Bearer ${token}`}
        });

        if (response.status === 401) {
            console.error("Session expired or unauthorized");
            return;
        }
        
        if(!response.ok) {
            throw new Error("Failed to fetch playlists");
        }
        
        const playlists = await response.json();
        console.log("Fetched Playlists:", playlists);

        renderPlaylistsUI(playlists);
    }
    catch (err) {
        console.error("Error fetching playlists:", err);
    }
}


//Render Playlists
function renderPlaylistsUI(playlists) {
    const container = document.getElementById("playlistSectionContainer");
    if(!container) return;

    let htmlContent =  `
    <div class="song-card create-pl-card" id="createNewPlaylistBtn" style="display:flex; flex-direction:column; align-items:center; justify-content:center; border:2px dashed #14C8C8; min-height:180px;">
    <i class="fas fa-plus" style="font-size:2rem; color: #14C8C8; margin-bottom:10px;"></i>
    
    </div>`;

    if (Array.isArray(playlists)) {
        playlists.forEach(pl => {
            htmlContent += `
                <div class="song-card" style="cursor: pointer;" onclick="viewPlaylist('${pl._id}')">
                <div class="card-img">
                    <img src="assets/covers/placeholder.jpg" alt="Playlist">
                    </div>
                <div class="song-info">
                    <h3>${pl.name}</h3>
                    <p>${pl.songs ? pl.songs.length : 0} Songs</p>
                </div>
                </div>`;
        });
    }
    container.innerHTML = htmlContent;
    document.getElementById("createNewPlaylistBtn").onclick = createPlaylist;
}


//Add Song to Playlist
async function addSongToPlaylist(playlistId, songId) {
    const token = localStorage.getItem("token");
    const response = await fetch("http://localhost:5000/api/playlists/add-song", {
        method: "POST", 
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({playlistId, songId})
    });

    if(response.ok) {
        alert("Song is added to playlist! 🎵");
    }
}


//Show Playlist Options
async function showPlaylistMenu(event, songId) {
    event.stopPropagation();
    const token = localStorage.getItem("token");
    if(!token) return alert("Please Login to add songs!");

    try {
        const response = await fetch("http://localhost:5000/api/playlists/all", {
            headers: { "Authorization": `Bearer ${token}`}
        });
        const playlists = await response.json();

        if(playlists.length === 0) {
            alert("No playlists found! Create one first.");
            return;
        }

        let menuText = "Select a Playlist by number:\n";
        playlists.forEach((pl, i) => {
            menuText += `${i + 1}. ${pl.name}\n`;
        });

        const choice = prompt(menuText);
        const selectedIdx = parseInt(choice) - 1;

        if(playlists[selectedIdx]) {
            addSongToPlaylist(playlists[selectedIdx]._id, songId);
        }
    }
    catch (err) {
        console.error("Error showing menu:", err);
    }
}


//playlist opening function
async function viewPlaylist(playlistId) {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
        const response = await fetch("http://localhost:5000/api/playlists/all", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const playlists = await response.json();
        
        const targetPlaylist = playlists.find(pl => pl._id === playlistId);
        
        if (!targetPlaylist) {
            alert("Playlist not found!");
            return;
        }

        if (welcomeGreeting) welcomeGreeting.innerText = targetPlaylist.name;

        mainScrollArea.innerHTML = `
            <div class="section">
                <h2>${targetPlaylist.name}</h2>
                <div class="song-container" id="playlistSongsSection"></div>
            </div>`;

        const playlistSongs = targetPlaylist.songs || [];

        if (playlistSongs.length === 0) {
            document.getElementById("playlistSongsSection").innerHTML = `
                <p style="color:gray; padding:20px; font-size:1.2rem;">This playlist has no songs yet. Add some! 🎵</p>`;
            return;
        }

        currentPlaylistSongs = [...playlistSongs];
        renderFilteredSongs(playlistSongs, "playlistSongsSection");
    } catch (err) {
        console.error("Error opening playlist:", err);
        alert("Could not open playlist");
    }
}

//Repeat Song 
document.getElementById('repeat').addEventListener('click', (e) => {
    isRepeat = !isRepeat;
    e.target.style.color = isRepeat ? "#14C8C8" : "#fff";
});


//Shuffle Song
document.getElementById('shuffle').addEventListener('click', (e) => {
    isShuffle = !isShuffle;
    e.target.style.color = isShuffle ? "#14C8C8" : "#fff";
});


//LEFT & RIGHT TOP NAVIGATION CONTROLS
if (backBtn) {
    backBtn.onclick = () => {
        if (historyIndex > 0) {
            historyIndex--;
            isNavigating = true;
            switchTabContent(navHistory[historyIndex]);
            isNavigating = false;
        }
        else {
            console.log("No back history available");
        }
    };
}

if (forwardBtn) {
    forwardBtn.onclick = () => {
        if (historyIndex < navHistory.length - 1) {
            historyIndex++;
            isNavigating = true;
            switchTabContent(navHistory[historyIndex]);
            isNavigating = false;
        }
        else {
            console.log("No forward history available");
        }
    };
}

// ==========================================
//  🎛️ SIDEBAR TOGGLE & HOVER CONTROLS ENGINE
// ==========================================
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');

// Toggle sidebar on hamburger/button click
if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });
}

// Desktop hover smooth experience (Screen > 768px)
if (sidebar) {
    sidebar.addEventListener('mouseenter', () => {
        if (window.innerWidth > 768) { 
            sidebar.classList.add('active');
        }
    });

    sidebar.addEventListener('mouseleave', () => {
        if (window.innerWidth > 768) {
            sidebar.classList.remove('active');
        }
    });
}



// ========================================================
//  🎯 STUNNING TOPBAR RESPONSIVENESS ENGINE (TERE HTML PAR BASED)
// ========================================================
// Variable definitions matching exactly your HTML from image_c7a21d.jpg
const searchIcon = document.getElementById('searchIcon');
const searchContent = document.querySelector('.search-content');
const searchInputEl = document.getElementById('searchbar');

if (searchIcon && searchContent && searchInputEl) {
    searchIcon.addEventListener('click', (e) => {
        // Sirf mobile dimensions par toggle execution hoga
        if (window.innerWidth <= 768) {
            e.stopPropagation();
            searchContent.classList.toggle('mobile-expanded');
            
            if (searchContent.classList.contains('mobile-expanded')) {
                searchInputEl.focus();
            }
        }
    });
}

// Global window tap setup for backdrop auto-collapse
window.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && searchContent && !searchContent.contains(e.target)) {
        searchContent.classList.remove('mobile-expanded');
    }
});


initApp();
updateAuthUI();