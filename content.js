/* Claude Quota Checker - Content Script */
'use strict';

function Log(...args) {
    console.log('[Claude Quota Checker]', ...args);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class QuotaPopup {
    constructor() {
        this.container = null;
        this.isMinimized = false;
        this.orgId = null;
        this.refreshIntervalId = null;
    }

    async initialize() {
        // Retrieve initial settings and coordinates
        const storage = await chrome.storage.local.get([
            'isMinimized',
            'posX',
            'posY',
            'showFloatingWidget'
        ]);

        // If user disabled the floating widget in popup, do not initialize
        if (storage.showFloatingWidget === false) {
            Log('Floating widget disabled by user preference');
            return;
        }

        // Get organization ID from cookies
        this.orgId = this.getOrgIdFromCookie();
        if (!this.orgId) {
            Log('Could not find active organization ID. Waiting for login...');
            this.createPopup(true); // Create in logged-out / error state
            this.startCookiePolling();
            return;
        }

        this.isMinimized = !!storage.isMinimized;
        this.createPopup(false);

        // Position coordinates
        if (storage.posX !== undefined && storage.posY !== undefined) {
            this.container.style.right = storage.posX;
            this.container.style.bottom = storage.posY;
            this.container.style.left = 'auto';
            this.container.style.top = 'auto';
        }

        this.setupEventListeners();
        this.setupDraggable();
        this.setupStorageListener();
        this.updateTheme();

        // Fetch usage data
        await this.fetchUsageData();

        // Auto-refresh every 60 seconds
        this.refreshIntervalId = setInterval(() => this.fetchUsageData(), 60000);

        Log('Popup initialized successfully');
    }

    getOrgIdFromCookie() {
        const match = document.cookie.match(/lastActiveOrg=([^;]+)/);
        return match ? match[1] : null;
    }

    startCookiePolling() {
        // Poll every 5s to check if user has logged in
        const interval = setInterval(async () => {
            const currentOrg = this.getOrgIdFromCookie();
            if (currentOrg) {
                clearInterval(interval);
                this.orgId = currentOrg;
                if (this.container) {
                    this.container.remove();
                }
                await this.initialize();
            }
        }, 5000);
    }

    createPopup(isLoggedOut = false) {
        this.container = document.createElement('div');
        this.container.className = 'ut-floating-popup';
        this.container.id = 'ut-quota-popup';
        if (this.isMinimized) {
            this.container.classList.add('ut-minimized');
        }

        this.container.innerHTML = this.buildPopupHTML();
        document.body.appendChild(this.container);

        if (isLoggedOut) {
            this.showStatusState('Please log in to Claude.ai to track quota.');
        }
    }

    buildPopupHTML() {
        const minimizeText = this.isMinimized ? '+' : '−';
        return `
			<div class="ut-popup-header">
				<div class="ut-popup-title">
					<span class="ut-popup-title-icon">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
							<path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
						</svg>
					</span>
					<span>Claude Quota</span>
				</div>
				<div class="ut-popup-controls">
					<button class="ut-popup-btn ut-refresh-btn" title="Refresh">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M23 4v6h-6M1 20v-6h6"/>
							<path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
						</svg>
					</button>
					<button class="ut-popup-btn ut-minimize-btn" title="Minimize">${minimizeText}</button>
				</div>
			</div>
			<div class="ut-popup-content">
				<div class="ut-popup-main-view" id="ut-main-view">
					<div class="ut-popup-section">
						<div class="ut-popup-usage-row">
							<span class="ut-popup-label">SESSION</span>
							<span class="ut-popup-percentage" id="ut-session-pct">--%</span>
						</div>
						<div class="ut-popup-progress-container">
							<div class="ut-popup-progress-bar" id="ut-session-bar" style="width: 0%"></div>
						</div>
						<div class="ut-popup-reset-row">
							<span class="ut-popup-reset-label">
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
								</svg>
								Resets in
							</span>
							<span class="ut-popup-reset-value" id="ut-session-reset">Loading...</span>
						</div>
					</div>
					<div class="ut-popup-section">
						<div class="ut-popup-usage-row">
							<span class="ut-popup-label">WEEKLY</span>
							<span class="ut-popup-percentage" id="ut-weekly-pct">--%</span>
						</div>
						<div class="ut-popup-progress-container">
							<div class="ut-popup-progress-bar" id="ut-weekly-bar" style="width: 0%"></div>
						</div>
						<div class="ut-popup-reset-row">
							<span class="ut-popup-reset-label">
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
								</svg>
								Resets in
							</span>
							<span class="ut-popup-reset-value" id="ut-weekly-reset">Loading...</span>
						</div>
					</div>
				</div>
				<div class="ut-popup-status-view ut-hidden" id="ut-status-view">
					<div class="ut-status-icon">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
						</svg>
					</div>
					<div class="ut-status-message" id="ut-status-text">Loading...</div>
				</div>
				<div class="ut-popup-footer">
					<span>Claude Quota Checker</span>
				</div>
			</div>
		`;
    }

    setupEventListeners() {
        // Minimize button
        this.container.querySelector('.ut-minimize-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMinimize();
        });

        // Refresh button
        this.container.querySelector('.ut-refresh-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.fetchUsageData();
        });
    }

    async toggleMinimize() {
        this.isMinimized = !this.isMinimized;
        this.container.classList.toggle('ut-minimized', this.isMinimized);
        this.container.querySelector('.ut-minimize-btn').textContent = this.isMinimized ? '+' : '−';
        await chrome.storage.local.set({ isMinimized: this.isMinimized });
    }

    setupDraggable() {
        const header = this.container.querySelector('.ut-popup-header');
        let isDragging = false;
        let startX, startY;
        let startRight, startBottom;

        header.addEventListener('mousedown', (e) => {
            // Drag only on left-click and not on buttons
            if (e.button !== 0 || e.target.closest('.ut-popup-btn')) return;

            isDragging = true;
            this.container.classList.add('ut-dragging');
            
            startX = e.clientX;
            startY = e.clientY;

            const style = window.getComputedStyle(this.container);
            startRight = parseInt(style.right, 10) || 20;
            startBottom = parseInt(style.bottom, 10) || 20;

            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        const onMouseMove = (e) => {
            if (!isDragging) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            let newRight = startRight - dx;
            let newBottom = startBottom - dy;

            // Contain widget inside the boundaries of the screen
            const rect = this.container.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            newRight = Math.max(0, Math.min(viewportWidth - rect.width, newRight));
            newBottom = Math.max(0, Math.min(viewportHeight - rect.height, newBottom));

            this.container.style.right = `${newRight}px`;
            this.container.style.bottom = `${newBottom}px`;
            this.container.style.left = 'auto';
            this.container.style.top = 'auto';
        };

        const onMouseUp = async () => {
            if (!isDragging) return;
            isDragging = false;
            this.container.classList.remove('ut-dragging');
            document.body.style.userSelect = '';

            // Persist the coordinates in storage
            await chrome.storage.local.set({
                posX: this.container.style.right,
                posY: this.container.style.bottom
            });
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    setupStorageListener() {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (changes.showFloatingWidget) {
                const show = changes.showFloatingWidget.newValue;
                if (show === false) {
                    if (this.container) this.container.classList.add('ut-hidden');
                } else {
                    if (this.container) this.container.classList.remove('ut-hidden');
                }
            }
        });
    }

    detectClaudeTheme() {
        try {
            const bodyBg = window.getComputedStyle(document.body).backgroundColor;
            const rgb = bodyBg.match(/\d+/g);
            if (rgb && rgb.length >= 3) {
                const r = parseInt(rgb[0], 10);
                const g = parseInt(rgb[1], 10);
                const b = parseInt(rgb[2], 10);
                const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                return brightness < 128 ? 'dark' : 'light';
            }
        } catch (e) {
            // Safe fallback
        }
        return 'dark';
    }

    updateTheme() {
        if (!this.container) return;
        const theme = this.detectClaudeTheme();
        if (theme === 'light') {
            this.container.classList.add('ut-light-theme');
        } else {
            this.container.classList.remove('ut-light-theme');
        }
    }

    showStatusState(message) {
        const mainView = this.container.querySelector('#ut-main-view');
        const statusView = this.container.querySelector('#ut-status-view');
        const statusText = this.container.querySelector('#ut-status-text');

        if (mainView && statusView && statusText) {
            mainView.classList.add('ut-hidden');
            statusView.classList.remove('ut-hidden');
            statusText.textContent = message;
        }
    }

    showMainState() {
        const mainView = this.container.querySelector('#ut-main-view');
        const statusView = this.container.querySelector('#ut-status-view');

        if (mainView && statusView) {
            mainView.classList.remove('ut-hidden');
            statusView.classList.add('ut-hidden');
        }
    }

    async fetchUsageData() {
        if (!this.container) return;

        // Auto update theme check on refresh
        this.updateTheme();

        try {
            // Verify org ID cookie on refresh
            const currentOrg = this.getOrgIdFromCookie();
            if (!currentOrg) {
                this.showStatusState('Please log in to Claude.ai to track quota.');
                await chrome.storage.local.set({ isLoggedOut: true });
                return;
            }

            if (currentOrg !== this.orgId) {
                Log('Active organization switched. Updating API target.');
                this.orgId = currentOrg;
            }

            const response = await fetch(`https://claude.ai/api/organizations/${this.orgId}/usage`, {
                credentials: 'include'
            });

            if (response.status === 401 || response.status === 403) {
                this.showStatusState('Session expired. Please sign in again.');
                await chrome.storage.local.set({ isLoggedOut: true });
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            
            // Cache the data in extension storage for the toolbar action
            await chrome.storage.local.set({
                cachedQuota: data,
                lastUpdated: Date.now(),
                isLoggedOut: false,
                orgId: this.orgId
            });

            this.showMainState();
            this.updateDisplay(data);
        } catch (error) {
            Log('Error fetching usage data:', error);
            this.showStatusState('Unable to fetch quota data.');
        }
    }

    updateDisplay(data) {
        // Session (5-hour)
        if (data.five_hour) {
            const sessionPct = Math.round(data.five_hour.utilization || 0);
            const sessionPctEl = this.container.querySelector('#ut-session-pct');
            const sessionBarEl = this.container.querySelector('#ut-session-bar');

            if (sessionPctEl && sessionBarEl) {
                sessionPctEl.textContent = `${sessionPct}%`;
                sessionBarEl.style.width = `${sessionPct}%`;

                if (sessionPct >= 80) {
                    sessionPctEl.classList.add('warning');
                    sessionBarEl.classList.add('warning');
                } else {
                    sessionPctEl.classList.remove('warning');
                    sessionBarEl.classList.remove('warning');
                }
            }
            const resetEl = this.container.querySelector('#ut-session-reset');
            if (resetEl) {
                resetEl.textContent = this.formatResetTime(data.five_hour.resets_at);
            }
        }

        // Weekly (7-day)
        if (data.seven_day) {
            const weeklyPct = Math.round(data.seven_day.utilization || 0);
            const weeklyPctEl = this.container.querySelector('#ut-weekly-pct');
            const weeklyBarEl = this.container.querySelector('#ut-weekly-bar');

            if (weeklyPctEl && weeklyBarEl) {
                weeklyPctEl.textContent = `${weeklyPct}%`;
                weeklyBarEl.style.width = `${weeklyPct}%`;

                if (weeklyPct >= 80) {
                    weeklyPctEl.classList.add('warning');
                    weeklyBarEl.classList.add('warning');
                } else {
                    weeklyPctEl.classList.remove('warning');
                    weeklyBarEl.classList.remove('warning');
                }
            }
            const resetEl = this.container.querySelector('#ut-weekly-reset');
            if (resetEl) {
                resetEl.textContent = this.formatResetTime(data.seven_day.resets_at);
            }
        }
    }

    formatResetTime(isoString) {
        if (!isoString) return 'Unknown';

        const resetDate = new Date(isoString);
        const now = new Date();
        const diffMs = resetDate - now;

        if (diffMs <= 0) return 'Now';

        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (diffHours >= 24) {
            const days = Math.floor(diffHours / 24);
            return `${days}d ${diffHours % 24}h`;
        }
        return `${diffHours}h ${diffMins}m`;
    }
}

function injectStyles() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('tracker-styles.css');
    document.head.appendChild(link);
}

// Initialize
(async () => {
    try {
        await sleep(1000);
        injectStyles();
        const popup = new QuotaPopup();
        await popup.initialize();
    } catch (error) {
        console.error('[Claude Quota Checker] Initialization failure:', error);
    }
})();
