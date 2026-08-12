/**
 * Logs in as the wp-env administrator once and saves the session.
 *
 * Runs as the `setup` project, which the `chromium` project depends on (see
 * playwright.config.js). Specs that need wp-admin opt in with
 * `test.use({ storageState: ADMIN_STORAGE_STATE })` instead of logging in
 * themselves, which keeps concurrent logins from racing on the user's
 * session_tokens meta. See the note on ADMIN_STORAGE_STATE in helpers.js.
 */

const { test: setup, expect } = require( '@playwright/test' );
const { loginAsAdmin, ADMIN_STORAGE_STATE } = require( './helpers' );

setup( 'authenticate as administrator', async ( { page } ) => {
	await loginAsAdmin( page );

	// Fail here rather than leaving every admin spec to fail on a session that
	// was never established.
	await expect( page.locator( '#wpadminbar' ) ).toBeVisible();

	await page.context().storageState( { path: ADMIN_STORAGE_STATE } );
} );
