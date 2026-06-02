# Privacy Policy for Claude Quota Checker

**Last Updated:** June 2026

We take your privacy seriously. This Privacy Policy explains how our Chrome Extension, **Claude Quota Checker**, handles your information.

## 1. No Data Collection
**Claude Quota Checker does not collect, store, or transmit any personal data, usage statistics, credentials, or web history.** 
All operations are performed entirely within your local browser environment. We do not operate any external servers, database infrastructure, or analytics tools.

## 2. Access to Claude.ai API
To display your message quota, the extension makes direct network requests (via HTTPS) to Claude's official endpoint:
`https://claude.ai/api/organizations/{org_id}/usage`

These requests utilize your active, local browser session cookies for authentication. Your session credentials, cookies, and tokens are never read, saved, or sent to any third-party servers. They remain securely handled by your browser.

## 3. Local Storage Usage
The extension uses Chrome's secure local storage API (`chrome.storage.local`) exclusively on your device to persist:
* Your interface preferences (whether the overlay is minimized or maximized).
* The custom drag position coordinates (`bottom` and `right` pixels) of the floating panel.
* Cached quota metrics to speed up rendering when clicking the extension icon.

This data never leaves your computer and is deleted automatically if you uninstall the extension.

## 4. Policy Changes
We may update this Privacy Policy from time to time. Any changes will be posted directly within the extension's source repository.

## 5. Contact
If you have any questions about this Privacy Policy, please contact the developer via the GitHub repository issues page.
