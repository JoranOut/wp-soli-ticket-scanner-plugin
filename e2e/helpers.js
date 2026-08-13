/**
 * Shared helpers for the Soli Ticket Scanner e2e tests.
 *
 * The suite runs against the wp-env `tests` instance, which `.wp-env-setup.sh`
 * switches to pretty permalinks (`wp rewrite structure`) before any spec runs.
 * That matters twice over here: without rewrite rules both `/scanner/{slug}`
 * and `/wp-json/*` 404 in Apache before WordPress is ever reached, which makes
 * every route assertion in this suite pass for the wrong reason. See
 * `permalinks.spec.js`, which fails loudly if that setup step regresses.
 */

const path = require( 'path' );
const { expect } = require( '@playwright/test' );

const ADMIN_USER = 'admin';
const ADMIN_PASSWORD = 'password';

/**
 * Where the one-and-only admin login stores its cookies.
 *
 * Two browser contexts logging in as the same WordPress user race on that
 * user's `session_tokens` meta, and the loser's auth cookie is rejected —
 * wp-admin bounces it straight back to wp-login.php. With admin-facing specs
 * now spread across two files, `test.describe.configure` cannot prevent that:
 * it only orders tests within a file, while Playwright runs the files in
 * parallel workers.
 *
 * So the suite logs in exactly once, in `auth.setup.js`, and every admin spec
 * reuses the resulting cookies through `test.use({ storageState })`. Public
 * specs deliberately do not opt in — the scanner is anonymous by design.
 */
const ADMIN_STORAGE_STATE = path.join( __dirname, '.auth', 'admin.json' );

/**
 * Fragments of paths that identify this plugin's own PHP files.
 *
 * Used to scope the softer PHP diagnostics (warnings, notices, deprecations) to
 * code this repository owns, so unrelated WordPress core, theme or Eventin
 * stub noise cannot turn CI red. Fatals and parse errors are deliberately not
 * scoped — those are never acceptable, wherever they come from.
 *
 * Covers every PHP file the plugin loads at request time:
 *   - wp-soli-ticket-scanner.php  bootstrap
 *   - includes/class-rewrite.php  /scanner/{slug} route + template include
 *   - includes/class-rest-api.php REST routes
 *   - includes/class-validator.php, class-rate-limiter.php  scan pipeline
 *   - includes/class-admin-fields.php  wp-admin PIN field
 *   - templates/scanner-page.php  the standalone front-end document
 *   - updater.php  loaded in wp-admin only
 */
const PLUGIN_PHP_FILES =
	'wp-soli-ticket-scanner\\.php|' +
	'class-(?:rewrite|rest-api|validator|rate-limiter|admin-fields)\\.php|' +
	'scanner-page\\.php|' +
	'updater\\.php';

/** Diagnostics that are never acceptable, wherever they come from. */
const FATAL_ERROR_PATTERN = /Fatal error|Parse error/i;

/** Softer diagnostics, but only when they point at this plugin's files. */
const PLUGIN_DIAGNOSTIC_PATTERN = new RegExp(
	'(Warning|Notice|Deprecated):[^\\n]*(' + PLUGIN_PHP_FILES + ')',
	'i'
);

/**
 * Reads the body text of the current page twice, for the two assertions below.
 *
 * DO NOT change these reads back to `innerText`. `innerText` is the *rendered*
 * text: it skips anything in a subtree that computes to `display: none` or
 * `visibility: hidden`. That blind spot is specific and load-bearing here —
 * the scanner document ships `#pin-screen` and `#scanner-screen` with the
 * `tw-hidden` class and lets JavaScript reveal the right one. A diagnostic
 * emitted from inside either screen, which is where the template does most of
 * its PHP work, is invisible to an `innerText` assertion and the check passes
 * vacuously. Measured here: the same injected error produced 3 failures via
 * `textContent` and only 2 via `innerText`.
 *
 * `textContent` also returns the source text of `<script>` and `<style>`
 * elements, which `innerText` does not — and that cuts both ways, so the two
 * patterns read different strings.
 *
 * `PLUGIN_DIAGNOSTIC_PATTERN` must NOT see script text. It matches within a
 * single line (`[^\n]*`), and wp-admin prints large one-line JSON blobs into
 * inline script, so a `Warning:` string sitting near a plugin path inside such
 * a blob matches and turns CI red for nothing. This was demonstrated against
 * the old single-read helper in two sibling repos; it is not hypothetical. So
 * the path-scoped assertion reads a body clone with script/style/template/
 * noscript stripped. Scoping the read is the right fix; loosening the pattern
 * to tolerate script noise would blunt the diagnostic itself.
 *
 * `FATAL_ERROR_PATTERN` must see script text. A fatal thrown while an inline
 * script is being printed lands inside that `<script>` node, and a stripped
 * clone would lose it entirely. `Fatal error` / `Parse error` are also far
 * less likely than `Warning:` to occur incidentally in script source.
 *
 * @param {import('@playwright/test').Page} page
 * @return {Promise<{full: string, markup: string}>} Full body text, and body
 *                                                   text with script/style
 *                                                   sources removed.
 */
