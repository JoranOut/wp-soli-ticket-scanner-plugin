/**
 * Guards the other environment assumption this suite rests on.
 *
 * wp-env installs WordPress with plain permalinks, which leaves the site with
 * no rewrite rules at all. Both of this plugin's surfaces are rewrite-based:
 *
 *   - `/scanner/{slug}` is an `add_rewrite_rule()` route, and
 *   - `/wp-json/*` is WordPress's own rewrite-backed REST entry point.
 *
 * With plain permalinks Apache 404s both before WordPress runs. That is
 * quietly catastrophic for the specs rather than obviously broken, because the
 * two shapes this suite uses most both *succeed* against an Apache 404:
 * `expect(response.status()).toBe(404)` passes for entirely the wrong reason,
 * and a "renders no PHP errors" check on a 404 page asserts nothing about the
 * scanner. Both were live in this repo before `.wp-env-setup.sh` started
 * running `wp rewrite structure` (note: through the `tests-cli` container, not
 * `tests`).
 *
 * These tests prove the rewrite rules are actually in place, so a regression
 * in the setup script fails here instead of turning the rest of the suite into
 * a no-op that still reports green.
 */

const { test, expect } = require( '@playwright/test' );

test.describe( 'the tests instance serves rewrite-based routes', () => {
	test( 'the REST API answers under /wp-json/', async ( { request } ) => {
		const response = await request.get( '/wp-json/' );

		expect(
			response.status(),
			'/wp-json/ 404s at Apache when the tests instance falls back to ' +
				'plain permalinks, which makes every REST assertion in this ' +
				'suite vacuous.'
		).toBe( 200 );

		const body = await response.json();
		expect( body.namespaces ).toContain( 'soli_ticket_scanner/v1' );
	} );

	test( 'the scanner route resolves to the plugin template', async ( {
		page,
	} ) => {
		const response = await page.goto( '/scanner/test-concert/' );

		expect(
			response.status(),
			'/scanner/{slug} 404s at Apache without rewrite rules, so a spec ' +
				'that only asserts on a 404 would never reach this plugin.'
		).toBe( 200 );

		// Proof the response is this plugin's standalone template and not the
		// theme's 404 or a generic page: the template is the only thing that
		// renders #scanner-app, and it is served with no theme markup at all.
		await expect( page.locator( '#scanner-app' ) ).toHaveCount( 1 );
		await expect( page.locator( '#scanner-screen' ) ).toHaveCount( 1 );
		// toHaveTitle, not toHaveText on locator('title'): `<title>` is not a
		// rendered element, so toHaveText normalises it to the empty string and
		// the assertion would never match.
		await expect( page ).toHaveTitle( /Test Concert/ );
	} );

	test( 'an unknown scanner slug 404s from WordPress, not Apache', async ( {
		page,
	} ) => {
		const response = await page.goto( '/scanner/non-existent-event/' );

		expect( response.status() ).toBe( 404 );

		// An Apache 404 is a short, theme-less error document. WordPress's own
		// 404 renders through the active theme, so it carries the admin bar
		// stylesheet handle / theme body classes that Apache's never would.
		// Asserting on that is what separates "the route reached the plugin
		// and the plugin declined" from "the URL never reached PHP".
		const body = await page.locator( 'body' ).textContent();
		expect(
			body,
			'Expected the WordPress 404 template, not an Apache error page — ' +
				'the latter means rewrite rules are missing.'
		).not.toMatch( /Apache\/[\d.]+ \(\w+\) Server at/i );
		await expect( page.locator( 'body' ) ).toHaveClass( /error404/ );
	} );
} );
