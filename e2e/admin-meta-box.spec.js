const { test, expect } = require('@playwright/test');
const { ADMIN_STORAGE_STATE } = require('./helpers');

test.describe('Admin Scanner Fields', () => {
	// Reuse the single admin session established by auth.setup.js rather than
	// logging in per test. Two logins as the same WordPress user race on that
	// user's session_tokens meta, and the loser's auth cookie is rejected —
	// wp-admin bounces it straight back to wp-login.php. Sequencing within this
	// file was not enough once a second file also needed wp-admin, because
	// Playwright runs files in parallel workers.
	test.use({ storageState: ADMIN_STORAGE_STATE });

	test('scanner PIN meta is registered and accessible via REST', async ({ request, page }) => {
		// Get the test event
		const cookies = await page.context().cookies();
		const eventsResponse = await request.get('/wp-json/wp/v2/etn?slug=test-gala', {
			headers: {
				Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; '),
			},
		});
		const events = await eventsResponse.json();
		expect(events.length).toBeGreaterThan(0);

		const event = events[0];
		expect(event.meta._soli_scanner_pin).toBe('1234');
	});

	test('scanner PIN can be updated via REST API', async ({ request, page }) => {
		// Log in first to get auth cookies
		const cookies = await page.context().cookies();
		const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

		// Get the test event
		const eventsResponse = await request.get('/wp-json/wp/v2/etn?slug=test-concert', {
			headers: { Cookie: cookieHeader },
		});
		const events = await eventsResponse.json();
		const eventId = events[0].id;

		// Get nonce
		await page.goto('/wp-admin/');
		const nonce = await page.evaluate(() => window.wpApiSettings?.nonce || '');

		// Update PIN via REST
		const updateResponse = await request.post(`/wp-json/wp/v2/etn/${eventId}`, {
			headers: {
				Cookie: cookieHeader,
				'X-WP-Nonce': nonce,
			},
			data: {
				meta: { _soli_scanner_pin: '5678' },
			},
		});
		expect(updateResponse.status()).toBe(200);

		// Verify PIN was saved
		const verifyResponse = await request.get(`/wp-json/wp/v2/etn/${eventId}`, {
			headers: { Cookie: cookieHeader },
		});
		const updated = await verifyResponse.json();
		expect(updated.meta._soli_scanner_pin).toBe('5678');

		// Clean up - remove the PIN
		await request.post(`/wp-json/wp/v2/etn/${eventId}`, {
			headers: {
				Cookie: cookieHeader,
				'X-WP-Nonce': nonce,
			},
			data: {
				meta: { _soli_scanner_pin: '' },
			},
		});
	});
});
