<?php

namespace Soli\TicketScanner;

/*
  Plugin Name: Soli Ticket Scanner
  Version: 0.1.0
  Author: Joran Out
  Description: Public-facing QR ticket scanner for Eventin Pro events with optional PIN protection
  Requires PHP: 8.2
  Text Domain: soli-ticket-scanner
  Domain Path: /languages
  License: GPL-3.0-or-later
*/

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SOLI_TICKET_SCANNER__PLUGIN_DIR_PATH', plugin_dir_path( __FILE__ ) );
define( 'SOLI_TICKET_SCANNER__PLUGIN_BASENAME', plugin_basename( __FILE__ ) );
define( 'SOLI_TICKET_SCANNER__PLUGIN_DIR_URL', plugin_dir_url( __FILE__ ) );
define( 'SOLI_TICKET_SCANNER__PLUGIN_VERSION', '0.1.0' );

// Load classes
require_once SOLI_TICKET_SCANNER__PLUGIN_DIR_PATH . 'includes/class-rewrite.php';
require_once SOLI_TICKET_SCANNER__PLUGIN_DIR_PATH . 'includes/class-rest-api.php';
require_once SOLI_TICKET_SCANNER__PLUGIN_DIR_PATH . 'includes/class-validator.php';
require_once SOLI_TICKET_SCANNER__PLUGIN_DIR_PATH . 'includes/class-rate-limiter.php';
require_once SOLI_TICKET_SCANNER__PLUGIN_DIR_PATH . 'includes/class-admin-fields.php';

/**
 * Plugin activation hook
 */
function soli_ticket_scanner_activate(): void {
	update_option( 'soli_ticket_scanner_flush_rewrite_rules', true );
}
register_activation_hook( __FILE__, __NAMESPACE__ . '\soli_ticket_scanner_activate' );

/**
 * Flush rewrite rules after activation (runs on init after all plugins loaded)
 */
add_action( 'init', function () {
	if ( get_option( 'soli_ticket_scanner_flush_rewrite_rules' ) ) {
		flush_rewrite_rules();
		delete_option( 'soli_ticket_scanner_flush_rewrite_rules' );
	}
}, 99 );

/**
 * Plugin deactivation hook
 */
function soli_ticket_scanner_deactivate(): void {
	flush_rewrite_rules();
}
register_deactivation_hook( __FILE__, __NAMESPACE__ . '\soli_ticket_scanner_deactivate' );

add_action( 'init', function () {
	load_plugin_textdomain( 'soli-ticket-scanner', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );

	include_once 'updater.php';

	if ( ! defined( 'WP_GITHUB_FORCE_UPDATE' ) ) {
		define( 'WP_GITHUB_FORCE_UPDATE', true );
	}

	if ( is_admin() ) {
		$config = array(
			'slug'               => plugin_basename( __FILE__ ),
			'proper_folder_name' => dirname( plugin_basename( __FILE__ ) ),
			'api_url'            => 'https://api.github.com/repos/JoranOut/wp-soli-ticket-scanner-plugin',
			'raw_url'            => 'https://raw.githubusercontent.com/JoranOut/wp-soli-ticket-scanner-plugin/main',
			'github_url'         => 'https://github.com/JoranOut/wp-soli-ticket-scanner-plugin',
			// Fallback only. The updater resolves the real download from the
			// GitHub releases API and overrides this with the release's zip
			// asset, which is the built tree rather than a bare branch archive.
			'zip_url'            => 'https://github.com/JoranOut/wp-soli-ticket-scanner-plugin/releases/latest/download/wp-soli-ticket-scanner-plugin.zip',
			'sslverify'          => true,
			// Both ends of the supported range are rewritten at packaging time by
			// the nightly and release workflows, from the same two numbers
			// test.yml runs a matrix leg against. Do not reformat: the workflows
			// match these lines with sed.
			'requires'           => '6.9',    // oldest branch the e2e suite covers; see package.json wordpress.requiresAtLeast
			'tested'             => '7.0.4',  // newest release the e2e suite ran against
			'readme'             => 'readme.md',
		);

		new WP_GitHub_Updater( $config );
	}
} );

// Initialize components
$soli_ticket_scanner_rewrite = new Rewrite();
$soli_ticket_scanner_rewrite->init();

$soli_ticket_scanner_rest_api = new Rest_API();
$soli_ticket_scanner_rest_api->init();

$soli_ticket_scanner_admin_fields = new Admin_Fields();
$soli_ticket_scanner_admin_fields->init();
