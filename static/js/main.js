// App State
let state = {
    releaseNotes: [],
    activeFilter: 'all',
    searchQuery: '',
    selectedItem: null,
    history: []
};

// UI Elements
const els = {
    btnRefresh: document.getElementById('btn-refresh'),
    lastFetchedTime: document.getElementById('last-fetched-time'),
    searchInput: document.getElementById('search-input'),
    clearSearch: document.getElementById('clear-search'),
    filterTagsList: document.getElementById('filter-tags-list'),
    
    feedLoading: document.getElementById('feed-loading'),
    feedError: document.getElementById('feed-error'),
    errorMessage: document.getElementById('error-message'),
    btnRetry: document.getElementById('btn-retry'),
    feedEmpty: document.getElementById('feed-empty'),
    feedContainer: document.getElementById('feed-container'),
    
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabComposer: document.getElementById('tab-composer'),
    tabHistory: document.getElementById('tab-history'),
    historyBadge: document.getElementById('history-badge'),
    
    composerPlaceholder: document.getElementById('composer-placeholder'),
    composerEditor: document.getElementById('composer-editor'),
    composerClose: document.getElementById('composer-close'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    btnCancelComposer: document.getElementById('btn-cancel-composer'),
    btnTweetShare: document.getElementById('btn-tweet-share'),
    previewTitle: document.getElementById('preview-title'),
    previewDesc: document.getElementById('preview-desc'),
    
    charProgressCircle: document.getElementById('char-progress-circle'),
    charCounter: document.getElementById('char-counter'),
    charWarning: document.getElementById('char-warning'),
    hashtagChips: document.querySelectorAll('.hashtag-chip'),
    
    historyEmpty: document.getElementById('history-empty'),
    historyList: document.getElementById('history-list'),
    toastContainer: document.getElementById('toast-container'),
    connectionStatus: document.getElementById('connection-status')
};

// SVG Progress Ring config
const circleRadius = 14;
const circleCircumference = 2 * Math.PI * circleRadius; // ~87.96

// Setup Progress Ring
if (els.charProgressCircle) {
    els.charProgressCircle.style.strokeDasharray = `${circleCircumference} ${circleCircumference}`;
    els.charProgressCircle.style.strokeDashoffset = circleCircumference;
}

// Initializations
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    fetchReleaseNotes();
    fetchHistory();
});

// Event Listeners Registration
function initEventListeners() {
    // Refresh buttons
    els.btnRefresh.addEventListener('click', () => fetchReleaseNotes(true));
    els.btnRetry.addEventListener('click', () => fetchReleaseNotes(true));
    
    // Search operations
    els.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim().toLowerCase();
        els.clearSearch.style.display = state.searchQuery ? 'block' : 'none';
        renderFeed();
    });
    
    els.clearSearch.addEventListener('click', () => {
        els.searchInput.value = '';
        state.searchQuery = '';
        els.clearSearch.style.display = 'none';
        renderFeed();
        els.searchInput.focus();
    });
    
    // Filters tags clicking
    els.filterTagsList.addEventListener('click', (e) => {
        const tag = e.target.closest('.filter-tag');
        if (!tag) return;
        
        // Update active class
        document.querySelectorAll('.filter-tag').forEach(btn => btn.classList.remove('active'));
        tag.classList.add('active');
        
        state.activeFilter = tag.dataset.type;
        renderFeed();
    });
    
    // Tab switching
    els.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            
            els.tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            if (targetTab === 'composer') {
                els.tabComposer.classList.add('active');
                els.tabHistory.classList.remove('active');
            } else {
                els.tabComposer.classList.remove('active');
                els.tabHistory.classList.add('active');
            }
        });
    });
    
    // Composer elements
    els.tweetTextarea.addEventListener('input', handleTweetInput);
    els.btnCancelComposer.addEventListener('click', resetComposer);
    els.composerClose.addEventListener('click', resetComposer);
    els.btnTweetShare.addEventListener('click', handlePublishTweet);
    
    // Quick hashtag suggestions
    els.hashtagChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const tag = chip.dataset.tag;
            const currentText = els.tweetTextarea.value;
            
            if (!currentText.includes(tag)) {
                // Insert hashtag with proper spaces
                const spacing = currentText.length > 0 && !currentText.endsWith(' ') ? ' ' : '';
                els.tweetTextarea.value = currentText + spacing + tag;
                handleTweetInput();
                showToast(`Added ${tag}`, 'info');
            }
        });
    });
}

