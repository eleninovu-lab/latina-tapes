// ==========================================
// LatinaTapes - Main Application Script
// ==========================================

const CONFIG = {
    VIDEOS_PER_PAGE: 20,
    ADMIN_USER: 'kenznovu',
    ADMIN_PASS: 'Huh131Xjk09',
    ADMIN_KEY: 'latinaTapesAdminSession',

    // Cloudflare Worker (handles R2 presigned URLs + JWT auth)
    API_BASE: 'https://latinatapes-api.kenzienovu.workers.dev',

    // Appwrite Config
    APPWRITE_ENDPOINT: 'https://sfo.cloud.appwrite.io/v1', // change if https://cloud.appwrite.io/v1
    APPWRITE_PROJECT: '6a90d8c20004bfe475f1',
    APPWRITE_DATABASE_ID: '6a90d9250036703f663c',
    APPWRITE_COLLECTION_ID: 'latina-tapes-db-tables'
};

// Appwrite SDK Init
const { Client, Databases, ID, Query } = Appwrite;
const appwriteClient = new Client()
    .setEndpoint(CONFIG.APPWRITE_ENDPOINT)
    .setProject(CONFIG.APPWRITE_PROJECT);
const databases = new Databases(appwriteClient);

// ==========================================
// VIDEO DATABASE (Appwrite Live Only)
// ==========================================
const VideoDB = {
    videos: [],

    async init() {
        await this.syncFromAppwrite();
    },

    async syncFromAppwrite() {
        try {
            const response = await databases.listDocuments(
                CONFIG.APPWRITE_DATABASE_ID,
                CONFIG.APPWRITE_COLLECTION_ID,
                [Query.limit(100), Query.orderDesc('$createdAt')]
            );
            this.videos = response.documents.map(doc => ({
                id: doc.$id,
                title: doc.title,
                slug: doc.slug,
                thumbnail: doc.thumbnail_url || 'assets/img/placeholder.jpg',
                videoUrl: doc.video_url,
                views: doc.views || 0,
                category: doc.category || 'Latina',
                createdAt: doc.$createdAt
            }));
        } catch (e) {
            console.error('Appwrite sync failed:', e);
            this.videos = [];
        }
    },

    async add(video) {
        const token = JSON.parse(sessionStorage.getItem(CONFIG.ADMIN_KEY) || '{}').token;
        if (!token) throw new Error('Admin not authenticated');

        // 1. Get presigned URL from Cloudflare Worker for the video
        const videoExt = video.videoFile.name.split('.').pop();
        const videoFilename = `videos/${Date.now()}.${videoExt}`;

        const presignRes = await fetch(
            `${CONFIG.API_BASE}/api/upload/presigned?filename=${encodeURIComponent(videoFilename)}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );
        if (!presignRes.ok) throw new Error('Failed to get video upload URL');
        const presignData = await presignRes.json();

        // 2. Upload video directly to Cloudflare R2
        await fetch(presignData.uploadUrl, { method: 'PUT', body: video.videoFile });

        // 3. Upload thumbnail to R2 if provided
        let thumbnailUrl = 'assets/img/placeholder.jpg';
        if (video.thumbnailFile) {
            const thumbExt = video.thumbnailFile.name.split('.').pop();
            const thumbFilename = `thumbnails/${Date.now()}.${thumbExt}`;
            const thumbRes = await fetch(
                `${CONFIG.API_BASE}/api/upload/presigned?filename=${encodeURIComponent(thumbFilename)}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            const thumbData = await thumbRes.json();
            await fetch(thumbData.uploadUrl, { method: 'PUT', body: video.thumbnailFile });
            thumbnailUrl = thumbData.publicUrl;
        }

        const slug = this.slugify(video.title);

        // 4. Save metadata to Appwrite
        await databases.createDocument(
            CONFIG.APPWRITE_DATABASE_ID,
            CONFIG.APPWRITE_COLLECTION_ID,
            ID.unique(),
            {
                title: video.title,
                slug: slug,
                thumbnail_url: thumbnailUrl,
                video_url: presignData.publicUrl,
                views: 0,
                category: video.category,
                created_at: new Date().toISOString()
            }
        );

        await this.syncFromAppwrite();
    },

    async delete(id) {
        await databases.deleteDocument(
            CONFIG.APPWRITE_DATABASE_ID,
            CONFIG.APPWRITE_COLLECTION_ID,
            id
        );
        await this.syncFromAppwrite();
    },

    getBySlug(slug) {
        return this.videos.find(v => v.slug === slug);
    },

    getPage(page = 1, sortBy = 'latest') {
        let sorted = [...this.videos];
        switch(sortBy) {
            case 'latest':
                sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                break;
            case 'most-viewed':
                sorted.sort((a, b) => (b.views || 0) - (a.views || 0));
                break;
            case 'random':
                sorted.sort(() => Math.random() - 0.5);
                break;
        }

        const totalPages = Math.max(1, Math.ceil(sorted.length / CONFIG.VIDEOS_PER_PAGE));
        const safePage = Math.min(Math.max(1, page), totalPages);
        const start = (safePage - 1) * CONFIG.VIDEOS_PER_PAGE;

        return {
            videos: sorted.slice(start, start + CONFIG.VIDEOS_PER_PAGE),
            totalPages,
            currentPage: safePage,
            totalVideos: sorted.length
        };
    },

    getStats() {
        return {
            total: this.videos.length,
            totalViews: this.videos.reduce((sum, v) => sum + (v.views || 0), 0)
        };
    },

    slugify(text) {
        return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
};


// ==========================================
// AUTHENTICATION
// ==========================================
const Auth = {
    async login(username, password) {
        // If Worker API is configured, authenticate against it for a real JWT
        if (CONFIG.API_BASE) {
            try {
                const res = await fetch(`${CONFIG.API_BASE}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                if (data.success && data.token) {
                    const session = {
                        user: username,
                        token: data.token,
                        expires: Date.now() + (24 * 60 * 60 * 1000)
                    };
                    sessionStorage.setItem(CONFIG.ADMIN_KEY, JSON.stringify(session));
                    return true;
                }
            } catch (e) {
                console.error('Worker login failed:', e);
            }
            return false;
        }

        // Fallback local auth (only if API_BASE is empty)
        if (username === CONFIG.ADMIN_USER && password === CONFIG.ADMIN_PASS) {
            const session = {
                user: username,
                token: btoa(username + ':' + Date.now()),
                expires: Date.now() + (24 * 60 * 60 * 1000)
            };
            sessionStorage.setItem(CONFIG.ADMIN_KEY, JSON.stringify(session));
            return true;
        }
        return false;
    },

    check() {
        const stored = sessionStorage.getItem(CONFIG.ADMIN_KEY);
        if (!stored) return false;
        try {
            const session = JSON.parse(stored);
            if (Date.now() > session.expires) {
                this.logout();
                return false;
            }
            return true;
        } catch (e) {
            return false;
        }
    },

    logout() {
        sessionStorage.removeItem(CONFIG.ADMIN_KEY);
    }
};


// ==========================================
// UTILITY FUNCTIONS
// ==========================================
function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', month: 'short', day: 'numeric' 
    });
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            resolve('');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
    });
}

// ==========================================
// UI RENDERERS
// ==========================================
function renderVideoGrid(videos) {
    const grid = document.querySelector('.video-grid');
    if (!grid) return;

    if (videos.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-secondary);"><h3>No videos yet</h3><p></p></div>';
        return;
    }

    grid.innerHTML = videos.map(video => `
        <a href="video-page.html?slug=${video.slug}" class="video-card">
            <div class="video-thumbnail">
                <img src="${video.thumbnail}" alt="${video.title}" loading="lazy" onerror="this.src='assets/img/placeholder.jpg'">
            </div>
            <p class="video-title">${video.title}</p>
        </a>
    `).join('');
}

function renderPagination(currentPage, totalPages) {
    const container = document.querySelector('.pagination');
    if (!container) return;

    let html = '';

    // Previous button
    const prevDisabled = currentPage === 1 ? 'disabled' : '';
    html += `<li class="page-item ${prevDisabled}"><a class="page-link" href="?page=${currentPage - 1}">Previous</a></li>`;

    // Sliding window of 3 pages
    let startPage, endPage;

    if (totalPages <= 3) {
        startPage = 1;
        endPage = totalPages;
    } else {
        // Show window around current page
        if (currentPage === 1) {
            startPage = 1;
            endPage = 3;
        } else if (currentPage === totalPages) {
            startPage = totalPages - 2;
            endPage = totalPages;
        } else {
            startPage = currentPage - 1;
            endPage = currentPage + 1;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        const activeClass = i === currentPage ? 'active' : '';
        html += `<li class="page-item"><a class="page-link ${activeClass}" href="?page=${i}">${i}</a></li>`;
    }

    // Next button
    const nextDisabled = currentPage === totalPages ? 'disabled' : '';
    html += `<li class="page-item ${nextDisabled}"><a class="page-link" href="?page=${currentPage + 1}">Next</a></li>`;

    container.innerHTML = html;
}

function renderAdminVideoList() {
    const container = document.getElementById('adminVideoList');
    if (!container) return;

    const { videos } = VideoDB.getPage(1, 'latest');

    if (videos.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No videos uploaded yet.</p>';
        return;
    }

    container.innerHTML = videos.map(v => `
        <div class="admin-video-item" data-id="${v.id}">
            <img src="${v.thumbnail}" alt="${v.title}" onerror="this.src='assets/img/placeholder.jpg'">
            <div class="admin-video-info">
                <h4>${v.title}</h4>
                <p>${v.views.toLocaleString()} views • ${v.category} • ${formatDate(v.createdAt)}</p>
            </div>
            <div class="admin-video-actions">
                <button class="delete-btn" onclick="deleteVideo('${v.id}')" title="Delete">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function renderStats() {
    const stats = VideoDB.getStats();
    const totalEl = document.getElementById('statTotal');
    const viewsEl = document.getElementById('statViews');

    if (totalEl) totalEl.textContent = stats.total;
    if (viewsEl) viewsEl.textContent = stats.totalViews.toLocaleString();
}

// ==========================================
// EVENT HANDLERS & SETUP
// ==========================================
function setupSortDropdown(currentSort) {
    const filterBtn = document.querySelector('.filter-btn');
    const filterDropdown = document.querySelector('.filter-dropdown');
    if (!filterBtn || !filterDropdown) return;

    // Mark current sort as active
    filterDropdown.querySelectorAll('a').forEach(link => {
        link.classList.remove('active-sort');
        if (link.dataset.sort === currentSort) {
            link.classList.add('active-sort');
        }
    });

    filterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        filterDropdown.classList.toggle('active');
    });

    filterDropdown.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sort = link.dataset.sort || 'latest';
            const url = new URL(window.location.href);
            url.searchParams.set('sort', sort);
            url.searchParams.set('page', '1');
            window.location.href = url.toString();
        });
    });

    window.addEventListener('click', () => {
        filterDropdown.classList.remove('active');
    });
}

function setupLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    const toggleBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const errorBox = document.getElementById('loginError');

    // Toggle password visibility
    if (toggleBtn && passwordInput) {
        toggleBtn.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            toggleBtn.innerHTML = type === 'password' 
                ? '<i class="fa-solid fa-eye"></i>' 
                : '<i class="fa-solid fa-eye-slash"></i>';
        });
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (Auth.login(username, password)) {
            window.location.href = 'admin.html';
        } else {
            if (errorBox) {
                errorBox.textContent = 'Invalid username or password.';
                errorBox.classList.add('show');
            }
            // Shake animation
            form.style.animation = 'none';
            form.offsetHeight; // trigger reflow
            form.style.animation = 'shake 0.5s ease-in-out';
        }
    });
}

function setupAdminPage() {
    if (!document.body.classList.contains('admin-page')) return;

    // Check auth
    if (!Auth.check()) {
        window.location.href = 'login.html';
        return;
    }

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            Auth.logout();
            window.location.href = 'index.html';
        });
    }

        // Upload form
    const form = document.getElementById('uploadForm');
    const successBox = document.getElementById('uploadSuccess');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const title = document.getElementById('videoTitle').value.trim();
            const category = document.getElementById('videoCategory').value;
            const videoFile = document.getElementById('videoFile').files[0];
            const thumbnailFile = document.getElementById('videoThumbnail').files[0];

            if (!title || !category || !videoFile) {
                alert('Please fill in all required fields and select a video file.');
                return;
            }

            try {
                await VideoDB.add({ title, category, videoFile, thumbnailFile });

                if (successBox) {
                    successBox.textContent = 'Video uploaded successfully! It will appear on the home page.';
                    successBox.classList.add('show');
                    setTimeout(() => successBox.classList.remove('show'), 4000);
                }

                form.reset();
                renderAdminVideoList();
                renderStats();

            } catch (err) {
                console.error('Upload error:', err);
                alert('Error uploading video: ' + err.message);
            }
        });
    }

    renderAdminVideoList();
    renderStats();
}

