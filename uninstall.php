<?php

namespace Soli\TicketScanner;

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// A second copy of this plugin may still be active - for instance when another
// version is installed alongside this one and this folder is the one being
// deleted. Removing shared data would break that active copy, so bail out.
$soli_ticket_scanner_active = (array) get_option( 'active_plugins', array() );
if ( is_multisite() ) {
	$soli_ticket_scanner_active = array_merge( $soli_ticket_scanner_active, array_keys( (array) get_site_option( 'active_sitewide_plugins', array() ) ) );
}
foreach ( $soli_ticket_scanner_active as $soli_ticket_scanner_active_file ) {
	if ( basename( $soli_ticket_scanner_active_file ) === 'wp-soli-ticket-scanner.php' && dirname( $soli_ticket_scanner_active_file ) !== basename( __DIR__ ) ) {
		return;
	}
}
unset( $soli_ticket_scanner_active, $soli_ticket_scanner_active_file );

global $wpdb;

// Delete scanner PIN meta from all events
$wpdb->query( "DELETE FROM {$wpdb->postmeta} WHERE meta_key = '_soli_scanner_pin'" );

// Delete plugin options
delete_option( 'soli_ticket_scanner_flush_rewrite_rules' );

// Delete rate limiter transients
$wpdb->query(
	"DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_soli_scanner_pin_attempts_%' OR option_name LIKE '_transient_timeout_soli_scanner_pin_attempts_%'"
);