// Fetch release notes from backend
async function fetchReleaseNotes(forceRefresh = false) {
    showLoading(true);
    
    try {
        const response = await fetch(`/api/release-notes${forceRefresh ? '?refresh=true' : ''}`);
        const result = await response.json();
        
        if (result.success) {
            state.releaseNotes = result.data;
            els.lastFetchedTime.textContent = result.last_fetched;
            
            // Connection status active
            els.connectionStatus.className = 'status-badge connected';
            els.connectionStatus.querySelector('.status-text').textContent = 'Connected';
            
            renderFeed();
            if (forceRefresh) {
                showToast('Feed refreshed successfully!', 'success');
            }
        } else {
            throw new Error(result.error || 'Failed to fetch release notes.');
        }
    } catch (error) {
        console.error('Error fetching release notes:', error);
        showError(error.message);
        
        els.connectionStatus.className = 'status-badge offline';
        els.connectionStatus.querySelector('.status-text').textContent = 'Disconnected';
    } finally {
        showLoading(false);
    }
}

// Fetch Tweet history from backend
async function fetchHistory() {
    try {
        const response = await fetch('/api/history');
        const result = await response.json();
        if (result.success) {
            state.history = result.data;
            renderHistory();
        }
    } catch (err) {
        console.error('Error fetching tweet history:', err);
    }
}

// Show/Hide loader state
function showLoading(isLoading) {
    if (isLoading) {
        els.feedLoading.style.display = 'flex';
        els.feedContainer.style.display = 'none';
        els.feedError.style.display = 'none';
        els.feedEmpty.style.display = 'none';
        els.btnRefresh.classList.add('refreshing');
        els.btnRefresh.disabled = true;
    } else {
        els.feedLoading.style.display = 'none';
        els.btnRefresh.classList.remove('refreshing');
        els.btnRefresh.disabled = false;
    }
}

// Show error state
function showError(msg) {
    els.errorMessage.textContent = msg;
    els.feedError.style.display = 'flex';
    els.feedContainer.style.display = 'none';
    els.feedEmpty.style.display = 'none';
}

// Render release notes feed based on filters and search
function renderFeed() {
    els.feedContainer.innerHTML = '';
    
    let hasItems = false;
    
    state.releaseNotes.forEach(entry => {
        // Filter items in entry
        const filteredItems = entry.items.filter(item => {
            // Filter by type
            const typeMatches = state.activeFilter === 'all' || 
                               (state.activeFilter === 'Breaking' && (item.type.toLowerCase() === 'breaking' || item.type.toLowerCase() === 'change')) ||
                               item.type.toLowerCase() === state.activeFilter.toLowerCase();
            
            // Filter by search query
            const searchMatches = !state.searchQuery || 
                                 item.type.toLowerCase().includes(state.searchQuery) ||
                                 item.text.toLowerCase().includes(state.searchQuery);
                                 
            return typeMatches && searchMatches;
        });
        
        if (filteredItems.length > 0) {
            hasItems = true;
            
            // Create Date Group
            const dateGroup = document.createElement('div');
            dateGroup.className = 'date-group';
            
            // Date Header
            const dateHeader = document.createElement('div');
            dateHeader.className = 'date-header';
            
            const dateTitle = document.createElement('div');
            dateTitle.className = 'date-title';
            dateTitle.textContent = entry.date;
            
            const dateLine = document.createElement('div');
            dateLine.className = 'date-line';
            
            dateHeader.appendChild(dateTitle);
            dateHeader.appendChild(dateLine);
            dateGroup.appendChild(dateHeader);
            
            // Sub items list
            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'date-group-items';
            
            filteredItems.forEach(item => {
                const card = createReleaseCard(item, entry.date, entry.link);
                itemsContainer.appendChild(card);
            });
            
            dateGroup.appendChild(itemsContainer);
            els.feedContainer.appendChild(dateGroup);
        }
    });
    
    if (hasItems) {
        els.feedContainer.style.display = 'flex';
        els.feedEmpty.style.display = 'none';
    } else {
        els.feedContainer.style.display = 'none';
        els.feedEmpty.style.display = 'flex';
    }
}