function deleteVideo(id) {
    if (!confirm('Are you sure you want to delete this video?')) return;
    VideoDB.delete(id);
    renderAdminVideoList();
    renderStats();
}

function setupMobileMenu() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    if (!hamburger || !navMenu) return;

    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
    });

    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
        });
    });
}

function setupSearch() {
    const searchBox = document.querySelector('.search-box');
    const searchBtn = document.querySelector('.search-btn');
    if (!searchBox || !searchBtn) return;

    function performSearch() {
        const query = searchBox.value.trim().toLowerCase();
        if (!query) return;

        // Local search
        const results = VideoDB.videos.filter(v => 
            v.title.toLowerCase().includes(query)
        );

        const grid = document.querySelector('.video-grid');
        const titleEl = document.getElementById('video-section-title');
        const pagination = document.querySelector('.pagination-container');

        if (grid && results.length > 0) {
            if (titleEl) titleEl.textContent = `Search: "${query}"`;
            renderVideoGrid(results.slice(0, CONFIG.VIDEOS_PER_PAGE));
            if (pagination) pagination.style.display = 'none';
        } else if (grid) {
            grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-secondary);"><h3>No results found</h3></div>';
            if (pagination) pagination.style.display = 'none';
        }
    }

    searchBtn.addEventListener('click', performSearch);
    searchBox.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
}

