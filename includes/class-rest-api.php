<?php

namespace Soli\TicketScanner;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Rest_API {

	private const NAMESPACE = 'soli_ticket_scanner/v1';

	private Validator    $validator;
	private Rate_Limiter $rate_limiter;

	public function __construct() {
		$this->validator    = new Validator();
		$this->rate_limiter = new Rate_Limiter();
	}

	public function init(): void {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	public function register_routes(): void {
		register_rest_route(
			self::NAMESPACE,
			'/event-info/(?P<event_id>\d+)',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_event_info' ),
				'permission_callback' => '__return_true',
				// No validate_callback here: an unknown event in the route path is a
				// missing resource (404 from the callback), not a malformed request.
				'args'                => array(
					'event_id' => array(
						'required'          => true,
						'sanitize_callback' => 'absint',
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/verify-pin',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'verify_pin' ),
				'permission_callback' => '__return_true',
				'args'                => array(
					'event_id' => array(
						'required'          => true,
						'validate_callback' => array( $this, 'validate_event_id' ),
						'sanitize_callback' => 'absint',
					),
					'pin' => array(
						'required'          => true,
						'sanitize_callback' => 'sanitize_text_field',
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/lookup',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'lookup_ticket' ),
				'permission_callback' => '__return_true',
				'args'                => $this->get_ticket_args(),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/checkin',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'checkin_ticket' ),
				'permission_callback' => '__return_true',
				'args'                => $this->get_ticket_args(),
			)
		);
	}

	/**
	 * Shared argument definitions for ticket endpoints.
	 */
	private function get_ticket_args(): array {
		return array(
			'event_id' => array(
				'required'          => true,
				'validate_callback' => array( $this, 'validate_event_id' ),
				'sanitize_callback' => 'absint',
			),
			'attendee_id' => array(
				'required'          => true,
				'sanitize_callback' => 'absint',
			),
			'ticket_id' => array(
				'required'          => true,
				'sanitize_callback' => 'sanitize_text_field',
			),
			'pin' => array(
				'required'          => false,
				'sanitize_callback' => 'sanitize_text_field',
			),
		);
	}

	/**
	 * Validate that an event ID corresponds to an existing etn post.
	 */
	public function validate_event_id( $value ): bool {
		$event = get_post( absint( $value ) );
		return $event && 'etn' === $event->post_type;
	}

	/**
	 * Verify PIN server-side. Returns WP_REST_Response with error on failure, or null on success.
	 */
	private function check_pin( \WP_REST_Request $request ): ?\WP_REST_Response {
		$event_id   = $request->get_param( 'event_id' );
		$pin        = $request->get_param( 'pin' );
		$stored_pin = get_post_meta( $event_id, '_soli_scanner_pin', true );

		if ( ! empty( $stored_pin ) && ( empty( $pin ) || $pin !== $stored_pin ) ) {
			return new \WP_REST_Response(
				array(
					'status'   => 'error',
					'message'  => __( 'Invalid PIN.', 'soli-ticket-scanner' ),
					'attendee' => null,
				),
				403
			);
		}

		return null;
	}

	/**
	 * GET /event-info/{event_id}
	 *
	 * @return \WP_REST_Response|\WP_Error Event data, or a 404 error when the event does not exist.
	 */
	public function get_event_info( \WP_REST_Request $request ) {
		$event_id = $request->get_param( 'event_id' );
		$event    = get_post( $event_id );

		if ( ! $event || 'etn' !== $event->post_type ) {
			return new \WP_Error(
				'soli_ticket_scanner_event_not_found',
				__( 'Event not found.', 'soli-ticket-scanner' ),
				array( 'status' => 404 )
			);
		}

		$pin          = get_post_meta( $event_id, '_soli_scanner_pin', true );
		$event_date   = get_post_meta( $event_id, 'etn_start_date', true );

		return new \WP_REST_Response(
			array(
				'event_id'     => $event_id,
				'event_title'  => $event->post_title,
				'event_date'   => $event_date,
				'pin_required' => ! empty( $pin ),
			),
			200
		);
	}

	/**
	 * POST /verify-pin
	 */
	public function verify_pin( \WP_REST_Request $request ): \WP_REST_Response {
		$event_id = $request->get_param( 'event_id' );
		$pin      = $request->get_param( 'pin' );

		// Check rate limiting
		if ( $this->rate_limiter->is_locked_out( $event_id ) ) {
			return new \WP_REST_Response(
				array(
					'valid'   => false,
					'message' => __( 'Too many attempts. Please try again later.', 'soli-ticket-scanner' ),
				),
				429
			);
		}

		$stored_pin = get_post_meta( $event_id, '_soli_scanner_pin', true );

		// If no PIN is set, access is open
		if ( empty( $stored_pin ) ) {
			return new \WP_REST_Response(
				array(
					'valid'   => true,
					'message' => __( 'No PIN required.', 'soli-ticket-scanner' ),
				),
				200
			);
		}

		if ( $pin === $stored_pin ) {
			$this->rate_limiter->reset( $event_id );

			return new \WP_REST_Response(
				array(
					'valid'   => true,
					'message' => __( 'PIN verified.', 'soli-ticket-scanner' ),
				),
				200
			);
		}

		$this->rate_limiter->record_failed_attempt( $event_id );
		$remaining = $this->rate_limiter->remaining_attempts( $event_id );

		return new \WP_REST_Response(
			array(
				'valid'              => false,
				'message'            => __( 'Incorrect PIN.', 'soli-ticket-scanner' ),
				'remaining_attempts' => $remaining,
			),
			403
		);
	}

	/**
	 * POST /lookup — Read-only ticket info, no check-in.
	 */
	public function lookup_ticket( \WP_REST_Request $request ): \WP_REST_Response {
		$pin_error = $this->check_pin( $request );
		if ( $pin_error ) {
			return $pin_error;
		}

		$result = $this->validator->lookup_ticket(
			$request->get_param( 'attendee_id' ),
			$request->get_param( 'ticket_id' ),
			$request->get_param( 'event_id' )
		);

		$status_code = 'error' === $result['status'] ? 400 : 200;

		return new \WP_REST_Response( $result, $status_code );
	}

	/**
	 * POST /checkin — Actually check in the ticket.
	 */
	public function checkin_ticket( \WP_REST_Request $request ): \WP_REST_Response {
		$pin_error = $this->check_pin( $request );
		if ( $pin_error ) {
			return $pin_error;
		}

		$result = $this->validator->checkin_ticket(
			$request->get_param( 'attendee_id' ),
			$request->get_param( 'ticket_id' ),
			$request->get_param( 'event_id' )
		);

		$status_code = 'error' === $result['status'] ? 400 : 200;

		return new \WP_REST_Response( $result, $status_code );
	}
}
