<?php

namespace Soli\TicketScanner;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Rewrite {

	public function init(): void {
		add_action( 'init', array( $this, 'register_rewrite_rules' ) );
		add_filter( 'query_vars', array( $this, 'register_query_vars' ) );
		add_action( 'template_redirect', array( $this, 'handle_scanner_request' ) );
	}

	public function register_rewrite_rules(): void {
		add_rewrite_rule(
			'^scanner/([^/]+)/?$',
			'index.php?soli_ticket_scanner_event=$matches[1]',
			'top'
		);
	}

	public function register_query_vars( array $vars ): array {
		$vars[] = 'soli_ticket_scanner_event';
		return $vars;
	}

	public function handle_scanner_request(): void {
		$event_slug = get_query_var( 'soli_ticket_scanner_event' );

		if ( ! $event_slug ) {
			return;
		}

		// Look up the Eventin event by slug
		$event = get_page_by_path( $event_slug, OBJECT, 'etn' );

		if ( ! $event ) {
			global $wp_query;
			$wp_query->set_404();
			status_header( 404 );
			nocache_headers();
			include get_query_template( '404' );
			exit;
		}

		// Get scanner config for this event
		$pin = get_post_meta( $event->ID, '_soli_scanner_pin', true );

		// Pass data to template
		$scanner_data = array(
			'event_id'     => $event->ID,
			'event_title'  => $event->post_title,
			'event_slug'   => $event_slug,
			'pin_required' => ! empty( $pin ),
			'api_base'     => rest_url( 'soli_ticket_scanner/v1' ),
			'api_nonce'    => wp_create_nonce( 'wp_rest' ),
			'worker_url'   => SOLI_TICKET_SCANNER__PLUGIN_DIR_URL . 'assets/js/qr-scanner-worker.min.js',
			'i18n'         => array(
				'checkin' => __( 'Check in', 'soli-ticket-scanner' ),
			),
		);

		include SOLI_TICKET_SCANNER__PLUGIN_DIR_PATH . 'templates/scanner-page.php';
		exit;
	}
}
