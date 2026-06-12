(function () {
	'use strict';

	const config = window.soliTicketScanner;
	if (!config) return;

	// DOM elements
	const pinScreen = document.getElementById('pin-screen');
	const scannerScreen = document.getElementById('scanner-screen');
	const loadingScreen = document.getElementById('loading-screen');

	// PIN elements
	const pinInputs = document.querySelectorAll('#pin-inputs input');
	const pinSubmit = document.getElementById('pin-submit');
	const pinError = document.getElementById('pin-error');

	// Scanner elements
	const scannerVideo = document.getElementById('scanner-video');
	const scanOverlay = document.getElementById('scan-overlay');
	const cameraError = document.getElementById('camera-error');
	const scanCount = document.getElementById('scan-count');

	// Result elements
	const resultDisplay = document.getElementById('result-display');
	const resultCard = document.getElementById('result-card');
	const resultIcon = document.getElementById('result-icon');
	const resultMessage = document.getElementById('result-message');
	const resultAttendeeName = document.getElementById('result-attendee-name');
	const resultTicketType = document.getElementById('result-ticket-type');
	const resultDismiss = document.getElementById('result-dismiss');

	let qrScanner = null;
	let scannedCount = 0;
	let isProcessing = false;
	let autoResumeTimer = null;
	let storedPin = sessionStorage.getItem('soli_scanner_pin_' + config.event_id) || '';

	// Set QR scanner worker path for UMD build
	if (typeof QrScanner !== 'undefined' && config.worker_url) {
		QrScanner.WORKER_PATH = config.worker_url;
	}

	// ─── Screen management ───

	function showScreen(screen) {
		loadingScreen.classList.add('tw-hidden');
		pinScreen.classList.add('tw-hidden');
		scannerScreen.classList.add('tw-hidden');

		screen.classList.remove('tw-hidden');
	}

	// ─── PIN handling ───

	function initPinScreen() {
		showScreen(pinScreen);

		pinInputs.forEach((input, index) => {
			input.addEventListener('input', function () {
				this.value = this.value.replace(/[^0-9]/g, '');
				if (this.value && index < pinInputs.length - 1) {
					pinInputs[index + 1].focus();
				}
				updatePinSubmitState();
			});

			input.addEventListener('keydown', function (e) {
				if (e.key === 'Backspace' && !this.value && index > 0) {
					pinInputs[index - 1].focus();
				}
				if (e.key === 'Enter') {
					e.preventDefault();
					if (!pinSubmit.disabled) {
						verifyPin();
					}
				}
			});

			// Handle paste
			input.addEventListener('paste', function (e) {
				e.preventDefault();
				const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
				for (let i = 0; i < Math.min(paste.length, pinInputs.length - index); i++) {
					pinInputs[index + i].value = paste[i];
				}
				const lastFilled = Math.min(index + paste.length, pinInputs.length) - 1;
				pinInputs[lastFilled].focus();
				updatePinSubmitState();
			});
		});

		pinSubmit.addEventListener('click', verifyPin);
		pinInputs[0].focus();
	}

	function updatePinSubmitState() {
		const pin = getPin();
		pinSubmit.disabled = pin.length !== 4;
	}

	function getPin() {
		return Array.from(pinInputs).map(i => i.value).join('');
	}

	async function verifyPin() {
		const pin = getPin();
		if (pin.length !== 4) return;

		pinSubmit.disabled = true;
		pinSubmit.classList.add('tw-loading');
		pinError.classList.add('tw-hidden');

		try {
			const response = await fetch(config.api_base + '/verify-pin', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					event_id: config.event_id,
					pin: pin,
				}),
			});

			const data = await response.json();

			if (data.valid) {
				storedPin = pin;
				sessionStorage.setItem('soli_scanner_pin_' + config.event_id, pin);
				initScannerScreen();
			} else {
				pinError.textContent = data.message;
				pinError.classList.remove('tw-hidden');

				// Clear inputs
				pinInputs.forEach(i => (i.value = ''));
				pinInputs[0].focus();
			}
		} catch (err) {
			pinError.textContent = 'Connection error. Please try again.';
			pinError.classList.remove('tw-hidden');
		} finally {
			pinSubmit.disabled = false;
			pinSubmit.classList.remove('tw-loading');
			updatePinSubmitState();
		}
	}

	// ─── Scanner ───

	async function initScannerScreen() {
		showScreen(scannerScreen);

		try {
			qrScanner = new QrScanner(
				scannerVideo,
				result => handleScanResult(result.data),
				{
					returnDetailedScanResult: true,
					highlightScanRegion: false,
					highlightCodeOutline: false,
				}
			);

			await qrScanner.start();
			scanOverlay.classList.remove('tw-hidden');
			cameraError.classList.add('tw-hidden');
		} catch (err) {
			console.error('Camera error:', err);
			scanOverlay.classList.add('tw-hidden');
			cameraError.classList.remove('tw-hidden');
		}
	}

	function parseQrData(data) {
		// Eventin QR codes contain a URL with query params:
		// e.g., https://example.com/?etn_action=ticket_scanner&attendee_id=123&ticket_id=abc&event_id=456
		try {
			const url = new URL(data);
			const params = url.searchParams;

			const attendee_id = params.get('attendee_id');
			const ticket_id = params.get('ticket_id');
			const event_id = params.get('event_id');

			if (attendee_id && ticket_id) {
				return { attendee_id, ticket_id, event_id };
			}
		} catch (e) {
			// Not a URL, try other formats
		}

		// Try JSON format
		try {
			const parsed = JSON.parse(data);
			if (parsed.attendee_id && parsed.ticket_id) {
				return parsed;
			}
		} catch (e) {
			// Not JSON
		}

		return null;
	}

	async function handleScanResult(data) {
		if (isProcessing) return;

		const parsed = parseQrData(data);
		if (!parsed) return;

		isProcessing = true;

		// Pause scanner during validation
		if (qrScanner) {
			qrScanner.pause();
		}

		try {
			const response = await fetch(config.api_base + '/validate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					event_id: config.event_id,
					attendee_id: parseInt(parsed.attendee_id, 10),
					ticket_id: parsed.ticket_id,
					pin: storedPin || undefined,
				}),
			});

			const result = await response.json();
			showResult(result);
		} catch (err) {
			showResult({
				status: 'error',
				message: 'Connection error. Please try again.',
				attendee: null,
			});
		}
	}

	function showResult(result) {
		// Clear any existing timer
		if (autoResumeTimer) {
			clearTimeout(autoResumeTimer);
			autoResumeTimer = null;
		}

		// Set card style based on status
		resultCard.className = 'tw-card tw-shadow-2xl';
		resultIcon.innerHTML = '';

		switch (result.status) {
			case 'success':
				resultCard.classList.add('tw-bg-success', 'tw-text-success-content');
				resultIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="tw-w-8 tw-h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>';
				scannedCount++;
				scanCount.textContent = scannedCount;
				break;

			case 'warning':
				resultCard.classList.add('tw-bg-warning', 'tw-text-warning-content');
				resultIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="tw-w-8 tw-h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>';
				break;

			case 'error':
			default:
				resultCard.classList.add('tw-bg-error', 'tw-text-error-content');
				resultIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="tw-w-8 tw-h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" /></svg>';
				break;
		}

		// Set result text
		resultMessage.textContent = result.message;

		if (result.attendee) {
			resultAttendeeName.textContent = result.attendee.name || '';
			resultTicketType.textContent = result.attendee.ticket_type || '';
		} else {
			resultAttendeeName.textContent = '';
			resultTicketType.textContent = '';
		}

		resultDisplay.classList.remove('tw-hidden');

		// Auto-resume on success after 3 seconds
		if (result.status === 'success') {
			autoResumeTimer = setTimeout(dismissResult, 3000);
		}
	}

	function dismissResult() {
		if (autoResumeTimer) {
			clearTimeout(autoResumeTimer);
			autoResumeTimer = null;
		}

		resultDisplay.classList.add('tw-hidden');
		isProcessing = false;

		if (qrScanner) {
			qrScanner.start();
		}
	}

	// ─── Init ───

	resultDismiss.addEventListener('click', dismissResult);

	// Start the app
	if (config.pin_required && !storedPin) {
		initPinScreen();
	} else if (config.pin_required && storedPin) {
		// Verify stored PIN is still valid
		fetch(config.api_base + '/verify-pin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				event_id: config.event_id,
				pin: storedPin,
			}),
		})
			.then(r => r.json())
			.then(data => {
				if (data.valid) {
					initScannerScreen();
				} else {
					storedPin = '';
					sessionStorage.removeItem('soli_scanner_pin_' + config.event_id);
					initPinScreen();
				}
			})
			.catch(() => {
				// On network error, try with stored PIN anyway
				initScannerScreen();
			});
	} else {
		initScannerScreen();
	}
})();
