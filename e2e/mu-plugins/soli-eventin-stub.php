<?php
/**
 * Plugin Name: Soli Eventin Stub (e2e only)
 * Description: Registers the Eventin Pro post types the scanner integrates with, so the e2e suite can run without Eventin Pro installed.
 *
 * This file is mounted into wp-content/mu-plugins by wp-env (see the "mappings"
 * key in .wp-env.json). It is never shipped: e2e/** is excluded from the
 * release zip via .zipignore.
 *
 * Registration is guarded by post_type_exists() so that a real Eventin Pro
 * installation always wins.
 *
 * @package Soli\TicketScanner
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action(
	'init',
	function () {
		if ( ! post_type_exists( 'etn' ) ) {
			register_post_type(
				'etn',
				array(
					'label'        => 'Events',
					'public'       => true,
					'show_ui'      => true,
					'show_in_rest' => true,
					'has_archive'  => false,
					'supports'     => array( 'title', 'editor', 'custom-fields' ),
					'rewrite'      => array( 'slug' => 'etn' ),
				)
			);
		}

		if ( ! post_type_exists( 'etn-attendee' ) ) {
			register_post_type(
				'etn-attendee',
				array(
					'label'        => 'Attendees',
					'public'       => true,
					'show_ui'      => true,
					'show_in_rest' => true,
					'has_archive'  => false,
					'supports'     => array( 'title', 'custom-fields' ),
					'rewrite'      => array( 'slug' => 'etn-attendee' ),
				)
			);
		}
	},
	5
);