function readBodyText( page ) {
	return page.evaluate( () => {
		const clone = document.body.cloneNode( true );
		clone
			.querySelectorAll( 'script, style, template, noscript' )
			.forEach( ( node ) => node.remove() );

		return {
			full: document.body.textContent || '',
			markup: clone.textContent || '',
		};
	} );
}

/**
 * Asserts that the currently loaded page contains no PHP diagnostics.
 *
 * `WP_DEBUG` and `WP_DEBUG_DISPLAY` are enabled for the wp-env `tests`
 * environment (see `.wp-env.json`), so PHP diagnostics are printed into the
 * rendered document. Anything PHP emits before `<html>` or inside `<head>` is
 * relocated into the body by the HTML parser, so reading the body catches
 * diagnostics from any point in the request.
 *
 * See `readBodyText()` for why this reads `textContent` and not `innerText`,
 * and why the two assertions read different strings.
 *
 * @param {import('@playwright/test').Page} page
 */
async function expectNoPhpDiagnostics( page ) {
	const url = page.url();
	const { full, markup } = await readBodyText( page );

	expect( full, `PHP fatal/parse error rendered by ${ url }` ).not.toMatch(
		FATAL_ERROR_PATTERN
	);
	expect(
		markup,
		`PHP warning/notice/deprecation from this plugin rendered by ${ url }`
	).not.toMatch( PLUGIN_DIAGNOSTIC_PATTERN );
}

/**
 * Asserts a response body carries no PHP diagnostics.
 *
 * The REST routes return JSON, so there is no document to read. A diagnostic
 * printed before the JSON payload is still visible in the raw body.
 *
 * @param {import('@playwright/test').APIResponse} response
 * @param {string}                                 label Description for failures.
 */
async function expectNoPhpDiagnosticsInBody( response, label ) {
	const body = await response.text();

	expect( body, `PHP fatal/parse error in ${ label }` ).not.toMatch(
		FATAL_ERROR_PATTERN
	);
	expect(
		body,
		`PHP warning/notice/deprecation from this plugin in ${ label }`
	).not.toMatch( PLUGIN_DIAGNOSTIC_PATTERN );
}

/**
 * Logs in as the wp-env administrator.
 *
 * @param {import('@playwright/test').Page} page
 */
async function loginAsAdmin( page ) {
	await page.goto( '/wp-login.php' );
	await page.fill( '#user_login', ADMIN_USER );
	await page.fill( '#user_pass', ADMIN_PASSWORD );
	await page.click( '#wp-submit' );
	await page.waitForURL( /wp-admin/ );
}

/**
 * Resolves a seeded event's post id from its slug.
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string}                                      slug Event slug.
 * @return {Promise<number>} The event post id.
 */
async function eventIdBySlug( request, slug ) {
	const response = await request.get(
		`/wp-json/wp/v2/etn?slug=${ encodeURIComponent( slug ) }`
	);

	if ( ! response.ok() ) {
		throw new Error(
			`Could not look up event "${ slug }": ${ response.status() }. ` +
				'If this is a 404, the tests instance lost its pretty permalinks.'
		);
	}

	const events = await response.json();
	if ( ! Array.isArray( events ) || 0 === events.length ) {
		throw new Error( `No seeded event with slug "${ slug }".` );
	}

	return events[ 0 ].id;
}

module.exports = {
	ADMIN_USER,
	ADMIN_PASSWORD,
	ADMIN_STORAGE_STATE,
	PLUGIN_PHP_FILES,
	FATAL_ERROR_PATTERN,
	PLUGIN_DIAGNOSTIC_PATTERN,
	expectNoPhpDiagnostics,
	expectNoPhpDiagnosticsInBody,
	loginAsAdmin,
	eventIdBySlug,
};
