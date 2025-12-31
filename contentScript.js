(() => {

let youtubeLeftControls, youtubePlayer;
let currentVideo = "";
let currentVideoBookmarks = [];

// Inject custom styles for the new dots
if (!document.getElementById('yt-bookmark-dot-style')) {
    const style = document.createElement('style');
    style.id = 'yt-bookmark-dot-style';
    style.innerHTML = `
        .yt-bookmark-dot {
            position: absolute;
            bottom: -7px;
            width: 9px;
            height: 9px;
            background: linear-gradient(145deg, #00ba7c 40%, #10e0be 100%);
            border: 2px solid #fff;
            border-radius: 50%;
            transform: translateX(-50%);
            cursor: pointer;
            z-index: 1000;
            pointer-events: auto;
            transition: box-shadow 0.18s, background 0.18s, opacity 0.18s;
            box-shadow: 0 2px 8px #00ba7c4a;
            opacity: 0.85;
        }
        .ytp-progress-bar:hover .yt-bookmark-dot {
            opacity: 1;
            box-shadow: 0 2px 14px #00ba7cab;
        }
        .yt-bookmark-dot:hover {
            background: #003a29;
            box-shadow: 0 0 18px 6px #00ba7ca1;
        }
    `;
    document.head.appendChild(style);
}

// Handle extension messages for new video, play, and delete events
chrome.runtime.onMessage.addListener((obj, sender, response) => {
    const { type, value, videoId } = obj;
    if (type === "NEW") {
        currentVideo = videoId;
        newVideoLoaded();
    } else if (type === "PLAY") {
        if (youtubePlayer) youtubePlayer.currentTime = value;
    } else if (type === "DELETE") {
        currentVideoBookmarks = currentVideoBookmarks.filter((b) => b.time != value);
        chrome.storage.sync.set({ [currentVideo]: JSON.stringify(currentVideoBookmarks) }, () => {
            renderBookmarkDots(currentVideoBookmarks, youtubePlayer.duration);
            response(currentVideoBookmarks);
        });
        return true;
    }
});

// Fetch saved bookmarks for the current video
const fetchBookmarks = () => {
    return new Promise((resolve) => {
        chrome.storage.sync.get([currentVideo], (obj) => {
            resolve(obj[currentVideo] ? JSON.parse(obj[currentVideo]) : []);
        });
    });
};

// Render stylish, modern dots for bookmarks on the YouTube seek bar
function renderBookmarkDots(bookmarks, duration) {
    document.querySelectorAll('.yt-bookmark-dot').forEach(dot => dot.remove());
    const progressBar = document.querySelector('.ytp-progress-bar');
    if (!progressBar) return;
    bookmarks.forEach(bookmark => {
        const dot = document.createElement('div');
        dot.className = 'yt-bookmark-dot';
        const leftPercent = (bookmark.time / duration) * 100;
        dot.style.left = `${leftPercent}%`;
        dot.title = `${getTime(bookmark.time)} - ${bookmark.desc}`;
        dot.addEventListener('click', (e) => {
            e.stopPropagation();
            youtubePlayer.currentTime = bookmark.time;
        });
        progressBar.appendChild(dot);
    });
}

// Add bookmark button and hook up dot rendering logic
const newVideoLoaded = async () => {
    const bookmarkBtnExists = document.getElementsByClassName("bookmark-btn")[0];
    currentVideoBookmarks = await fetchBookmarks();
    youtubeLeftControls = document.getElementsByClassName("ytp-left-controls")[0];
    youtubePlayer = document.getElementsByClassName("video-stream")[0];
    if (!bookmarkBtnExists && youtubeLeftControls) {
        const bookmarkBtn = document.createElement("img");
        bookmarkBtn.src = chrome.runtime.getURL("assets/bookmark.png");
        bookmarkBtn.className = "ytp-button bookmark-btn";
        bookmarkBtn.title = "Bookmark current timestamp";
        youtubeLeftControls.appendChild(bookmarkBtn);
        bookmarkBtn.addEventListener("click", addNewBookmarkEventHandler);
    }
    if (youtubePlayer) {
        renderBookmarkDots(currentVideoBookmarks, youtubePlayer.duration);
    }
};

// Add bookmark at current time
const addNewBookmarkEventHandler = async () => {
    const currentTime = youtubePlayer.currentTime;
    const newBookmark = {
        time: currentTime,
        desc: "Bookmark at " + getTime(currentTime)
    };
    currentVideoBookmarks = await fetchBookmarks();
    chrome.storage.sync.set({
        [currentVideo]: JSON.stringify([...currentVideoBookmarks, newBookmark].sort((a, b) => a.time - b.time))
    }, () => {
        currentVideoBookmarks.push(newBookmark);
        renderBookmarkDots(currentVideoBookmarks, youtubePlayer.duration);
    });
};

// Format seconds as HH:MM:SS
const getTime = t => {
    let date = new Date(0);
    date.setSeconds(t);
    return date.toISOString().substr(11, 8);
};

// Keyboard shortcut: Alt+X to bookmark current time
document.addEventListener('keydown', function(event) {
    if (event.altKey && (event.key === 'x' || event.key === 'X')) {
        const bookmarkBtn = document.querySelector('.ytp-button.bookmark-btn');
        if (bookmarkBtn) {
            bookmarkBtn.click();
            event.preventDefault();
        }
    }
});

// Export bookmarks as formatted text to clipboard: Alt+C
function exportCurrentVideoBookmarks() {
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('v');
    if (!videoId) return;
    chrome.storage.sync.get([videoId], (obj) => {
        const bookmarks = obj[videoId] ? JSON.parse(obj[videoId]) : [];
        if (bookmarks.length === 0) {
            alert("No bookmarks for this video.");
            return;
        }
        // ---- CHAPTERS FORMAT ----
        let text = '00:00:00 Intro\n';
        text += bookmarks
            .map((b, idx) => `${getTime(b.time)} Bookmark ${idx + 1}`)
            .join('\n');
        navigator.clipboard.writeText(text).then(() => {
            alert("Chapters copied to clipboard:\n\n" + text);
        }, (err) => {
            alert("Failed to copy chapters: " + err);
        });
    });
}


// Keyboard shortcut: Alt+C to export as text
document.addEventListener('keydown', function(event) {
    if (event.altKey && (event.key === 'c' || event.key === 'C')) {
        exportCurrentVideoBookmarks();
        event.preventDefault();
    }
});

})();
