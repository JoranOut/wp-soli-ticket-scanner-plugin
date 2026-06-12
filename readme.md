# Soli Ticket Scanner

~Plugin Name: wp-soli-ticket-scanner-plugin~
~Current Version:0.1.0~

Public-facing QR ticket scanner for Eventin Pro events with optional PIN protection. No login required - designed for volunteers at the door.

## Features

- Public scanner page at `/scanner/{event-slug}/`
- Optional 4-digit PIN protection per event
- QR code scanning via device camera
- Color-coded validation feedback (success/warning/error)
- Rate-limited PIN verification (brute-force protection)
- Admin fields injected into Eventin Pro event editor
- Delegates to Eventin Pro's ticket validation logic

## Requirements

- WordPress 6.0+
- PHP 8.2+
- Eventin Pro plugin (active)
