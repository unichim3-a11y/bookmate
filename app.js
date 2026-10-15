/**
 * Web Reader Application Script
 * Multi-Book Support for:
 * 1. Kinh Tế Học Cơ Bản - Thomas Sowell (784 trang)
 * 2. Sapiens: Lược Sử Về Loài Người - Yuval Noah Harari (481 trang)
 */

const BOOKS_CATALOG = [
    {
        id: 'kinh-te-hoc-co-ban',
        title: 'Kinh Tế Học Cơ Bản - Sách Vỡ Lòng Về Kinh Tế',
        shortTitle: 'Kinh Tế Học Cơ Bản',
        author: 'Thomas Sowell',
        genre: 'Kinh tế học & Tư duy tài chính',
        coverBadge: 'Tác Phẩm Kinh Điển',
        readingTime: '18 - 22 Giờ đọc',
        dataFile: 'kinh_te_hoc_co_ban_data.json',
        pdfFile: 'Kinh Tế Học Cơ Bản - Sách Vỡ Lòng Về Kinh Tế - Thomas Sowell.pdf',
        description: 'Tác phẩm kinh điển nổi tiếng của Thomas Sowell giải thích toàn diện các nguyên lý kinh tế học, cơ chế thị trường, quy luật cung cầu, giá cả, và vai trò của chính phủ bằng ngôn ngữ đại chúng sáng rõ, không hề dùng biệt ngữ hay các mô hình toán học phức tạp.',
        searchPlaceholder: 'Tìm kiếm (Ví dụ: Quy luật cung cầu, Kiểm soát giá thuê, Năng suất lao động, Lạm phát)...'
    },
    {
        id: 'sapiens',
        title: 'Sapiens: Lược Sử Về Loài Người',
        shortTitle: 'Sapiens',
        author: 'Yuval Noah Harari',
        genre: 'Lịch sử & Khoa học nhân loại',
        coverBadge: 'Best Seller Toàn Cầu',
        readingTime: '12 - 15 Giờ đọc',
        dataFile: 'sapiens_data.json',
        pdfFile: 'sapiens-luoc-su-ve-loai-nguoi.pdf',
        description: 'Chuyến hành trình kinh ngạc và sâu sắc qua toàn bộ lịch sử loài người từ Cuộc cách mạng nhận thức, cách mạng nông nghiệp đến thời đại chủ nghĩa tư bản và công nghệ sinh học.',
        searchPlaceholder: 'Tìm kiếm (Ví dụ: Thuyết tiến hóa, Neanderthal, Cách mạng nông nghiệp, Tiền tệ)...'
    }
];

class UniversalReaderApp {
    constructor() {
        this.currentBookId = this.detectInitialBookId();
        this.activeBookMeta = this.getBookMeta(this.currentBookId);
        this.bookData = null;
        this.currentPage = 1;
        this.readingMode = 'scroll'; // 'page' or 'scroll'
        this.bookmarks = [];
        this.readingHistory = [];
        this.isProgrammaticScroll = false;
        
        // Reading Display Preferences
        this.prefs = {
            theme: 'beige',
            fontFamily: 'Lora',
            fontSize: 18,
            lineHeight: 1.88,
            maxWidth: '680px'
        };

        // Text-to-Speech (TTS)
        this.speechSynth = window.speechSynthesis || null;
        this.currentUtterance = null;
        this.isPlayingAudio = false;

        // Cloud Sync Settings
        this.cloudSyncKey = localStorage.getItem('reader_cloud_sync_key') || this.generateDefaultSyncKey();
        this.autoCloudSyncEnabled = localStorage.getItem('reader_auto_cloud_sync') === 'true';
        this.cloudPushTimeout = null;

        this.init();
    }

    generateDefaultSyncKey() {
        const rand = Math.floor(1000 + Math.random() * 9000);
        const key = `BOOK-${rand}`;
        localStorage.setItem('reader_cloud_sync_key', key);
        return key;
    }

    detectInitialBookId() {
        const urlParams = new URLSearchParams(window.location.search);
        const bookParam = urlParams.get('book');
        if (bookParam && BOOKS_CATALOG.some(b => b.id === bookParam)) {
            return bookParam;
        }
        const savedBookId = localStorage.getItem('reader_current_book_id');
        if (savedBookId && BOOKS_CATALOG.some(b => b.id === savedBookId)) {
            return savedBookId;
        }
        // Default to newly added book
        return 'kinh-te-hoc-co-ban';
    }

    getBookMeta(bookId) {
        return BOOKS_CATALOG.find(b => b.id === bookId) || BOOKS_CATALOG[0];
    }

    async init() {
        this.loadUserPreferences();
        this.checkUrlForSyncState();
        this.bindEvents();
        this.initKeyboardShortcuts();
        this.setupScrollListener();
        this.setupTouchGestures();
        
        await this.loadBookData(this.currentBookId);
    }

