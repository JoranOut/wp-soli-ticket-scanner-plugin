<?php
/**
 * Standalone scanner page template.
 *
 * Renders a full-screen, mobile-first QR ticket scanner.
 * This is NOT loaded through the WordPress theme — it's a standalone HTML page.
 *
 * @var array $scanner_data Contains event_id, event_title, event_slug, pin_required, api_base, api_nonce.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$plugin_url = SOLI_TICKET_SCANNER__PLUGIN_DIR_URL;
$version    = SOLI_TICKET_SCANNER__PLUGIN_VERSION;
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
	<title><?php echo esc_html( $scanner_data['event_title'] ); ?> — <?php esc_html_e( 'Ticket Scanner', 'soli-ticket-scanner' ); ?></title>
	<link rel="stylesheet" href="<?php echo esc_url( $plugin_url . 'assets/css/scanner.css?v=' . $version ); ?>">
</head>
<body>
	<div id="scanner-app">
		<!-- PIN Screen -->
		<div id="pin-screen" class="tw-hidden">
			<div class="tw-flex tw-flex-col tw-items-center tw-justify-center tw-min-h-screen tw-p-6 tw-bg-base-200">
				<div class="tw-card tw-bg-base-100 tw-shadow-xl tw-w-full tw-max-w-sm">
					<div class="tw-card-body tw-items-center tw-text-center">
						<h2 class="tw-card-title tw-text-xl tw-mb-2"><?php echo esc_html( $scanner_data['event_title'] ); ?></h2>
						<p class="tw-text-base-content/70 tw-mb-4"><?php esc_html_e( 'Enter the 4-digit PIN to access the scanner.', 'soli-ticket-scanner' ); ?></p>

						<div class="tw-flex tw-gap-2 tw-mb-4" id="pin-inputs">
							<input type="tel" maxlength="1" pattern="[0-9]" inputmode="numeric" class="tw-input tw-input-bordered tw-w-14 tw-h-14 tw-text-center tw-text-2xl" data-pin-index="0" autocomplete="off">
							<input type="tel" maxlength="1" pattern="[0-9]" inputmode="numeric" class="tw-input tw-input-bordered tw-w-14 tw-h-14 tw-text-center tw-text-2xl" data-pin-index="1" autocomplete="off">
							<input type="tel" maxlength="1" pattern="[0-9]" inputmode="numeric" class="tw-input tw-input-bordered tw-w-14 tw-h-14 tw-text-center tw-text-2xl" data-pin-index="2" autocomplete="off">
							<input type="tel" maxlength="1" pattern="[0-9]" inputmode="numeric" class="tw-input tw-input-bordered tw-w-14 tw-h-14 tw-text-center tw-text-2xl" data-pin-index="3" autocomplete="off">
						</div>

						<div id="pin-error" class="tw-text-error tw-text-sm tw-mb-2 tw-hidden"></div>

						<button id="pin-submit" class="tw-btn tw-btn-primary tw-w-full tw-text-lg" disabled>
							<?php esc_html_e( 'Verify', 'soli-ticket-scanner' ); ?>
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- Scanner Screen -->
		<div id="scanner-screen" class="tw-hidden">
			<div class="tw-flex tw-flex-col tw-h-screen tw-bg-black">
				<!-- Header -->
				<div class="tw-bg-base-100 tw-p-3 tw-flex tw-items-center tw-justify-between tw-shrink-0">
					<h1 class="tw-text-lg tw-font-bold tw-truncate"><?php echo esc_html( $scanner_data['event_title'] ); ?></h1>
					<span id="scan-count" class="tw-badge tw-badge-neutral">0</span>
				</div>

				<!-- Camera feed -->
				<div class="tw-flex-1 tw-relative tw-overflow-hidden">
					<video id="scanner-video" class="tw-w-full tw-h-full tw-object-cover"></video>

					<!-- Scanning overlay -->
					<div id="scan-overlay" class="tw-absolute tw-inset-0 tw-flex tw-items-center tw-justify-center">
						<div class="tw-border-2 tw-border-white/50 tw-rounded-2xl" style="width: 280px; height: 280px;"></div>
					</div>

					<!-- Camera error -->
					<div id="camera-error" class="tw-hidden tw-absolute tw-inset-0 tw-flex tw-items-center tw-justify-center tw-bg-base-200">
						<div class="tw-text-center tw-p-6">
							<svg xmlns="http://www.w3.org/2000/svg" class="tw-w-16 tw-h-16 tw-mx-auto tw-mb-4 tw-text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
							</svg>
							<p class="tw-text-lg tw-font-semibold tw-mb-2"><?php esc_html_e( 'Camera access required', 'soli-ticket-scanner' ); ?></p>
							<p class="tw-text-base-content/70"><?php esc_html_e( 'Please allow camera access to scan tickets.', 'soli-ticket-scanner' ); ?></p>
						</div>
					</div>
				</div>

				<!-- Result display (overlays bottom of camera) -->
				<div id="result-display" class="tw-hidden tw-absolute tw-bottom-0 tw-left-0 tw-right-0 tw-p-4 tw-z-10">
					<div id="result-card" class="tw-card tw-shadow-2xl">
						<div class="tw-card-body tw-p-4">
							<div class="tw-flex tw-items-start tw-gap-3">
								<div id="result-icon" class="tw-shrink-0 tw-mt-1"></div>
								<div class="tw-flex-1 tw-min-w-0">
									<p id="result-message" class="tw-font-bold tw-text-lg"></p>
									<p id="result-attendee-name" class="tw-text-sm tw-truncate"></p>
								</div>
								<button id="result-dismiss" class="tw-btn tw-btn-ghost tw-btn-sm tw-shrink-0">✕</button>
							</div>
							<button id="result-checkin" class="tw-btn tw-btn-neutral tw-w-full tw-mt-3 tw-hidden tw-text-lg">
								<?php esc_html_e( 'Check in', 'soli-ticket-scanner' ); ?>
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Loading Screen -->
		<div id="loading-screen" class="tw-flex tw-items-center tw-justify-center tw-min-h-screen tw-bg-base-200">
			<span class="tw-loading tw-loading-spinner tw-loading-lg"></span>
		</div>
	</div>

	<script>
		window.soliTicketScanner = <?php echo wp_json_encode( $scanner_data ); ?>;
	</script>
	<script src="<?php echo esc_url( $plugin_url . 'assets/js/qr-scanner.min.js?v=' . $version ); ?>"></script>
	<script src="<?php echo esc_url( $plugin_url . 'assets/js/scanner.js?v=' . $version ); ?>"></script>
</body>
</html>
