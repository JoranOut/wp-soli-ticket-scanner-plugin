<?php
/**
 * Seeds the fixtures the e2e suite expects into the wp-env tests instance.
 *
 * Run through WP-CLI from .wp-env-setup.sh:
 *   wp-env run tests-cli -- wp eval-file wp-content/soli-e2e/seed-test-data.php
 *
 * Idempotent: re-running updates the existing fixtures instead of creating
 * duplicates (a duplicate would get a "-2" slug and break the specs).
 *
 * Never shipped: e2e/** is excluded from the release zip via .zipignore.
 *
 * @package Soli\TicketScanner
 */

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	exit( 1 );
}

if ( ! post_type_exists( 'etn' ) || ! post_type_exists( 'etn-attendee' ) ) {
	WP_CLI::error( 'The etn/etn-attendee post types are not registered. Is e2e/mu-plugins mapped into wp-content/mu-plugins?' );
}

/**
 * Create or update an event fixture.
 *
 * @param string $slug       Post slug.
 * @param string $title      Post title.
 * @param string $start_date Value for the etn_start_date meta.
 * @param string $pin        Scanner PIN, or an empty string for no PIN.
 * @return int Post ID.
 */
function soli_ticket_scanner_seed_event( string $slug, string $title, string $start_date, string $pin ): int {
	$postarr = array(
		'post_title'  => $title,
		'post_name'   => $slug,
		'post_type'   => 'etn',
		'post_status' => 'publish',
	);

	$existing = get_page_by_path( $slug, OBJECT, 'etn' );
	if ( $existing ) {
		$postarr['ID'] = $existing->ID;
	}

	$post_id = wp_insert_post( $postarr, true );
	if ( is_wp_error( $post_id ) ) {
		WP_CLI::error( sprintf( 'Could not seed event "%s": %s', $slug, $post_id->get_error_message() ) );
	}

	update_post_meta( $post_id, 'etn_start_date', $start_date );

	if ( '' === $pin ) {
		delete_post_meta( $post_id, '_soli_scanner_pin' );
	} else {
		update_post_meta( $post_id, '_soli_scanner_pin', $pin );
	}

	WP_CLI::log( sprintf( 'Seeded event %s (ID %d, pin: %s)', $slug, $post_id, '' === $pin ? 'none' : $pin ) );

	return $post_id;
}

/**
 * Create or update an attendee fixture, keyed on its unique ticket id.
 *
 * @param int   $event_id Event the attendee belongs to.
 * @param array $meta     Attendee meta, including etn_unique_ticket_id.
 * @return int Post ID.
 */
function soli_ticket_scanner_seed_attendee( int $event_id, array $meta ): int {
	$existing = get_posts(
		array(
			'post_type'        => 'etn-attendee',
			'post_status'      => 'publish',
			'posts_per_page'   => 1,
			'fields'           => 'ids',
			'meta_key'         => 'etn_unique_ticket_id',
			'meta_value'       => $meta['etn_unique_ticket_id'],
			'suppress_filters' => false,
		)
	);

	$postarr = array(
		'post_title'  => $meta['etn_name'] . ' ' . $meta['etn_last_name'],
		'post_type'   => 'etn-attendee',
		'post_status' => 'publish',
	);

	if ( $existing ) {
		$postarr['ID'] = $existing[0];
	}

	$post_id = wp_insert_post( $postarr, true );
	if ( is_wp_error( $post_id ) ) {
		WP_CLI::error( sprintf( 'Could not seed attendee "%s": %s', $meta['etn_unique_ticket_id'], $post_id->get_error_message() ) );
	}

	update_post_meta( $post_id, 'etn_event_id', $event_id );
	foreach ( $meta as $key => $value ) {
		update_post_meta( $post_id, $key, $value );
	}

	WP_CLI::log( sprintf( 'Seeded attendee %s (ID %d)', $meta['etn_unique_ticket_id'], $post_id ) );

	return $post_id;
}

$soli_event_no_pin   = soli_ticket_scanner_seed_event( 'test-concert', 'Test Concert', '2026-12-25', '' );
$soli_event_with_pin = soli_ticket_scanner_seed_event( 'test-gala', 'Test Gala', '2026-12-31', '1234' );

soli_ticket_scanner_seed_attendee(
	$soli_event_no_pin,
	array(
		'etn_name'             => 'Jan',
		'etn_last_name'        => 'de Vries',
		'etn_email'            => 'jan@example.com',
		'etn_ticket_name'      => 'Regular',
		'etn_unique_ticket_id' => 'TICKET-001',
	)
);

WP_CLI::success( 'Ticket scanner test data seeded.' );
