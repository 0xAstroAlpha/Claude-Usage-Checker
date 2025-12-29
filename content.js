/* Claude Usage Checker - Minimal UI */
'use strict';

// Simple logging
function Log(...args) {
    console.log('[Claude Usage Checker]', ...args);
}

// Sleep helper
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Floating Popup UI Manager with Real Usage API
class UsagePopup {
    constructor() {
        this.container = null;
        this.isMinimized = false;
        this.orgId = null;
    }

    async initialize() {
        // Get org ID from cookie
        this.orgId = this.getOrgIdFromCookie();
        if (!this.orgId) {
            Log('Could not find org ID');
            return;
        }

        // Create popup
        this.container = document.createElement('div');
        this.container.className = 'ut-floating-popup';
        this.container.id = 'ut-usage-popup';
        this.container.innerHTML = this.buildPopupHTML();
        document.body.appendChild(this.container);

        // Setup event listeners
        this.setupEventListeners();

        // Load saved state
        this.loadState();

        // Fetch usage data
        await this.fetchUsageData();

        // Auto refresh every 60 seconds
        setInterval(() => this.fetchUsageData(), 60000);

        Log('Popup initialized');
    }

    getOrgIdFromCookie() {
        const match = document.cookie.match(/lastActiveOrg=([^;]+)/);
        return match ? match[1] : null;
    }

    buildPopupHTML() {
        return `
			<div class="ut-popup-header">
				<div class="ut-popup-title">
					<span class="ut-popup-title-icon">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
							<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
						</svg>
					</span>
					<span>Usage</span>
				</div>
				<div class="ut-popup-controls">
					<button class="ut-popup-btn ut-refresh-btn" title="Refresh">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M23 4v6h-6M1 20v-6h6"/>
							<path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
						</svg>
					</button>
					<button class="ut-popup-btn ut-minimize-btn" title="Minimize">−</button>
				</div>
			</div>
			<div class="ut-popup-content">
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
				<div class="ut-popup-footer">
					<span>From Brian Le</span>
				</div>
			</div>
		`;
    }

    setupEventListeners() {
        // Minimize button
        this.container.querySelector('.ut-minimize-btn').addEventListener('click', () => {
            this.toggleMinimize();
        });

        // Refresh button
        this.container.querySelector('.ut-refresh-btn').addEventListener('click', () => {
            this.fetchUsageData();
        });
    }

    toggleMinimize() {
        this.isMinimized = !this.isMinimized;
        this.container.classList.toggle('ut-minimized', this.isMinimized);
        this.container.querySelector('.ut-minimize-btn').textContent = this.isMinimized ? '+' : '−';
        this.saveState();
    }

    saveState() {
        localStorage.setItem('ut-popup-minimized', this.isMinimized ? '1' : '0');
    }

    loadState() {
        if (localStorage.getItem('ut-popup-minimized') === '1') {
            this.toggleMinimize();
        }
    }

    async fetchUsageData() {
        try {
            const response = await fetch(`https://claude.ai/api/organizations/${this.orgId}/usage`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            this.updateDisplay(data);
        } catch (error) {
            Log('Error fetching usage:', error);
        }
    }

    updateDisplay(data) {
        // Session (5-hour)
        if (data.five_hour) {
            const sessionPct = Math.round(data.five_hour.utilization || 0);
            const sessionPctEl = document.getElementById('ut-session-pct');
            const sessionBarEl = document.getElementById('ut-session-bar');

            sessionPctEl.textContent = `${sessionPct}%`;
            sessionBarEl.style.width = `${sessionPct}%`;
            document.getElementById('ut-session-reset').textContent = this.formatResetTime(data.five_hour.resets_at);

            // Add warning class if usage is high
            if (sessionPct >= 80) {
                sessionPctEl.classList.add('warning');
                sessionBarEl.classList.add('warning');
            } else {
                sessionPctEl.classList.remove('warning');
                sessionBarEl.classList.remove('warning');
            }
        }

        // Weekly (7-day)
        if (data.seven_day) {
            const weeklyPct = Math.round(data.seven_day.utilization || 0);
            const weeklyPctEl = document.getElementById('ut-weekly-pct');
            const weeklyBarEl = document.getElementById('ut-weekly-bar');

            weeklyPctEl.textContent = `${weeklyPct}%`;
            weeklyBarEl.style.width = `${weeklyPct}%`;
            document.getElementById('ut-weekly-reset').textContent = this.formatResetTime(data.seven_day.resets_at);

            // Add warning class if usage is high
            if (weeklyPct >= 80) {
                weeklyPctEl.classList.add('warning');
                weeklyBarEl.classList.add('warning');
            } else {
                weeklyPctEl.classList.remove('warning');
                weeklyBarEl.classList.remove('warning');
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

// Inject styles
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
        const popup = new UsagePopup();
        await popup.initialize();
    } catch (error) {
        console.error('[Claude Usage Checker] Failed to initialize:', error);
    }
})();
