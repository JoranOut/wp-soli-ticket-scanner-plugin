<?php

namespace Soli\TicketScanner;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Admin_Fields {

	public function init(): void {
		add_action( 'init', array( $this, 'register_meta' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_scripts' ) );
	}

	/**
	 * Register _soli_scanner_pin as post meta with REST API support.
	 */
	public function register_meta(): void {
		register_post_meta(
			'etn',
			'_soli_scanner_pin',
			array(
				'show_in_rest'  => true,
				'single'        => true,
				'type'          => 'string',
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
			)
		);
	}

	/**
	 * Enqueue admin JS only on the Eventin admin page.
	 */
	public function enqueue_admin_scripts( string $hook ): void {
		// Eventin's admin SPA runs on admin.php?page=eventin
		if ( 'admin_page_eventin' !== $hook && 'toplevel_page_eventin' !== $hook ) {
			return;
		}

		wp_enqueue_script(
			'soli-admin-scanner-fields',
			SOLI_TICKET_SCANNER__PLUGIN_DIR_URL . 'assets/js/admin-scanner-fields.js',
			array(),
			SOLI_TICKET_SCANNER__PLUGIN_VERSION,
			true
		);

		wp_localize_script(
			'soli-admin-scanner-fields',
			'soliScannerAdmin',
			array(
				'restUrl'  => rest_url( 'wp/v2/etn/' ),
				'nonce'    => wp_create_nonce( 'wp_rest' ),
				'homeUrl'  => home_url(),
			)
		);
	}
}
