(function () {
	'use strict';

	const config = window.soliScannerAdmin;
	if (!config) return;

	const SECTION_ID = 'soli-scanner-settings';
	let currentEventId = null;
	let saveTimeout = null;

	/**
	 * Extract event ID from the current URL hash.
	 * Eventin uses hash routing: #/events/edit/{id}/advanced
	 */
	function getEventIdFromHash() {
		const match = window.location.hash.match(/\/events\/edit\/(\d+)/);
		return match ? parseInt(match[1], 10) : null;
	}

	/**
	 * Check if we're on the advanced tab.
	 */
	function isAdvancedTab() {
		return window.location.hash.includes('/advanced');
	}

	/**
	 * Get event slug for scanner URL.
	 */
	async function getEventSlug(eventId) {
		try {
			const response = await fetch(config.restUrl + eventId, {
				headers: { 'X-WP-Nonce': config.nonce },
			});
			const data = await response.json();
			return data.slug || '';
		} catch (e) {
			return '';
		}
	}

	/**
	 * Fetch current PIN value for an event.
	 */
	async function getPinValue(eventId) {
		try {
			const response = await fetch(config.restUrl + eventId, {
				headers: { 'X-WP-Nonce': config.nonce },
			});
			const data = await response.json();
			return data.meta?._soli_scanner_pin || '';
		} catch (e) {
			return '';
		}
	}

	/**
	 * Save PIN value for an event (debounced).
	 */
	function savePinValue(eventId, pin) {
		if (saveTimeout) clearTimeout(saveTimeout);

		saveTimeout = setTimeout(async () => {
			try {
				await fetch(config.restUrl + eventId, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': config.nonce,
					},
					body: JSON.stringify({
						meta: { _soli_scanner_pin: pin },
					}),
				});

				showSaveStatus('Saved');
			} catch (e) {
				showSaveStatus('Error saving');
			}
		}, 500);
	}

	/**
	 * Show a brief save status message.
	 */
	function showSaveStatus(message) {
		const status = document.getElementById('soli-scanner-save-status');
		if (!status) return;
		status.textContent = message;
		status.style.opacity = '1';
		setTimeout(() => {
			status.style.opacity = '0';
		}, 2000);
	}

	/**
	 * Generate a random 4-digit PIN.
	 */
	function generatePin() {
		return String(Math.floor(1000 + Math.random() * 9000));
	}

	/**
	 * Create the scanner settings section HTML.
	 */
	function createScannerSection(scannerUrl, pinValue) {
		const pinEnabled = pinValue.length > 0;

		const section = document.createElement('div');
		section.id = SECTION_ID;
		section.style.cssText = 'margin-top: 24px; padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;';

		section.innerHTML = `
			<h3 style="margin: 0 0 16px; font-size: 14px; font-weight: 600; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">
				Ticket Scanner
			</h3>

			<div style="margin-bottom: 16px;">
				<label style="display: block; margin-bottom: 4px; font-size: 13px; font-weight: 500; color: #374151;">Scanner URL</label>
				<div style="display: flex; gap: 8px;">
					<input type="text" id="soli-scanner-url" value="${scannerUrl}" readonly
						style="flex: 1; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; font-size: 13px; color: #6b7280; cursor: default;">
					<button type="button" id="soli-scanner-copy-url" style="padding: 8px 16px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; cursor: pointer; font-size: 13px; white-space: nowrap;">
						Copy
					</button>
				</div>
			</div>

			<div style="margin-bottom: 12px;">
				<label style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; color: #374151; cursor: pointer;">
					<input type="checkbox" id="soli-scanner-pin-toggle" ${pinEnabled ? 'checked' : ''}
						style="width: 16px; height: 16px;">
					PIN protection
				</label>
			</div>

			<div id="soli-scanner-pin-fields" style="display: ${pinEnabled ? 'block' : 'none'}; margin-bottom: 8px;">
				<label style="display: block; margin-bottom: 4px; font-size: 13px; font-weight: 500; color: #374151;">PIN code</label>
				<div style="display: flex; gap: 8px;">
					<input type="text" id="soli-scanner-pin-input" value="${pinValue}" maxlength="4" pattern="[0-9]{4}" inputmode="numeric"
						style="width: 100px; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 16px; letter-spacing: 0.3em; text-align: center;">
					<button type="button" id="soli-scanner-generate-pin" style="padding: 8px 16px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; cursor: pointer; font-size: 13px; white-space: nowrap;">
						Generate
					</button>
				</div>
			</div>

			<span id="soli-scanner-save-status" style="font-size: 12px; color: #059669; opacity: 0; transition: opacity 0.3s;"></span>
		`;

		return section;
	}

	/**
	 * Attach event listeners to the scanner section.
	 */
	function attachListeners(eventId) {
		const copyBtn = document.getElementById('soli-scanner-copy-url');
		const urlInput = document.getElementById('soli-scanner-url');
		const pinToggle = document.getElementById('soli-scanner-pin-toggle');
		const pinFields = document.getElementById('soli-scanner-pin-fields');
		const pinInput = document.getElementById('soli-scanner-pin-input');
		const generateBtn = document.getElementById('soli-scanner-generate-pin');

		copyBtn.addEventListener('click', () => {
			navigator.clipboard.writeText(urlInput.value).then(() => {
				copyBtn.textContent = 'Copied!';
				setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
			});
		});

		pinToggle.addEventListener('change', () => {
			if (pinToggle.checked) {
				const pin = generatePin();
				pinInput.value = pin;
				pinFields.style.display = 'block';
				savePinValue(eventId, pin);
			} else {
				pinInput.value = '';
				pinFields.style.display = 'none';
				savePinValue(eventId, '');
			}
		});

		pinInput.addEventListener('input', () => {
			pinInput.value = pinInput.value.replace(/[^0-9]/g, '');
			if (pinInput.value.length === 4) {
				savePinValue(eventId, pinInput.value);
			}
		});

		generateBtn.addEventListener('click', () => {
			const pin = generatePin();
			pinInput.value = pin;
			savePinValue(eventId, pin);
		});
	}

	/**
	 * Inject the scanner section into the Eventin advanced tab.
	 */
	async function injectScannerFields() {
		const eventId = getEventIdFromHash();
		if (!eventId || !isAdvancedTab()) return;

		// Don't re-inject if already present for this event
		if (currentEventId === eventId && document.getElementById(SECTION_ID)) return;

		// Remove existing section if switching events
		const existing = document.getElementById(SECTION_ID);
		if (existing) existing.remove();

		currentEventId = eventId;

		// Find a container in the advanced tab to append to
		// Eventin's advanced tab typically has form fields in a container
		const advancedContainer = findAdvancedTabContainer();
		if (!advancedContainer) return;

		const [slug, pinValue] = await Promise.all([
			getEventSlug(eventId),
			getPinValue(eventId),
		]);

		const scannerUrl = config.homeUrl + '/scanner/' + slug + '/';
		const section = createScannerSection(scannerUrl, pinValue);

		advancedContainer.appendChild(section);
		attachListeners(eventId);
	}

	/**
	 * Find the advanced tab's content container.
	 */
	function findAdvancedTabContainer() {
		// Try common Eventin advanced tab selectors
		// The advanced tab content is typically rendered inside the main content area
		const selectors = [
			'.etn-event-advanced-tab',
			'.etn-advanced-content',
			'[class*="advanced"]',
			'.etn-event-form',
		];

		for (const selector of selectors) {
			const el = document.querySelector(selector);
			if (el) return el;
		}

		// Fallback: find the main content area of the Eventin admin page
		const mainContent = document.querySelector('#eventin-admin-app .etn-editor-content') ||
			document.querySelector('#eventin-admin-app [class*="content"]') ||
			document.querySelector('.etn-dashboard-body') ||
			document.querySelector('#eventin-admin-app');

		return mainContent;
	}

	/**
	 * Remove the scanner section when leaving the advanced tab.
	 */
	function cleanupIfNeeded() {
		if (!isAdvancedTab() || getEventIdFromHash() !== currentEventId) {
			const existing = document.getElementById(SECTION_ID);
			if (existing) {
				existing.remove();
				currentEventId = null;
			}
		}
	}

	// ─── Initialization ───

	// Watch for hash changes (SPA navigation)
	window.addEventListener('hashchange', () => {
		cleanupIfNeeded();
		setTimeout(injectScannerFields, 500);
	});

	// Watch for DOM changes with MutationObserver
	const observer = new MutationObserver(() => {
		if (isAdvancedTab() && !document.getElementById(SECTION_ID)) {
			injectScannerFields();
		}
	});

	// Start observing when the Eventin admin app is available
	function startObserving() {
		const app = document.querySelector('#eventin-admin-app') || document.body;
		observer.observe(app, { childList: true, subtree: true });

		// Initial injection attempt
		if (isAdvancedTab()) {
			setTimeout(injectScannerFields, 500);
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', startObserving);
	} else {
		startObserving();
	}
})();
