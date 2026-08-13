/**
 * Asserts the surfaces this plugin renders emit no PHP diagnostics.
 *
 * `WP_DEBUG` and `WP_DEBUG_DISPLAY` are enabled for the tests environment in
 * `.wp-env.json`, so diagnostics are printed into the response. `debug-mode.spec.js`
 * proves that is still true; `permalinks.spec.js` proves the routes below are
 * actually served by WordPress rather than 404ing at Apache. Without both, the
 * assertions here pass without testing anything.
 *
 * Fatals and parse errors are never acceptable, wherever they come from. Softer
 * diagnostics are scoped to this plugin's own files (see `helpers.js`) so that
 * an unrelated core deprecation or a warning from the Eventin stub mu-plugin
 * cannot turn CI red.
 */

const { test, expect } = require( '@playwright/test' );
const {
	expectNoPhpDiagnostics,
	expectNoPhpDiagnosticsInBody,
	eventIdBySlug,
	ADMIN_STORAGE_STATE,
} = require( './helpers' );

test.describe( 'the public scanner renders without PHP errors', () => {
	// Deliberately not logged in. This plugin's whole point is a public,
	// PIN-protected scanner with no WordPress login, so the diagnostics have to
	// be asserted against exactly that: an anonymous visitor. Logging in would
	// exercise a code path real users never hit.

	test( 'on an event with no PIN', async ( { page } ) => {
		await page.goto( '/scanner/test-concert/' );

		// Assert the template really rendered before asserting on its absence
		// of errors — an empty or redirected document would pass vacuously.
		await expect( page.locator( '#scanner-screen' ) ).toBeVisible( {
			timeout: 10000,
		} );
		await expectNoPhpDiagnostics( page );
	} );

	test( 'on a PIN-protected event', async ( { page } ) => {
		await page.goto( '/scanner/test-gala/' );

		await expect( page.locator( '#pin-screen' ) ).toBeVisible( {
			timeout: 10000,
		} );
		await expectNoPhpDiagnostics( page );
	} );

	test( 'after a successful PIN verification', async ( { page } ) => {
		await page.goto( '/scanner/test-gala/' );
		await expect( page.locator( '#pin-screen' ) ).toBeVisible( {
			timeout: 10000,
		} );

		const pinInputs = page.locator( '#pin-inputs input' );
		await pinInputs.nth( 0 ).fill( '1' );
		await pinInputs.nth( 1 ).fill( '2' );
		await pinInputs.nth( 2 ).fill( '3' );
		await pinInputs.nth( 3 ).fill( '4' );
		await page.locator( '#pin-submit' ).click();

		await expect( page.locator( '#scanner-screen' ) ).toBeVisible( {
			timeout: 10000,
		} );

		// The verify-pin round trip runs Rest_API + Rate_Limiter server-side.
		// Diagnostics from those land in the JSON response rather than the
		// document, so check the document has not been polluted either way.
		await expectNoPhpDiagnostics( page );
	} );

	test( 'on the WordPress 404 the scanner route falls back to', async ( {
		page,
	} ) => {
		// Rewrite::handle_scanner_request() sets the 404 itself and includes the
		// theme's 404 template, which is a distinct PHP path from the happy one.
		await page.goto( '/scanner/non-existent-event/' );
		await expectNoPhpDiagnostics( page );
	} );
} );

test.describe( 'the REST routes respond without PHP errors', () => {
	test( 'GET /event-info for a seeded event', async ( { request } ) => {
		const eventId = await eventIdBySlug( request, 'test-concert' );
		const response = await request.get(
			`/wp-json/soli_ticket_scanner/v1/event-info/${ eventId }`
		);

		expect( response.status() ).toBe( 200 );
		await expectNoPhpDiagnosticsInBody( response, 'GET /event-info' );
	} );

	test( 'GET /event-info for a missing event', async ( { request } ) => {
		const response = await request.get(
			'/wp-json/soli_ticket_scanner/v1/event-info/999999'
		);

		expect( response.status() ).toBe( 404 );
		// A WordPress REST 404 carries a JSON error code. An Apache 404 does
		// not, and would make this assertion meaningless.
		const body = await response.json();
		expect( body.code ).toBeTruthy();
		await expectNoPhpDiagnosticsInBody(
			response,
			'GET /event-info (missing event)'
		);
	} );

	test( 'POST /verify-pin with an incorrect PIN', async ( { request } ) => {
		const eventId = await eventIdBySlug( request, 'test-gala' );
		const response = await request.post(
			'/wp-json/soli_ticket_scanner/v1/verify-pin',
			{ data: { event_id: eventId, pin: '0000' } }
		);

		expect( response.status() ).toBe( 403 );
		await expectNoPhpDiagnosticsInBody(
			response,
			'POST /verify-pin (incorrect)'
		);
	} );

	test( 'POST /verify-pin with the correct PIN', async ( { request } ) => {
		const eventId = await eventIdBySlug( request, 'test-gala' );
		const response = await request.post(
			'/wp-json/soli_ticket_scanner/v1/verify-pin',
			{ data: { event_id: eventId, pin: '1234' } }
		);

		expect( response.status() ).toBe( 200 );
		await expectNoPhpDiagnosticsInBody(
			response,
			'POST /verify-pin (correct)'
		);
	} );
} );

test.describe( 'the admin surface renders without PHP errors', () => {
	// Reuse the single admin session from auth.setup.js: concurrent logins as
	// the same user race on session_tokens meta and the loser gets bounced to
	// wp-login.php. See helpers.js.
	test.use( { storageState: ADMIN_STORAGE_STATE } );

	test( 'in the event list table', async ( { page } ) => {
		await page.goto( '/wp-admin/edit.php?post_type=etn' );
		await expectNoPhpDiagnostics( page );
	} );

	test( 'in the editor where Admin_Fields registers the PIN field', async ( {
		page,
	} ) => {
		const eventId = await eventIdBySlug( page.request, 'test-gala' );
		await page.goto( `/wp-admin/post.php?post=${ eventId }&action=edit` );
		await expectNoPhpDiagnostics( page );
	} );

	test( 'on the plugins screen where the updater loads', async ( {
		page,
	} ) => {
		await page.goto( '/wp-admin/plugins.php' );
		await expectNoPhpDiagnostics( page );
	} );
} );
