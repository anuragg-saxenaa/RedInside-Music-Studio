#!/usr/bin/env bash
# Force Railway deploy using permanent project token — no login required ever again.
# Usage: bash scripts/railway-deploy.sh
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export RAILWAY_TOKEN=ba3a01ed-9279-4925-b3dc-5444c2eaee12
cd "$SCRIPT_DIR"
railway link --project e4ebb35d-aaa2-4449-9090-650e61a3659c --environment production 2>/dev/null || true
railway up --detach
echo "Deploy triggered. Watch: https://railway.com/project/e4ebb35d-aaa2-4449-9090-650e61a3659c"