// Create a single release card element
function createReleaseCard(item, dateStr, entryLink) {
    const card = document.createElement('div');
    card.className = 'release-card';
    card.id = `card-${item.id}`;
    
    // Check if currently selected
    if (state.selectedItem && state.selectedItem.id === item.id) {
        card.classList.add('selected-active');
    }
    
    // Badge mapping class
    const badgeClass = item.type.toLowerCase();
    
    card.innerHTML = `
        <div class="release-card-header">
            <div class="badge-wrapper">
                <span class="type-badge ${badgeClass}">${item.type}</span>
            </div>
        </div>
        <div class="release-card-body">
            ${item.html}
        </div>
        <div class="release-card-actions">
            <a href="${entryLink}" target="_blank" class="source-link">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> Source Feed Link
            </a>
            <button class="btn-card-tweet" data-item-id="${item.id}">
                <i class="fa-brands fa-x-twitter"></i> Tweet
            </button>
        </div>
    `;
    
    // Event listener for Tweet Composer selection
    card.querySelector('.btn-card-tweet').addEventListener('click', () => {
        selectItemForTweet(item, dateStr, entryLink);
    });
    
    return card;
}

// Select update to compose tweet
function selectItemForTweet(item, dateStr, link) {
    // Save selection state
    state.selectedItem = { ...item, date: dateStr, link: link };
    
    // Toggle active classes on cards
    document.querySelectorAll('.release-card').forEach(card => {
        card.classList.remove('selected-active');
    });
    const selectedCard = document.getElementById(`card-${item.id}`);
    if (selectedCard) {
        selectedCard.classList.add('selected-active');
    }
    
    // Pre-populate Composer Text
    const emojiMap = {
        'feature': '🚀',
        'announcement': '📢',
        'issue': '⚠️',
        'breaking': '🚨',
        'change': '🔄',
        'deprecation': '🛑'
    };
    
    const emoji = emojiMap[item.type.toLowerCase()] || '⚡';
    
    // We compose the template
    const header = `${emoji} BigQuery ${item.type} (${dateStr}):\n\n`;
    const footer = `\n\n#BigQuery #GoogleCloud #GCP\n🔗 ${link}`;
    
    // Smart content truncation to fit within 280 limits
    const textLimit = 280 - header.length - footer.length;
    let mainText = item.text;
    
    if (mainText.length > textLimit) {
        mainText = mainText.substring(0, textLimit - 4) + '...';
    }
    
    const fullTweetText = header + mainText + footer;
    
    // Load into UI
    els.tweetTextarea.value = fullTweetText;
    els.previewTitle.textContent = `BigQuery Release Notes (${dateStr})`;
    
    // Shorten HTML snippet description for link preview
    let descSnippet = item.text;
    if (descSnippet.length > 130) {
        descSnippet = descSnippet.substring(0, 130) + '...';
    }
    els.previewDesc.textContent = descSnippet;
    
    // Toggle side tab pane to composer and active state
    els.tabBtns[0].click(); // Click Composer tab
    
    els.composerPlaceholder.style.display = 'none';
    els.composerEditor.style.display = 'flex';
    
    handleTweetInput(); // Recalculate character counters
}

// Handle real-time tweet input changes
function handleTweetInput() {
    const text = els.tweetTextarea.value;
    const length = text.length;
    const limit = 280;
    const remaining = limit - length;
    
    // Update counter text
    els.charCounter.textContent = remaining;
    
    // Handle status progress ring colors and limits
    if (remaining < 0) {
        els.charCounter.style.color = 'var(--color-breaking)';
        els.btnTweetShare.disabled = true;
        els.charWarning.style.display = 'block';
        els.charWarning.textContent = `Over limit by ${Math.abs(remaining)} characters`;
        setProgressDashoffset(0);
        els.charProgressCircle.style.stroke = 'var(--color-breaking)';
    } else {
        els.btnTweetShare.disabled = false;
        els.charWarning.style.display = 'none';
        els.charCounter.style.color = remaining <= 20 ? 'var(--color-issue)' : 'var(--text-secondary)';
        
        // Progress stroke calculation
        const percent = Math.min((length / limit) * 100, 100);
        const offset = circleCircumference - (percent / 100) * circleCircumference;
        setProgressDashoffset(offset);
        
        // Progress ring colors
        if (remaining <= 20) {
            els.charProgressCircle.style.stroke = 'var(--color-issue)';
        } else {
            els.charProgressCircle.style.stroke = 'var(--color-x-blue)';
        }
    }
}

