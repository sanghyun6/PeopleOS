#!/usr/bin/env bash
# Usage (from project root): CARTESIA_API_KEY=sk_car_... bash agent/setup-cartesia.sh
set -euo pipefail
: "${CARTESIA_API_KEY:?set CARTESIA_API_KEY}"
export CARTESIA_TOOL_SECRET="${CARTESIA_TOOL_SECRET:-$(openssl rand -hex 16)}"
npx convex env set CARTESIA_TOOL_SECRET "$CARTESIA_TOOL_SECRET"
node agent/setup-cartesia.mjs
curl -s https://resolute-horse-290.convex.site/health; echo