function setupVideoPage() {
    if (!document.body.classList.contains('video-page')) return;

    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('slug');

    if (!slug) return;

    const video = VideoDB.getBySlug(slug);
    if (!video) return;

    // Update page title
    document.title = `Watching ${video.title} | LatinaTapes`;

    // Update video info
    const titleEl = document.querySelector('h1.video-title');
    if (titleEl) titleEl.textContent = video.title;

    // Update video source if available
    const videoEl = document.getElementById('video-id');
    if (videoEl && video.videoUrl) {
        const source = videoEl.querySelector('source');
        if (source) source.src = video.videoUrl;
    }

    // Update metadata
    const metaContainer = document.querySelector('.video-metadata');
    if (metaContainer) {
        metaContainer.innerHTML = `
            <span>${video.views.toLocaleString()} views</span>
            <span>•</span>
            <span>${video.duration}</span>
            <span>•</span>
            <span>${formatDate(video.createdAt)}</span>
        `;
    }
}

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    await VideoDB.init();

    // Index page setup
    if (document.querySelector('.video-grid')) {
        const urlParams = new URLSearchParams(window.location.search);
        const page = parseInt(urlParams.get('page')) || 1;
        const sortBy = urlParams.get('sort') || 'latest';

        const data = VideoDB.getPage(page, sortBy);
        renderVideoGrid(data.videos);
        renderPagination(data.currentPage, data.totalPages);

        const titleMap = {
            'latest': 'Latest Videos',
            'most-viewed': 'Most Viewed Videos',
            'random': 'Random Videos'
        };
        const titleEl = document.getElementById('video-section-title');
        if (titleEl) titleEl.textContent = titleMap[sortBy] || 'Latest Videos';

        setupSortDropdown(sortBy);
        setupSearch();
    }

    setupLoginForm();
    setupAdminPage();
    setupVideoPage();
    setupMobileMenu();
});

// Smooth scroll for anchor links
    //document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        //anchor.addEventListener('click', function (e) {
            //e.preventDefault();
            //const target = document.querySelector(this.getAttribute('href'));
            //if (target) {
                //target.scrollIntoView({ behavior: 'smooth' });
            //}
        //});
    //});
//});

// Add shake animation for login error
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-10px); }
        40% { transform: translateX(10px); }
        60% { transform: translateX(-10px); }
        80% { transform: translateX(10px); }
    }
`;
document.head.appendChild(style);
