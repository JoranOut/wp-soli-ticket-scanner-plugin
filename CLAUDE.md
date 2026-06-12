# wp-soli-ticket-scanner-plugin

Public-facing QR ticket scanner for Eventin Pro events with optional PIN protection.

## Purpose

Provides a **public scanner page** at `/scanner/{event-slug}/` that volunteers can use to check in attendees at the door. No WordPress login required — optional 4-digit PIN protection per event.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                wp-soli-ticket-scanner-plugin              │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Rewrite     │  │  REST API    │  │  Admin Fields  │  │
│  │  /scanner/*  │  │  (public)    │  │  (Eventin UI)  │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────────┘  │
│         │                 │                              │
│         ▼                 ▼                              │
│  ┌──────────────┐  ┌──────────────┐                     │
│  │  Scanner     │  │  Validator   │──┐                  │
│  │  Template    │  │  (wrapper)   │  │                  │
│  └──────────────┘  └──────────────┘  │                  │
│                                      │                  │
│                    ┌─────────────────┘                  │
│                    ▼                                     │
│         ┌─────────────────────┐                         │
│         │  Rate Limiter       │                         │
│         │  (PIN brute-force)  │                         │
│         └─────────────────────┘                         │
└──────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│                    Eventin Pro                            │
│                                                          │
│  Etn_Pro\Core\Attendee\Hooks::check_ticket_id()         │
│  (core validation logic — no auth checks)                │
└──────────────────────────────────────────────────────────┘
```

## Plugin Structure

```
wp-soli-ticket-scanner-plugin/
├── wp-soli-ticket-scanner.php     # Main plugin file
├── updater.php                     # GitHub updater
├── uninstall.php                   # Cleanup on uninstall
├── readme.md                       # Version info for updater
├── CLAUDE.md                       # This documentation
├── package.json                    # NPM dependencies
├── tailwind.config.js              # Tailwind + DaisyUI config
├── playwright.config.js            # E2E test configuration
├── build.js                        # JS build script
├── .wp-env.json                    # Local dev environment
├── .wp-env-setup.sh                # Test data seeding
├── includes/
│   ├── class-rewrite.php           # URL routing (/scanner/{slug})
│   ├── class-rest-api.php          # Public REST API endpoints
│   ├── class-validator.php         # Ticket validation wrapper
│   ├── class-rate-limiter.php      # PIN brute-force protection
│   └── class-admin-fields.php      # Eventin admin UI injection
├── templates/
│   └── scanner-page.php            # Standalone scanner HTML page
├── src/
│   ├── css/scanner.css             # Tailwind source CSS
│   └── js/
│       ├── scanner.js              # Scanner page JS
│       └── admin-scanner-fields.js # Admin panel JS injection
├── assets/
│   ├── css/scanner.css             # Compiled CSS
│   └── js/
│       ├── scanner.js              # Scanner JS (built)
│       ├── admin-scanner-fields.js # Admin JS (built)
│       ├── qr-scanner.min.js       # QR library
│       └── qr-scanner-worker.min.js
├── languages/                      # Translation files
└── e2e/                            # Playwright tests
    ├── scanner-page.spec.js
    └── admin-meta-box.spec.js
```

## REST API Endpoints

All endpoints are public (`permission_callback => '__return_true'`).

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/soli_ticket_scanner/v1/event-info/{event_id}` | Event name, date, PIN required |
| POST | `/soli_ticket_scanner/v1/verify-pin` | Verify PIN (rate-limited) |
| POST | `/soli_ticket_scanner/v1/validate` | Validate scanned ticket |

## Post Meta

| Key | Post Type | Description |
|-----|-----------|-------------|
| `_soli_scanner_pin` | `etn` | 4-digit PIN for scanner access (empty = no PIN) |

## Eventin Pro Integration

We delegate to `Etn_Pro\Core\Attendee\Hooks::check_ticket_id()` — the core validation method with NO auth checks. This means:

- We inherit all Eventin Pro validation logic updates automatically
- We don't maintain our own ticket validation business logic
- If Eventin renames/removes this method, the plugin returns a clear error

**We do NOT call** `validate_ticket()` — that method has `is_user_logged_in()` and capability checks.

## Development

### Coding Standards

- Namespace: `Soli\TicketScanner`
- Function prefix: `soli_ticket_scanner_`
- Hook prefix: `soli_ticket_scanner_`
- Text domain: `soli-ticket-scanner`
- Constants: `SOLI_TICKET_SCANNER__*`

### Build

```bash
npm install
npm run build        # Build CSS + copy JS assets
npm run watch        # Watch CSS changes
```

### Testing

```bash
npm run wp-env:start  # Start local WordPress
npm run test:e2e      # Run Playwright tests
```

### Rate Limiting

- Max 5 PIN attempts per IP + event combo
- 5-minute lockout window
- Reset on successful verification
- Uses WordPress transients