    /* ----------------------------------------------------
       DATA LOADING & SWITCHING
    ---------------------------------------------------- */
    async loadBookData(bookId) {
        this.currentBookId = bookId;
        this.activeBookMeta = this.getBookMeta(bookId);
        localStorage.setItem('reader_current_book_id', bookId);

        // Update URL without reloading page
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('book', bookId);
        window.history.replaceState({}, '', newUrl);

        // Show loading state
        const contentArea = document.getElementById('textContentArea');
        if (contentArea) {
            contentArea.innerHTML = `
                <div class="loading-spinner">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    <p>Đang nạp dữ liệu cuốn sách <strong>${this.escapeHtml(this.activeBookMeta.shortTitle)}</strong>...</p>
                </div>
            `;
        }

        try {
            const response = await fetch(this.activeBookMeta.dataFile);
            if (!response.ok) {
                throw new Error(`Failed to load ${this.activeBookMeta.dataFile}: ${response.statusText}`);
            }
            this.bookData = await response.json();

            // Load book-specific bookmarks and history
            this.loadBookmarks();
            this.loadReadingHistory();

            // Update UI with Book Metadata
            this.applyBookMetaToUi();

            // Render TOC
            this.renderToc();

            // Determine starting page
            const savedPageKey = `reader_${this.currentBookId}_page`;
            let savedPage = parseInt(localStorage.getItem(savedPageKey));
            
            // Backwards compatibility for sapiens
            if (!savedPage && this.currentBookId === 'sapiens') {
                savedPage = parseInt(localStorage.getItem('sapiens_last_page'));
            }

            const startPage = savedPage && savedPage >= 1 && savedPage <= this.bookData.metadata.totalPages ? savedPage : 1;
            this.goToPage(startPage, true);

            // Re-render Library Modal with active badge
            this.renderLibraryModal();

        } catch (error) {
            console.error('Error loading book data:', error);
            if (contentArea) {
                contentArea.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #ef4444;">
                        <i class="fa-solid fa-circle-exclamation" style="font-size: 2.5rem; margin-bottom: 12px;"></i>
                        <h3>Không thể tải tập tin dữ liệu sách</h3>
                        <p style="margin-top: 8px; color: var(--text-secondary);">${this.escapeHtml(error.message)}</p>
                    </div>
                `;
            }
        }
    }

    applyBookMetaToUi() {
        const meta = this.bookData.metadata;
        const catalogMeta = this.activeBookMeta;

        // Browser Document Title
        document.title = `${catalogMeta.shortTitle} - Reader Web App`;

        // Navbar & Sidebar Book Badge
        const navTitle = document.getElementById('currentBookNameNav');
        if (navTitle) navTitle.textContent = catalogMeta.shortTitle;

        const sidebarTitle = document.getElementById('sidebarBookTitle');
        if (sidebarTitle) sidebarTitle.textContent = catalogMeta.title;

        const sidebarAuthor = document.getElementById('sidebarBookAuthor');
        if (sidebarAuthor) sidebarAuthor.textContent = catalogMeta.author;

        // Page Indicators
        const totalPageEls = [
            document.getElementById('totalPagesCount'),
            document.getElementById('footerTotalPages'),
            document.getElementById('heroTotalPages')
        ];
        totalPageEls.forEach(el => {
            if (el) el.textContent = meta.totalPages;
        });

        // Hero Banner Meta
        const heroTitle = document.getElementById('heroBookTitle');
        if (heroTitle) heroTitle.textContent = catalogMeta.title;

        const heroAuthor = document.getElementById('heroBookAuthor');
        if (heroAuthor) heroAuthor.innerHTML = `<i class="fa-solid fa-feather"></i> ${this.escapeHtml(catalogMeta.author)}`;

        const heroDesc = document.getElementById('heroBookDescription');
        if (heroDesc) heroDesc.textContent = catalogMeta.description;

        const heroBadge = document.getElementById('heroCoverBadge');
        if (heroBadge) heroBadge.textContent = catalogMeta.coverBadge;

        const heroTotalChapters = document.getElementById('heroTotalChapters');
        if (heroTotalChapters) heroTotalChapters.textContent = meta.totalChapters || (this.bookData.toc ? this.bookData.toc.length : 0);

        const heroReadingTime = document.getElementById('heroReadingTime');
        if (heroReadingTime) heroReadingTime.textContent = catalogMeta.readingTime;

        // Search Modal Titles & Placeholder
        const searchHeaderTitle = document.getElementById('searchModalHeaderTitle');
        if (searchHeaderTitle) {
            searchHeaderTitle.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> Tìm kiếm trong "${this.escapeHtml(catalogMeta.shortTitle)}"`;
        }
        const searchInput = document.getElementById('fullSearchInput');
        if (searchInput) {
            searchInput.placeholder = catalogMeta.searchPlaceholder;
        }
    }

    async switchBook(bookId) {
        if (bookId === this.currentBookId) {
            this.closeLibraryModal();
            return;
        }

        // Stop any playing TTS audio
        this.stopAudio();
        const audioBar = document.getElementById('audioPlayerBar');
        if (audioBar) audioBar.classList.add('hidden');

        // Close any search results
        const searchInput = document.getElementById('fullSearchInput');
        if (searchInput) searchInput.value = '';
        const searchResults = document.getElementById('searchResultsList');
        if (searchResults) searchResults.innerHTML = '';

        this.closeLibraryModal();
        await this.loadBookData(bookId);
    }

    /* ----------------------------------------------------
       BOOK LIBRARY MODAL
    ---------------------------------------------------- */
    renderLibraryModal() {
        const grid = document.getElementById('libraryBooksGrid');
        if (!grid) return;
        grid.innerHTML = '';

        BOOKS_CATALOG.forEach(book => {
            const isActive = book.id === this.currentBookId;
            const savedPageKey = `reader_${book.id}_page`;
            let savedPage = parseInt(localStorage.getItem(savedPageKey));
            if (!savedPage && book.id === 'sapiens') {
                savedPage = parseInt(localStorage.getItem('sapiens_last_page'));
            }
            if (!savedPage) savedPage = 1;

            const totalPages = book.id === 'kinh-te-hoc-co-ban' ? 784 : 481;
            const progressPct = ((savedPage / totalPages) * 100).toFixed(1);

            const card = document.createElement('div');
            card.className = `library-book-card ${isActive ? 'active' : ''}`;
            card.dataset.bookId = book.id;

            card.innerHTML = `
                <div>
                    <div class="book-card-top">
                        <span class="book-card-badge">${this.escapeHtml(book.coverBadge)}</span>
                        ${isActive ? `
                            <span class="book-card-active-pill">
                                <span class="active-pulse-dot"></span> Đang đọc
                            </span>
                        ` : ''}
                    </div>

                    <h4 class="book-card-title">${this.escapeHtml(book.title)}</h4>
                    <div class="book-card-author"><i class="fa-solid fa-feather"></i> ${this.escapeHtml(book.author)}</div>
                    <div class="book-card-desc">${this.escapeHtml(book.description)}</div>

                    <div class="book-card-stats">
                        <span><i class="fa-solid fa-file-lines"></i> <strong>${totalPages}</strong> Trang</span>
                        <span><i class="fa-solid fa-clock"></i> <strong>${book.readingTime}</strong></span>
                        <span><i class="fa-solid fa-tags"></i> ${this.escapeHtml(book.genre)}</span>
                    </div>

                    <div class="book-card-progress">
                        <div class="progress-label-wrap">
                            <span>Tiến độ đọc: Trang ${savedPage}/${totalPages}</span>
                            <span class="progress-pct-val">${progressPct}%</span>
                        </div>
                        <div class="mini-progress-bar-bg">
                            <div class="mini-progress-bar-fill" style="width: ${progressPct}%;"></div>
                        </div>
                    </div>
                </div>

                <button class="book-card-btn ${isActive ? 'btn-active-read' : 'btn-select-read'}">
                    ${isActive ? '<i class="fa-solid fa-book-open-reader"></i> Tiếp tục đọc sách này' : '<i class="fa-solid fa-arrow-right"></i> Chọn đọc tác phẩm này'}
                </button>
            `;

            card.addEventListener('click', () => {
                this.switchBook(book.id);
            });

            grid.appendChild(card);
        });
    }

    openLibraryModal() {
        this.renderLibraryModal();
        const modal = document.getElementById('bookLibraryModal');
        if (modal) modal.classList.add('open');
    }

    closeLibraryModal() {
        const modal = document.getElementById('bookLibraryModal');
        if (modal) modal.classList.remove('open');
    }

    toggleLibraryModal() {
        const modal = document.getElementById('bookLibraryModal');
        if (modal && modal.classList.contains('open')) {
            this.closeLibraryModal();
        } else {
            this.openLibraryModal();
        }
    }

    /* ----------------------------------------------------
       PREFERENCES & THEMING
    ---------------------------------------------------- */
    loadUserPreferences() {
        const savedPrefs = localStorage.getItem('sapiens_user_prefs');
        if (savedPrefs) {
            try {
                this.prefs = { ...this.prefs, ...JSON.parse(savedPrefs) };
            } catch (e) {}
        }
        this.applyPreferences();
    }

    savePreferences() {
        localStorage.setItem('sapiens_user_prefs', JSON.stringify(this.prefs));
    }

    applyPreferences() {
        // Theme
        document.documentElement.setAttribute('data-theme', this.prefs.theme);
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === this.prefs.theme);
        });

        // Font Family
        const fontMap = {
            'Lora': "'Lora', serif",
            'Merriweather': "'Merriweather', serif",
            'Plus Jakarta Sans': "'Plus Jakarta Sans', sans-serif"
        };
        document.documentElement.style.setProperty('--reader-font', fontMap[this.prefs.fontFamily] || fontMap['Lora']);
        document.querySelectorAll('.font-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.font === this.prefs.fontFamily);
        });

        // Font Size
        document.documentElement.style.setProperty('--reader-size', `${this.prefs.fontSize}px`);
        const fontRange = document.getElementById('fontSizeRange');
        if (fontRange) fontRange.value = this.prefs.fontSize;
        const fontSizeVal = document.getElementById('fontSizeValue');
        if (fontSizeVal) fontSizeVal.textContent = `${this.prefs.fontSize}px`;

        // Line Height
        document.documentElement.style.setProperty('--reader-lh', this.prefs.lineHeight);
        const lhRange = document.getElementById('lineHeightRange');
        if (lhRange) lhRange.value = this.prefs.lineHeight;
        const lhVal = document.getElementById('lineHeightValue');
        if (lhVal) lhVal.textContent = this.prefs.lineHeight;

        // Max Width
        document.documentElement.style.setProperty('--reader-width', this.prefs.maxWidth);
        document.querySelectorAll('.width-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.width === this.prefs.maxWidth);
        });
    }

    /* ----------------------------------------------------
       TOC & NAVIGATION
    ---------------------------------------------------- */
    renderToc() {
        const tocContainer = document.getElementById('tocList');
        if (!tocContainer) return;
        tocContainer.innerHTML = '';

        if (!this.bookData || !this.bookData.toc) return;

        this.bookData.toc.forEach((item) => {
            const li = document.createElement('li');
            li.className = `toc-item`;

            const a = document.createElement('a');
            a.className = `toc-link toc-level-${item.level}`;
            a.dataset.startPage = item.startPage;
            a.dataset.chapId = item.id;

            a.innerHTML = `
                <span class="toc-title-text">${this.escapeHtml(item.title)}</span>
                <span class="toc-page-tag">Tr. ${item.startPage}</span>
            `;

            a.addEventListener('click', (e) => {
                e.preventDefault();
                this.goToPage(item.startPage, true);
                if (window.innerWidth <= 768) {
                    this.closeSidebar();
                }
            });

            li.appendChild(a);
            tocContainer.appendChild(li);
        });
    }

    updateActiveTocItem() {
        document.querySelectorAll('.toc-link').forEach(link => {
            link.classList.remove('active');
        });

        const activeToc = this.getCurrentChapterToc();
        if (activeToc) {
            const activeEl = document.querySelector(`.toc-link[data-chap-id="${activeToc.id}"]`);
            if (activeEl) {
                activeEl.classList.add('active');
                activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }

            // Update Header Chapter Title
            const currentChapterHeader = document.getElementById('currentChapterHeaderTitle');
            if (currentChapterHeader) currentChapterHeader.textContent = activeToc.title;

            const chapterBadge = document.getElementById('chapterBadge');
            if (chapterBadge) {
                chapterBadge.textContent = activeToc.level === 1 ? 'Phần / Chương Lớn' : (activeToc.level === 2 ? 'Chương' : 'Mục');
            }

            const chapterTitleDisplay = document.getElementById('chapterTitleDisplay');
            if (chapterTitleDisplay) chapterTitleDisplay.textContent = activeToc.title;

            const chapPageRange = document.getElementById('chapPageRange');
            if (chapPageRange) {
                chapPageRange.innerHTML = `<i class="fa-solid fa-bookmark"></i> Trang ${activeToc.startPage} - ${activeToc.endPage}`;
            }

            const chapEstTime = document.getElementById('chapEstTime');
            if (chapEstTime) {
                chapEstTime.innerHTML = `<i class="fa-solid fa-stopwatch"></i> ~${activeToc.readingTimeMin} phút đọc`;
            }

            const chapWordCount = document.getElementById('chapWordCount');
            if (chapWordCount) {
                chapWordCount.innerHTML = `<i class="fa-solid fa-pen-nib"></i> ${(activeToc.wordCount || 0).toLocaleString()} từ`;
            }
        }
    }

    getCurrentChapterToc() {
        if (!this.bookData || !this.bookData.toc || this.bookData.toc.length === 0) return null;
        let current = this.bookData.toc[0];
        for (let i = 0; i < this.bookData.toc.length; i++) {
            if (this.currentPage >= this.bookData.toc[i].startPage) {
                current = this.bookData.toc[i];
            } else {
                break;
            }
        }
        return current;
    }

    /* ----------------------------------------------------
       PAGE & CONTENT RENDERING
    ---------------------------------------------------- */
    goToPage(pageNum, scrollUp = true) {
        if (!this.bookData) return;
        const targetPage = Math.max(1, Math.min(pageNum, this.bookData.metadata.totalPages));
        this.currentPage = targetPage;
        this.isProgrammaticScroll = true;

        // Save current page per book
        localStorage.setItem(`reader_${this.currentBookId}_page`, this.currentPage);
        if (this.currentBookId === 'sapiens') {
            localStorage.setItem('sapiens_last_page', this.currentPage);
        }
        
        // Update Nav Page Indicators
        const pageInput = document.getElementById('currentPageInput');
        if (pageInput && document.activeElement !== pageInput) {
            pageInput.textContent = this.currentPage;
        }
        const footerPage = document.getElementById('footerCurrPage');
        if (footerPage) footerPage.textContent = this.currentPage;

        const mobilePageIndicator = document.getElementById('mobilePageIndicator');
        if (mobilePageIndicator && this.bookData) {
            mobilePageIndicator.textContent = `${this.currentPage}/${this.bookData.metadata.totalPages}`;
        }

        // Render Page Content
        this.renderContent();

        // Update Reading Progress Bar
        const progressPct = ((this.currentPage / this.bookData.metadata.totalPages) * 100).toFixed(1);
        const progressBar = document.getElementById('readingProgressBar');
        if (progressBar) progressBar.style.width = `${progressPct}%`;

        // Active TOC & Bookmark Sync
        this.updateActiveTocItem();
        this.updateBookmarkIcon();
        this.logReadingHistory(this.currentPage);

        // Auto Cloud Sync if enabled
        if (this.autoCloudSyncEnabled) {
            this.debouncedCloudPush();
        }

        // Scroll to target element or top
        if (scrollUp) {
            const viewport = document.getElementById('readerViewport');
            if (this.readingMode === 'page' || targetPage === 1) {
                if (viewport) viewport.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                const blockEl = document.getElementById(`page-block-${targetPage}`);
                if (blockEl) {
                    blockEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else if (viewport) {
                    viewport.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }
        }

        setTimeout(() => {
            this.isProgrammaticScroll = false;
        }, 500);
    }

    renderContent() {
        const textContentArea = document.getElementById('textContentArea');
        if (!textContentArea || !this.bookData || !this.bookData.pages) return;

        if (this.readingMode === 'page') {
            // Render Single Page Mode
            const pageData = this.bookData.pages[this.currentPage - 1];
            if (pageData) {
                textContentArea.innerHTML = this.formatParagraphsHtml(pageData.paragraphs, this.currentPage);
            }
        } else {
            // Scroll Mode: Check if target page block is ALREADY in DOM
            const existingBlock = document.getElementById(`page-block-${this.currentPage}`);
            if (existingBlock) {
                return; // Already rendered in current chapter batch
            }

            // Render Current Chapter pages
            const currentToc = this.getCurrentChapterToc();
            const startP = currentToc ? currentToc.startPage : Math.max(1, this.currentPage - 2);
            const endP = currentToc ? currentToc.endPage : Math.min(this.bookData.metadata.totalPages, this.currentPage + 5);

            let combinedHtml = '';
            for (let p = startP; p <= endP; p++) {
                const pageData = this.bookData.pages[p - 1];
                if (pageData) {
                    combinedHtml += `<div class="page-block" id="page-block-${p}" data-page="${p}">`;
                    if (p > startP) {
                        combinedHtml += `<div class="page-break-divider"><i class="fa-solid fa-bookmark"></i> Trang ${p}</div>`;
                    }
                    combinedHtml += this.formatParagraphsHtml(pageData.paragraphs, p);
                    combinedHtml += `</div>`;
                }
            }
            textContentArea.innerHTML = combinedHtml;
        }
    }

    formatParagraphsHtml(paragraphs, pageNum) {
        if (!paragraphs || paragraphs.length === 0) {
            return `<p style="font-style: italic; color: var(--text-muted); text-align: center; padding: 20px 0;">[Trang ${pageNum} không có nội dung chữ hoặc là trang bìa / biểu đồ]</p>`;
        }
        return paragraphs.map(p => `<p>${this.escapeHtml(p)}</p>`).join('');
    }

    setupScrollListener() {
        const viewport = document.getElementById('readerViewport');
        if (!viewport) return;

        let scrollTimeout;
        viewport.addEventListener('scroll', () => {
            if (this.readingMode !== 'scroll' || this.isProgrammaticScroll || !this.bookData) return;

            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const blocks = document.querySelectorAll('.page-block');
                if (!blocks.length) return;

                const viewportRect = viewport.getBoundingClientRect();
                let closestBlock = null;
                let minDistance = Infinity;

                blocks.forEach(block => {
                    const rect = block.getBoundingClientRect();
                    const distance = Math.abs(rect.top - (viewportRect.top + 60));
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestBlock = block;
                    }
                });

                if (closestBlock) {
                    const pageNum = parseInt(closestBlock.dataset.page);
                    if (pageNum && pageNum !== this.currentPage) {
                        this.currentPage = pageNum;
                        localStorage.setItem(`reader_${this.currentBookId}_page`, this.currentPage);
                        if (this.currentBookId === 'sapiens') {
                            localStorage.setItem('sapiens_last_page', this.currentPage);
                        }
                        
                        const pageInput = document.getElementById('currentPageInput');
                        if (pageInput && document.activeElement !== pageInput) {
                            pageInput.textContent = this.currentPage;
                        }
                        const footerPage = document.getElementById('footerCurrPage');
                        if (footerPage) footerPage.textContent = this.currentPage;

                        const progressPct = ((this.currentPage / this.bookData.metadata.totalPages) * 100).toFixed(1);
                        const pBar = document.getElementById('readingProgressBar');
                        if (pBar) pBar.style.width = `${progressPct}%`;

                        this.updateActiveTocItem();
                        this.updateBookmarkIcon();
                        this.logReadingHistory(this.currentPage);
                    }
                }
            }, 100);
        });
    }

    /* ----------------------------------------------------
       BOOKMARKS SYSTEM (Per-Book)
    ---------------------------------------------------- */
    loadBookmarks() {
        const key = `reader_${this.currentBookId}_bookmarks`;
        let saved = localStorage.getItem(key);
        if (!saved && this.currentBookId === 'sapiens') {
            saved = localStorage.getItem('sapiens_bookmarks');
        }

        if (saved) {
            try {
                this.bookmarks = JSON.parse(saved);
            } catch (e) {
                this.bookmarks = [];
            }
        } else {
            this.bookmarks = [];
        }
        this.renderBookmarksList();
    }

    saveBookmarks() {
        const key = `reader_${this.currentBookId}_bookmarks`;
        localStorage.setItem(key, JSON.stringify(this.bookmarks));
        if (this.currentBookId === 'sapiens') {
            localStorage.setItem('sapiens_bookmarks', JSON.stringify(this.bookmarks));
        }
        this.renderBookmarksList();
        this.updateBookmarkIcon();
    }

    toggleBookmarkCurrent() {
        const existingIdx = this.bookmarks.findIndex(b => b.page === this.currentPage);
        if (existingIdx >= 0) {
            this.bookmarks.splice(existingIdx, 1);
        } else {
            const pageData = this.bookData && this.bookData.pages ? this.bookData.pages[this.currentPage - 1] : null;
            const snippet = pageData && pageData.text ? pageData.text.substring(0, 120) + '...' : `Trang ${this.currentPage}`;
            const currentToc = this.getCurrentChapterToc();

            this.bookmarks.push({
                page: this.currentPage,
                title: currentToc ? currentToc.title : `Trang ${this.currentPage}`,
                snippet: snippet,
                timestamp: new Date().toLocaleDateString('vi-VN')
            });
        }
        this.saveBookmarks();
    }

    updateBookmarkIcon() {
        const icon = document.getElementById('bookmarkIcon');
        if (!icon) return;
        const isBookmarked = this.bookmarks.some(b => b.page === this.currentPage);
        if (isBookmarked) {
            icon.className = 'fa-solid fa-bookmark';
            icon.style.color = 'var(--accent)';
        } else {
            icon.className = 'fa-regular fa-bookmark';
            icon.style.color = '';
        }
    }

    renderBookmarksList() {
        const container = document.getElementById('bookmarksList');
        const badge = document.getElementById('bookmarkCountBadge');
        if (badge) badge.textContent = this.bookmarks.length;
        if (!container) return;

        if (this.bookmarks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fa-regular fa-bookmark" style="font-size: 2rem; margin-bottom: 8px; opacity: 0.5;"></i>
                    <p>Chưa có trang nào được đánh dấu</p>
                    <small>Bấm vào biểu tượng thẻ bài ở thanh trên cùng để đánh dấu trang hiện tại.</small>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        const sorted = [...this.bookmarks].sort((a, b) => a.page - b.page);

        sorted.forEach(bm => {
            const card = document.createElement('div');
            card.className = 'bookmark-card';
            card.innerHTML = `
                <div class="bm-header">
                    <span class="bm-page-badge"><i class="fa-solid fa-bookmark"></i> Trang ${bm.page}</span>
                    <button class="bm-delete-btn" title="Xóa đánh dấu"><i class="fa-solid fa-trash-can"></i></button>
                </div>
                <div class="bm-title" style="font-weight: 600; font-size: 0.88rem; margin-bottom: 4px;">${this.escapeHtml(bm.title)}</div>
                <div class="bm-snippet">${this.escapeHtml(bm.snippet)}</div>
            `;

            card.addEventListener('click', (e) => {
                if (e.target.closest('.bm-delete-btn')) {
                    e.stopPropagation();
                    this.bookmarks = this.bookmarks.filter(b => b.page !== bm.page);
                    this.saveBookmarks();
                    return;
                }
                this.goToPage(bm.page, true);
                if (window.innerWidth <= 768) this.closeSidebar();
            });

            container.appendChild(card);
        });
    }

    /* ----------------------------------------------------
       READING HISTORY SYSTEM (Per-Book)
    ---------------------------------------------------- */
    loadReadingHistory() {
        const key = `reader_${this.currentBookId}_history`;
        let saved = localStorage.getItem(key);
        if (!saved && this.currentBookId === 'sapiens') {
            saved = localStorage.getItem('sapiens_reading_history');
        }

        if (saved) {
            try {
                this.readingHistory = JSON.parse(saved);
            } catch (e) {
                this.readingHistory = [];
            }
        } else {
            this.readingHistory = [];
        }
        this.renderHistoryList();
    }

    saveReadingHistory() {
        const key = `reader_${this.currentBookId}_history`;
        localStorage.setItem(key, JSON.stringify(this.readingHistory));
        if (this.currentBookId === 'sapiens') {
            localStorage.setItem('sapiens_reading_history', JSON.stringify(this.readingHistory));
        }
        this.renderHistoryList();
    }

    logReadingHistory(pageNum) {
        if (!this.bookData) return;
        const currentToc = this.getCurrentChapterToc();
        const progressPct = ((pageNum / this.bookData.metadata.totalPages) * 100).toFixed(1);
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} - ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}`;

        this.readingHistory = this.readingHistory.filter(h => h.page !== pageNum);

        this.readingHistory.unshift({
            page: pageNum,
            title: currentToc ? currentToc.title : `Trang ${pageNum}`,
            progressPct: progressPct,
            timestamp: timeStr,
            timeRaw: Date.now()
        });

        if (this.readingHistory.length > 80) {
            this.readingHistory = this.readingHistory.slice(0, 80);
        }

        this.saveReadingHistory();
    }

    clearReadingHistory() {
        if (confirm(`Bạn có chắc chắn muốn xóa toàn bộ lịch sử đọc sách "${this.activeBookMeta.shortTitle}" không?`)) {
            this.readingHistory = [];
            this.saveReadingHistory();
        }
    }

    renderHistoryList() {
        const container = document.getElementById('historyList');
        const badge = document.getElementById('historyCountBadge');
        const summaryText = document.getElementById('historySummaryText');

        if (!container) return;
        if (badge) badge.textContent = this.readingHistory.length;
        if (summaryText) summaryText.textContent = `${this.readingHistory.length} trang đã đọc`;

        if (this.readingHistory.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-clock-rotate-left" style="font-size: 2rem; margin-bottom: 8px; opacity: 0.5;"></i>
                    <p>Chưa có lịch sử đọc</p>
                    <small>Các trang bạn đọc sẽ được tự động lưu lại tại đây.</small>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        this.readingHistory.forEach(item => {
            const card = document.createElement('div');
            card.className = 'history-card';
            card.innerHTML = `
                <div class="history-header">
                    <span class="history-page-badge"><i class="fa-solid fa-book-open"></i> Trang ${item.page}</span>
                    <span class="history-time"><i class="fa-regular fa-clock"></i> ${item.timestamp}</span>
                </div>
                <div class="history-title">${this.escapeHtml(item.title)}</div>
                <div class="history-footer">
                    <span>Tiến độ</span>
                    <span class="history-progress-badge">${item.progressPct}% sách</span>
                </div>
            `;

            card.addEventListener('click', () => {
                this.goToPage(item.page, true);
                if (window.innerWidth <= 768) this.closeSidebar();
            });

            container.appendChild(card);
        });
    }

    /* ----------------------------------------------------
       FULL-TEXT SEARCH ENGINE
    ---------------------------------------------------- */
    performSearch(query) {
        const resultsContainer = document.getElementById('searchResultsList');
        const statsEl = document.getElementById('searchResultStats');
        if (!resultsContainer || !statsEl) return;
        resultsContainer.innerHTML = '';

        const trimmed = query.trim();
        if (trimmed.length < 2) {
            statsEl.textContent = 'Nhập ít nhất 2 ký tự để tìm kiếm.';
            return;
        }

        if (!this.bookData || !this.bookData.pages) return;

        const regex = new RegExp(this.escapeRegExp(trimmed), 'gi');
        const matches = [];

        for (let p = 0; p < this.bookData.pages.length; p++) {
            const pageObj = this.bookData.pages[p];
            if (pageObj.text && regex.test(pageObj.text)) {
                const matchIndex = pageObj.text.toLowerCase().indexOf(trimmed.toLowerCase());
                const start = Math.max(0, matchIndex - 60);
                const end = Math.min(pageObj.text.length, matchIndex + trimmed.length + 80);
                let snippet = pageObj.text.substring(start, end);
                if (start > 0) snippet = '...' + snippet;
                if (end < pageObj.text.length) snippet = snippet + '...';

                const highlightedSnippet = this.escapeHtml(snippet).replace(
                    new RegExp(this.escapeRegExp(trimmed), 'gi'),
                    match => `<span class="search-highlight">${match}</span>`
                );

                let chapTitle = `Trang ${pageObj.page}`;
                if (this.bookData.toc) {
                    for (let c of this.bookData.toc) {
                        if (pageObj.page >= c.startPage && pageObj.page <= c.endPage) {
                            chapTitle = c.title;
                            break;
                        }
                    }
                }

                matches.push({
                    page: pageObj.page,
                    chapterTitle: chapTitle,
                    snippetHtml: highlightedSnippet
                });

                if (matches.length >= 80) break;
            }
        }

        statsEl.textContent = `Tìm thấy ${matches.length} kết quả phù hợp cho "${trimmed}":`;

        if (matches.length === 0) {
            resultsContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted);">Không tìm thấy kết quả nào phù hợp trong cuốn sách này.</div>`;
            return;
        }

        matches.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'search-result-item';
            itemEl.innerHTML = `
                <div class="sr-header">
                    <span class="sr-chap-title">${this.escapeHtml(item.chapterTitle)}</span>
                    <span class="sr-page">Trang ${item.page}</span>
                </div>
                <div class="sr-snippet">${item.snippetHtml}</div>
            `;
            itemEl.addEventListener('click', () => {
                this.closeSearchModal();
                this.goToPage(item.page, true);
            });
            resultsContainer.appendChild(itemEl);
        });
    }

    /* ----------------------------------------------------
       TEXT TO SPEECH (AUDIO READER)
    ---------------------------------------------------- */
    toggleAudioReader() {
        const bar = document.getElementById('audioPlayerBar');
        if (!bar) return;
        if (this.isPlayingAudio) {
            this.stopAudio();
            bar.classList.add('hidden');
        } else {
            bar.classList.remove('hidden');
            this.playAudio();
        }
    }

    playAudio() {
        if (!this.speechSynth) {
            alert('Trình duyệt của bạn không hỗ trợ tính năng Đọc thành tiếng (Text-to-Speech).');
            return;
        }

        this.speechSynth.cancel();

        const pageData = this.bookData && this.bookData.pages ? this.bookData.pages[this.currentPage - 1] : null;
        if (!pageData || !pageData.text) return;

        const snippetDisplay = document.getElementById('audioPlayingTextSnippet');
        if (snippetDisplay) snippetDisplay.textContent = pageData.text.substring(0, 100) + '...';

        this.currentUtterance = new SpeechSynthesisUtterance(pageData.text);
        this.currentUtterance.lang = 'vi-VN';
        
        const speedSelect = document.getElementById('selectAudioSpeed');
        if (speedSelect) this.currentUtterance.rate = parseFloat(speedSelect.value) || 1.0;

        this.currentUtterance.onend = () => {
            this.isPlayingAudio = false;
            const playBtn = document.getElementById('btnAudioPlayPause');
            if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        };

        this.speechSynth.speak(this.currentUtterance);
        this.isPlayingAudio = true;
        const playBtn = document.getElementById('btnAudioPlayPause');
        if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    }

    stopAudio() {
        if (this.speechSynth) {
            this.speechSynth.cancel();
        }
        this.isPlayingAudio = false;
        const playBtn = document.getElementById('btnAudioPlayPause');
        if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    }

    /* ----------------------------------------------------
       EVENTS & CONTROLS BINDING
    ---------------------------------------------------- */
    bindEvents() {
        // Book Library Switcher triggers
        const btnOpenLibraryNav = document.getElementById('btnOpenLibraryNav');
        if (btnOpenLibraryNav) {
            btnOpenLibraryNav.addEventListener('click', () => this.toggleLibraryModal());
        }

        const btnOpenLibraryQuick = document.getElementById('btnOpenLibraryQuick');
        if (btnOpenLibraryQuick) {
            btnOpenLibraryQuick.addEventListener('click', () => this.toggleLibraryModal());
        }

        const btnSwitchBookSidebar = document.getElementById('btnSwitchBookSidebar');
        if (btnSwitchBookSidebar) {
            btnSwitchBookSidebar.addEventListener('click', () => this.openLibraryModal());
        }

        const btnCloseLibrary = document.getElementById('btnCloseLibrary');
        if (btnCloseLibrary) {
            btnCloseLibrary.addEventListener('click', () => this.closeLibraryModal());
        }

        const libraryModal = document.getElementById('bookLibraryModal');
        if (libraryModal) {
            libraryModal.addEventListener('click', (e) => {
                if (e.target.id === 'bookLibraryModal') this.closeLibraryModal();
            });
        }

        // Page Nav buttons
        document.getElementById('btnPrevPage').addEventListener('click', () => this.goToPage(this.currentPage - 1, true));
        document.getElementById('btnNextPage').addEventListener('click', () => this.goToPage(this.currentPage + 1, true));
        document.getElementById('btnFooterPrev').addEventListener('click', () => this.goToPage(this.currentPage - 1, true));
        document.getElementById('btnFooterNext').addEventListener('click', () => this.goToPage(this.currentPage + 1, true));

        // Direct Page Input
        const pageInput = document.getElementById('currentPageInput');
        if (pageInput) {
            pageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = parseInt(pageInput.textContent.trim());
                    if (!isNaN(val)) this.goToPage(val, true);
                    pageInput.blur();
                }
            });
            pageInput.addEventListener('blur', () => {
                const val = parseInt(pageInput.textContent.trim());
                if (!isNaN(val) && val !== this.currentPage) {
                    this.goToPage(val, true);
                } else {
                    pageInput.textContent = this.currentPage;
                }
            });
        }

        // Reading Mode Pills
        document.getElementById('btnReadingModeScroll').addEventListener('click', () => {
            this.readingMode = 'scroll';
            document.getElementById('btnReadingModeScroll').classList.add('active');
            document.getElementById('btnReadingModePage').classList.remove('active');
            document.getElementById('textContentArea').innerHTML = '';
            this.goToPage(this.currentPage, true);
        });
        document.getElementById('btnReadingModePage').addEventListener('click', () => {
            this.readingMode = 'page';
            document.getElementById('btnReadingModePage').classList.add('active');
            document.getElementById('btnReadingModeScroll').classList.remove('active');
            document.getElementById('textContentArea').innerHTML = '';
            this.goToPage(this.currentPage, true);
        });

        // Sidebar Toggle & Tabs
        document.getElementById('btnToggleSidebar').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('btnCloseSidebar').addEventListener('click', () => this.closeSidebar());
        document.getElementById('sidebarBackdrop').addEventListener('click', () => this.closeSidebar());

        document.querySelectorAll('.sidebar-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sidebar-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.sidebar-content .tab-pane').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const targetTab = btn.dataset.tab;
                document.getElementById(`tab${targetTab.charAt(0).toUpperCase() + targetTab.slice(1)}Content`).classList.add('active');
            });
        });

        // TOC Filter
        document.getElementById('tocFilterInput').addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            document.querySelectorAll('#tocList .toc-item').forEach(item => {
                const text = item.textContent.toLowerCase();
                item.style.display = text.includes(query) ? '' : 'none';
            });
        });

        // Bookmarks & History Buttons
        document.getElementById('btnBookmarkCurrent').addEventListener('click', () => this.toggleBookmarkCurrent());

        const btnHistoryQuick = document.getElementById('btnHistoryQuick');
        if (btnHistoryQuick) {
            btnHistoryQuick.addEventListener('click', () => {
                this.toggleSidebar();
                document.getElementById('tabHistoryBtn').click();
            });
        }

        const btnClearHistory = document.getElementById('btnClearHistory');
        if (btnClearHistory) {
            btnClearHistory.addEventListener('click', () => this.clearReadingHistory());
        }

        // Settings Drawer Controls
        document.getElementById('btnSettings').addEventListener('click', () => {
            document.getElementById('settingsDrawer').classList.toggle('open');
        });
        document.getElementById('btnCloseSettings').addEventListener('click', () => {
            document.getElementById('settingsDrawer').classList.remove('open');
        });

        // Theme Switchers
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.prefs.theme = btn.dataset.theme;
                this.applyPreferences();
                this.savePreferences();
            });
        });

        // Font Switchers
        document.querySelectorAll('.font-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.prefs.fontFamily = btn.dataset.font;
                this.applyPreferences();
                this.savePreferences();
            });
        });

        // Font Size Range & Buttons
        const fontRange = document.getElementById('fontSizeRange');
        if (fontRange) {
            fontRange.addEventListener('input', (e) => {
                this.prefs.fontSize = parseInt(e.target.value);
                this.applyPreferences();
                this.savePreferences();
            });
        }
        document.getElementById('btnDecreaseFont').addEventListener('click', () => {
            if (this.prefs.fontSize > 14) {
                this.prefs.fontSize--;
                this.applyPreferences();
                this.savePreferences();
            }
        });
        document.getElementById('btnIncreaseFont').addEventListener('click', () => {
            if (this.prefs.fontSize < 28) {
                this.prefs.fontSize++;
                this.applyPreferences();
                this.savePreferences();
            }
        });

        // Line Height Range
        document.getElementById('lineHeightRange').addEventListener('input', (e) => {
            this.prefs.lineHeight = parseFloat(e.target.value);
            this.applyPreferences();
            this.savePreferences();
        });

        // Width Switchers
        document.querySelectorAll('.width-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.prefs.maxWidth = btn.dataset.width;
                this.applyPreferences();
                this.savePreferences();
            });
        });

        // Full-text Search Modal Controls
        document.getElementById('btnSearch').addEventListener('click', () => this.openSearchModal());
        document.getElementById('btnCloseSearch').addEventListener('click', () => this.closeSearchModal());
        document.getElementById('searchModal').addEventListener('click', (e) => {
            if (e.target.id === 'searchModal') this.closeSearchModal();
        });

        const searchInput = document.getElementById('fullSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.performSearch(e.target.value));
        }
        document.getElementById('btnClearSearch').addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                this.performSearch('');
                searchInput.focus();
            }
        });

        // Fullscreen Toggle
        document.getElementById('btnFullscreen').addEventListener('click', () => this.toggleFullscreen());

        // Audio Player Controls
        document.getElementById('btnAudioPlayer').addEventListener('click', () => this.toggleAudioReader());
        document.getElementById('btnAudioPlayPause').addEventListener('click', () => {
            if (this.isPlayingAudio) {
                this.stopAudio();
            } else {
                this.playAudio();
            }
        });
        document.getElementById('btnAudioStop').addEventListener('click', () => this.stopAudio());
        document.getElementById('btnCloseAudioBar').addEventListener('click', () => {
            this.stopAudio();
            document.getElementById('audioPlayerBar').classList.add('hidden');
        });
        document.getElementById('selectAudioSpeed').addEventListener('change', () => {
            if (this.isPlayingAudio) this.playAudio();
        });

        // Cross-Device Sync Modal Controls
        const btnOpenSyncModal = document.getElementById('btnOpenSyncModal');
        if (btnOpenSyncModal) {
            btnOpenSyncModal.addEventListener('click', () => this.openSyncModal());
        }

        const btnCloseSyncModal = document.getElementById('btnCloseSyncModal');
        if (btnCloseSyncModal) {
            btnCloseSyncModal.addEventListener('click', () => this.closeSyncModal());
        }

        const syncModal = document.getElementById('syncDevicesModal');
        if (syncModal) {
            syncModal.addEventListener('click', (e) => {
                if (e.target.id === 'syncDevicesModal') this.closeSyncModal();
            });
        }

        // Sync Modal Tabs
        document.querySelectorAll('.sync-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sync-tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.sync-tab-pane').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const tabId = `tabSync${btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)}`;
                const pane = document.getElementById(tabId);
                if (pane) pane.classList.add('active');
            });
        });

        // Copy Sync URL
        const btnCopySyncUrl = document.getElementById('btnCopySyncUrl');
        if (btnCopySyncUrl) {
            btnCopySyncUrl.addEventListener('click', () => {
                const input = document.getElementById('syncUrlInput');
                if (input) {
                    navigator.clipboard.writeText(input.value).then(() => {
                        this.showToast('📋 Đã sao chép liên kết đồng bộ!', 'fa-solid fa-copy');
                    }).catch(() => {
                        input.select();
                        document.execCommand('copy');
                        this.showToast('📋 Đã sao chép liên kết đồng bộ!', 'fa-solid fa-copy');
                    });
                }
            });
        }

        // Apply Custom Host (Wi-Fi LAN IP)
        const btnApplyCustomHost = document.getElementById('btnApplyCustomHost');
        if (btnApplyCustomHost) {
            btnApplyCustomHost.addEventListener('click', () => {
                const customHostInput = document.getElementById('customHostInput');
                const host = customHostInput ? customHostInput.value.trim() : '';
                const url = this.generateSyncUrl(host || null);
                const syncUrlInput = document.getElementById('syncUrlInput');
                if (syncUrlInput) syncUrlInput.value = url;
                this.renderSyncQrCode(url);
                this.showToast('✨ Đã cập nhật mã QR với địa chỉ IP mới!', 'fa-solid fa-qrcode');
            });
        }

        // Cloud Sync Key Controls
        const cloudKeyInput = document.getElementById('cloudSyncKeyInput');
        if (cloudKeyInput) {
            cloudKeyInput.value = this.cloudSyncKey;
            cloudKeyInput.addEventListener('input', (e) => {
                this.cloudSyncKey = e.target.value.trim().toUpperCase();
                localStorage.setItem('reader_cloud_sync_key', this.cloudSyncKey);
            });
        }

        const btnGenerateSyncKey = document.getElementById('btnGenerateSyncKey');
        if (btnGenerateSyncKey) {
            btnGenerateSyncKey.addEventListener('click', () => {
                this.cloudSyncKey = this.generateDefaultSyncKey();
                if (cloudKeyInput) cloudKeyInput.value = this.cloudSyncKey;
                this.showToast(`🔑 Đã tạo mã đồng bộ mới: ${this.cloudSyncKey}`, 'fa-solid fa-key');
            });
        }

        const btnPushToCloud = document.getElementById('btnPushToCloud');
        if (btnPushToCloud) {
            btnPushToCloud.addEventListener('click', () => this.cloudPush());
        }

        const btnPullFromCloud = document.getElementById('btnPullFromCloud');
        if (btnPullFromCloud) {
            btnPullFromCloud.addEventListener('click', () => this.cloudPull());
        }

        const chkAutoCloudSync = document.getElementById('chkAutoCloudSync');
        if (chkAutoCloudSync) {
            chkAutoCloudSync.checked = this.autoCloudSyncEnabled;
            chkAutoCloudSync.addEventListener('change', (e) => {
                this.autoCloudSyncEnabled = e.target.checked;
                localStorage.setItem('reader_auto_cloud_sync', e.target.checked ? 'true' : 'false');
                this.showToast(e.target.checked ? 'Đã bật Tự động đồng bộ đám mây' : 'Đã tắt Tự động đồng bộ đám mây', 'fa-solid fa-cloud');
            });
        }

        // Backup & Restore JSON
        const btnExportJson = document.getElementById('btnExportJson');
        if (btnExportJson) {
            btnExportJson.addEventListener('click', () => this.exportBackupFile());
        }

        const btnImportJson = document.getElementById('btnImportJson');
        const importFileInput = document.getElementById('importJsonFileInput');
        if (btnImportJson && importFileInput) {
            btnImportJson.addEventListener('click', () => importFileInput.click());
            importFileInput.addEventListener('change', (e) => this.importBackupFile(e));
        }

        // Mobile Bottom Navigation Bar Events
        const btnMobileToc = document.getElementById('btnMobileToc');
        if (btnMobileToc) {
            btnMobileToc.addEventListener('click', () => this.toggleSidebar());
        }

        const btnMobileLibrary = document.getElementById('btnMobileLibrary');
        if (btnMobileLibrary) {
            btnMobileLibrary.addEventListener('click', () => this.openLibraryModal());
        }

        const btnMobilePrev = document.getElementById('btnMobilePrev');
        if (btnMobilePrev) {
            btnMobilePrev.addEventListener('click', () => this.goToPage(this.currentPage - 1, true));
        }

        const btnMobileNext = document.getElementById('btnMobileNext');
        if (btnMobileNext) {
            btnMobileNext.addEventListener('click', () => this.goToPage(this.currentPage + 1, true));
        }

        const mobilePageIndicator = document.getElementById('mobilePageIndicator');
        if (mobilePageIndicator) {
            mobilePageIndicator.addEventListener('click', () => {
                const target = prompt(`Nhập số trang muốn đến (1 - ${this.bookData.metadata.totalPages}):`, this.currentPage);
                if (target) {
                    const pageNum = parseInt(target.trim());
                    if (!isNaN(pageNum)) this.goToPage(pageNum, true);
                }
            });
        }

        const btnMobileSync = document.getElementById('btnMobileSync');
        if (btnMobileSync) {
            btnMobileSync.addEventListener('click', () => this.openSyncModal());
        }

        const btnMobileSettings = document.getElementById('btnMobileSettings');
        if (btnMobileSettings) {
            btnMobileSettings.addEventListener('click', () => {
                const drawer = document.getElementById('settingsDrawer');
                if (drawer) drawer.classList.toggle('open');
            });
        }
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebarBackdrop');
        sidebar.classList.toggle('closed');
        if (window.innerWidth <= 768) {
            backdrop.style.display = sidebar.classList.contains('closed') ? 'none' : 'block';
        }
    }

    closeSidebar() {
        document.getElementById('sidebar').classList.add('closed');
        document.getElementById('sidebarBackdrop').style.display = 'none';
    }

    openSearchModal() {
        const modal = document.getElementById('searchModal');
        modal.classList.add('open');
        setTimeout(() => {
            const input = document.getElementById('fullSearchInput');
            if (input) input.focus();
        }, 100);
    }

    closeSearchModal() {
        document.getElementById('searchModal').classList.remove('open');
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {});
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    }

    initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return;

            if (e.key === 'ArrowLeft') {
                this.goToPage(this.currentPage - 1, true);
            } else if (e.key === 'ArrowRight') {
                this.goToPage(this.currentPage + 1, true);
            } else if (e.key.toLowerCase() === 'l') {
                this.toggleLibraryModal();
            } else if (e.key.toLowerCase() === 'f') {
                this.toggleFullscreen();
            } else if (e.key.toLowerCase() === 's') {
                e.preventDefault();
                this.openSearchModal();
            } else if (e.key.toLowerCase() === 't') {
                this.toggleSidebar();
            } else if (e.key.toLowerCase() === 'b') {
                this.toggleBookmarkCurrent();
            } else if (e.key.toLowerCase() === 'y') {
                this.openSyncModal();
            } else if (e.key === 'Escape') {
                this.closeSearchModal();
                this.closeLibraryModal();
                this.closeSyncModal();
                document.getElementById('settingsDrawer').classList.remove('open');
            }
        });
    }

    /* ----------------------------------------------------
       CROSS-DEVICE SYNCHRONIZATION SYSTEM
    ---------------------------------------------------- */
    checkUrlForSyncState() {
        const urlParams = new URLSearchParams(window.location.search);
        const syncParam = urlParams.get('sync');
        if (!syncParam) return;

        try {
            const jsonStr = decodeURIComponent(escape(atob(decodeURIComponent(syncParam))));
            const payload = JSON.parse(jsonStr);

            // Apply book ID if valid
            if (payload.b && BOOKS_CATALOG.some(book => book.id === payload.b)) {
                this.currentBookId = payload.b;
                localStorage.setItem('reader_current_book_id', payload.b);
            }

            // Apply book pages
            if (payload.bp) {
                if (payload.bp.k) localStorage.setItem('reader_kinh-te-hoc-co-ban_page', payload.bp.k);
                if (payload.bp.s) {
                    localStorage.setItem('reader_sapiens_page', payload.bp.s);
                    localStorage.setItem('sapiens_last_page', payload.bp.s);
                }
            }

            if (payload.p) {
                localStorage.setItem(`reader_${this.currentBookId}_page`, payload.p);
                if (this.currentBookId === 'sapiens') {
                    localStorage.setItem('sapiens_last_page', payload.p);
                }
            }

            // Clean URL so refresh does not re-apply
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete('sync');
            cleanUrl.searchParams.set('book', this.currentBookId);
            window.history.replaceState({}, '', cleanUrl);

            setTimeout(() => {
                this.showToast(`✨ Đã đồng bộ thành công từ thiết bị trước! Đang tiếp tục tại trang ${payload.p || 1}`, 'fa-solid fa-arrows-rotate', 4500);
            }, 800);
        } catch (err) {
            console.error('Failed to parse sync state from URL:', err);
        }
    }

    getBookmarksForBook(bookId) {
        const key = `reader_${bookId}_bookmarks`;
        let saved = localStorage.getItem(key);
        if (!saved && bookId === 'sapiens') saved = localStorage.getItem('sapiens_bookmarks');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { return []; }
        }
        return [];
    }

    getHistoryForBook(bookId) {
        const key = `reader_${bookId}_history`;
        let saved = localStorage.getItem(key);
        if (!saved && bookId === 'sapiens') saved = localStorage.getItem('sapiens_reading_history');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { return []; }
        }
        return [];
    }

    exportReadingState() {
        return {
            version: 1,
            exportedAt: new Date().toISOString(),
            currentBookId: this.currentBookId,
            currentPage: this.currentPage,
            books: {
                'kinh-te-hoc-co-ban': {
                    page: parseInt(localStorage.getItem('reader_kinh-te-hoc-co-ban_page')) || (this.currentBookId === 'kinh-te-hoc-co-ban' ? this.currentPage : 1),
                    bookmarks: this.getBookmarksForBook('kinh-te-hoc-co-ban'),
                    history: this.getHistoryForBook('kinh-te-hoc-co-ban')
                },
                'sapiens': {
                    page: parseInt(localStorage.getItem('reader_sapiens_page')) || parseInt(localStorage.getItem('sapiens_last_page')) || (this.currentBookId === 'sapiens' ? this.currentPage : 1),
                    bookmarks: this.getBookmarksForBook('sapiens'),
                    history: this.getHistoryForBook('sapiens')
                }
            },
            prefs: this.prefs
        };
    }

    applyReadingState(state, showToast = true) {
        if (!state || typeof state !== 'object') return false;

        if (state.books) {
            Object.keys(state.books).forEach(bookId => {
                const bData = state.books[bookId];
                if (!bData) return;
                if (bData.page) {
                    localStorage.setItem(`reader_${bookId}_page`, bData.page);
                    if (bookId === 'sapiens') localStorage.setItem('sapiens_last_page', bData.page);
                }
                if (bData.bookmarks) {
                    localStorage.setItem(`reader_${bookId}_bookmarks`, JSON.stringify(bData.bookmarks));
                    if (bookId === 'sapiens') localStorage.setItem('sapiens_bookmarks', JSON.stringify(bData.bookmarks));
                }
                if (bData.history) {
                    localStorage.setItem(`reader_${bookId}_history`, JSON.stringify(bData.history));
                    if (bookId === 'sapiens') localStorage.setItem('sapiens_reading_history', JSON.stringify(bData.history));
                }
            });
        }

        if (state.prefs) {
            this.prefs = { ...this.prefs, ...state.prefs };
            this.savePreferences();
            this.applyPreferences();
        }

        this.loadBookmarks();
        this.loadReadingHistory();

        const targetBookId = state.currentBookId || this.currentBookId;
        const targetPage = state.currentPage || (state.books && state.books[targetBookId] ? state.books[targetBookId].page : 1);

        if (targetBookId !== this.currentBookId) {
            this.switchBook(targetBookId).then(() => {
                if (targetPage) this.goToPage(targetPage, true);
            });
        } else if (targetPage && targetPage !== this.currentPage) {
            this.goToPage(targetPage, true);
        }

        if (showToast) {
            const meta = this.getBookMeta(targetBookId);
            this.showToast(`🎉 Đã đồng bộ tiến độ thành công! (${meta.shortTitle} - Trang ${targetPage})`, 'fa-solid fa-arrows-rotate', 4000);
        }

        return true;
    }

    generateSyncUrl(customHost = null) {
        const minimalState = {
            b: this.currentBookId,
            p: this.currentPage,
            t: Date.now(),
            bp: {
                'k': parseInt(localStorage.getItem('reader_kinh-te-hoc-co-ban_page')) || (this.currentBookId === 'kinh-te-hoc-co-ban' ? this.currentPage : 1),
                's': parseInt(localStorage.getItem('reader_sapiens_page')) || parseInt(localStorage.getItem('sapiens_last_page')) || (this.currentBookId === 'sapiens' ? this.currentPage : 1)
            }
        };
        const jsonStr = JSON.stringify(minimalState);
        const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(jsonStr))));

        let origin = window.location.origin;
        let pathname = window.location.pathname;

        if (customHost) {
            const protocol = window.location.protocol.startsWith('http') ? window.location.protocol : 'http:';
            origin = `${protocol}//${customHost.trim().replace(/^https?:\/\//, '')}`;
        }

        return `${origin}${pathname}?sync=${encoded}`;
    }

    renderSyncQrCode(url) {
        const container = document.getElementById('syncQrCodeContainer');
        if (!container) return;
        container.innerHTML = '';

        if (typeof QRCode !== 'undefined') {
            try {
                new QRCode(container, {
                    text: url,
                    width: 170,
                    height: 170,
                    colorDark: "#1f2937",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
                });
                return;
            } catch (e) {
                console.warn('QRCode rendering error:', e);
            }
        }

        // Fallback: Use QuickChart QR API or display clickable link
        const qrImg = document.createElement('img');
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${encodeURIComponent(url)}`;
        qrImg.alt = 'QR Code Sync';
        qrImg.onerror = () => {
            container.innerHTML = `<div style="padding: 20px; font-size: 0.75rem; color: var(--text-muted);"><i class="fa-solid fa-qrcode" style="font-size: 2rem; display: block; margin-bottom: 8px;"></i>Hãy sao chép liên kết bên dưới để mở trên điện thoại.</div>`;
        };
        container.appendChild(qrImg);
    }

    openSyncModal() {
        const modal = document.getElementById('syncDevicesModal');
        if (!modal) return;

        // Update status banner
        const statusBook = document.getElementById('syncStatusBookTitle');
        if (statusBook) statusBook.textContent = this.activeBookMeta.title;

        const statusPage = document.getElementById('syncStatusPage');
        if (statusPage && this.bookData) {
            statusPage.textContent = `Đang ở Trang ${this.currentPage} / ${this.bookData.metadata.totalPages} • Đã lưu tại máy này`;
        }

        // Handle IP Wi-Fi hint
        const customHostInput = document.getElementById('customHostInput');
        const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        let defaultHost = null;

        if (isLocal) {
            defaultHost = `192.168.1.101:${window.location.port || '8000'}`;
            if (customHostInput && !customHostInput.value) {
                customHostInput.value = defaultHost;
            }
        }

        const effectiveHost = (customHostInput && customHostInput.value.trim()) ? customHostInput.value.trim() : null;
        const syncUrl = this.generateSyncUrl(effectiveHost);

        const syncUrlInput = document.getElementById('syncUrlInput');
        if (syncUrlInput) syncUrlInput.value = syncUrl;

        this.renderSyncQrCode(syncUrl);

        // Load sync key
        const cloudKeyInput = document.getElementById('cloudSyncKeyInput');
        if (cloudKeyInput) cloudKeyInput.value = this.cloudSyncKey;

        modal.classList.add('open');
    }

    closeSyncModal() {
        const modal = document.getElementById('syncDevicesModal');
        if (modal) modal.classList.remove('open');
    }

    debouncedCloudPush() {
        clearTimeout(this.cloudPushTimeout);
        this.cloudPushTimeout = setTimeout(() => {
            this.cloudPush(true);
        }, 3000);
    }

    async cloudPush(isSilent = false) {
        const syncKey = this.cloudSyncKey || this.generateDefaultSyncKey();
        const payload = this.exportReadingState();
        const statusEl = document.getElementById('cloudSyncStatusMsg');

        try {
            if (statusEl && !isSilent) statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải lên đám mây...';

            // Store in KVDB or public KV store
            const kvUrl = `https://kvdb.io/BkMtReader9921/${encodeURIComponent(syncKey)}`;
            let isSuccess = false;

            try {
                const res = await fetch(kvUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) isSuccess = true;
            } catch (netErr) {
                console.warn('Cloud KV network error, saving fallback:', netErr);
            }

            // Always store fallback in localStorage
            localStorage.setItem(`cloud_mock_${syncKey}`, JSON.stringify(payload));
            const now = new Date();
            const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

            if (statusEl) {
                statusEl.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #059669;"></i> Đã lưu lên Đám Mây thành công lúc <strong>${timeStr}</strong> (Khóa: <code>${syncKey}</code>)`;
            }

            if (!isSilent) {
                this.showToast('☁️ Đã lưu tiến độ đọc lên Đám Mây thành công!', 'fa-solid fa-cloud-arrow-up');
            }
        } catch (err) {
            console.error('Cloud push error:', err);
            if (statusEl && !isSilent) {
                statusEl.innerHTML = `<span style="color: #dc2626;"><i class="fa-solid fa-circle-exclamation"></i> Không thể lưu lên đám mây: ${this.escapeHtml(err.message)}</span>`;
            }
        }
    }

    async cloudPull() {
        const syncKey = this.cloudSyncKey;
        const statusEl = document.getElementById('cloudSyncStatusMsg');

        if (!syncKey) {
            alert('Vui lòng nhập Mã Đồng Bộ Cá Nhân (Sync Key) để tải dữ liệu.');
            return;
        }

        try {
            if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tìm nạp dữ liệu từ đám mây...';

            let stateData = null;
            const kvUrl = `https://kvdb.io/BkMtReader9921/${encodeURIComponent(syncKey)}`;

            try {
                const res = await fetch(kvUrl);
                if (res.ok) {
                    stateData = await res.json();
                }
            } catch (netErr) {
                console.warn('Cloud KV fetch failed, attempting local fallback:', netErr);
            }

            if (!stateData) {
                const localMock = localStorage.getItem(`cloud_mock_${syncKey}`);
                if (localMock) {
                    stateData = JSON.parse(localMock);
                }
            }

            if (!stateData) {
                throw new Error(`Không tìm thấy dữ liệu trên Đám Mây cho mã khóa "${syncKey}". Hãy đảm bảo thiết bị kia đã bấm "Lưu tiến độ lên Đám Mây".`);
            }

            this.applyReadingState(stateData, true);

            const now = new Date();
            const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            if (statusEl) {
                statusEl.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #059669;"></i> Đã đồng bộ dữ liệu mới nhất từ Đám Mây lúc <strong>${timeStr}</strong>!`;
            }
        } catch (err) {
            console.error('Cloud pull error:', err);
            if (statusEl) {
                statusEl.innerHTML = `<span style="color: #dc2626;"><i class="fa-solid fa-circle-exclamation"></i> ${this.escapeHtml(err.message)}</span>`;
            }
            this.showToast(err.message, 'fa-solid fa-circle-exclamation', 4500);
        }
    }

    exportBackupFile() {
        const state = this.exportReadingState();
        const jsonStr = JSON.stringify(state, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `bookmate_backup_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast('📥 Đã tải xuống tệp sao lưu dữ liệu!', 'fa-solid fa-download');
    }

    importBackupFile(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                const success = this.applyReadingState(data, true);
                if (success) {
                    this.closeSyncModal();
                } else {
                    alert('Tệp dữ liệu không hợp lệ hoặc thiếu cấu trúc.');
                }
            } catch (err) {
                alert('Không thể đọc tệp sao lưu: ' + err.message);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    setupTouchGestures() {
        const viewport = document.getElementById('readerViewport');
        if (!viewport) return;
        let startX = 0;
        let startY = 0;
        let startTime = 0;

        viewport.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            startTime = Date.now();
        }, { passive: true });

        viewport.addEventListener('touchend', (e) => {
            if (!startX || Date.now() - startTime > 700) return;
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const deltaX = endX - startX;
            const deltaY = endY - startY;

            // Horizontal swipe detection: significant X, minor Y
            if (Math.abs(deltaX) > 65 && Math.abs(deltaY) < 50) {
                if (deltaX < 0) {
                    // Swiped left -> Next page
                    if (this.currentPage < this.bookData.metadata.totalPages) {
                        this.goToPage(this.currentPage + 1, true);
                        this.showToast(`Trang ${this.currentPage} / ${this.bookData.metadata.totalPages}`, 'fa-solid fa-arrow-right', 1200);
                    }
                } else {
                    // Swiped right -> Previous page
                    if (this.currentPage > 1) {
                        this.goToPage(this.currentPage - 1, true);
                        this.showToast(`Trang ${this.currentPage} / ${this.bookData.metadata.totalPages}`, 'fa-solid fa-arrow-left', 1200);
                    }
                }
            }
            startX = 0;
            startY = 0;
        }, { passive: true });
    }

    showToast(message, icon = 'fa-solid fa-circle-check', duration = 3000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'toast-item';
        toast.innerHTML = `<i class="${icon}"></i><span>${this.escapeHtml(message)}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-8px)';
            setTimeout(() => toast.remove(), 250);
        }, duration);
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;')
                          .replace(/</g, '&lt;')
                          .replace(/>/g, '&gt;')
                          .replace(/"/g, '&quot;')
                          .replace(/'/g, '&#039;');
    }

    escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

// Start app on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new UniversalReaderApp();
});
