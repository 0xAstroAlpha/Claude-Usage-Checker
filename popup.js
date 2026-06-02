/* Claude Quota Checker - Action Popup Script */
'use strict';

document.addEventListener('DOMContentLoaded', async () => {
    const mainView = document.getElementById('main-view');
    const statusView = document.getElementById('status-view');
    const statusText = document.getElementById('status-text');
    const refreshBtn = document.getElementById('refresh-btn');
    const widgetToggle = document.getElementById('widget-toggle');
    const lastUpdatedTime = document.getElementById('last-updated-time');

    const sessionPct = document.getElementById('session-pct');
    const sessionBar = document.getElementById('session-bar');
    const sessionReset = document.getElementById('session-reset');

    const weeklyPct = document.getElementById('weekly-pct');
    const weeklyBar = document.getElementById('weekly-bar');
    const weeklyReset = document.getElementById('weekly-reset');

    // 1. Load preferences
    const storage = await chrome.storage.local.get([
        'showFloatingWidget',
        'cachedQuota',
        'lastUpdated',
        'isLoggedOut',
        'orgId'
    ]);

    // Handle widget toggle preference
    const showWidget = storage.showFloatingWidget !== false; // default true
    widgetToggle.checked = showWidget;

    widgetToggle.addEventListener('change', async () => {
        await chrome.storage.local.set({ showFloatingWidget: widgetToggle.checked });
    });

    // 2. Render UI
    function renderUI(data, lastUpdated, isLoggedOut) {
        if (isLoggedOut) {
            mainView.classList.add('ut-hidden');
            statusView.classList.remove('ut-hidden');
            statusText.textContent = 'Session expired or logged out. Please open Claude.ai to sign in.';
            return;
        }

        if (!data) {
            mainView.classList.add('ut-hidden');
            statusView.classList.remove('ut-hidden');
            statusText.textContent = 'No cached quota data found. Please open Claude.ai first.';
            return;
        }

        mainView.classList.remove('ut-hidden');
        statusView.classList.add('ut-hidden');

        // Session (5-hour)
        if (data.five_hour) {
            const sessionVal = Math.round(data.five_hour.utilization || 0);
            sessionPct.textContent = `${sessionVal}%`;
            sessionBar.style.width = `${sessionVal}%`;
            sessionReset.textContent = formatResetTime(data.five_hour.resets_at);

            if (sessionVal >= 80) {
                sessionPct.classList.add('warning');
                sessionBar.classList.add('warning');
            } else {
                sessionPct.classList.remove('warning');
                sessionBar.classList.remove('warning');
            }
        }

        // Weekly (7-day)
        if (data.seven_day) {
            const weeklyVal = Math.round(data.seven_day.utilization || 0);
            weeklyPct.textContent = `${weeklyVal}%`;
            weeklyBar.style.width = `${weeklyVal}%`;
            weeklyReset.textContent = formatResetTime(data.seven_day.resets_at);

            if (weeklyVal >= 80) {
                weeklyPct.classList.add('warning');
                weeklyBar.classList.add('warning');
            } else {
                weeklyPct.classList.remove('warning');
                weeklyBar.classList.remove('warning');
            }
        }

        if (lastUpdated) {
            lastUpdatedTime.textContent = new Date(lastUpdated).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }
    }

    function formatResetTime(isoString) {
        if (!isoString) return '--';

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

    // 3. Initial Render
    renderUI(storage.cachedQuota, storage.lastUpdated, storage.isLoggedOut);

    // 4. Refresh Action
    refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.style.opacity = '0.5';

        // Re-read storage to get the latest orgId
        const currentStorage = await chrome.storage.local.get(['orgId']);
        const orgId = currentStorage.orgId;

        if (!orgId) {
            statusText.textContent = 'Please open Claude.ai first to initialize organization details.';
            mainView.classList.add('ut-hidden');
            statusView.classList.remove('ut-hidden');
            refreshBtn.disabled = false;
            refreshBtn.style.opacity = '1';
            return;
        }

        try {
            statusText.textContent = 'Refreshing quota data...';
            mainView.classList.add('ut-hidden');
            statusView.classList.remove('ut-hidden');

            const response = await fetch(`https://claude.ai/api/organizations/${orgId}/usage`);

            if (response.status === 401 || response.status === 403) {
                await chrome.storage.local.set({ isLoggedOut: true });
                renderUI(null, null, true);
            } else if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            } else {
                const data = await response.json();
                const now = Date.now();
                await chrome.storage.local.set({
                    cachedQuota: data,
                    lastUpdated: now,
                    isLoggedOut: false
                });
                renderUI(data, now, false);
            }
        } catch (error) {
            console.error('[Claude Quota Checker] Fetch failed:', error);
            statusText.textContent = 'Failed to refresh. Ensure you are logged into Claude.ai.';
            mainView.classList.add('ut-hidden');
            statusView.classList.remove('ut-hidden');
        } finally {
            refreshBtn.disabled = false;
            refreshBtn.style.opacity = '1';
        }
    });
});
