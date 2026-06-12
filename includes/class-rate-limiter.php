<?php

namespace Soli\TicketScanner;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Rate_Limiter {

	private const MAX_ATTEMPTS    = 5;
	private const LOCKOUT_SECONDS = 300; // 5 minutes

	/**
	 * Check if the current request is rate-limited.
	 *
	 * @param int $event_id The event post ID.
	 * @return bool True if locked out, false if allowed.
	 */
	public function is_locked_out( int $event_id ): bool {
		$key      = $this->get_transient_key( $event_id );
		$attempts = (int) get_transient( $key );

		return $attempts >= self::MAX_ATTEMPTS;
	}

	/**
	 * Record a failed PIN attempt.
	 *
	 * @param int $event_id The event post ID.
	 */
	public function record_failed_attempt( int $event_id ): void {
		$key      = $this->get_transient_key( $event_id );
		$attempts = (int) get_transient( $key );

		set_transient( $key, $attempts + 1, self::LOCKOUT_SECONDS );
	}

	/**
	 * Reset attempts after successful verification.
	 *
	 * @param int $event_id The event post ID.
	 */
	public function reset( int $event_id ): void {
		$key = $this->get_transient_key( $event_id );
		delete_transient( $key );
	}

	/**
	 * Get remaining attempts before lockout.
	 *
	 * @param int $event_id The event post ID.
	 * @return int Remaining attempts.
	 */
	public function remaining_attempts( int $event_id ): int {
		$key      = $this->get_transient_key( $event_id );
		$attempts = (int) get_transient( $key );

		return max( 0, self::MAX_ATTEMPTS - $attempts );
	}

	/**
	 * Build the transient key from IP + event ID.
	 *
	 * @param int $event_id The event post ID.
	 * @return string Transient key.
	 */
	private function get_transient_key( int $event_id ): string {
		$ip = $this->get_client_ip();
		return 'soli_scanner_pin_attempts_' . md5( $ip . '_' . $event_id );
	}

	/**
	 * Get the client's IP address.
	 *
	 * @return string IP address.
	 */
	private function get_client_ip(): string {
		if ( ! empty( $_SERVER['HTTP_X_FORWARDED_FOR'] ) ) {
			$ips = explode( ',', sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_FORWARDED_FOR'] ) ) );
			return trim( $ips[0] );
		}

		if ( ! empty( $_SERVER['HTTP_X_REAL_IP'] ) ) {
			return sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_REAL_IP'] ) );
		}

		return sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0' ) );
	}
}
