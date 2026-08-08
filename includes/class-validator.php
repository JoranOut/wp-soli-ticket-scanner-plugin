<?php

namespace Soli\TicketScanner;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Validator {

	/**
	 * Look up a ticket without checking in. Read-only.
	 *
	 * @param int    $attendee_id The attendee post ID.
	 * @param string $ticket_id   The ticket identifier string.
	 * @param int    $event_id    The event post ID.
	 * @return array Normalized result with 'status', 'message', and 'attendee' keys.
	 */
	public function lookup_ticket( int $attendee_id, string $ticket_id, int $event_id ): array {
		// Verify the attendee post exists and is the correct type
		$attendee_post = get_post( $attendee_id );
		if ( ! $attendee_post || 'etn-attendee' !== $attendee_post->post_type ) {
			return array(
				'status'   => 'error',
				'message'  => __( 'Attendee not found.', 'soli-ticket-scanner' ),
				'attendee' => null,
			);
		}

		// Verify the attendee belongs to this event
		$attendee_event_id = get_post_meta( $attendee_id, 'etn_event_id', true );
		if ( (int) $attendee_event_id !== $event_id ) {
			return array(
				'status'   => 'error',
				'message'  => __( 'This ticket does not belong to this event.', 'soli-ticket-scanner' ),
				'attendee' => null,
			);
		}

		// Verify ticket ID matches
		$unique_id = get_post_meta( $attendee_id, 'etn_unique_ticket_id', true );
		if ( $unique_id !== $ticket_id ) {
			return array(
				'status'   => 'error',
				'message'  => __( 'Invalid ticket ID.', 'soli-ticket-scanner' ),
				'attendee' => null,
			);
		}

		$attendee_info = $this->get_attendee_info( $attendee_id );

		// Check ticket status (read-only, no state change)
		$ticket_status  = get_post_meta( $attendee_id, 'etn_attendeee_ticket_status', true );
		$payment_status = get_post_meta( $attendee_id, 'etn_status', true );

		if ( 'used' === $ticket_status ) {
			return array(
				'status'   => 'warning',
				'message'  => __( 'Already checked in', 'soli-ticket-scanner' ),
				'attendee' => $attendee_info,
			);
		}

		if ( 'failed' === $payment_status ) {
			return array(
				'status'   => 'error',
				'message'  => __( 'Payment failed', 'soli-ticket-scanner' ),
				'attendee' => $attendee_info,
			);
		}

		return array(
			'status'   => 'valid',
			'message'  => __( 'Ticket is valid', 'soli-ticket-scanner' ),
			'attendee' => $attendee_info,
		);
	}

	/**
	 * Check in a ticket by delegating to Eventin Pro's check_ticket_id().
	 *
	 * @param int    $attendee_id The attendee post ID.
	 * @param string $ticket_id   The ticket identifier string.
	 * @param int    $event_id    The event post ID.
	 * @return array Normalized result with 'status', 'message', and 'attendee' keys.
	 */
	public function checkin_ticket( int $attendee_id, string $ticket_id, int $event_id ): array {
		// Check that Eventin Pro is available
		if ( ! class_exists( '\Etn_Pro\Core\Attendee\Hooks' ) ) {
			return array(
				'status'   => 'error',
				'message'  => __( 'Eventin Pro is not active. Ticket validation unavailable.', 'soli-ticket-scanner' ),
				'attendee' => null,
			);
		}

		// Verify the attendee post exists and is the correct type
		$attendee_post = get_post( $attendee_id );
		if ( ! $attendee_post || 'etn-attendee' !== $attendee_post->post_type ) {
			return array(
				'status'   => 'error',
				'message'  => __( 'Attendee not found.', 'soli-ticket-scanner' ),
				'attendee' => null,
			);
		}

		// Verify the attendee belongs to this event
		$attendee_event_id = get_post_meta( $attendee_id, 'etn_event_id', true );
		if ( (int) $attendee_event_id !== $event_id ) {
			return array(
				'status'   => 'error',
				'message'  => __( 'This ticket does not belong to this event.', 'soli-ticket-scanner' ),
				'attendee' => null,
			);
		}

		// Call Eventin Pro's core validation (no auth checks in this method)
		$etn_hooks = \Etn_Pro\Core\Attendee\Hooks::instance();
		$result    = $etn_hooks->check_ticket_id( $attendee_id, $ticket_id, $event_id );

		// Fetch attendee display info
		$attendee_info = $this->get_attendee_info( $attendee_id );

		// Normalize Eventin's response format
		// update_status: 0/false = invalid, 1 = warning (expired/used/payment failed), 2 = success
		$update_status = $result['update_status'] ?? false;

		if ( 2 === $update_status ) {
			return array(
				'status'   => 'success',
				'message'  => __( 'Ticket is valid', 'soli-ticket-scanner' ),
				'attendee' => $attendee_info,
			);
		}

		if ( 1 === $update_status ) {
			return array(
				'status'   => 'warning',
				'message'  => $result['msg'] ?? __( 'Ticket has a warning.', 'soli-ticket-scanner' ),
				'attendee' => $attendee_info,
			);
		}

		return array(
			'status'   => 'error',
			'message'  => $result['msg'] ?? __( 'Invalid ticket.', 'soli-ticket-scanner' ),
			'attendee' => $attendee_info,
		);
	}

	/**
	 * Get display info for an attendee.
	 *
	 * @param int $attendee_id The attendee post ID.
	 * @return array Attendee display info.
	 */
	private function get_attendee_info( int $attendee_id ): array {
		$first_name  = get_post_meta( $attendee_id, 'etn_name', true );
		$last_name   = get_post_meta( $attendee_id, 'etn_last_name', true );
		$email       = get_post_meta( $attendee_id, 'etn_email', true );
		$ticket_type = get_post_meta( $attendee_id, 'ticket_name', true );

		$name = trim( $first_name . ' ' . $last_name );
		if ( empty( $name ) ) {
			$name = get_the_title( $attendee_id );
		}

		return array(
			'name'        => $name,
			'email'       => $email,
			'ticket_type' => $ticket_type,
		);
	}
}
