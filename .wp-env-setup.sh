#!/bin/bash
#
# Prepares the wp-env tests instance for the e2e suite.
# Runs automatically after `wp-env start` (see lifecycleScripts.afterStart in
# .wp-env.json). wp-env hides this script's output unless it is run with
# --debug, and it fails `wp-env start` if the script exits non-zero, so keep
# `set -e` on: a broken fixture must break the start, not pass silently.

set -euo pipefail

echo "Preparing ticket scanner test data..."

# wp-env installs WordPress with plain permalinks, which leaves the site without
# any rewrite rules: /scanner/{slug} and /wp-json/* would both 404 in Apache.
wp-env run tests-cli -- wp rewrite structure '/%postname%/' --hard
wp-env run tests-cli -- wp rewrite flush --hard

# Seed the events/attendee the specs expect. Path comes from the "mappings"
# entry in .wp-env.json, so it does not depend on the checkout directory name.
wp-env run tests-cli -- wp eval-file wp-content/soli-e2e/seed-test-data.php

echo "Test data setup complete."
