const { test, expect } = require('@playwright/test');

test.describe('Scanner Page', () => {
	test('returns 404 for non-existent event slug', async ({ page }) => {
		const response = await page.goto('/scanner/non-existent-event/');
		expect(response.status()).toBe(404);
	});

	test('loads scanner page for valid event without PIN', async ({ page }) => {
		await page.goto('/scanner/test-concert/');

		// Should show the scanner screen (no PIN required)
		await expect(page.locator('#scanner-screen')).toBeVisible({ timeout: 10000 });

		// Should show event title
		await expect(page.locator('h1')).toContainText('Test Concert');
	});

	test('shows PIN screen for PIN-protected event', async ({ page }) => {
		await page.goto('/scanner/test-gala/');

		// Should show the PIN screen
		await expect(page.locator('#pin-screen')).toBeVisible({ timeout: 10000 });

		// Should show event title
		await expect(page.locator('#pin-screen h2')).toContainText('Test Gala');

		// PIN submit should be disabled initially
		await expect(page.locator('#pin-submit')).toBeDisabled();
	});

	test('PIN verification with incorrect PIN shows error', async ({ page }) => {
		await page.goto('/scanner/test-gala/');

		await expect(page.locator('#pin-screen')).toBeVisible({ timeout: 10000 });

		// Enter wrong PIN
		const pinInputs = page.locator('#pin-inputs input');
		await pinInputs.nth(0).fill('9');
		await pinInputs.nth(1).fill('9');
		await pinInputs.nth(2).fill('9');
		await pinInputs.nth(3).fill('9');

		// Submit
		await page.locator('#pin-submit').click();

		// Should show error
		await expect(page.locator('#pin-error')).toBeVisible({ timeout: 5000 });
		await expect(page.locator('#pin-error')).toContainText('Incorrect PIN');
	});

	test('PIN verification with correct PIN proceeds to scanner', async ({ page }) => {
		await page.goto('/scanner/test-gala/');

		await expect(page.locator('#pin-screen')).toBeVisible({ timeout: 10000 });

		// Enter correct PIN
		const pinInputs = page.locator('#pin-inputs input');
		await pinInputs.nth(0).fill('1');
		await pinInputs.nth(1).fill('2');
		await pinInputs.nth(2).fill('3');
		await pinInputs.nth(3).fill('4');

		// Submit
		await page.locator('#pin-submit').click();

		// Should show scanner screen
		await expect(page.locator('#scanner-screen')).toBeVisible({ timeout: 10000 });
	});

	test('scanner page has correct meta viewport for mobile', async ({ page }) => {
		await page.goto('/scanner/test-concert/');

		const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
		expect(viewport).toContain('width=device-width');
		expect(viewport).toContain('user-scalable=no');
	});
});

test.describe('REST API', () => {
	test('GET /event-info returns event data', async ({ request }) => {
		// First we need to find the event ID
		const eventsResponse = await request.get('/wp-json/wp/v2/etn?slug=test-concert');
		const events = await eventsResponse.json();
		expect(events.length).toBeGreaterThan(0);

		const eventId = events[0].id;

		const response = await request.get(`/wp-json/soli_ticket_scanner/v1/event-info/${eventId}`);
		expect(response.status()).toBe(200);

		const data = await response.json();
		expect(data.event_title).toBe('Test Concert');
		expect(data.pin_required).toBe(false);
	});

	test('GET /event-info returns 404 for invalid event', async ({ request }) => {
		const response = await request.get('/wp-json/soli_ticket_scanner/v1/event-info/999999');
		expect(response.status()).toBe(404);
	});

	test('POST /verify-pin rejects incorrect PIN', async ({ request }) => {
		const eventsResponse = await request.get('/wp-json/wp/v2/etn?slug=test-gala');
		const events = await eventsResponse.json();
		const eventId = events[0].id;

		const response = await request.post('/wp-json/soli_ticket_scanner/v1/verify-pin', {
			data: { event_id: eventId, pin: '0000' },
		});
		expect(response.status()).toBe(403);

		const data = await response.json();
		expect(data.valid).toBe(false);
	});

	test('POST /verify-pin accepts correct PIN', async ({ request }) => {
		const eventsResponse = await request.get('/wp-json/wp/v2/etn?slug=test-gala');
		const events = await eventsResponse.json();
		const eventId = events[0].id;

		const response = await request.post('/wp-json/soli_ticket_scanner/v1/verify-pin', {
			data: { event_id: eventId, pin: '1234' },
		});
		expect(response.status()).toBe(200);

		const data = await response.json();
		expect(data.valid).toBe(true);
	});
});
