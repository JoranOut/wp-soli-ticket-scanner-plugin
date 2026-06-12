<?php

namespace Soli\TicketScanner;

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

global $wpdb;

// Delete scanner PIN meta from all events
$wpdb->query( "DELETE FROM {$wpdb->postmeta} WHERE meta_key = '_soli_scanner_pin'" );

// Delete plugin options
delete_option( 'soli_ticket_scanner_flush_rewrite_rules' );

// Delete rate limiter transients
$wpdb->query(
	"DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_soli_scanner_pin_attempts_%' OR option_name LIKE '_transient_timeout_soli_scanner_pin_attempts_%'"
);
