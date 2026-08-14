[![version](https://img.shields.io/github/package-json/v/JoranOut/wp-soli-ticket-scanner-plugin?label=version&color=3858e9)](https://github.com/JoranOut/wp-soli-ticket-scanner-plugin/releases)
[![nightly](https://img.shields.io/github/v/release/JoranOut/wp-soli-ticket-scanner-plugin?include_prereleases&label=nightly&color=fb8817)](https://github.com/JoranOut/wp-soli-ticket-scanner-plugin/releases)
[![tested up to](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.wordpress.org%2Fcore%2Fversion-check%2F1.7%2F&query=%24.offers%5B0%5D.current&label=tested%20up%20to&prefix=WP%20&color=40a8af)](https://wordpress.org/download/releases/)
[![requires](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FJoranOut%2Fwp-soli-ticket-scanner-plugin%2Fmain%2Fpackage.json&query=%24.wordpress.requiresAtLeast&label=requires&prefix=WP%20&color=40a8af)](https://wordpress.org/download/releases/)
[![wp-env](https://img.shields.io/github/package-json/dependency-version/JoranOut/wp-soli-ticket-scanner-plugin/dev/@wordpress/env?label=wp-env&color=40a8af)](https://www.npmjs.com/package/@wordpress/env)
[![node](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FJoranOut%2Fwp-soli-ticket-scanner-plugin%2Fmain%2Fpackage.json&query=%24.engines.node&label=node&color=43853d)](https://nodejs.org)

# Soli Ticket Scanner

<!-- Machine-readable markers. publish.js reads the plugin name to name the zip,
     and the nightly workflow rewrites the version here when packaging a build.
     Kept in a comment because a single tilde renders as strikethrough on GitHub;
     the badges above are the human-readable version. Do not reformat.
~Plugin Name: wp-soli-ticket-scanner-plugin~
~Current Version:0.1.0~
-->

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

- WordPress 6.9+ (the oldest branch CI exercises; see `wordpress.requiresAtLeast` in package.json)
- PHP 8.2+
- Eventin Pro plugin (active)
