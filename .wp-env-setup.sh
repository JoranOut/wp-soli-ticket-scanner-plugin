#!/bin/bash

# Setup test data for the ticket scanner plugin.
# This script runs after wp-env starts (lifecycleScripts.afterStart).

echo "Setting up ticket scanner test data..."

# Flush rewrite rules so /scanner/{slug} works
wp-env run tests cli -- wp rewrite flush

# Register the etn post type if Eventin is not installed (for testing)
wp-env run tests cli -- wp eval '
if ( ! post_type_exists( "etn" ) ) {
    register_post_type( "etn", array(
        "public" => true,
        "label"  => "Events",
        "show_in_rest" => true,
        "supports" => array( "title", "editor", "custom-fields" ),
    ) );
}

if ( ! post_type_exists( "etn-attendee" ) ) {
    register_post_type( "etn-attendee", array(
        "public" => true,
        "label"  => "Attendees",
        "show_in_rest" => true,
        "supports" => array( "title", "custom-fields" ),
    ) );
}

// Create test event without PIN
$event_no_pin = wp_insert_post( array(
    "post_title"  => "Test Concert",
    "post_name"   => "test-concert",
    "post_type"   => "etn",
    "post_status" => "publish",
) );

if ( ! is_wp_error( $event_no_pin ) ) {
    update_post_meta( $event_no_pin, "etn_start_date", "2026-12-25" );
    echo "Created test event (no PIN): " . $event_no_pin . "\n";
}

// Create test event with PIN
$event_with_pin = wp_insert_post( array(
    "post_title"  => "Test Gala",
    "post_name"   => "test-gala",
    "post_type"   => "etn",
    "post_status" => "publish",
) );

if ( ! is_wp_error( $event_with_pin ) ) {
    update_post_meta( $event_with_pin, "etn_start_date", "2026-12-31" );
    update_post_meta( $event_with_pin, "_soli_scanner_pin", "1234" );
    echo "Created test event (with PIN): " . $event_with_pin . "\n";
}

// Create a test attendee for the no-PIN event
$attendee = wp_insert_post( array(
    "post_title"  => "Jan de Vries",
    "post_type"   => "etn-attendee",
    "post_status" => "publish",
) );

if ( ! is_wp_error( $attendee ) && ! is_wp_error( $event_no_pin ) ) {
    update_post_meta( $attendee, "etn_event_id", $event_no_pin );
    update_post_meta( $attendee, "etn_name", "Jan" );
    update_post_meta( $attendee, "etn_last_name", "de Vries" );
    update_post_meta( $attendee, "etn_email", "jan@example.com" );
    update_post_meta( $attendee, "etn_ticket_name", "Regular" );
    update_post_meta( $attendee, "etn_unique_ticket_id", "TICKET-001" );
    echo "Created test attendee: " . $attendee . "\n";
}
'

echo "Test data setup complete."