function setProgressDashoffset(offset) {
    if (els.charProgressCircle) {
        els.charProgressCircle.style.strokeDashoffset = offset;
    }
}

// Reset composer state
function resetComposer() {
    state.selectedItem = null;
    els.tweetTextarea.value = '';
    els.composerPlaceholder.style.display = 'flex';
    els.composerEditor.style.display = 'none';
    
    document.querySelectorAll('.release-card').forEach(card => {
        card.classList.remove('selected-active');
    });
}

// Share tweet & Save to local history
async function handlePublishTweet() {
    const text = els.tweetTextarea.value.trim();
    if (!text || text.length > 280) return;
    
    const item = state.selectedItem;
    if (!item) return;
    
    // 1. Save to local history in Flask backend
    try {
        const payload = {
            item_id: item.id,
            date: item.date,
            type: item.type,
            tweet_text: text,
            link: item.link
        };
        
        const response = await fetch('/api/history', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        if (result.success) {
            // Add to client state
            state.history.unshift(result.data);
            renderHistory();
            showToast('Logged to share history!', 'success');
        }
    } catch (err) {
        console.error('Error logging tweet history:', err);
    }
    
    // 2. Open Twitter Intent Link
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(tweetUrl, '_blank', 'width=600,height=400');
    
    showToast('Redirected to X (Twitter) Web Intent!', 'success');
}

// Render tweet history lists
function renderHistory() {
    // Update badge count
    els.historyBadge.textContent = state.history.length;
    
    if (state.history.length === 0) {
        els.historyEmpty.style.display = 'flex';
        els.historyList.style.display = 'none';
        return;
    }
    
    els.historyEmpty.style.display = 'none';
    els.historyList.innerHTML = '';
    
    state.history.forEach(hist => {
        const card = document.createElement('div');
        card.className = 'history-card';
        
        card.innerHTML = `
            <div class="history-card-header">
                <span class="type-badge ${hist.type.toLowerCase()}">${hist.type}</span>
                <span class="history-time">${hist.timestamp}</span>
            </div>
            <div class="history-text">${escapeHTML(hist.tweet_text)}</div>
            <div class="history-card-actions">
                <a href="${hist.link}" target="_blank" class="history-link-ref">
                    <i class="fa-solid fa-link"></i> Origin Ref
                </a>
                <button class="btn-history-repost" data-history-id="${hist.timestamp}">
                    <i class="fa-solid fa-rotate-left"></i> Repost Text
                </button>
            </div>
        `;
        
        // Re-load into composer
        card.querySelector('.btn-history-repost').addEventListener('click', () => {
            loadHistoryTextToComposer(hist);
        });
        
        els.historyList.appendChild(card);
    });
    
    els.historyList.style.display = 'flex';
}

function loadHistoryTextToComposer(hist) {
    // Populate selection metadata (we might map it to a fresh composer session)
    state.selectedItem = {
        id: hist.id,
        type: hist.type,
        date: hist.date,
        link: hist.link,
        text: hist.tweet_text
    };
    
    els.tweetTextarea.value = hist.tweet_text;
    els.previewTitle.textContent = `BigQuery Release Notes (${hist.date})`;
    els.previewDesc.textContent = hist.tweet_text.substring(0, 130);
    
    // Switch to composer tab
    els.tabBtns[0].click();
    els.composerPlaceholder.style.display = 'none';
    els.composerEditor.style.display = 'flex';
    
    handleTweetInput();
    showToast('Loaded history template back into composer!', 'info');
}

// Toast System helper
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const iconClass = type === 'success' ? 'fa-solid fa-circle-check' : 
                      type === 'error' ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-circle-info';
                      
    toast.innerHTML = `
        <i class="${iconClass} toast-icon"></i>
        <div class="toast-content">${message}</div>
        <button class="toast-close"><i class="fa-solid fa-xmark"></i></button>
    `;
    
    els.toastContainer.appendChild(toast);
    
    // Close listener
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    });
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => toast.remove(), 300);
        }
    }, 4000);
}

// Simple HTML escaping helper
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}
